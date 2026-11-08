import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";

/**
 * Configuration source. By default the repo-root .env (the working Sui Testnet demo). A separate
 * environment (the bounded Mainnet proof) is selected with SISIH_ENV_FILE, a comma-separated list
 * of files relative to the repo root, for example ".env.mainnet,.env.mainnet.deployment". When
 * SISIH_ENV_FILE is set the root .env is NOT loaded, so Testnet IDs can never leak into Mainnet.
 * Values already in the process environment win (dotenv does not override).
 */
const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(here, "../../..");
export const ROOT_ENV_FILE = resolve(REPO_ROOT, ".env");

function selectedFiles(): string[] {
  const raw = process.env.SISIH_ENV_FILE?.trim();
  if (!raw) return [ROOT_ENV_FILE];
  return raw
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean)
    .map((f) => (isAbsolute(f) ? f : resolve(REPO_ROOT, f)));
}

const selectedEnvFiles = selectedFiles();
const explicitSelection = Boolean(process.env.SISIH_ENV_FILE?.trim());
const missingEnvFiles = selectedEnvFiles.filter((f) => !existsSync(f));
if (explicitSelection && missingEnvFiles.length) {
  throw new Error(`Selected SISIH_ENV_FILE does not exist: ${missingEnvFiles.join(", ")}`);
}

/** The env files actually loaded into this process (existing ones only). */
export const loadedEnvFiles: string[] = selectedEnvFiles.filter((f) => existsSync(f));

/**
 * Only these public deployment outputs may be supplied by a later selected file. Secrets,
 * network selection and identities must agree across files instead of being silently replaced.
 * Values inherited from the launching process always win.
 */
export const DEPLOYMENT_ENV_KEYS = new Set([
  "SISIH_PACKAGE_ID",
  "VAULT_ID",
  "OPERATOR_CAP_ID",
  "UPGRADE_CAP_ID",
  "DATABASE_URL",
  "MEMWAL_NAMESPACE_PREFIX",
  "MERCHANT_CHAINSCOPE_ADDRESS",
  "PUBLIC_BASE_URL",
  "PORT",
  "MAINNET_PLAN_ID",
  "MAINNET_OPERATOR_TX_GAS_BUDGET_MIST",
]);
const inherited = new Set(Object.keys(process.env));
for (const [index, file] of loadedEnvFiles.entries()) {
  const values = parse(readFileSync(file, "utf8"));
  for (const [key, value] of Object.entries(values)) {
    if (inherited.has(key)) continue;
    const current = process.env[key];
    if (current === undefined || current === "") {
      process.env[key] = value;
      continue;
    }
    if (current === value) continue;
    if (index > 0 && DEPLOYMENT_ENV_KEYS.has(key)) {
      process.env[key] = value;
      continue;
    }
    throw new Error(`Conflicting ${key} across selected environment files. Only public deployment IDs may be overridden by a later file.`);
  }
}

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

/**
 * Mainnet must come from its own configuration: never from the repo-root .env (the Testnet demo).
 * Pure, so it is unit tested; suiNetwork() applies it to this process.
 */
export function assertEnvIsolation(network: SuiNetwork, files: readonly string[], rootFile = ROOT_ENV_FILE): void {
  if (network !== "mainnet") return;
  if (files.some((f) => resolve(/*turbopackIgnore: true*/ f) === resolve(/*turbopackIgnore: true*/ rootFile))) {
    throw new Error(
      "SUI_NETWORK=mainnet while the repo-root .env (the Testnet demo) is loaded. Select the Mainnet configuration with SISIH_ENV_FILE (for example .env.mainnet,.env.mainnet.deployment).",
    );
  }
}

export function suiNetwork(): SuiNetwork {
  const n = env("SUI_NETWORK") ?? "testnet";
  if (n !== "testnet" && n !== "mainnet") throw new Error(`SUI_NETWORK must be testnet or mainnet, got ${n}`);
  assertEnvIsolation(n, loadedEnvFiles);
  return n;
}

export const isMainnet = (): boolean => suiNetwork() === "mainnet";

/** "Sui Testnet" / "Sui Mainnet", from validated config. */
export function suiNetworkLabel(network: SuiNetwork = suiNetwork()): string {
  return network === "mainnet" ? "Sui Mainnet" : "Sui Testnet";
}

/** "testnet USDC" on Testnet, "USDC" on Mainnet. */
export function usdcLabel(network: SuiNetwork = suiNetwork()): string {
  return network === "mainnet" ? "USDC" : "testnet USDC";
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
