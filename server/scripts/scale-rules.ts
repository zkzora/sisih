/**
 * Prove the session-start rule rebuild at scale, in its own namespace and its own SQLite file:
 *   1. write 30 mixed memories (decisions, outcomes, summaries, reserve changes, a merchant note,
 *      3 rules, 1 rule_disabled) to Walrus mainnet
 *   2. wipe the rules cache, start a session (start_session -> loadRules from Walrus)
 *   3. confirm exactly the expected rules come back (2 active, 1 disabled)
 *   4. repeat the rebuild with a small explicit limit (10) to see whether the tag queries alone
 *      still find every rule memory when plain recall cannot return everything
 * Run with its own DB:  DATABASE_URL=file:./server/data/scale-test.db npx tsx scripts/scale-rules.ts
 */
import { db, schema } from "../src/db/index.js";
import { formatUsdc } from "../src/lib/env.js";
import { serializeMemory, type MemoryType } from "../src/memory/format.js";
import { loadRules, memwalClient } from "../src/memory/memwal.js";
import { startSession } from "../src/services/sessions.js";
import { cachedRules, currentSession, kvSet } from "../src/services/state.js";

if (!(process.env.DATABASE_URL ?? "").includes("scale-test")) {
  console.error("Run with DATABASE_URL=file:./server/data/scale-test.db so the demo database is untouched.");
  process.exit(1);
}

const ns = process.argv[2] ?? `sisih-scale-${Date.now()}`;
const writeNew = !process.argv[2];
const day = 86_400_000;
const exp = Date.UTC(2026, 11, 5);
const until = "2026-12-05";

const RULES = [
  { ruleId: "scale-r1", merchant: "SearchBox", category: "search", maxAmount: "1500000", action: "allow", expiresMs: exp, s: `Always allow search from SearchBox up to 1.50 USDC until ${until}` },
  { ruleId: "scale-r2", merchant: "ReportLab", category: "research", maxAmount: "3000000", action: "deny", expiresMs: exp, s: `Always deny research from ReportLab up to 3.00 USDC until ${until}` },
  { ruleId: "scale-r3", merchant: "DataMart", category: "data", maxAmount: "1000000", action: "allow", expiresMs: exp + day, s: `Always allow data from DataMart up to 1.00 USDC until 2026-12-06` },
] as const;

function corpus(): { type: MemoryType; text: string }[] {
  const out: { type: MemoryType; text: string }[] = [];
  const add = (type: MemoryType, sentence: string, payload: object) => out.push({ type, text: serializeMemory(type, sentence, payload) });
  const merchants = ["DataMart", "SearchBox", "ReportLab"] as const;
  const amounts = ["0.50", "1.20", "3.00"];
  for (let i = 0; i < 14; i++) {
    const m = merchants[i % 3]!;
    const verdict = i % 4 === 0 ? "held, then approved by the owner" : i % 5 === 0 ? "denied by the owner" : "approved automatically";
    add("decision", `${m} (demo) request ${i + 1}, ${amounts[i % 3]} USDC: ${verdict}.`, { requestId: `scale-req-${i}`, merchant: m, amount: amounts[i % 3], session: 1 + (i % 5) });
  }
  for (let i = 0; i < 6; i++) add("obligation_outcome", `Inference API: bill ${(6.4 + i * 0.2).toFixed(2)}, reserve 6.00.`, { obligationId: 0, name: "Inference API", bill: String(6_400_000 + i * 200_000), cycle: i + 1 });
  for (let i = 0; i < 3; i++) add("session_summary", `Session ${i + 1}: 3 requests, ${2 - (i % 2)} held, ${1 + (i % 2)} automatic.`, { session: i + 1 });
  add("reserve_change", "Inference API reserve 6.00 to 7.00 USDC, approved by the owner.", { obligationId: 0, oldTarget: "6000000", newTarget: "7000000", accepted: true });
  add("reserve_change", "Weekly savings reserve suggestion 4.00 to 4.50 USDC, rejected by the owner.", { obligationId: 2, accepted: false });
  add("merchant_note", "ReportLab: reports above 2.00 USDC always ask first.", { merchant: "ReportLab", note: "ask above 2.00" });
  for (const r of RULES) add("rule", r.s, { ruleId: r.ruleId, merchant: r.merchant, category: r.category, maxAmount: r.maxAmount, action: r.action, expiresMs: r.expiresMs });
  add("rule_disabled", `Rule disabled: ${RULES[2].s}`, { ruleId: "scale-r3" });
  return out;
}

