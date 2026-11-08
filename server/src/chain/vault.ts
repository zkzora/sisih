/**
 * Vault state and vault transactions. Every read goes through lib/tatum.ts.
 *
 * Tatum budget: the cached VaultState is the only source for the API. After each
 * transaction we know about (ours, or a digest posted by the browser) we spend exactly
 * two reads: one GetTransaction (effects + events) and one Vault getObject.
 */
import { Transaction, coinWithBalance } from "@mysten/sui/transactions";
import { SimulationError } from "@mysten/sui/client";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index";
import type { AgentPolicyState, ObligationState, VaultState } from "../domain/types";
import { publish, jsonSafe } from "../lib/bus";
import { hardLimit } from "../policy/engine";
import type { Keypair } from "@mysten/sui/cryptography";
import { setGas, signAndExecuteDetailed, suiClient, UnknownTransactionOutcomeError, verifyTransaction, type CreatedObject, type TxEvent } from "../lib/tatum";
import { keypair } from "../lib/wallets";
import { operatorGasBudget } from "../mainnet/runtime";
import { isMainnet } from "../lib/env";
import { toBase64 } from "@mysten/sui/utils";
import { CLOCK_ID, operatorCapId, target, usdcType, vaultAbortName, vaultId } from "./sisih";

type Json = Record<string, unknown>;

const num = (v: unknown): bigint => {
  if (typeof v === "string" || typeof v === "number" || typeof v === "bigint") return BigInt(v);
  if (v && typeof v === "object" && "value" in v) return num((v as Json).value);
  throw new Error(`not a number: ${JSON.stringify(v)}`);
};

/** Parse the gRPC JSON of a Vault<T> object. */
export function parseVault(objectId: string, v: Json, readAtMs = Date.now()): VaultState {
  const free = num(v.free);
  const contents = ((v.obligations as Json)?.contents ?? []) as Array<{ key: unknown; value: Json }>;
  const obligations: ObligationState[] = contents.map(({ key, value }) => {
    const target = num(value.target);
    const reserve = num(value.reserve);
    return {
      id: Number(num(key)),
      name: String(value.name),
      payee: String(value.payee),
      target,
      reserve,
      kind: Number(value.kind) === 1 ? "usage" : "fixed",
      priority: Number(value.priority) === 0 ? "must" : "important",
      cycleMs: Number(num(value.cycle_ms)),
      nextDueMs: Number(num(value.next_due_ms)),
      cadenceLabel: String(value.cadence_label),
      status: reserve >= target ? "funded" : "underfunded",
    };
  });
  const reserved = obligations.reduce((s, o) => s + o.reserve, 0n);
  const raw = (v.agent_policy as Json | null) ?? null;
  const p = raw && "vec" in raw ? (((raw.vec as Json[]) ?? [])[0] ?? null) : raw;
  const policy: AgentPolicyState | null = p
    ? {
        agent: String(p.agent),
        maxPerRequest: num(p.max_per_request),
        maxPerDay: num(p.max_per_day),
        spentInWindow: num(p.spent_in_window),
        windowStartMs: Number(num(p.window_start_ms)),
        expiresMs: Number(num(p.expires_ms)),
        paused: Boolean(p.paused),
      }
    : null;
  return {
    vaultId: objectId,
    version: Number(v.version),
    owner: String(v.owner),
    free,
    reserved,
    total: free + reserved,
    obligations,
    policy,
    readAtMs,
  };
}

// The vault snapshot lives in Postgres (kv "vault_snapshot") so every serverless instance shares
// one cache: Tatum is read only after a transaction (or on an explicit refresh / first boot).
const SNAPSHOT_KEY = "vault_snapshot";
const ERROR_KEY = "vault_read_error";

function revive(raw: string): VaultState {
  const j = JSON.parse(raw) as Record<string, unknown> & { obligations: Record<string, unknown>[]; policy: Record<string, unknown> | null };
  const big = (v: unknown) => BigInt(String(v));
  return {
    vaultId: String(j.vaultId),
    version: Number(j.version),
    owner: String(j.owner),
    free: big(j.free),
    reserved: big(j.reserved),
    total: big(j.total),
    obligations: j.obligations.map((o) => ({ ...(o as unknown as ObligationState), target: big(o.target), reserve: big(o.reserve) })),
    policy: j.policy
      ? { ...(j.policy as unknown as AgentPolicyState), maxPerRequest: big(j.policy.maxPerRequest), maxPerDay: big(j.policy.maxPerDay), spentInWindow: big(j.policy.spentInWindow) }
      : null,
    readAtMs: Number(j.readAtMs),
  };
}

