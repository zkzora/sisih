/** Read deployed native Allowance entry points through the selected Mainnet Tatum gateway. */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT, suiNetwork } from "../../src/lib/env";
import { suiClient } from "../../src/lib/tatum";
const argv = process.argv.slice(2);
if (argv.includes("--help")) {
  console.log("inspect-primitives.ts [--write <file>]. Read-only deployed framework inspection; no signatures or broadcasts.");
  process.exit(0);
}
if (suiNetwork() !== "mainnet") throw new Error("Select isolated Mainnet configuration");
const client = suiClient("mainnet");
const info = await client.ledgerService.getServiceInfo({});
const functions: Array<Record<string, unknown>> = [];
for (const name of ["new", "balance_spend", "app_balance_spend"]) {
  try {
    const response = await client.movePackageService.getFunction({ packageId: "0x2", moduleName: "allowance", name });
    functions.push({ target: `0x2::allowance::${name}`, present: Boolean(response.response.function), descriptor: response.response.function });
  } catch (err) {
    functions.push({ target: `0x2::allowance::${name}`, present: false, error: (err as Error).message });
  }
}
const report = { inspected_at: new Date().toISOString(), network: "sui:mainnet", chain_id: info.response.chainId, checkpoint: String(info.response.checkpointHeight), transport: "Tatum native gRPC MovePackageService.GetFunction", signed: false, broadcast: false, functions, interpretation: "Deployed function availability is distinct from an app-bound reserve implementation. The selected proof still uses the independently exercised Sisih vault." };
const text = JSON.stringify(report, (_key, value) => typeof value === "bigint" ? value.toString() : value, 2);
if (argv.includes("--write")) writeFileSync(resolve(REPO_ROOT, argv[argv.indexOf("--write") + 1]!), text + "\n");
console.log(text);
