/** Prepare a local server-only env using an explicit allowlist. Never exports the owner key. */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { env, REPO_ROOT, suiNetwork } from "../../src/lib/env";
import { address } from "../../src/lib/wallets";
import { assertManifestIdentity, loadMainnetManifest } from "../../src/mainnet/manifest";

if (process.argv.includes("--help")) {
  console.log("server-env.ts [--write]. Default prints variable names only. --write creates/updates ignored .env.mainnet.server without exporting the local owner key.");
  process.exit(0);
}
if (suiNetwork() !== "mainnet") throw new Error("Select the isolated Mainnet environment first");
const m = loadMainnetManifest("docs/mainnet/MANIFEST.json");
assertManifestIdentity(m, { owner: address("owner"), operator: address("operator"), agent: address("agent"), facilitator: address("facilitator"), asset: env("USDC_COIN_TYPE") ?? "" });
const allow = ["SUI_NETWORK", "TATUM_API_KEY_MAINNET", "USDC_COIN_TYPE", "SISIH_PACKAGE_ID", "VAULT_ID", "OPERATOR_CAP_ID", "OPERATOR_PRIVATE_KEY", "AGENT_PRIVATE_KEY", "FACILITATOR_PRIVATE_KEY", "MEMWAL_KEY", "MEMWAL_ACCOUNT_ID", "MEMWAL_NAMESPACE_PREFIX", "DATABASE_URL", "PUBLIC_BASE_URL", "PORT", "HOST", "MAINNET_PLAN_ID", "MAINNET_OPERATOR_TX_GAS_BUDGET_MIST", "MERCHANT_CHAINSCOPE_ADDRESS"];
const values: Record<string, string> = Object.fromEntries(allow.flatMap((key) => env(key) ? [[key, env(key)!]] : []));
values.OWNER_ADDRESS = address("owner");
const out = resolve(REPO_ROOT, ".env.mainnet.server");
const previous = existsSync(out) ? parse(readFileSync(out)) : {};
values.SISIH_AGENT_TOKEN = previous.SISIH_AGENT_TOKEN || randomBytes(32).toString("hex");
values.SISIH_OWNER_MCP_TOKEN = previous.SISIH_OWNER_MCP_TOKEN || randomBytes(32).toString("hex");
console.log(`Server env names: ${Object.keys(values).join(", ")}`);
if (!process.argv.includes("--write")) {
  console.log("PLAN ONLY. No file changed; no credential values printed.");
  process.exit(0);
}
if (values.SISIH_AGENT_TOKEN === values.SISIH_OWNER_MCP_TOKEN) throw new Error("Role tokens must differ");
writeFileSync(out, `# Local Mainnet server-only configuration; never upload wholesale.\n${Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join("\n")}\n`, { mode: 0o600 });
console.log("Wrote ignored .env.mainnet.server. OWNER_PRIVATE_KEY was excluded. Existing role tokens were preserved.");
