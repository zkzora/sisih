/**
 * Walrus Memory (always mainnet). remember() is an async job: a row is "writing" until
 * waitForRememberJob resolves, then "stored" with its blob_id, or "failed" (retryable).
 * The row in Postgres is the job state, so any instance can finish a write another instance
 * started (serverless). Decisions never wait on any of this.
 */
import { randomUUID } from "node:crypto";
import { MemWal, type RecallResult } from "@mysten-incubation/memwal";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "../db/index";
import type { Category, RecalledMemory, Rule } from "../domain/types";
import { background } from "../lib/background";
import { publish } from "../lib/bus";
import { acquireLease } from "../lib/leases";
import { env, formatUsdc, requireEnv } from "../lib/env";
import { parseMemory, serializeMemory, type MemoryType } from "./format";

export const RELAYER_URL = "https://relayer.memory.walrus.xyz";

/** Active namespace: kv override (set by demo reset) or MEMWAL_NAMESPACE. */
export async function namespace(): Promise<string> {
  const [row] = await db().select().from(schema.kv).where(eq(schema.kv.key, "memwal_namespace"));
  return row?.value ?? env("MEMWAL_NAMESPACE") ?? "sisih-demo-1";
}

let client: MemWal | undefined;
function memwal(): MemWal {
  client ??= MemWal.create({ key: requireEnv("MEMWAL_KEY"), accountId: requireEnv("MEMWAL_ACCOUNT_ID"), serverUrl: RELAYER_URL });
  return client;
}

/** Raw client, for bulk writes in scripts (tests at scale). */
export function memwalClient(): MemWal {
  return memwal();
}

export async function delegatePublicKey(): Promise<string> {
  return memwal().getPublicKeyHex();
}

// --- remember -------------------------------------------------------------------------

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

const local = new Map<string, Promise<void>>();

