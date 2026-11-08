/** Authenticate a read with the configured Walrus account; never writes a memory. */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { env, requireEnv, REPO_ROOT, suiNetwork } from "../../src/lib/env";
import { memwalClient } from "../../src/memory/memwal";
const argv = process.argv.slice(2);
if (argv.includes("--help")) {
  console.log("preflight-memory.ts [--write <file>]. Authenticated account read only; never writes memory.");
  process.exit(0);
}
if (suiNetwork() !== "mainnet") throw new Error("Select Mainnet proof configuration");
const client = memwalClient();
await client.listMemories({ limit: 1 });
const report = { checked_at: new Date().toISOString(), service: "Walrus Memory Mainnet", account_id: requireEnv("MEMWAL_ACCOUNT_ID"), delegate_public_key: await client.getPublicKeyHex(), authenticated_read: true, proposed_namespace: env("MEMWAL_NAMESPACE_PREFIX"), memory_write_performed: false, note: "Account authentication only; not an inventory count or proof that future writes will succeed." };
if (argv.includes("--write")) writeFileSync(resolve(REPO_ROOT, argv[argv.indexOf("--write") + 1]!), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
