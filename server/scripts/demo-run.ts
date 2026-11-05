/**
 * Headless run of the recorded demo flow (docs/SPEC.md), from reset, against a running server:
 *   reset -> session 1 (3 requests, scripted owner decisions) -> advance cycle (6.80 bill, 7.00
 *   suggestion) -> owner accepts (signed here, as the browser wallet would) -> new session ->
 *   session 2 (3 requests). Asserts the SPEC tables and that every x402 settlement is verified
 *   through Tatum. Usage: server running (pnpm dev), then npx tsx scripts/demo-run.ts
 */
import { Transaction } from "@mysten/sui/transactions";
import { target, usdcType, vaultId } from "../src/chain/sisih.js";
import { formatUsdc } from "../src/lib/env.js";
import { setGas, signAndExecute } from "../src/lib/tatum.js";
import { keypair } from "../src/lib/wallets.js";

const API = process.env.API_URL ?? "http://127.0.0.1:8787";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const failures: string[] = [];
const digests: { what: string; digest: string }[] = [];

async function call<T = any>(method: "GET" | "POST", path: string, body?: unknown, expect: number[] = [200, 201]): Promise<T> {
  const res = await fetch(`${API}${path}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = (await res.json()) as T;
  if (!expect.includes(res.status)) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

function check(label: string, actual: unknown, expected: unknown) {
  const ok = String(actual) === String(expected);
  if (!ok) failures.push(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}: ${String(actual)}${ok ? "" : ` (expected ${String(expected)})`}`);
}

const usd = (base: string | bigint) => formatUsdc(BigInt(base));

async function balances(label: string, total: string, committed: string, free: string) {
  const s = await call("GET", "/api/state");
  console.log(`${label}: total ${usd(s.vault.total)} committed ${usd(s.vault.reserved)} free ${usd(s.vault.free)}`);
  check(`${label} total`, usd(s.vault.total), total);
  check(`${label} committed`, usd(s.vault.reserved), committed);
  check(`${label} free`, usd(s.vault.free), free);
}

type Req = { id: string; merchant: string; status: string; code: string; amount: string; reasons: string[]; cutsReserveBy: string; allowDisabled: boolean; paymentStatus: string; paymentDigests: { step: string; digest: string; verified: boolean }[] };

const rows: { session: number; merchant: string; item: string; amount: string; decision: string; reason: string }[] = [];

function recordRow(session: number, r: Req, decision: string) {
  rows.push({ session, merchant: r.merchant, item: (r as any).item, amount: usd(r.amount), decision, reason: r.reasons[0] ?? "" });
}

async function expectPaid(r: Req, what: string) {
  const full = await call<Req>("GET", `/api/requests/${r.id}`);
  check(`${what} payment`, full.paymentStatus, "paid");
  for (const d of full.paymentDigests) {
    const tx = await call("GET", `/api/tx/${d.digest}`);
    check(`${what} ${d.step} verified through Tatum`, tx.status, "verified");
    digests.push({ what: `${what} ${d.step}`, digest: d.digest });
  }
}

async function runTask(scenario: string): Promise<Req> {
  return call<Req>("POST", "/api/demo/run-task", { scenario });
}

// --- reset ---------------------------------------------------------------------------
console.log("== reset");
const reset = await call("POST", "/api/demo/reset");
console.log(`namespace ${reset.namespace}; seed ${reset.seed}; agent USDC ${usd(reset.agentUsdc)}; ${reset.recycled.length} recycle transfers`);
for (const r of reset.recycled) digests.push({ what: `recycle ${r.label}`, digest: r.digest });
digests.push({ what: "reset emergency withdraw", digest: reset.emergencyWithdraw }, { what: "reset seed", digest: reset.seed });
check("agent swept to 0 on reset", usd(reset.agentUsdc), "0.00");
await balances("Start of session 1", "20.00", "16.50", "3.50");

// --- session 1 -----------------------------------------------------------------------
console.log("\n== session 1");
const s1a = await runTask("cheap_data");
check("S1 DataMart 0.50 decision", s1a.status, "auto_allowed");
check("S1 DataMart reason", s1a.code, "default_threshold");
recordRow(1, s1a, "Auto-approved");
await expectPaid(s1a, "S1 DataMart");

const s1b = await runTask("new_merchant_search");
check("S1 SearchBox 1.20 decision", s1b.status, "held");
check("S1 SearchBox reason", s1b.code, "new_merchant");
const s1bDone = await call("POST", `/api/requests/${s1b.id}/decision`, { action: "approve_and_remember" });
check("S1 SearchBox owner decision", s1bDone.request.status, "approved");
recordRow(1, s1b, "Approved manually");
await expectPaid(s1b, "S1 SearchBox");

const s1c = await runTask("expensive_report");
check("S1 ReportLab 3.00 decision", s1c.status, "held");
check("S1 ReportLab cuts reserve by", usd(s1c.cutsReserveBy), "1.20");
check("S1 ReportLab approval disabled", s1c.allowDisabled, true);
const refused = await call("POST", `/api/requests/${s1c.id}/decision`, { action: "approve_once" }, [409]);
check("S1 ReportLab approve refused (reserves locked)", refused.code, "reserves_locked");
await call("POST", `/api/requests/${s1c.id}/decision`, { action: "deny_and_remember" });
recordRow(1, s1c, "Denied");
await balances("End of session 1", "18.30", "16.50", "1.80");