const items = corpus();
console.log(`namespace ${ns}: ${items.length} memories (${Object.entries(items.reduce<Record<string, number>>((a, m) => ((a[m.type] = (a[m.type] ?? 0) + 1), a), {})).map(([k, v]) => `${k} ${v}`).join(", ")})`);

if (writeNew) {
  const t0 = Date.now();
  const mw = memwalClient();
  const jobIds: string[] = [];
  for (let i = 0; i < items.length; i += 20) {
    const batch = items.slice(i, i + 20).map((m) => ({ text: m.text, namespace: ns }));
    const accepted = await mw.rememberBulkAsync(batch);
    jobIds.push(...accepted.job_ids);
  }
  let succeeded = 0;
  let failed = 0;
  for (let i = 0; i < jobIds.length; i += 20) {
    // The relayer caps bulk status at 20 job ids per request.
    const done = await mw.waitForRememberJobs(jobIds.slice(i, i + 20), [ns], { pollIntervalMs: 3000, timeoutMs: 600_000 });
    succeeded += done.succeeded;
    failed += done.failed;
  }
  console.log(`wrote ${succeeded}/${jobIds.length} to Walrus mainnet in ${((Date.now() - t0) / 1000).toFixed(1)} s (${failed} failed)`);
  if (failed > 0) process.exit(1);
}

// Fresh local state pointed at the scale namespace: no rules in the cache.
const d = db();
for (const t of [schema.rulesCache, schema.sessions, schema.memories, schema.requests]) d.delete(t).run();
kvSet("memwal_namespace", ns);
console.log(`cache wiped: ${cachedRules().length} rules; session ${currentSession()}`);

const started = await startSession();
console.log(`start_session -> session ${started.session}: loaded ${started.rules.loaded} rules (${started.rules.active} active) from ${started.rules.ruleMemories} rule memories; broad recall ${started.rules.recalled} of ${started.rules.inventory} in namespace; ${started.rules.ms} ms${started.rules.warning ? `; ${started.rules.warning}` : ""}`);

const got = cachedRules().map((r) => ({ id: r.id, active: r.active, merchant: r.merchant, category: r.category, max: formatUsdc(r.maxAmount), action: r.action, origin: r.origin }));
for (const r of got) console.log(`  ${r.id} ${r.active ? "active  " : "disabled"} ${r.action} ${r.category} from ${r.merchant} up to ${r.max} (origin ${r.origin})`);
const expected = [
  { id: "scale-r1", active: true, merchant: "SearchBox", category: "search", max: "1.50", action: "allow", origin: "walrus" },
  { id: "scale-r2", active: true, merchant: "ReportLab", category: "research", max: "3.00", action: "deny", origin: "walrus" },
  { id: "scale-r3", active: false, merchant: "DataMart", category: "data", max: "1.00", action: "allow", origin: "walrus" },
];
const sortById = <T extends { id: string }>(xs: T[]) => [...xs].sort((a, b) => a.id.localeCompare(b.id));
const exact = JSON.stringify(sortById(got)) === JSON.stringify(sortById(expected));
console.log(exact ? "PASS: exactly the expected rules (2 active, 1 disabled)" : "FAIL: rules differ from expected");

// Small explicit limit: plain recall cannot return all 30+; do the tag queries still find every rule memory?
const small = await loadRules({ namespace: ns, limit: 10 });
console.log(`limit 10: ${small.strategies.map((s) => `${s.name} returned ${s.returned} (${s.ruleMemories} rule memories)`).join("; ")}; union -> ${small.rules.length} rules, ${small.rules.filter((r) => r.active).length} active`);
const smallExact = small.rules.length === 3 && small.rules.filter((r) => r.active).map((r) => r.id).sort().join() === "scale-r1,scale-r2";
console.log(smallExact ? "PASS at limit 10: tag queries recover every rule memory" : "NOTE at limit 10: tag queries did not recover every rule memory");
process.exit(exact ? 0 : 1);
