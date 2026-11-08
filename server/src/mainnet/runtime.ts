import { env, isMainnet } from "../lib/env";
import { budgetSnapshot, getOperation, markUnknown, recordSpent, releaseReservation, reserveOperation, resolveUnknownReleased, resolveUnknownSpent } from "./budget";
import { proofManifest } from "./proof-policy";

const integer = (name: string, fallback?: bigint): bigint => {
  const raw = env(name);
  if (!raw) {
    if (fallback !== undefined) return fallback;
    throw new Error(`${name} is required on Mainnet`);
  }
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be an unsigned integer string`);
  return BigInt(raw);
};

export function mainnetPlanId(): string {
  const id = env("MAINNET_PLAN_ID");
  if (!id || !/^sisih-mainnet-proof-[a-z0-9-]+$/.test(id)) throw new Error("MAINNET_PLAN_ID is missing or invalid");
  return id;
}

export function operatorGasBudget(): bigint {
  return isMainnet() ? integer("MAINNET_OPERATOR_TX_GAS_BUDGET_MIST") : 50_000_000n;
}

export interface PurchaseBudgetReservation {
  usdcOperation: string;
  gasOperation: string;
  gasMaximum: bigint;
}

/** Must run after the request row is atomically claimed and before signing a release. */
export async function reservePurchaseBudget(requestId: string, amount: bigint): Promise<PurchaseBudgetReservation | null> {
  if (!isMainnet()) return null;
  const plan = mainnetPlanId();
  const reviewed = await proofManifest();
  if (amount !== BigInt(reviewed.merchant.price_base_units)) throw new Error("Purchase amount differs from the reviewed manifest");
  const gasMaximum = operatorGasBudget();
  const usdcOperation = `${plan}:purchase:${requestId}:usdc`;
  const gasOperation = `${plan}:purchase:${requestId}:operator-gas`;
  const allocation = await reserveOperation(usdcOperation, `${plan}:usdc`, amount);
  if (allocation.status !== "reserved") throw new Error(`Purchase already has ${allocation.status} budget state; reconcile instead of retrying`);
  try {
    await reserveOperation(gasOperation, `${plan}:operator-gas`, gasMaximum);
  } catch (err) {
    await releaseReservation(usdcOperation);
    throw err;
  }
  return { usdcOperation, gasOperation, gasMaximum };
}

export async function releasePurchaseBudget(r: PurchaseBudgetReservation | null): Promise<void> {
  if (!r) return;
  await Promise.all([releaseReservation(r.usdcOperation), releaseReservation(r.gasOperation)]);
}

export async function recordReleaseBudget(r: PurchaseBudgetReservation | null, amount: bigint, gasMist: bigint, digest: string): Promise<void> {
  if (!r) return;
  await Promise.all([recordSpent(r.usdcOperation, amount, digest), recordSpent(r.gasOperation, gasMist < 0n ? 0n : gasMist, digest)]);
}

export async function recordFailedReleaseBudget(r: PurchaseBudgetReservation | null, gasMist: bigint, digest: string): Promise<void> {
  if (!r) return;
  await releaseReservation(r.usdcOperation);
  await recordSpent(r.gasOperation, gasMist < 0n ? 0n : gasMist, digest);
}

export async function markReleaseBudgetUnknown(r: PurchaseBudgetReservation | null, digest: string): Promise<void> {
  if (!r) return;
  await Promise.all([markUnknown(r.usdcOperation, digest), markUnknown(r.gasOperation, digest)]);
}

export async function assertRuntimeBudgetsReady(): Promise<void> {
  if (!isMainnet()) return;
  await proofManifest();
  const plan = mainnetPlanId();
  for (const suffix of ["usdc", "operator-gas"] as const) {
    if (!(await budgetSnapshot(`${plan}:${suffix}`))) throw new Error(`Mainnet execution budget ${plan}:${suffix} is not initialized`);
  }
}

export const mainnetBudgetOperation = getOperation;

export async function resolveReleaseBudget(requestId: string, outcome: { spent: boolean; amount: bigint; gasMist: bigint; digest: string }): Promise<void> {
  if (!isMainnet()) return;
  const plan = mainnetPlanId();
  const usdc = `${plan}:purchase:${requestId}:usdc`;
  const gas = `${plan}:purchase:${requestId}:operator-gas`;
  for (const [id, actual, consumed] of [[usdc, outcome.amount, outcome.spent], [gas, outcome.gasMist < 0n ? 0n : outcome.gasMist, true]] as const) {
    const op = await getOperation(id);
    if (!op) throw new Error(`Missing reservation ${id}`);
    if (op.status === "spent" || op.status === "released") continue;
    if (op.status === "unknown") {
      if (consumed) await resolveUnknownSpent(id, actual, outcome.digest);
      else await resolveUnknownReleased(id);
    } else {
      if (consumed) await recordSpent(id, actual, outcome.digest);
      else await releaseReservation(id);
    }
  }
}
