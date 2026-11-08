/**
 * Owner intents: how an owner effect is authorized when the owner signs locally (always on
 * Mainnet; on Testnet with SISIH_OWNER_SIGNING=local).
 *
 * 1. An owner-authenticated caller (owner MCP tool or `pnpm sisih <command>`) asks for an action.
 *    Sisih validates it, resolves it against current state and stores a pending intent bound to
 *    the network, package, vault, asset, owner address, a random nonce and a 15-minute expiry. Nothing
 *    happens yet.
 * 2. The owner's local helper (`pnpm sisih sign <intent-id> --yes`) reads the intent, checks it
 *    against its own local configuration and signs it with the owner key, which never leaves the
 *    owner's machine:
 *    - Onchain actions (reserves, commitments, limits, pause/resume/revoke, accepting a
 *      suggestion): the helper builds the vault transaction itself (owner/tx.ts) and signs it.
 *    - Offchain actions (approve/deny, preferences, threshold, rejecting a suggestion, next
 *      session): the helper signs the canonical authorization text (a Sui personal message).
 * 3. Sisih verifies the signature against the configured owner, which must also be the vault's
 *    onchain owner. For a transaction, the signed bytes must match the intent exactly. One intent
 *    is used at most once (compare-and-swap pending -> submitting). Sisih then executes:
 *    - Transactions go through Tatum and are read back through Tatum before state advances.
 *    - Offchain actions run through the same domain functions as everywhere else.
 * If submitting a transaction fails without a clear answer, the intent becomes "unknown" with the
 * locally computed digest. reconcileIntent() looks that digest up through Tatum. A timeout is
 * never treated as failure, and an intent is never re-signed.
 *
 * The owner bearer token only lets a caller create and read intents. It is not a signature.
 */
import { randomBytes } from "node:crypto";
import { verifyPersonalMessageSignature, verifyTransactionSignature } from "@mysten/sui/verify";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { fromBase64 } from "@mysten/sui/utils";
import { cachedVault, vaultState } from "../chain/vault";
import { explorerTxUrl } from "../chain/activity";
import { formatUsdc, isMainnet, suiNetwork } from "../lib/env";
import { assertProofOwnerAction, proofManifest } from "../mainnet/proof-policy";
import { markUnknown, recordSpent, reserveOperation, resolveUnknownSpent } from "../mainnet/budget";
import { mainnetPlanId } from "../mainnet/runtime";
import { executeSigned, verifyTransaction } from "../lib/tatum";
import { ApiError } from "../services/requests";
import { kvCompareAndSet, kvRead, kvSet } from "../services/state";
import { afterOnchain, applyOffchain, describeOwnerAction, isOnchain, ownerTxTarget, resolveOnchainCall, type OwnerAction } from "./apply";
import { assertSignedTxMatches, OWNER_GAS_CAP_MIST, OwnerTxMismatch, txDigestFromBytes, type OwnerCallArgs, type OwnerTxTarget } from "./tx";

export const INTENT_TTL_MS = 15 * 60_000;

export type IntentStatus = "pending" | "submitting" | "executed" | "failed" | "unknown" | "expired";

export interface OwnerIntent {
  v: 1;
  id: string;
  kind: "onchain" | "offchain";
  action: OwnerAction;
  summary: string;
  /** Onchain only: the exact vault call and the config it is built against. */
  call: OwnerCallArgs | null;
  target: OwnerTxTarget;
  gas_cap_mist: string;
  nonce: string;
  created_at: number;
  expires_at: number;
  status: IntentStatus;
  digest: string | null;
  explorer_url: string | null;
  error: string | null;
  result: unknown;
}

const key = (id: string) => `owner_intent:${id}`;

/** What the owner signs for an offchain action. Binds action, parameters, environment, nonce and expiry. */
export function authorizationText(i: Pick<OwnerIntent, "id" | "action" | "target" | "nonce" | "expires_at" | "summary">): string {
  return [
    "Sisih owner authorization",
    `intent: ${i.id}`,
    `network: sui:${i.target.network}`,
    `package: ${i.target.packageId}`,
    `vault: ${i.target.vaultId}`,
    `asset: ${i.target.usdcType}`,
    `owner: ${normalizeSuiAddress(i.target.ownerAddress)}`,
    `action: ${JSON.stringify(i.action)}`,
    `summary: ${i.summary}`,
    `nonce: ${i.nonce}`,
    `expires: ${new Date(i.expires_at).toISOString()}`,
  ].join("\n");
}

