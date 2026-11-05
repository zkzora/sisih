/**
 * start_session: wait for every pending remember job (~21 s each), write a session_summary
 * memory for the previous session, rebuild the rules cache from Walrus recall, bump the number.
 */
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { jsonSafe, publish } from "../lib/bus.js";
import { loadRules, remember, waitForPendingMemories } from "../memory/memwal.js";
import { cachedRules, currentSession, replaceRulesFromWalrus } from "./state.js";

export function sessionStats(n: number) {
  const rs = db().select().from(schema.requests).where(eq(schema.requests.session, n)).all();
  const newRules = db().select().from(schema.memories).where(eq(schema.memories.session, n)).all().filter((m) => m.type === "rule");
  return {
    session: n,
    requests: rs.length,
    held: rs.filter((r) => r.action === "hold").length,
    automatic: rs.filter((r) => r.action !== "hold").length,
    approved: rs.filter((r) => r.status === "approved" || r.status === "auto_allowed").length,
    denied: rs.filter((r) => r.status === "denied" || r.status === "auto_denied").length,
    newRules: newRules.length,
  };
}

export interface SessionStartResult {
  previous: number;
  session: number;
  waitedForMemories: number;
  summaryMemoryId: string | null;
  rules: { loaded: number; active: number; ruleMemories: number; recalled: number; inventory: number; ms: number; warning: string | null };
  before: { id: string; sentence: string; active: boolean }[];
}

export async function startSession(): Promise<SessionStartResult> {
  const previous = currentSession();
  publish("session.starting", { previous });

  // 1. Every rule written this session must be on Walrus before we rebuild from Walrus.
  const waited = await waitForPendingMemories();

  // 2. Summary of the session that is ending (feeds the "What changed" card).
  const stats = sessionStats(previous);
  const summary = remember(
    "session_summary",
    `Session ${previous}: ${stats.requests} requests, ${stats.held} held, ${stats.automatic} automatic, ${stats.newRules} new rules.`,
    stats,
    { session: previous },
  );
  db().update(schema.sessions).set({ endedAt: Date.now(), summaryMemoryId: summary.id }).where(eq(schema.sessions.n, previous)).run();

  // 3. Rebuild rules from Walrus recall: the source of truth; SQLite only caches it.
  const before = cachedRules().map((r) => ({ id: r.id, sentence: r.sentence, active: r.active }));
  const loaded = await loadRules();
  replaceRulesFromWalrus(loaded.rules);

  // 4. Next session.
  const n = previous + 1;
  db().insert(schema.sessions).values({ n, startedAt: Date.now(), rulesLoaded: loaded.rules.length, rulesLoadMs: loaded.ms }).run();
  const result: SessionStartResult = {
    previous,
    session: n,
    waitedForMemories: waited,
    summaryMemoryId: summary.id,
    rules: {
      loaded: loaded.rules.length,
      active: loaded.rules.filter((r) => r.active).length,
      ruleMemories: loaded.ruleMemories,
      recalled: loaded.recalled,
      inventory: loaded.inventory,
      ms: loaded.ms,
      warning: loaded.warning,
    },
    before,
  };
  publish("session.started", jsonSafe({ ...result, rulesAfter: cachedRules() }));
  return result;
}
