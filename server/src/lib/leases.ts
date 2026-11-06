/**
 * Coordination that must hold across serverless instances, so it lives in Postgres, not memory.
 * - Leases: one holder per key until `until`. Re-acquiring by the same holder extends it; an
 *   expired lease can be taken by anyone, so a killed function never holds a key forever.
 * - Rate limits: fixed window per key, counted with one atomic upsert.
 */
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "../db/index";

export interface LeaseResult {
  acquired: boolean;
  holder: string;
  until: number;
}

/** Take or extend `key` for `holder` for `ttlMs`. Fails while another holder's lease is live. */
export async function acquireLease(key: string, holder: string, ttlMs: number, now = Date.now()): Promise<LeaseResult> {
  const until = now + ttlMs;
  const t = schema.leases;
  const won = await db()
    .insert(t)
    .values({ key, holder, until })
    .onConflictDoUpdate({ target: t.key, set: { holder, until }, setWhere: sql`${t.until} < ${now} or ${t.holder} = ${holder}` })
    .returning({ holder: t.holder, until: t.until });
  if (won.length) return { acquired: true, holder, until };
  const [cur] = await db().select().from(t).where(eq(t.key, key));
  return { acquired: false, holder: cur?.holder ?? "", until: cur?.until ?? now };
}

export async function releaseLease(key: string, holder: string): Promise<void> {
  await db().delete(schema.leases).where(and(eq(schema.leases.key, key), eq(schema.leases.holder, holder)));
}

/** The live lease on `key`, if any. */
export async function currentLease(key: string, now = Date.now()): Promise<{ holder: string; until: number } | null> {
  const [cur] = await db().select().from(schema.leases).where(eq(schema.leases.key, key));
  return cur && cur.until > now ? { holder: cur.holder, until: cur.until } : null;
}

export interface RateResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/** Count one hit for `key`; allowed while the window holds at most `max` hits. */
export async function rateHit(key: string, max: number, windowMs: number, now = Date.now()): Promise<RateResult> {
  const t = schema.rateLimits;
  const fresh = sql`${t.windowStart} <= ${now - windowMs}`;
  const [row] = await db()
    .insert(t)
    .values({ key, windowStart: now, hits: 1 })
    .onConflictDoUpdate({
      target: t.key,
      set: {
        hits: sql`case when ${fresh} then 1 else ${t.hits} + 1 end`,
        windowStart: sql`case when ${fresh} then ${now} else ${t.windowStart} end`,
      },
    })
    .returning({ hits: t.hits, windowStart: t.windowStart });
  const allowed = (row?.hits ?? 1) <= max;
  const retryAfterSeconds = allowed ? 0 : Math.max(1, Math.ceil(((row?.windowStart ?? now) + windowMs - now) / 1000));
  return { allowed, retryAfterSeconds };
}