// --- advance cycle -------------------------------------------------------------------
console.log("\n== advance cycle");
for (;;) {
  const c = await call("GET", "/api/demo/clock");
  if (c.secondsToNextDue === 0) break;
  console.log(`  waiting ${c.secondsToNextDue}s for obligations to come due (demo cycle ${c.cycleMs / 1000}s)`);
  await sleep(Math.min(30, c.secondsToNextDue) * 1000);
}
const cycle = await call("POST", "/api/demo/advance-cycle");
check("cycle advanced", cycle.advanced, true);
for (const r of cycle.recycled ?? []) digests.push({ what: `recycle ${r.label}`, digest: r.digest });
digests.push({ what: "simulated income 17.00", digest: cycle.income.digest });
for (const p of cycle.payments) {
  console.log(`  paid ${p.name} ${usd(p.bill)} ${p.ok ? p.digest : `FAILED ${p.reason}`}`);
  if (p.digest) digests.push({ what: `pay ${p.name}`, digest: p.digest });
}
const inference = cycle.payments.find((p: any) => p.name === "Inference API");
check("Inference API bill", usd(inference?.bill ?? "0"), "6.80");
const sug = (cycle.suggestions ?? []).find((s: any) => s.obligationName === "Inference API");
check("reserve suggestion", sug ? usd(sug.suggestedTarget) : "none", "7.00");
check("suggestion reason", sug?.reason, "Inference API: raise 6.00 to 7.00 USDC. Last cycle was 0.80 short.");
if (cycle.funded.digest) digests.push({ what: "fund reserves", digest: cycle.funded.digest });

// Owner accepts: sign set_obligation_target as the browser wallet would, then post the digest.
const owner = keypair("owner");
const tx = new Transaction();
tx.setSender(owner.toSuiAddress());
await setGas(tx, { budget: 20_000_000n });
tx.moveCall({ target: target("set_obligation_target"), typeArguments: [usdcType()], arguments: [tx.object(vaultId()), tx.pure.u64(BigInt(sug.obligationId)), tx.pure.u64(BigInt(sug.suggestedTarget))] });
const signed = await signAndExecute(tx, owner);
const accepted = await call("POST", `/api/suggestions/${sug.id}/accept`, { digest: signed.digest });
check("suggestion accepted", usd(accepted.newTarget), "7.00");
digests.push({ what: "owner accepts reserve 7.00", digest: signed.digest });
await balances("Start of session 2", "18.00", "16.00", "2.00");

// --- new session ---------------------------------------------------------------------
console.log("\n== new session (waits for pending memories, rebuilds rules from Walrus)");
const sess = await call("POST", "/api/demo/new-session");
console.log(`  session ${sess.session}: waited for ${sess.waitedForMemories} memories; ${sess.rules.loaded} rules from Walrus (${sess.rules.active} active), ${sess.rules.inventory} memories in namespace, ${sess.rules.ms} ms`);
check("rules rebuilt from Walrus", sess.rules.loaded, 2);

// --- session 2 -----------------------------------------------------------------------
console.log("\n== session 2");
const s2a = await runTask("new_merchant_search");
check("S2 SearchBox 1.20 decision", s2a.status, "auto_allowed");
check("S2 SearchBox reason", s2a.code, "allow_rule");
recordRow(2, s2a, "Auto-approved");
await expectPaid(s2a, "S2 SearchBox");

const s2b = await runTask("cheap_data");
check("S2 DataMart 0.50 decision", s2b.status, "auto_allowed");
check("S2 DataMart reason", s2b.code, "default_threshold");
recordRow(2, s2b, "Auto-approved");
await expectPaid(s2b, "S2 DataMart");

const s2c = await runTask("expensive_report");
check("S2 ReportLab 3.00 decision", s2c.status, "held");
check("S2 ReportLab cuts reserve by", usd(s2c.cutsReserveBy), "2.70");
check("S2 ReportLab denied before", s2c.reasons.some((r) => r.startsWith("You denied this before")), true);
recordRow(2, s2c, "Held");
await balances("End of session 2", "16.30", "16.00", "0.30");

// --- summary -------------------------------------------------------------------------
const insights = await call("GET", "/api/insights");
console.log("\n== agent requests (compare with docs/SPEC.md 'Sample data: agent requests')");
for (const r of rows) console.log(`  S${r.session} ${r.merchant.padEnd(10)} ${r.amount}  ${r.decision.padEnd(18)} ${r.reason}`);
console.log(`\nmanual reviews: session 1 ${insights.sessions[0]?.manualReviews} of 3, session 2 ${insights.sessions[1]?.manualReviews} of 3; memories stored ${insights.cards.memoriesStored}`);
console.log("\n== digests");
for (const d of digests) console.log(`  ${d.what.padEnd(44)} ${d.digest}`);
console.log(failures.length ? `\nFAIL (${failures.length}):\n  ${failures.join("\n  ")}` : "\nPASS: demo flow reproduced the SPEC tables end to end");
process.exit(failures.length ? 1 : 0);
