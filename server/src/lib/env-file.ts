import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The single .env at the repo root. Never committed. */
export const ROOT_ENV_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env");

/** Insert or replace KEY=value lines in the root .env, keeping everything else as is. */
export function upsertEnv(values: Record<string, string>, path = ROOT_ENV_PATH): void {
  let text = readFileSync(/*turbopackIgnore: true*/ path, "utf8");
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, "m");
    text = re.test(text) ? text.replace(re, line) : `${text.replace(/\s*$/, "")}\n${line}\n`;
    process.env[key] = value;
  }
  writeFileSync(/*turbopackIgnore: true*/ path, text);
}
