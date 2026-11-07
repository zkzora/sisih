/**
 * Demo controls (dock + headless run). Everything here is demo plumbing on testnet:
 * simulated income, scripted usage bills, recycled funds, 2-minute demo cycles.
 */
import { eq, like } from "drizzle-orm";
import { depositIncome, fundReserves, payObligation, readVault, vaultState } from "../chain/vault";
import { db, schema } from "../db/index";
import { publish } from "../lib/bus";
import { env, formatUsdc } from "../lib/env";
import { address } from "../lib/wallets";
import { namespace, waitForPendingMemories } from "../memory/memwal";
import { usdc } from "../chain/sisih";
import { onVaultEvents } from "../services/chainEvents";
import { currentSession, kvRead, kvSet } from "../services/state";
import { BILLS } from "./bills";
import { emergencyWithdrawAll, OWNER_DEPOSIT_FLOAT, SEED_DEPOSIT, seedVault } from "./owner";
import { assertTestnet, operatorSendUsdc, recycle, usdcBalance, waitForBalance, type SweepRecord } from "./recycle";

export const SIMULATED_INCOME = usdc("17.00");
/** The chain clock can trail ours; treat an obligation as due only this long after next_due_ms. */
export const DUE_MARGIN_MS = 5_000;


export async function demoCycle(): Promise<number> {
  return Number((await kvRead("demo_cycle")) ?? "1");
}

export async function clock() {
  const v = await vaultState();
  const next = v.obligations.length ? Math.min(...v.obligations.map((o) => o.nextDueMs)) : null;
  return {
    cycle: await demoCycle(),
    session: await currentSession(),
    namespace: await namespace(),
    cycleMs: Number(env("DEMO_CYCLE_MS") ?? "120000"),
    nextDueMs: next,
    secondsToNextDue: next === null ? null : Math.max(0, Math.ceil((next + DUE_MARGIN_MS - Date.now()) / 1000)),
  };
}

export interface CycleResult {
  advanced: boolean;
  cycle: number;
  secondsToNextDue?: number;
  recycled?: SweepRecord[];
  income?: { digest: string; amount: string };
  payments?: { name: string; bill: string; digest: string | null; ok: boolean; reason?: string }[];
  funded?: { digest: string | null; ok: boolean; reason?: string };
  suggestions?: unknown[];
}

/**
 * Advance one demo cycle: recycle demo funds, deposit simulated income (17.00), pay every due
 * obligation (usage bills from bills.ts), then fund reserves. If nothing is due yet, return
 * the seconds until the next due time.
 */
export async function advanceCycle(): Promise<CycleResult> {
  assertTestnet("Demo billing cycle (simulated income)");
  const cycle = await demoCycle();
  const v = await vaultState();
  const now = Date.now();
  const due = v.obligations.filter((o) => now >= o.nextDueMs + DUE_MARGIN_MS);
  if (due.length === 0) {
    const c = await clock();
    return { advanced: false, cycle, secondsToNextDue: c.secondsToNextDue ?? undefined };
  }
  publish("demo.cycle_started", { cycle, due: due.map((o) => o.name) });
  const recycled = await recycle({ includeAgent: true, log: (l) => publish("demo.recycle", { line: l }) });

  await waitForBalance(address("operator"), SIMULATED_INCOME); // read-after-write lag after the sweeps
  const income = await depositIncome(SIMULATED_INCOME);
  if (!income.ok) throw new Error(`simulated income deposit failed: ${income.reason}`);

  const before = (await db().select().from(schema.suggestions)).length;
  const payments: NonNullable<CycleResult["payments"]> = [];
  for (const o of due) {
    const bill = o.kind === "usage" && BILLS[String(cycle)]?.[o.name] ? usdc(BILLS[String(cycle)]![o.name]!) : o.target;
    const res = await payObligation(o.id, bill);
    if (res.ok) await onVaultEvents(res.tx); // obligation outcome memory + reserve suggestion
    payments.push({ name: o.name, bill: bill.toString(), digest: res.ok ? res.digest : (res.digest ?? null), ok: res.ok, reason: res.ok ? undefined : res.reason });
  }
  const fund = await fundReserves();
  await kvSet("demo_cycle", String(cycle + 1));
  const suggestions = (await db().select().from(schema.suggestions).orderBy(schema.suggestions.createdAt)).slice(before);
  const result: CycleResult = {
    advanced: true,
    cycle,
    recycled,
    income: { digest: income.digest, amount: SIMULATED_INCOME.toString() },
    payments,
    funded: { digest: fund.ok ? fund.digest : null, ok: fund.ok, reason: fund.ok ? undefined : fund.reason },
    suggestions,
  };
  publish("demo.cycle_done", result);
  return result;
}

