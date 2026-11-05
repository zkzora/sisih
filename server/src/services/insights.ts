/**
 * Learning impact: per-session metrics for the 5 charts, computed only from real rows
 * (requests, memories, rules) and Tatum-verified vault events in tx_log. Never invented.
 */
import { db, schema } from "../db/index.js";
import type { TxEvent } from "../lib/tatum.js";
import { cachedRules } from "./state.js";

const CATEGORIES = ["data", "search", "inference", "research"] as const;

export function insights() {
  const requests = db().select().from(schema.requests).all();
  const sessions = db().select().from(schema.sessions).orderBy(schema.sessions.n).all();
  const memories = db().select().from(schema.memories).all();
  const txs = db().select().from(schema.txLog).all();

  let protectedCumulative = 0n;
  const perSession = sessions.map((s) => {
    const rs = requests.filter((r) => r.session === s.n);
    const manual = rs.filter((r) => r.action === "hold").length;
    const falseHolds = rs.filter((r) => r.action === "hold" && r.status === "approved").length;
    // Money protected: committed funds a request would have used, and that stayed reserved.
    const protectedNow = rs
      .filter((r) => r.code === "would_cut_reserve" && r.status !== "approved")
      .reduce((sum, r) => sum + BigInt(r.cutsReserveBy), 0n);
    protectedCumulative += protectedNow;
    const spend = Object.fromEntries(CATEGORIES.map((c) => [c, 0n])) as Record<(typeof CATEGORIES)[number], bigint>;
    for (const r of rs) if (r.status === "approved" || r.status === "auto_allowed") spend[r.category as (typeof CATEGORIES)[number]] += BigInt(r.amount);
    const end = s.endedAt ?? Number.MAX_SAFE_INTEGER;
    const paid = txs
      .filter((t) => t.status === "verified" && t.recordedAt >= s.startedAt && t.recordedAt < end)
      .flatMap((t) => (t.events ? (JSON.parse(t.events) as TxEvent[]) : []))
      .filter((e) => e.type.endsWith("::vault::ObligationPaid") && e.json);
    const onTime = paid.filter((e) => BigInt(String(e.json!.from_free)) === 0n && BigInt(String(e.json!.uncovered)) === 0n).length;
    return {
      session: s.n,
      requests: rs.length,
      manualReviews: manual,
      automatic: rs.length - manual,
      automaticPct: rs.length ? Math.round(((rs.length - manual) / rs.length) * 100) : null,
      falseHolds,
      moneyProtected: protectedNow.toString(),
      moneyProtectedCumulative: protectedCumulative.toString(),
      obligationsOnTime: onTime,
      obligationsUnderfunded: paid.length - onTime,
      spendByCategory: Object.fromEntries(Object.entries(spend).map(([k, v]) => [k, v.toString()])),
    };
  });
  const last = perSession.filter((s) => s.requests > 0).at(-1);
  return {
    source: "From Walrus memories + Sui events via Tatum",
    sessions: perSession,
    cards: {
      memoriesStored: memories.filter((m) => m.status === "stored").length,
      memoriesWriting: memories.filter((m) => m.status === "writing").length,
      activeRules: cachedRules().filter((r) => r.active).length,
      automaticPctLastSession: last?.automaticPct ?? null,
      moneyProtectedTotal: protectedCumulative.toString(),
    },
  };
}