async function kvGet(key: string): Promise<string | undefined> {
  const [row] = await db().select().from(schema.kv).where(eq(schema.kv.key, key));
  return row?.value;
}

async function kvPut(key: string, value: string): Promise<void> {
  await db().insert(schema.kv).values({ key, value }).onConflictDoUpdate({ target: schema.kv.key, set: { value } });
}

export async function cachedVault(): Promise<VaultState | null> {
  const raw = await kvGet(SNAPSHOT_KEY);
  return raw ? revive(raw) : null;
}

export async function vaultReadError(): Promise<{ at: number; message: string } | null> {
  const raw = await kvGet(ERROR_KEY);
  return raw ? (JSON.parse(raw) as { at: number; message: string }) : null;
}

const sameId = (a: string, b: string) => a.toLowerCase().replace(/^0x0*/, "") === b.toLowerCase().replace(/^0x0*/, "");

/**
 * One Vault getObject through Tatum; updates the shared cache and emits state.changed.
 * With minVersion (from a transaction's effects) it re-reads with backoff until the gateway
 * serves at least that version, so a lagging node never shows a pre-transaction balance.
 */
export async function readVault(minVersion?: string): Promise<VaultState> {
  try {
    let { object } = await suiClient().getObject({ objectId: vaultId(), include: { json: true } });
    for (let i = 0; minVersion && BigInt(object.version) < BigInt(minVersion) && i < 6; i++) {
      await new Promise((r) => setTimeout(r, 700 * (i + 1)));
      ({ object } = await suiClient().getObject({ objectId: vaultId(), include: { json: true } }));
    }
    if (minVersion && BigInt(object.version) < BigInt(minVersion)) {
      publish("state.lagging", { have: object.version, want: minVersion });
    }
    const next = parseVault(object.objectId, object.json as Json);
    const prev = await cachedVault();
    const changed = !prev || JSON.stringify(jsonSafe({ ...prev, readAtMs: 0 })) !== JSON.stringify(jsonSafe({ ...next, readAtMs: 0 }));
    await kvPut(SNAPSHOT_KEY, JSON.stringify(jsonSafe(next)));
    await db().delete(schema.kv).where(eq(schema.kv.key, ERROR_KEY));
    publish(changed ? "state.changed" : "state.verified", jsonSafe(next));
    return next;
  } catch (err) {
    const e = { at: Date.now(), message: (err as Error).message.slice(0, 200) };
    await kvPut(ERROR_KEY, JSON.stringify(e)).catch(() => {});
    publish("state.error", e);
    throw err;
  }
}

export async function vaultState(): Promise<VaultState> {
  return (await cachedVault()) ?? readVault();
}

export interface RecordedTx {
  digest: string;
  status: "verified" | "failed" | "error";
  success: boolean | null;
  checkpoint: string | null;
  timestampMs: number | null;
  events: TxEvent[];
  error: string | null;
  gasMist: bigint | null;
}

/** Who signed a recorded digest: our server keys, the owner wallet, the demo owner key (testnet), or an import. */
export type TxSource = "our" | "owner" | "demo_owner" | "import";

/**
 * Remember a digest and prove it through Tatum: GetTransaction (effects + events), then
 * one vault read. Idempotent per digest (a second call re-reads, the row is updated).
 */
