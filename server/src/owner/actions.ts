/**
 * Owner entry point shared by the owner MCP tools and POST /api/owner/actions (the CLI).
 *
 * - Authority: requireCapability on every call (role from the verified credential only).
 * - Shared demo run: owner actions never take the run away from the owner's own agent. They are
 *   refused while an unrelated visitor holds the run, except emergency pause/revoke.
 * - Fund-moving effects (approving a purchase, vault transactions) run under the shared action
 *   mutex, so they never interleave with a payment.
 * - Signing: with server_demo (Testnet default), onchain effects are signed by the labeled
 *   "Demo owner (server-signed, testnet)" key (assertTestnet inside). With local_owner (always on
 *   Mainnet), every effect becomes an owner intent that the owner signs locally.
 */
import { desc } from "drizzle-orm";
import { explorerTxUrl } from "../chain/activity";
import { cachedVault, vaultState } from "../chain/vault";
import { db, schema } from "../db/index";
import { AGENT_HOLDER, DEMO_RUN_LEASE, withActionLock } from "../api/guard";
import { requireCapability, type AuthContext, type Capability } from "../auth/context";
import { demoOwnerAction, DEMO_OWNER_LABEL, isDemoOwnerAction } from "../demo/owner";
import { formatUsdc, suiNetworkLabel } from "../lib/env";
import { currentLease } from "../lib/leases";
import { namespace } from "../memory/memwal";
import { listSuggestions } from "../services/chainEvents";
import { ApiError, getRequest, listRequests, requestView } from "../services/requests";
import { cachedRules, currentSession, defaultThreshold } from "../services/state";
import { applyOffchain, demoOwnerBodyFor, describeOwnerAction, isEmergency, isOnchain, normalizeOwnerAction, type OwnerAction } from "./apply";
import { createIntent, signatureRequired } from "./intents";

const CAP_FOR: Record<OwnerAction["action"], Capability> = {
  decide_request: "owner.decide",
  add_preference: "owner.configure",
  set_preference_enabled: "owner.configure",
  set_threshold: "owner.configure",
  reject_suggestion: "owner.configure",
  accept_suggestion: "owner.configure",
  set_reserve: "owner.configure",
  add_commitment: "owner.configure",
  set_limits: "owner.configure",
  set_agent_permission: "owner.permission",
  start_next_session: "owner.session",
};

/** Refuse when an unrelated visitor holds the shared run (the owner's own agent never blocks the owner). */
async function assertOwnerTurn(ctx: AuthContext, a: OwnerAction): Promise<void> {
  if (isEmergency(a)) return;
  const l = await currentLease(DEMO_RUN_LEASE);
  if (!l || l.holder === AGENT_HOLDER || l.holder === ctx.holder) return;
  const s = Math.max(1, Math.ceil((l.until - Date.now()) / 1000));
  throw new ApiError(423, `Another visitor is running the shared demo. Try again within ${Math.ceil(s / 60)} min.`, "demo_busy");
}

const movesFunds = (a: OwnerAction) => isOnchain(a) || (a.action === "decide_request" && a.decision === "approve");

/**
 * Perform (server_demo) or prepare (local_owner) one owner action. Returns either the effect's
 * result or an owner_signature_required response naming the intent to sign.
 */
export async function performOwnerAction(ctx: AuthContext, name: string, params: Record<string, unknown>) {
  if (ctx.role !== "owner") throw new ApiError(403, "Owner actions need the owner credential.", "not_owner");
  const a = normalizeOwnerAction(name, params);
  requireCapability(ctx, CAP_FOR[a.action]);
  await assertOwnerTurn(ctx, a);

  if (ctx.ownerSigning === "local_owner") {
    const intent = await createIntent(a);
    return signatureRequired(intent);
  }

  const run = async () => {
    if (!isOnchain(a)) return { status: "done" as const, summary: describeOwnerAction(a), result: await applyOffchain(a) };
    const { action, body } = demoOwnerBodyFor(a);
    if (!isDemoOwnerAction(action)) throw new ApiError(500, "unmapped owner action");
    const result = await demoOwnerAction(action, body);
    return { status: "done" as const, summary: describeOwnerAction(a), signer: DEMO_OWNER_LABEL, result };
  };
  if (!movesFunds(a)) return run();
  const locked = await withActionLock(run);
  if (!locked.ok) throw new ApiError(409, "Another payment or vault action is still running. Try again in a moment.", "demo_action_running");
  return locked.value;
}

