/** Sessions, the rules cache and settings (Postgres). Walrus is the source of truth for rules. */
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, schema } from "../db/index";
import type { Category, Rule } from "../domain/types";
import { merchantKey } from "../policy/engine";

// --- sessions ---------------------------------------------------------------------------

export async function currentSession(): Promise<number> {
  const [row] = await db().select().from(schema.sessions).orderBy(desc(schema.sessions.n)).limit(1);
  if (row) return row.n;
  await db().insert(schema.sessions).values({ n: 1, startedAt: Date.now() }).onConflictDoNothing();
  return 1;
}

export async function sessionRow(n: number) {
  const [row] = await db().select().from(schema.sessions).where(eq(schema.sessions.n, n));
  return row;
}

// --- settings / kv ----------------------------------------------------------------------

export async function kvRead(key: string): Promise<string | undefined> {
  const [row] = await db().select().from(schema.kv).where(eq(schema.kv.key, key));
  return row?.value;
}

export async function kvSet(key: string, value: string): Promise<void> {
  await db().insert(schema.kv).values({ key, value }).onConflictDoUpdate({ target: schema.kv.key, set: { value } });
}

/**
 * Compare-and-swap: replace the value only if it still equals `expected`. Exactly one concurrent
 * caller wins; returns whether this one did. Used for one-way state transitions (owner intents).
 */
export async function kvCompareAndSet(key: string, expected: string, next: string): Promise<boolean> {
  const moved = await db()
    .update(schema.kv)
    .set({ value: next })
    .where(and(eq(schema.kv.key, key), eq(schema.kv.value, expected)))
    .returning({ key: schema.kv.key });
  return moved.length === 1;
}

export async function kvDelete(key: string): Promise<void> {
  await db().delete(schema.kv).where(eq(schema.kv.key, key));
}

/** Default auto-approve threshold (SPEC: 0.50 USDC). */
export async function defaultThreshold(): Promise<bigint> {
  return BigInt((await kvRead("default_threshold")) ?? "500000");
}

// --- rules cache ------------------------------------------------------------------------

type RuleRow = typeof schema.rulesCache.$inferSelect;

export interface CachedRule extends Rule {
  origin: "local" | "walrus";
  sourceBlobId: string | null;
  timesUsed: number;
  lastUsedAt: number | null;
  createdAt: number;
}

function toRule(r: RuleRow): CachedRule {
  return {
    id: r.id,
    merchant: r.merchant,
    category: r.category as Category,
    maxAmount: BigInt(r.maxAmount),
    action: r.action === "deny" ? "deny" : "allow",
    expiresMs: r.expiresMs,
    active: r.active,
    sentence: r.sentence,
    sourceMemoryId: r.sourceMemoryId,
    sourceBlobId: r.sourceBlobId,
    origin: r.origin === "walrus" ? "walrus" : "local",
    timesUsed: r.timesUsed,
    lastUsedAt: r.lastUsedAt,
    createdAt: r.createdAt,
  };
}

/** Rules ordered oldest first (the engine takes the newest match). */
export async function cachedRules(): Promise<CachedRule[]> {
  return (await db().select().from(schema.rulesCache).orderBy(asc(schema.rulesCache.createdAt))).map(toRule);
}

export async function cachedRule(id: string): Promise<CachedRule | undefined> {
  const [r] = await db().select().from(schema.rulesCache).where(eq(schema.rulesCache.id, id));
  return r ? toRule(r) : undefined;
}

export async function addLocalRule(rule: Omit<Rule, "id" | "active" | "sourceMemoryId">, sourceMemoryId: string, id = `rule-${randomUUID().slice(0, 8)}`): Promise<CachedRule> {
  await db().insert(schema.rulesCache).values({
    id,
    sourceMemoryId,
    sourceBlobId: null,
    merchant: rule.merchant,
    category: rule.category,
    maxAmount: rule.maxAmount.toString(),
    action: rule.action,
    expiresMs: rule.expiresMs,
    active: true,
    sentence: rule.sentence,
    timesUsed: 0,
    lastUsedAt: null,
    origin: "local",
    createdAt: Date.now(),
  });
  return (await cachedRule(id))!;
}

/** Replace the whole cache with rules rebuilt from Walrus (session start). */
export async function replaceRulesFromWalrus(rules: Rule[]): Promise<void> {
  const usage = new Map((await cachedRules()).map((r) => [r.id, r]));
  await db().delete(schema.rulesCache);
  let order = 0;
  for (const r of rules) {
    const prev = usage.get(r.id);
    await db().insert(schema.rulesCache).values({
      id: r.id,
      sourceMemoryId: prev?.sourceMemoryId ?? null,
      sourceBlobId: r.sourceMemoryId,
      merchant: r.merchant,
      category: r.category,
      maxAmount: r.maxAmount.toString(),
      action: r.action,
      expiresMs: r.expiresMs,
      active: r.active,
      sentence: r.sentence,
      timesUsed: prev?.timesUsed ?? 0,
      lastUsedAt: prev?.lastUsedAt ?? null,
      origin: "walrus",
      createdAt: prev?.createdAt ?? Date.now() + order++,
    });
  }
}

export async function setRuleActive(id: string, active: boolean): Promise<void> {
  await db().update(schema.rulesCache).set({ active }).where(eq(schema.rulesCache.id, id));
}

export async function markRulesUsed(ids: string[]): Promise<void> {
  for (const id of ids) {
    const r = await cachedRule(id);
    if (r) await db().update(schema.rulesCache).set({ timesUsed: r.timesUsed + 1, lastUsedAt: Date.now() }).where(eq(schema.rulesCache.id, id));
  }
}

/** Merchants with an earlier request or a rule. */
export async function knownMerchants(): Promise<Set<string>> {
  const fromRequests = (await db().selectDistinct({ m: schema.requests.merchant }).from(schema.requests)).map((r) => r.m);
  const fromRules = (await cachedRules()).map((r) => r.merchant);
  return new Set([...fromRequests, ...fromRules].map(merchantKey));
}
