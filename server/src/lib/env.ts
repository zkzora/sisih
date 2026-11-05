import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

// The single .env lives at the repo root.
const here = dirname(fileURLToPath(import.meta.url));
const rootEnv = resolve(here, "../../../.env");
if (existsSync(rootEnv)) config({ path: rootEnv, quiet: true });

export type SuiNetwork = "testnet" | "mainnet";

export function env(name: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v === "" ? undefined : v;
}

export function requireEnv(name: string): string {
  const v = env(name);
  if (!v) throw new Error(`${name} is not set (see .env.example)`);
  return v;
}

export function suiNetwork(): SuiNetwork {
  const n = env("SUI_NETWORK") ?? "testnet";
  if (n !== "testnet" && n !== "mainnet") throw new Error(`SUI_NETWORK must be testnet or mainnet, got ${n}`);
  return n;
}

export const USDC_DECIMALS = 6;

/** 1.234567 USDC -> "1.23" for logs. Amounts stay bigint everywhere else. */
export function formatUsdc(base: bigint): string {
  const neg = base < 0n;
  const abs = neg ? -base : base;
  const whole = abs / 1_000_000n;
  const cents = (abs % 1_000_000n) / 10_000n;
  return `${neg ? "-" : ""}${whole}.${cents.toString().padStart(2, "0")}`;
}