// --- owner reads ---------------------------------------------------------------------------

export async function ownerStatus(ctx: AuthContext) {
  requireCapability(ctx, "owner.read");
  const [v, session, threshold, rules, held, ns] = await Promise.all([vaultState(), currentSession(), defaultThreshold(), cachedRules(), listRequests(), namespace()]);
  const p = v.policy;
  const now = Date.now();
  return {
    network: suiNetworkLabel(ctx.network),
    owner_signing: ctx.ownerSigning === "server_demo" ? DEMO_OWNER_LABEL : "Owner-signed locally (pnpm sisih sign)",
    session,
    memory_namespace: ns,
    vault: { total_usdc: formatUsdc(v.total), committed_usdc: formatUsdc(v.reserved), free_usdc: formatUsdc(v.free), read_through_tatum_at: new Date(v.readAtMs).toISOString() },
    commitments: v.obligations.map((o) => ({ commitment_id: o.id, name: o.name, target_usdc: formatUsdc(o.target), reserved_usdc: formatUsdc(o.reserve), cadence: o.cadenceLabel, next_due: new Date(Number(o.nextDueMs)).toISOString() })),
    agent_permission: p
      ? { status: p.paused ? "paused" : p.expiresMs <= now ? "expired" : "active", max_per_request_usdc: formatUsdc(p.maxPerRequest), max_per_day_usdc: formatUsdc(p.maxPerDay), expires_at: new Date(p.expiresMs).toISOString() }
      : { status: "revoked" },
    automatic_approval_up_to_usdc: formatUsdc(threshold),
    preferences: rules.map((r) => ({ rule_id: r.id, active: r.active, sentence: r.sentence })),
    held_requests: held.filter((r) => r.status === "held").map((r) => ({ request_id: r.id, merchant: r.merchant, amount_usdc: formatUsdc(BigInt(r.amount)), reason: (JSON.parse(r.reasons) as string[])[0] ?? null })),
  };
}

export async function ownerRequests(ctx: AuthContext, heldOnly: boolean) {
  requireCapability(ctx, "owner.read");
  const rows = (await listRequests(100)).map(requestView);
  return (heldOnly ? rows.filter((r) => r.status === "held") : rows).slice(0, 50).map((r) => ({
    request_id: r.id,
    session: r.session,
    merchant: r.merchant,
    amount_usdc: formatUsdc(BigInt(r.amount)),
    status: r.status,
    decision_code: r.code,
    payment: r.paymentStatus,
    reason: r.reasons[0] ?? null,
    task: r.taskContext,
  }));
}

export async function ownerRequest(ctx: AuthContext, id: string) {
  requireCapability(ctx, "owner.read");
  const r = requestView(await getRequest(id));
  const txs = (await db().select().from(schema.txLog)).filter((t) => t.requestId === id).map((t) => ({ label: t.label, digest: t.digest, status: t.status, explorer_url: explorerTxUrl(t.digest) }));
  return { ...r, amount_usdc: formatUsdc(BigInt(r.amount)), transactions: txs };
}

export async function ownerSuggestions(ctx: AuthContext) {
  requireCapability(ctx, "owner.read");
  return (await listSuggestions()).map((s) => ({ suggestion_id: s.id, status: s.status, commitment_id: s.obligationId, text: s.reason, suggested_target_usdc: formatUsdc(BigInt(s.suggestedTarget)) }));
}

export async function ownerEvidence(ctx: AuthContext) {
  requireCapability(ctx, "owner.read");
  const [txs, mems, ns] = await Promise.all([
    db().select().from(schema.txLog).orderBy(desc(schema.txLog.recordedAt)).limit(20),
    db().select().from(schema.memories).orderBy(desc(schema.memories.createdAt)).limit(30),
    namespace(),
  ]);
  return {
    transactions: txs.map((t) => ({ label: t.label, digest: t.digest, tatum_verification: t.status, explorer_url: explorerTxUrl(t.digest) })),
    memories: mems
      .filter((m) => m.namespace === ns)
      .map((m) => ({ type: m.type, status: m.status, job_id: m.jobId, blob_id: m.blobId, walrus_url: m.blobId ? `https://walruscan.com/mainnet/blob/${m.blobId}` : null })),
    note: "Memory status comes from the Walrus relayer job: writing, stored or failed. Stored means the job finished with a blob id.",
  };
}

void cachedVault;
