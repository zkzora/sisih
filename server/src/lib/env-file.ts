import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The single .env at the repo root (the Testnet demo). Never committed. */
export const ROOT_ENV_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env");

/** Files that hold Mainnet keys from the cancelled migration: never rewritten by any script. */
const PROTECTED = new Set([".env.mainnet"]);

/**
 * Insert or replace KEY=value lines in an env file, keeping everything else as is.
 * Refuses the root .env when this process runs against Mainnet, and never touches .env.mainnet:
 * Mainnet deployment IDs go to their own file (for example .env.mainnet.deployment).
 */
export function upsertEnv(values: Record<string, string>, path = ROOT_ENV_PATH): void {
  if (PROTECTED.has(basename(path))) throw new Error(`${basename(path)} is protected; write deployment output to a separate file`);
  if (resolve(/*turbopackIgnore: true*/ path) === resolve(ROOT_ENV_PATH) && process.env.SUI_NETWORK === "mainnet") {
    throw new Error("Refusing to write Mainnet values into the repo-root .env (the Testnet demo configuration)");
  }
  let text = readFileSync(/*turbopackIgnore: true*/ path, "utf8");
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, "m");
    text = re.test(text) ? text.replace(re, line) : `${text.replace(/\s*$/, "")}\n${line}\n`;
    process.env[key] = value;
  }
  writeFileSync(/*turbopackIgnore: true*/ path, text);
}
