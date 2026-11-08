/** Local dev: load the repo-root .env (Vercel provides real env vars). Import first. */
import "server-only";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

if (!process.env.VERCEL && !process.env.SISIH_ENV_FILE && process.env.SUI_NETWORK !== "mainnet" && !process.env.TATUM_API_KEY_TESTNET && !process.env.TATUM_API_KEY_MAINNET) {
  const root = resolve(/*turbopackIgnore: true*/ process.cwd(), "../.env");
  if (existsSync(root)) process.loadEnvFile(root);
}
// A relative local PGlite path is relative to the repo root, not to the bundled chunk.
const db = process.env.DATABASE_URL;
if (db && /^(pglite|file):\.\.?\//.test(db)) process.env.DATABASE_URL = `pglite:${resolve(/*turbopackIgnore: true*/ process.cwd(), "..", db.replace(/^(pglite|file):/, ""))}`;
