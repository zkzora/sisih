/**
 * Walrus Memory (always mainnet). remember() is an async job: a row is "writing" until
 * waitForRememberJob resolves, then "stored" with its blob_id, or "failed" (retryable).
 * Decisions never wait on any of this.
 */
import { randomUUID } from "node:crypto";
import { MemWal, type RecallResult } from "@mysten-incubation/memwal";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import type { Category, RecalledMemory, Rule } from "../domain/types.js";
import { publish } from "../lib/bus.js";
import { env, formatUsdc, requireEnv } from "../lib/env.js";
import { parseMemory, serializeMemory, type MemoryType } from "./format.js";

export const RELAYER_URL = "https://relayer.memory.walrus.xyz";

/** Active namespace: kv override (set by demo reset) or MEMWAL_NAMESPACE. */
export function namespace(): string {
  const row = db().select().from(schema.kv).where(eq(schema.kv.key, "memwal_namespace")).get();
  return row?.value ?? env("MEMWAL_NAMESPACE") ?? "sisih-demo-1";
}

let client: MemWal | undefined;
function memwal(): MemWal {
  client ??= MemWal.create({ key: requireEnv("MEMWAL_KEY"), accountId: requireEnv("MEMWAL_ACCOUNT_ID"), serverUrl: RELAYER_URL });
  return client;
}

export async function delegatePublicKey(): Promise<string> {
  return memwal().getPublicKeyHex();
}

// --- remember -------------------------------------------------------------------------

const pending = new Map<string, Promise<void>>();

export interface RememberOptions {
  session: number;
  usedIn?: string[];
}

export interface MemoryRow {
  id: string;
  type: MemoryType;
  text: string;
  status: "writing" | "stored" | "failed";
  blobId: string | null;
  namespace: string;
}

/** Queue a memory. Returns immediately with the "writing" row; the job runs in the background. */
export function remember(type: MemoryType, sentence: string, payload: object, opts: RememberOptions): MemoryRow {
  const id = `mem-${randomUUID().slice(0, 12)}`;
  const text = serializeMemory(type, sentence, payload);
  const ns = namespace();
  const now = Date.now();
  db().insert(schema.memories)
    .values({ id, type, text, payload: JSON.stringify(payload, (_k, v) => (typeof v === "bigint" ? v.toString() : v)), session: opts.session, status: "writing", namespace: ns, usedInDecisions: JSON.stringify(opts.usedIn ?? []), createdAt: now })
    .run();
  publish("memory.writing", { id, type, text, namespace: ns });
  startJob(id, text, ns);
  return { id, type, text, status: "writing", blobId: null, namespace: ns };
}

function startJob(id: string, text: string, ns: string): void {
  const job = (async () => {
    const t0 = Date.now();
    try {
      const accepted = await memwal().remember(text, ns);
      db().update(schema.memories).set({ jobId: accepted.job_id }).where(eq(schema.memories.id, id)).run();
      const done = await memwal().waitForRememberJob(accepted.job_id, { pollIntervalMs: 2000, timeoutMs: 180_000 });
      db().update(schema.memories).set({ status: "stored", blobId: done.blob_id, storedAt: Date.now(), error: null }).where(eq(schema.memories.id, id)).run();
      publish("memory.stored", { id, blobId: done.blob_id, jobId: accepted.job_id, namespace: ns, ms: Date.now() - t0 });
    } catch (err) {
      const message = (err as Error).message.slice(0, 300);
      db().update(schema.memories).set({ status: "failed", error: message }).where(eq(schema.memories.id, id)).run();
      publish("memory.failed", { id, error: message });
    }
  })().finally(() => pending.delete(id));
  pending.set(id, job);
}

/** Re-run a failed write with the same text. */
export function retryMemory(id: string): boolean {
  const row = db().select().from(schema.memories).where(eq(schema.memories.id, id)).get();
  if (!row || row.status !== "failed") return false;
  db().update(schema.memories).set({ status: "writing", error: null, jobId: null }).where(eq(schema.memories.id, id)).run();
  publish("memory.writing", { id, type: row.type, text: row.text, namespace: row.namespace, retry: true });
  startJob(id, row.text, row.namespace);
  return true;
}

/** Wait until every queued remember job has finished (start_session uses this). */
export async function waitForPendingMemories(): Promise<number> {
  const jobs = [...pending.values()];
  await Promise.allSettled(jobs);
  return jobs.length;
}

export function pendingMemoryCount(): number {
  return pending.size;
}

// --- recall ---------------------------------------------------------------------------

export interface TimedRecall {
  query: string;
  ms: number;
  results: RecalledMemory[];
}