/** The configured owner must be the vault's actual onchain owner. */
async function assertOwnerMatchesVault(t: OwnerTxTarget): Promise<void> {
  const v = (await cachedVault()) ?? (await vaultState());
  if (normalizeSuiAddress(v.owner) !== normalizeSuiAddress(t.ownerAddress)) {
    throw new ApiError(409, "The configured owner address is not the vault's onchain owner.", "owner_mismatch");
  }
}

/** Step 1: validate, resolve and store a pending intent. No effect yet. */
export async function createIntent(a: OwnerAction, nowMs = Date.now()): Promise<OwnerIntent> {
  if (isMainnet() && a.action === "decide_request" && a.remember) {
    const m = await proofManifest();
    a = { ...a, max_amount: a.max_amount ?? m.merchant.price_base_units, days: a.days ?? 7 };
  }
  await assertProofOwnerAction(a);
  const target = await ownerTxTarget();
  await assertOwnerMatchesVault(target);
  const onchain = isOnchain(a);
  const intent: OwnerIntent = {
    v: 1,
    id: `oi-${randomBytes(6).toString("hex")}`,
    kind: onchain ? "onchain" : "offchain",
    action: a,
    summary: describeOwnerAction(a),
    call: onchain ? await resolveOnchainCall(a, nowMs) : null,
    target,
    gas_cap_mist: isMainnet() ? (await proofManifest()).operations.find((op) => op.id === "revoke-agent")!.gas_budget_mist : OWNER_GAS_CAP_MIST.toString(),
    nonce: randomBytes(16).toString("hex"),
    created_at: nowMs,
    expires_at: nowMs + INTENT_TTL_MS,
    status: "pending",
    digest: null,
    explorer_url: null,
    error: null,
    result: null,
  };
  await kvSet(key(intent.id), JSON.stringify(intent));
  return intent;
}

export async function getIntent(id: string): Promise<OwnerIntent> {
  if (!/^oi-[0-9a-f]{12}$/.test(id)) throw new ApiError(400, "Not an owner intent id", "bad_id");
  const raw = await kvRead(key(id));
  if (!raw) throw new ApiError(404, `No owner intent ${id}`, "not_found");
  const i = JSON.parse(raw) as OwnerIntent;
  return i.status === "pending" && Date.now() > i.expires_at ? { ...i, status: "expired" } : i;
}

/** One-way transition; false when another caller already moved it. */
async function transition(prev: OwnerIntent, next: OwnerIntent): Promise<boolean> {
  return kvCompareAndSet(key(prev.id), JSON.stringify(prev), JSON.stringify(next));
}

/** The response an owner client gets instead of an effect: what to sign, and how. */
export function signatureRequired(i: OwnerIntent) {
  return {
    status: "owner_signature_required" as const,
    intent_id: i.id,
    kind: i.kind,
    summary: i.summary,
    network: `sui:${i.target.network}`,
    vault: i.target.vaultId,
    expires_at: new Date(i.expires_at).toISOString(),
    sign_with: `pnpm sisih sign ${i.id} --yes`,
    note: "Nothing has changed yet. The owner's local helper checks this intent against its own configuration and signs it with the owner key, which never leaves the owner's machine. `pnpm sisih sign <id>` without --yes only shows the plan.",
  };
}

export interface SubmitInput {
  signature: string;
  /** Onchain intents: base64 transaction bytes the owner built and signed locally. */
  tx_bytes?: string;
}