/** Queue a memory. Returns once the "writing" row exists; the Walrus job runs in the background. */
export async function remember(type: MemoryType, sentence: string, payload: object, opts: RememberOptions): Promise<MemoryRow> {
  const id = `mem-${randomUUID().slice(0, 12)}`;
  const text = serializeMemory(type, sentence, payload);
  const ns = await namespace();
  await db().insert(schema.memories).values({
    id,
    type,
    text,
    payload: JSON.stringify(payload, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
    session: opts.session,
    status: "writing",
    namespace: ns,
    usedInDecisions: JSON.stringify(opts.usedIn ?? []),
    createdAt: Date.now(),
  });
  publish("memory.writing", { id, type, text, namespace: ns });
  startJob(id, text, ns);
  return { id, type, text, status: "writing", blobId: null, namespace: ns };
}

// Transitions only leave "writing": two instances finishing the same job never overwrite a result
// or publish it twice.
async function markStored(id: string, blobId: string, jobId: string, ns: string, startedAt: number) {
  const moved = await db()
    .update(schema.memories)
    .set({ status: "stored", blobId, storedAt: Date.now(), error: null })
    .where(and(eq(schema.memories.id, id), eq(schema.memories.status, "writing")))
    .returning({ id: schema.memories.id });
  if (moved.length) publish("memory.stored", { id, blobId, jobId, namespace: ns, ms: Date.now() - startedAt });
}

async function markFailed(id: string, err: unknown) {
  const message = ((err as Error)?.message ?? String(err)).slice(0, 300);
  const moved = await db()
    .update(schema.memories)
    .set({ status: "failed", error: message })
    .where(and(eq(schema.memories.id, id), eq(schema.memories.status, "writing")))
    .returning({ id: schema.memories.id });
  if (moved.length) publish("memory.failed", { id, error: message });
}

/** Submit (if needed) and wait for one memory job; idempotent per row. */
function startJob(id: string, text: string, ns: string, existingJobId?: string | null, startedAt = Date.now()): Promise<void> {
  const running = local.get(id);
  if (running) return running;
  const job = (async () => {
    try {
      let jobId = existingJobId ?? null;
      if (!jobId) {
        const accepted = await memwal().remember(text, ns);
        jobId = accepted.job_id;
        await db().update(schema.memories).set({ jobId }).where(eq(schema.memories.id, id));
      }
      const done = await memwal().waitForRememberJob(jobId, { pollIntervalMs: 2000, timeoutMs: 180_000 });
      await markStored(id, done.blob_id, jobId, ns, startedAt);
    } catch (err) {
      await markFailed(id, err);
    }
  })().finally(() => local.delete(id));
  local.set(id, job);
  background(job); // serverless: keep the function alive until the write settles
  return job;
}

/** Re-run a failed write with the same text. */
export async function retryMemory(id: string): Promise<boolean> {
  const [row] = await db().select().from(schema.memories).where(eq(schema.memories.id, id));
  if (!row || row.status !== "failed") return false;
  await db().update(schema.memories).set({ status: "writing", error: null, jobId: null }).where(eq(schema.memories.id, id));
  publish("memory.writing", { id, type: row.type, text: row.text, namespace: row.namespace, retry: true });
  startJob(id, row.text, row.namespace);
  return true;
}

/**
 * Wait until every memory still "writing" in the active namespace has settled (start_session).
 * Rows started by another instance are resolved here from their Walrus job id.
 */
export async function waitForPendingMemories(): Promise<number> {
  const ns = await namespace();
  const rows = await db().select().from(schema.memories).where(and(eq(schema.memories.status, "writing"), eq(schema.memories.namespace, ns)));
  await Promise.allSettled(rows.map((r) => startJob(r.id, r.text, r.namespace, r.jobId, r.createdAt)));
  return rows.length;
}

/** A row without a job id this old lost its function before Walrus accepted (or before we saved) the job. */
const RESUBMIT_AFTER_MS = 60_000;

export interface ReconcileReport {
  checked: number;
  stored: number;
  failed: number;
  resubmitted: number;
  stillWriting: number;
}

/**
 * Finish writes whose function went away. Runs on the dashboard's poll (GET /api/events ->
 * housekeeping) and on /api/state, so no memory depends on one function staying alive:
 * - job id saved: one status check per poll. done -> stored, failed / not_found -> failed
 *   (retryable from the UI), otherwise left for the next poll. Never a long wait here.
 * - no job id after RESUBMIT_AFTER_MS: one instance (lease memjob:<id>) submits the same text
 *   again and saves the new job id. If the lost function had already been accepted by the
 *   relayer, Walrus may hold the text twice; rules are merged by rule id, so that is harmless.
 */
export async function reconcilePendingMemories(olderThanMs = 15_000, now = Date.now()): Promise<ReconcileReport> {
  const rows = await db().select().from(schema.memories).where(eq(schema.memories.status, "writing"));
  const stale = rows.filter((r) => now - r.createdAt > olderThanMs && !local.has(r.id));
  const report: ReconcileReport = { checked: stale.length, stored: 0, failed: 0, resubmitted: 0, stillWriting: 0 };
  for (const r of stale) {
    try {
      if (r.jobId) {
        const s = await memwal().getRememberStatus(r.jobId);
        if (s.status === "done" && s.blob_id) {
          await markStored(r.id, s.blob_id, r.jobId, r.namespace, r.createdAt);
          report.stored++;
        } else if (s.status === "failed" || s.status === "not_found") {
          await markFailed(r.id, s.error ?? `Walrus job ${s.status}`);
          report.failed++;
        } else report.stillWriting++;
      } else if (now - r.createdAt > RESUBMIT_AFTER_MS) {
        const lease = await acquireLease(`memjob:${r.id}`, randomUUID(), 5 * 60_000);
        if (!lease.acquired) {
          report.stillWriting++;
          continue;
        }
        const accepted = await memwal().remember(r.text, r.namespace);
        const saved = await db()
          .update(schema.memories)
          .set({ jobId: accepted.job_id })
          .where(and(eq(schema.memories.id, r.id), isNull(schema.memories.jobId)))
          .returning({ id: schema.memories.id });
        if (saved.length) publish("memory.resubmitted", { id: r.id, jobId: accepted.job_id });
        report.resubmitted++;
      } else report.stillWriting++;
    } catch (err) {
      console.error(`reconcile ${r.id}:`, (err as Error).message);
      report.stillWriting++;
    }
  }
  return report;
}

export async function pendingMemoryCount(): Promise<number> {
  return (await db().select({ id: schema.memories.id }).from(schema.memories).where(eq(schema.memories.status, "writing"))).length;
}

// --- recall ---------------------------------------------------------------------------

export interface TimedRecall {
  query: string;
  ms: number;
  results: RecalledMemory[];
}

async function toRecalled(r: RecallResult): Promise<RecalledMemory[]> {
  const rows = await db().select({ id: schema.memories.id, blobId: schema.memories.blobId }).from(schema.memories);
  const byBlob = new Map(rows.filter((m) => m.blobId).map((m) => [m.blobId!, m.id]));
  return r.results.map((x) => ({ memoryId: byBlob.get(x.blob_id) ?? null, blobId: x.blob_id, text: x.text, distance: x.distance }));
}

export async function recall(query: string, limit = 5): Promise<TimedRecall> {
  const t0 = Date.now();
  const r = await memwal().recall({ query, limit, namespace: await namespace() });
  return { query, ms: Date.now() - t0, results: await toRecalled(r) };
}

/** Recall context for a payment request. Called in parallel with the decision, never awaited by it. */
export function recallQueryFor(req: { merchant: string; category: Category; amount: bigint; taskContext?: string | null }): string {
  return `${req.merchant} ${req.category} ${formatUsdc(req.amount)} USDC decision or rule${req.taskContext ? `: ${req.taskContext}` : ""}`;
}

// --- rules from Walrus ----------------------------------------------------------------

export interface LoadedRules {
  rules: Rule[];
  /** rule + rule_disabled memories found (union of all strategies) */
  ruleMemories: number;
  /** all memories the broad recall returned */
  recalled: number;
  /** memories in this namespace per listMemories (metadata inventory) */
  inventory: number;
  ms: number;
  warning: string | null;
  /** What each strategy found, so plain recall vs tag queries can be compared. */
  strategies: { name: string; limit: number; returned: number; ruleMemories: number }[];
}

export const RULE_RECALL_LIMIT = 100; // relayer cap

async function namespaceInventory(ns: string): Promise<number> {
  // The relayer's namespace filter returned 0 for every namespace on 2026-11-07, while the
  // unfiltered listing still pages through every memory with its namespace_id; count those.
  let cursor: string | undefined;
  let count = 0;
  for (let page = 0; page < 50; page++) {
    const res = await memwal().listMemories({ cursor, limit: 100 });
    count += res.memories.filter((m) => m.namespace_id === ns).length;
    if (!res.has_more || !res.next_cursor) break;
    cursor = res.next_cursor;
  }
  return count;
}

const isRuleText = (t: string) => t.startsWith("[sisih:v1:rule]") || t.startsWith("[sisih:v1:rule_disabled]");

/**
 * Source of truth for rules at session start. Three recalls with explicit limits, merged by
 * blob id: a broad one (returns everything when the namespace holds <= 100 memories) and two
 * tag queries ("[sisih:v1:rule]", "[sisih:v1:rule_disabled]") that rank rule memories first
 * even in a larger namespace. Disables are applied by rule id. listMemories gives the count
 * so a truncated result is visible.
 */
export async function loadRules(opts: { namespace?: string; limit?: number } = {}): Promise<LoadedRules> {
  const ns = opts.namespace ?? (await namespace());
  const limit = opts.limit ?? RULE_RECALL_LIMIT;
  const t0 = Date.now();
  const queries = [
    { name: "broad", query: "Sisih memory: decision, rule, obligation outcome, reserve change, session summary" },
    { name: "tag:rule", query: "[sisih:v1:rule] Always allow or deny merchant category up to USDC until" },
    { name: "tag:rule_disabled", query: "[sisih:v1:rule_disabled] Rule disabled: Always allow or deny" },
  ];
  const [inventory, ...results] = await Promise.all([
    namespaceInventory(ns),
    ...queries.map((q) => memwal().recall({ query: q.query, limit, namespace: ns })),
  ]);
  const byBlob = new Map<string, { blob_id: string; text: string }>();
  const strategies = queries.map((q, i) => {
    const r = results[i]!;
    for (const hit of r.results) byBlob.set(hit.blob_id, hit);
    return { name: q.name, limit, returned: r.results.length, ruleMemories: r.results.filter((h) => isRuleText(h.text)).length };
  });

  const rules = new Map<string, Rule>();
  const disabled = new Set<string>();
  let ruleMemories = 0;
  for (const hit of byBlob.values()) {
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
  const broad = strategies[0]!.returned;
  const warning =
    inventory > limit
      ? `Namespace holds ${inventory} memories, above the recall limit ${limit}; rules rely on the tag queries.`
      : broad < inventory
        ? `Broad recall returned ${broad} of ${inventory} memories in the namespace.`
        : null;
  return { rules: ordered, ruleMemories, recalled: broad, inventory, ms: Date.now() - t0, warning, strategies };
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
