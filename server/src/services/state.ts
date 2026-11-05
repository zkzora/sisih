/** Sessions, the rules cache and settings. All local (SQLite); Walrus is the source of truth for rules. */
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import type { Category, Rule } from "../domain/types.js";
import { merchantKey } from "../policy/engine.js";

// --- sessions ---------------------------------------------------------------------------

export function currentSession(): number {
  const row = db().select().from(schema.sessions).orderBy(desc(schema.sessions.n)).limit(1).get();
  if (row) return row.n;
  db().insert(schema.sessions).values({ n: 1, startedAt: Date.now() }).run();
  return 1;
}

export function sessionRow(n: number) {
  return db().select().from(schema.sessions).where(eq(schema.sessions.n, n)).get();
}

// --- settings ---------------------------------------------------------------------------

function kvGet(key: string): string | undefined {
  return db().select().from(schema.kv).where(eq(schema.kv.key, key)).get()?.value;
}

export function kvSet(key: string, value: string): void {
  db().insert(schema.kv).values({ key, value }).onConflictDoUpdate({ target: schema.kv.key, set: { value } }).run();
}

export function kvRead(key: string): string | undefined {
  return kvGet(key);
}

/** Default auto-approve threshold (SPEC: 0.50 USDC). */
export function defaultThreshold(): bigint {
  return BigInt(kvGet("default_threshold") ?? "500000");
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
export function cachedRules(): CachedRule[] {
  return db().select().from(schema.rulesCache).orderBy(schema.rulesCache.createdAt).all().map(toRule);
}

export function cachedRule(id: string): CachedRule | undefined {
  const r = db().select().from(schema.rulesCache).where(eq(schema.rulesCache.id, id)).get();
  return r ? toRule(r) : undefined;
}

export function addLocalRule(rule: Omit<Rule, "id" | "active" | "sourceMemoryId">, sourceMemoryId: string, id = `rule-${randomUUID().slice(0, 8)}`): CachedRule {
  const now = Date.now();
  db().insert(schema.rulesCache)
    .values({ id, sourceMemoryId, sourceBlobId: null, merchant: rule.merchant, category: rule.category, maxAmount: rule.maxAmount.toString(), action: rule.action, expiresMs: rule.expiresMs, active: true, sentence: rule.sentence, timesUsed: 0, lastUsedAt: null, origin: "local", createdAt: now })
    .run();
  return cachedRule(id)!;
}

/** Replace the whole cache with rules rebuilt from Walrus (session start). */
export function replaceRulesFromWalrus(rules: Rule[]): void {
  const d = db();
  const usage = new Map(cachedRules().map((r) => [r.id, r]));
  d.delete(schema.rulesCache).run();
  let order = 0;
  for (const r of rules) {
    const prev = usage.get(r.id);
    d.insert(schema.rulesCache)
      .values({
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
      })
      .run();
  }
}

export function setRuleActive(id: string, active: boolean): void {
  db().update(schema.rulesCache).set({ active }).where(eq(schema.rulesCache.id, id)).run();
}

export function markRulesUsed(ids: string[]): void {
  for (const id of ids) {
    const r = cachedRule(id);
    if (r) db().update(schema.rulesCache).set({ timesUsed: r.timesUsed + 1, lastUsedAt: Date.now() }).where(eq(schema.rulesCache.id, id)).run();
  }
}

/** Merchants with an earlier request or a rule. */
export function knownMerchants(): Set<string> {
  const fromRequests = db().selectDistinct({ m: schema.requests.merchant }).from(schema.requests).all().map((r) => r.m);
  const fromRules = cachedRules().map((r) => r.merchant);
  return new Set([...fromRequests, ...fromRules].map(merchantKey));
}