/** Step 3: verify the owner's signature, use the intent once, execute. */
export async function submitIntent(id: string, input: SubmitInput): Promise<OwnerIntent> {
  const i = await getIntent(id);
  if (i.status === "expired") throw new ApiError(410, "This intent expired. Ask again to create a new one.", "intent_expired");
  if (i.status !== "pending") throw new ApiError(409, `This intent is already ${i.status}; it cannot be used again.`, "intent_used");
  if (i.target.network !== suiNetwork()) throw new ApiError(409, `Intent is for sui:${i.target.network}, this deployment is sui:${suiNetwork()}.`, "wrong_network");
  if (isMainnet()) {
    await assertProofOwnerAction(i.action);
    const current = await ownerTxTarget();
    for (const k of ["packageId", "vaultId", "usdcType", "ownerAddress"] as const) {
      if (current[k].toLowerCase() !== i.target[k].toLowerCase()) throw new ApiError(409, "Deployment changed after this intent was created", "intent_target_changed");
    }
  }
  if (typeof input.signature !== "string" || input.signature.length < 20) throw new ApiError(400, "signature is required", "bad_signature");
  const owner = normalizeSuiAddress(i.target.ownerAddress);

  let txBytes: Uint8Array | null = null;
  try {
    if (i.kind === "onchain") {
      if (!input.tx_bytes) throw new ApiError(400, "tx_bytes (base64) is required for an onchain intent", "bad_tx");
      txBytes = fromBase64(input.tx_bytes);
      await assertSignedTxMatches(txBytes, i.target, i.call!, BigInt(i.gas_cap_mist));
      await verifyTransactionSignature(txBytes, input.signature, { address: owner });
    } else {
      await verifyPersonalMessageSignature(new TextEncoder().encode(authorizationText(i)), input.signature, { address: owner });
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof OwnerTxMismatch) throw new ApiError(422, err.message, "intent_mismatch");
    throw new ApiError(401, "The signature is not the vault owner's signature over this intent.", "bad_signature");
  }
  await assertOwnerMatchesVault(i.target);

  // Use the intent once: exactly one submitter wins.
  if (isMainnet() && txBytes) {
    await reserveOperation(`owner-intent:${i.id}`, `${mainnetPlanId()}:owner-runtime-gas`, BigInt(i.gas_cap_mist));
  }
  const submitting: OwnerIntent = { ...i, status: "submitting", digest: txBytes ? txDigestFromBytes(txBytes) : null };
  if (!(await transition(i, submitting))) throw new ApiError(409, "This intent was already submitted.", "intent_used");

  if (i.kind === "offchain") {
    try {
      const result = await applyOffchain(i.action);
      const done: OwnerIntent = { ...submitting, status: "executed", result };
      await transition(submitting, done);
      return done;
    } catch (err) {
      const failed: OwnerIntent = { ...submitting, status: "failed", error: (err as Error).message.slice(0, 300) };
      await transition(submitting, failed);
      throw err;
    }
  }

  // Onchain: submit through Tatum. Any transport error leaves the outcome unknown, not failed.
  let executed;
  try {
    executed = await executeSigned(txBytes!, input.signature, i.target.network);
  } catch (err) {
    if (isMainnet()) await markUnknown(`owner-intent:${i.id}`, submitting.digest!);
    const unknown: OwnerIntent = {
      ...submitting,
      status: "unknown",
      explorer_url: explorerTxUrl(submitting.digest!, i.target.network),
      error: `Submission outcome unknown (${(err as Error).message.slice(0, 160)}). Do not sign again; run pnpm sisih reconcile ${i.id}.`,
    };
    await transition(submitting, unknown);
    return unknown;
  }
  return finishOnchain(submitting, executed.digest, executed.success, executed.error);
}

async function finishOnchain(prev: OwnerIntent, digest: string, success: boolean, error: string | null): Promise<OwnerIntent> {
  if (isMainnet()) {
    const verified = await verifyTransaction(digest, { network: "mainnet", tries: 3 });
    success = verified.success;
    error = verified.error;
    const operation = await import("../mainnet/budget").then((m) => m.getOperation(`owner-intent:${prev.id}`));
    if (operation?.status === "unknown") await resolveUnknownSpent(`owner-intent:${prev.id}`, verified.gasMist < 0n ? 0n : verified.gasMist, digest);
    else await recordSpent(`owner-intent:${prev.id}`, verified.gasMist < 0n ? 0n : verified.gasMist, digest);
  }
  if (!success) {
    const failed: OwnerIntent = { ...prev, status: "failed", digest, explorer_url: explorerTxUrl(digest, prev.target.network), error: error ?? "aborted" };
    await transition(prev, failed);
    return failed;
  }
  const result = await afterOnchain(prev.action, digest, `${prev.summary} (owner-signed)`);
  const done: OwnerIntent = { ...prev, status: "executed", digest, explorer_url: explorerTxUrl(digest, prev.target.network), result };
  await transition(prev, done);
  return done;
}

/** Look an unknown (or submitting) intent's digest up through Tatum and settle its status. Never re-signs or re-submits. */
export async function reconcileIntent(id: string): Promise<OwnerIntent> {
  const i = await getIntent(id);
  if (i.status !== "unknown" && i.status !== "submitting") return i;
  if (!i.digest) return i;
  try {
    const v = await verifyTransaction(i.digest, { network: i.target.network, tries: 3 });
    return finishOnchain(i, i.digest, v.success, v.success ? null : "aborted onchain");
  } catch {
    return { ...i, error: `Digest ${i.digest} is not visible through Tatum yet. It may still land; check again later. Do not sign this action again while it is unknown.` };
  }
}

/** Compact view for listings. */
export function intentView(i: OwnerIntent) {
  return {
    intent_id: i.id,
    kind: i.kind,
    summary: i.summary,
    status: i.status,
    network: `sui:${i.target.network}`,
    digest: i.digest,
    explorer_url: i.explorer_url,
    error: i.error,
    expires_at: new Date(i.expires_at).toISOString(),
    gas_cap_sui: (Number(i.gas_cap_mist) / 1e9).toFixed(3),
  };
}

void formatUsdc;