function toRecalled(r: RecallResult): RecalledMemory[] {
  const byBlob = new Map(
    db().select({ id: schema.memories.id, blobId: schema.memories.blobId }).from(schema.memories).all().filter((m) => m.blobId).map((m) => [m.blobId!, m.id]),
  );
  return r.results.map((x) => ({ memoryId: byBlob.get(x.blob_id) ?? null, blobId: x.blob_id, text: x.text, distance: x.distance }));
}

export async function recall(query: string, limit = 5): Promise<TimedRecall> {
  const t0 = Date.now();
  const r = await memwal().recall({ query, limit, namespace: namespace() });
  return { query, ms: Date.now() - t0, results: toRecalled(r) };
}

/** Recall context for a payment request. Called in parallel with the decision, never awaited by it. */
export function recallQueryFor(req: { merchant: string; category: Category; amount: bigint; taskContext?: string | null }): string {
  return `${req.merchant} ${req.category} ${formatUsdc(req.amount)} USDC decision or rule${req.taskContext ? `: ${req.taskContext}` : ""}`;
}

// --- rules from Walrus ----------------------------------------------------------------

export interface LoadedRules {
  rules: Rule[];
  /** rule + rule_disabled memories seen in recall */
  ruleMemories: number;
  /** all memories recall returned */
  recalled: number;
  /** memories in this namespace per listMemories (metadata inventory) */
  inventory: number;
  ms: number;
  warning: string | null;
}

async function namespaceInventory(ns: string): Promise<number> {
  let cursor: string | undefined;
  let count = 0;
  for (let page = 0; page < 20; page++) {
    const res = await memwal().listMemories({ cursor, namespace: ns, limit: 100 });
    count += res.memories.filter((m) => m.namespace_id === ns).length;
    if (!res.has_more || !res.next_cursor) break;
    cursor = res.next_cursor;
  }
  return count;
}

/**
 * Source of truth for rules at session start. One recall (relayer cap 100) returns every
 * memory of a demo namespace; rule memories are parsed and disables applied. The count is
 * cross-checked against listMemories so a truncated recall is visible.
 */
export async function loadRules(): Promise<LoadedRules> {
  const ns = namespace();
  const t0 = Date.now();
  const [r, inventory] = await Promise.all([
    memwal().recall({ query: "[sisih:v1:rule] always allow or deny merchant category up to USDC until", limit: 100, namespace: ns }),
    namespaceInventory(ns),
  ]);
  const rules = new Map<string, Rule>();
  const disabled = new Set<string>();
  let ruleMemories = 0;
  for (const hit of r.results) {
    const m = parseMemory(hit.text);
    if (!m) continue;
    if (m.type === "rule_disabled") {
      ruleMemories++;
      disabled.add(String(m.payload.ruleId));
    } else if (m.type === "rule") {
      ruleMemories++;
      const p = m.payload;
      const ruleId = String(p.ruleId);
      rules.set(ruleId, {
        id: ruleId,
        merchant: String(p.merchant),
        category: String(p.category) as Category,
        maxAmount: BigInt(String(p.maxAmount)),
        action: p.action === "deny" ? "deny" : "allow",
        expiresMs: Number(p.expiresMs),
        active: true,
        sentence: m.sentence,
        sourceMemoryId: hit.blob_id, // blob id is the durable reference on Walrus
      });
    }
  }
  for (const id of disabled) {
    const rule = rules.get(id);
    if (rule) rule.active = false;
  }
  const ordered = [...rules.values()].sort((a, b) => a.expiresMs - b.expiresMs);
  const warning =
    inventory > 100
      ? `Namespace holds ${inventory} memories; recall returns at most 100, so older rules may be missed.`
      : r.results.length < inventory
        ? `Recall returned ${r.results.length} of ${inventory} memories in the namespace.`
        : null;
  return { rules: ordered, ruleMemories, recalled: r.results.length, inventory, ms: Date.now() - t0, warning };
}

// --- health ---------------------------------------------------------------------------

let healthCache: { at: number; value: { ok: boolean; status: string; ms: number; error?: string } } | undefined;

export async function memwalHealth(): Promise<{ ok: boolean; status: string; ms: number; error?: string }> {
  if (healthCache && Date.now() - healthCache.at < 30_000) return healthCache.value;
  const t0 = Date.now();
  try {
    const h = await memwal().health();
    healthCache = { at: Date.now(), value: { ok: h.status === "ok", status: h.status, ms: Date.now() - t0 } };
  } catch (err) {
    healthCache = { at: Date.now(), value: { ok: false, status: "error", ms: Date.now() - t0, error: (err as Error).message.slice(0, 200) } };
  }
  return healthCache.value;
}