async function nextNamespace(): Promise<string> {
  const n = Number((await kvRead("memwal_namespace_n")) ?? ((await namespace()).match(/-(\d+)$/)?.[1] ?? "1")) + 1;
  await kvSet("memwal_namespace_n", String(n));
  // Prefix keeps hosted and local runs in separate namespaces (both share the testnet vault).
  return `${env("MEMWAL_NAMESPACE_PREFIX") ?? "sisih-demo"}-${n}`;
}

/**
 * Reset (testnet only): emergency-withdraw the vault, recycle every demo holder (agent swept
 * to 0 USDC), top the owner up to 20.00, clear the app database, switch to a fresh memory namespace so a
 * recording starts with zero memories, and seed the SPEC starting state.
 */
export async function resetDemo() {
  assertTestnet("Demo reset");
  publish("demo.reset_started", {});
  const waited = await waitForPendingMemories(); // finish writes into the old namespace first
  const log: string[] = [];
  const say = (l: string) => {
    log.push(l);
    publish("demo.reset_progress", { line: l });
  };

  const withdraw = await emergencyWithdrawAll();
  if (!withdraw.ok) throw new Error(`emergency withdraw failed: ${withdraw.reason}`);
  say(`emergency_withdraw_all ${withdraw.digest}`);

  const recycled = await recycle({ includeAgent: true, log: say });
  const agentLeft = await usdcBalance(address("agent"));
  if (agentLeft !== 0n) throw new Error(`agent still holds ${formatUsdc(agentLeft)} USDC after recycle`);

  const ownerHas = await usdcBalance(address("owner"));
  let topUp: string | null = null;
  if (ownerHas < SEED_DEPOSIT) {
    topUp = await operatorSendUsdc(address("owner"), SEED_DEPOSIT - ownerHas);
    say(`owner top-up ${formatUsdc(SEED_DEPOSIT - ownerHas)} USDC from operator ${topUp}`);
  }

  // Fresh app state and a fresh namespace; keep only the namespace counter.
  const d = db();
  for (const t of [schema.requests, schema.decisions, schema.rulesCache, schema.memories, schema.suggestions, schema.txLog, schema.sessions, schema.events]) await d.delete(t);
  for (const k of ["last_recall", "demo_cycle"]) await d.delete(schema.kv).where(eq(schema.kv.key, k));
  // Per-run MCP state: idempotency mappings, request ownership, stored results and payment errors.
  for (const prefix of ["mcp:", "purchase_result:", "payment_error:"]) await d.delete(schema.kv).where(like(schema.kv.key, `${prefix}%`));
  const ns = await nextNamespace();
  await kvSet("memwal_namespace", ns);
  await currentSession(); // session 1

  await waitForBalance(address("owner"), SEED_DEPOSIT); // read-after-write lag after withdraw/top-up
  const seed = await seedVault();
  if (!seed.ok) throw new Error(`seed failed: ${seed.reason}`);
  say(`seed ${seed.digest}`);
  // Leave the owner a small float so a Deposit works right after a reset. Computed, not read:
  // a balance read right after the seed can lag (see waitForBalance).
  const ownerAfterSeed = (ownerHas > SEED_DEPOSIT ? ownerHas : SEED_DEPOSIT) - SEED_DEPOSIT;
  let ownerFloat: string | null = null;
  if (ownerAfterSeed < OWNER_DEPOSIT_FLOAT) {
    const amount = OWNER_DEPOSIT_FLOAT - ownerAfterSeed;
    ownerFloat = await operatorSendUsdc(address("owner"), amount);
    say(`owner deposit float ${formatUsdc(amount)} USDC from operator ${ownerFloat}`);
  }
  const v = await readVault();
  const result = {
    namespace: ns,
    waitedForMemories: waited,
    emergencyWithdraw: withdraw.digest,
    recycled,
    ownerTopUp: topUp,
    seed: seed.digest,
    ownerFloat,
    vault: { total: v.total.toString(), reserved: v.reserved.toString(), free: v.free.toString() },
    agentUsdc: agentLeft.toString(),
    log,
  };
  publish("demo.reset_done", result);
  return result;
}