export async function recordTx(
  digest: string,
  meta: { source: TxSource; label?: string; requestId?: string; memoryId?: string; refreshVault?: boolean },
): Promise<RecordedTx> {
  const d = db();
  await d
    .insert(schema.txLog)
    .values({ digest, source: meta.source, label: meta.label ?? null, status: "pending", recordedAt: Date.now(), requestId: meta.requestId ?? null, memoryId: meta.memoryId ?? null })
    .onConflictDoNothing();
  publish("tx.pending", { digest, label: meta.label });
  let rec: RecordedTx;
  let vaultVersion: string | undefined;
  try {
    const v = await verifyTransaction(digest);
    vaultVersion = Object.entries(v.objectVersions).find(([id]) => sameId(id, vaultId()))?.[1];
    rec = { digest, status: v.success ? "verified" : "failed", success: v.success, checkpoint: v.checkpoint, timestampMs: v.timestampMs, events: v.events, error: v.error, gasMist: v.gasMist };
    await d
      .update(schema.txLog)
      .set({
        status: rec.status,
        success: v.success,
        checkpoint: v.checkpoint,
        timestampMs: v.timestampMs,
        events: JSON.stringify(v.events),
        gasMist: v.gasMist.toString(),
        error: v.error,
        ...(meta.label ? { label: meta.label } : {}),
        ...(meta.requestId ? { requestId: meta.requestId } : {}),
        ...(meta.memoryId ? { memoryId: meta.memoryId } : {}),
      })
      .where(eq(schema.txLog.digest, digest));
    publish(v.success ? "tx.confirmed" : "tx.failed", { digest, label: meta.label, checkpoint: v.checkpoint, error: v.error ? vaultAbortName(v.error) : null });
  } catch (err) {
    rec = { digest, status: "error", success: null, checkpoint: null, timestampMs: null, events: [], error: (err as Error).message.slice(0, 200), gasMist: null };
    await d.update(schema.txLog).set({ status: "error", error: rec.error }).where(eq(schema.txLog.digest, digest));
    publish("tx.failed", { digest, label: meta.label, error: rec.error });
  }
  if (meta.refreshVault !== false) await readVault(vaultVersion).catch(() => {});
  return rec;
}

export type WriteResult =
  | { ok: true; digest: string; tx: RecordedTx; created: CreatedObject[] }
  | { ok: false; stage: "precheck" | "dry_run" | "execute" | "unknown"; code: string; reason: string; digest?: string };

const REASONS: Record<string, string> = {
  EExceedsFree: "Amount exceeds free funds. Reserves are locked by the contract.",
  EAgentPaused: "Agent is paused.",
  EAgentExpired: "Agent permission has expired.",
  ENoAgentPolicy: "Agent has no permission.",
  EOverPerRequest: "Amount exceeds the per-request limit.",
  EOverDaily: "Amount exceeds the remaining daily limit.",
  ENotDue: "Obligation is not due yet.",
  EFixedBillMismatch: "A fixed obligation must be billed exactly its amount.",
  EUsageBillTooHigh: "A usage-based bill may be at most 3x its amount.",
  EWrongOperatorCap: "The server operator cap does not match this vault.",
  ENotOwner: "Only the vault owner can do this.",
  EUnknownObligation: "No such obligation.",
};

export function readableAbort(error: string): { code: string; reason: string } {
  const code = vaultAbortName(error);
  return { code, reason: REASONS[code] ?? `Transaction rejected (${code}).` };
}

/** Build, dry-run (SDK resolution simulate), execute, then recordTx. Aborts spend no gas. */
export async function signedWrite(
  signer: Keypair,
  label: string,
  build: (tx: Transaction) => void,
  meta: { requestId?: string; source?: TxSource; budget?: bigint } = {},
): Promise<WriteResult> {
  const tx = new Transaction();
  tx.setSender(signer.toSuiAddress());
  await setGas(tx, { budget: meta.budget ?? 50_000_000n });
  build(tx);
  let res;
  try {
    res = await signAndExecuteDetailed(tx, signer, undefined, isMainnet() && meta.requestId ? async (prepared) => {
      await kvPut(`release_prepared:${meta.requestId}`, JSON.stringify({ digest: prepared.digest, bytes: toBase64(prepared.bytes), signature: prepared.signature }));
    } : undefined);
  } catch (err) {
    if (err instanceof SimulationError || (err as Error)?.name === "SimulationError") {
      const { code, reason } = readableAbort(String((err as Error).message));
      return { ok: false, stage: "dry_run", code, reason };
    }
    if (err instanceof UnknownTransactionOutcomeError) {
      return { ok: false, stage: "unknown", code: "EOutcomeUnknown", reason: "The transaction may have been submitted. Reconcile its known digest before any retry.", digest: err.digest };
    }
    throw err;
  }
  const source = meta.source ?? "our";
  if (!res.success) {
    const { code, reason } = readableAbort(res.error ?? "");
    await recordTx(res.digest, { source, label, requestId: meta.requestId });
    return { ok: false, stage: "execute", code, reason, digest: res.digest };
  }
  const recorded = await recordTx(res.digest, { source, label, requestId: meta.requestId });
  return { ok: true, digest: res.digest, tx: recorded, created: res.created };
}

