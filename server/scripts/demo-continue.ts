/**
 * Sessions 3 to 5 of the demo, headless, against a running deployment (testnet vault, Walrus
 * Memory mainnet). Run after sessions 1 and 2 (live recording or the UI flow):
 *   pnpm demo:continue                 (API_URL defaults to http://127.0.0.1:3000)
 *   API_URL=https://sisih-azure.vercel.app pnpm demo:continue
 *
 * Per session: advance the billing cycle (waits until bills are due), accept any open reserve
 * suggestion as the owner, start a new session (rules rebuilt from Walrus recall), then run the
 * three demo tasks. Owner decisions are one fixed rule, not tuned per session:
 *   held and approvable (would not cut reserves) -> approve once; held and would cut reserves -> deny.
 * Whatever the policy engine and the vault decide is what gets recorded. Nothing is faked.
 * Needs DEMO_TOKEN (from .env). Holds the demo-run lease with its own client id and releases it.
 */
import { randomUUID } from "node:crypto";
import { env, formatUsdc } from "../src/lib/env";

const API = (process.env.API_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const TOKEN = env("DEMO_TOKEN");
// DEMO_CLIENT: reuse the lease of a run that is still going (for example the UI flow before this).
const CLIENT = process.env.DEMO_CLIENT ?? `demo-continue-${randomUUID().slice(0, 8)}`;
const SESSIONS = (process.env.SESSIONS ?? "3,4,5").split(",").map(Number);
const SCENARIOS = ["cheap_data", "new_merchant_search", "expensive_report"] as const;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const usd = (v: string | number | bigint) => formatUsdc(BigInt(v));

async function call<T = any>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (method !== "GET" && TOKEN) Object.assign(headers, { "x-demo-token": TOKEN, "x-demo-client": CLIENT });
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    // Another action still running (409) or a transient gateway error: wait and retry.
    if ((res.status === 409 || res.status >= 500) && attempt < 6) {
      await sleep(5000 * attempt);
      continue;
    }
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
    return json as T;
  }
}

async function waitFor<T>(label: string, fn: () => Promise<T | null | undefined | false>, timeoutMs = 300_000): Promise<T> {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v as T;
    if (Date.now() - t0 > timeoutMs) throw new Error(`timeout waiting for ${label}`);
    await sleep(2000);
  }
}

const balances = async (label: string) => {
  const s = await call("GET", "/api/state");
  console.log(`${label}: total ${usd(s.vault.total)} / committed ${usd(s.vault.reserved)} / free ${usd(s.vault.free)} (session ${s.session}, ${s.memory.stored} memories stored)`);
};

async function advanceCycle() {
  for (;;) {
    const r = await call("POST", "/api/demo/advance-cycle");
    if (r?.advanced === false) {
      const wait = Number(r.secondsToNextDue ?? 10);
      console.log(`  bills not due yet, waiting ${wait} s`);
      await sleep((wait + 3) * 1000);
      continue;
    }
    for (const p of r.payments ?? []) console.log(`  paid ${p.name} ${usd(p.bill)} ${p.ok ? p.digest : `FAILED ${p.reason}`}`);
    console.log(`  income ${usd(r.income.amount)} ${r.income.digest}; fund_reserves ${r.funded?.digest ?? r.funded?.reason}`);
    return r;
  }
}

async function acceptSuggestions() {
  const open = (await call<any[]>("GET", "/api/suggestions")).filter((s) => s.status === "open");
  for (const s of open) {
    const r = await call("POST", "/api/demo/owner-action", { action: "accept_suggestion", suggestionId: s.id });
    console.log(`  owner accepted ${s.obligationName} ${usd(s.currentTarget)} -> ${usd(s.suggestedTarget)} (${s.reason}) ${r.digest}`);
  }
}

async function runTask(scenario: (typeof SCENARIOS)[number]) {
  const req = await call("POST", "/api/demo/run-task", { scenario });
  let decision = req.status;
  if (req.status === "held") {
    const cuts = BigInt(req.cutsReserveBy ?? "0") > 0n;
    const action = cuts ? "deny" : "approve_once";
    await call("POST", `/api/requests/${req.id}/decision`, { action });
    decision = `held -> owner ${action}`;
  }
  const done = await waitFor(`request ${req.id}`, async () => {
    const r = await call("GET", `/api/requests/${req.id}`);
    if (r.status === "held") return null;
    if ((r.status === "auto_allowed" || r.status === "approved") && r.paymentStatus !== "paid" && r.paymentStatus !== "failed") return null;
    return r;
  });
  const pay = done.paymentDigests?.length ? ` paid: release ${done.paymentDigests[0]?.digest} settle ${done.paymentDigests[1]?.digest}` : "";
  console.log(`  ${req.merchant} ${usd(req.amount)}: ${decision} (${req.code}; ${req.reasons?.[0] ?? ""})${pay}`);
}

console.log(`demo:continue against ${API}, sessions ${SESSIONS.join(", ")}, client ${CLIENT}`);
if (!TOKEN) console.log("  no DEMO_TOKEN set: mutations will only work on a local server without a token");
await balances("Before");
try {
  for (const n of SESSIONS) {
    console.log(`\n== cycle before session ${n}`);
    await advanceCycle();
    await acceptSuggestions();
    const s = await call("POST", "/api/demo/new-session");
    console.log(`== session ${s.session}: ${s.rules.loaded} rules rebuilt from Walrus (${s.rules.active} active, ${s.rules.recalled} recalled in ${s.rules.ms} ms)`);
    for (const sc of SCENARIOS) await runTask(sc);
    await balances(`End of session ${n}`);
  }
  const ins = await call("GET", "/api/insights");
  console.log(`\nmanual reviews per session: ${ins.sessions.map((x: any) => `S${x.session} ${x.manualReviews}/${x.requests}`).join(", ")}`);
  console.log(`memories stored ${ins.cards.memoriesStored}, writing ${ins.cards.memoriesWriting}, money protected ${usd(ins.cards.moneyProtectedTotal)} USDC`);
} finally {
  await call("POST", "/api/demo/release").catch(() => {});
}
