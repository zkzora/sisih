/** Move call targets and ids for the sisih::vault package, all from env (CLAUDE.md rule 7). */
import { requireEnv } from "../lib/env.js";

export const CLOCK_ID = "0x6";

export function packageId(): string {
  return requireEnv("SISIH_PACKAGE_ID");
}

export function vaultId(): string {
  return requireEnv("VAULT_ID");
}

export function operatorCapId(): string {
  return requireEnv("OPERATOR_CAP_ID");
}

export function usdcType(): string {
  return requireEnv("USDC_COIN_TYPE");
}

export function target(fn: string, pkg = packageId()): `${string}::${string}::${string}` {
  return `${pkg}::vault::${fn}`;
}

export const KIND = { fixed: 0, usage: 1 } as const;
export const PRIORITY = { must: 0, important: 1 } as const;

/** Abort codes from #[error(code = N)] in contracts/sisih/sources/vault.move. */
export const VAULT_ERRORS: Record<number, string> = {
  0: "ENotOwner",
  1: "EWrongOperatorCap",
  2: "EWrongVersion",
  3: "EZeroAmount",
  4: "EExceedsFree",
  5: "ETooManyObligations",
  6: "EUnknownObligation",
  7: "EInvalidKind",
  8: "EInvalidPriority",
  9: "ENotDue",
  10: "EFixedBillMismatch",
  11: "EUsageBillTooHigh",
  12: "ENoAgentPolicy",
  13: "EAgentPaused",
  14: "EAgentExpired",
  15: "EOverPerRequest",
  16: "EOverDaily",
  17: "EInvalidPolicy",
};

/** USDC "1.50" -> 1_500_000n. */
export function usdc(amount: string): bigint {
  const [whole, frac = ""] = amount.split(".");
  if (!/^\d+$/.test(whole ?? "") || !/^\d{0,6}$/.test(frac)) throw new Error(`bad USDC amount ${amount}`);
  return BigInt(whole!) * 1_000_000n + BigInt(frac.padEnd(6, "0"));
}