function operatorWrite(label: string, build: (tx: Transaction) => void, meta: { requestId?: string } = {}): Promise<WriteResult> {
  return signedWrite(keypair("operator"), label, build, { ...meta, budget: operatorGasBudget() });
}

const T = () => [usdcType()];

/** Operator: release free funds to the agent. Pre-checked against the cached vault first. */
export async function releaseToAgent(amount: bigint, requestId: string): Promise<WriteResult> {
  const v = await vaultState();
  const blocked = hardLimit(v, amount, Date.now());
  if (blocked) return { ok: false, stage: "precheck", code: blocked.code, reason: blocked.reason };
  return operatorWrite(
    "Release to agent",
    (tx) =>
      tx.moveCall({
        target: target("release_to_agent"),
        typeArguments: T(),
        arguments: [
          tx.object(vaultId()),
          tx.object(operatorCapId()),
          tx.pure.u64(amount),
          tx.pure.vector("u8", [...new TextEncoder().encode(requestId)]),
          tx.object(CLOCK_ID),
        ],
      }),
    { requestId },
  );
}

/** Operator: pay a due obligation (to its stored payee only). */
export async function payObligation(id: number, bill: bigint): Promise<WriteResult> {
  const v = await vaultState();
  const o = v.obligations.find((x) => x.id === id);
  if (!o) return { ok: false, stage: "precheck", code: "EUnknownObligation", reason: "No such obligation." };
  if (Date.now() < o.nextDueMs) return { ok: false, stage: "precheck", code: "ENotDue", reason: `${o.name} is not due yet.` };
  if (o.kind === "fixed" && bill !== o.target) return { ok: false, stage: "precheck", code: "EFixedBillMismatch", reason: REASONS.EFixedBillMismatch! };
  if (o.kind === "usage" && bill > o.target * 3n) return { ok: false, stage: "precheck", code: "EUsageBillTooHigh", reason: REASONS.EUsageBillTooHigh! };
  return operatorWrite(`Pay obligation: ${o.name}`, (tx) =>
    tx.moveCall({
      target: target("pay_obligation_as_operator"),
      typeArguments: T(),
      arguments: [tx.object(vaultId()), tx.object(operatorCapId()), tx.pure.u64(BigInt(id)), tx.pure.u64(bill), tx.object(CLOCK_ID)],
    }),
  );
}

/** Operator: top up underfunded reserves from free (must first). */
export async function fundReserves(): Promise<WriteResult> {
  return operatorWrite("Fund reserves", (tx) =>
    tx.moveCall({ target: target("fund_reserves_as_operator"), typeArguments: T(), arguments: [tx.object(vaultId()), tx.object(operatorCapId())] }),
  );
}

/** Operator: deposit simulated income (demo) from the operator's own USDC. */
export async function depositIncome(amount: bigint): Promise<WriteResult> {
  return operatorWrite("Deposit (simulated income)", (tx) =>
    tx.moveCall({
      target: target("deposit"),
      typeArguments: T(),
      arguments: [tx.object(vaultId()), coinWithBalance({ type: usdcType(), balance: amount })],
    }),
  );
}

/**
 * initialSharedVersion of the shared vault object, read once through Tatum and cached. Needed to
 * build owner transactions as a fixed transaction kind (owner/tx.ts) on both sides of signing.
 */
export async function vaultSharedVersion(): Promise<string> {
  const key = `vault_shared_version:${vaultId()}`;
  const [row] = await db().select().from(schema.kv).where(eq(schema.kv.key, key));
  if (row) return row.value;
  const { object } = await suiClient().getObject({ objectId: vaultId() });
  const owner = object.owner as { $kind: string; Shared?: { initialSharedVersion: string } };
  if (owner.$kind !== "Shared" || !owner.Shared) throw new Error(`Vault ${vaultId()} is not a shared object`);
  await kvPut(key, owner.Shared.initialSharedVersion);
  return owner.Shared.initialSharedVersion;
}
