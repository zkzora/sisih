/** Correctly scoped contract simulation after the two purchases, before final revoke. No signature. */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Transaction } from "@mysten/sui/transactions";
import { CLOCK_ID, operatorCapId, target, usdcType, vaultAbortName, vaultId } from "../../src/chain/sisih";
import { env, requireEnv, REPO_ROOT, suiNetwork } from "../../src/lib/env";
import { setGas, suiClient } from "../../src/lib/tatum";
import { loadMainnetManifest } from "../../src/mainnet/manifest";
import { verifyMainnetObjects } from "../../src/mainnet/deployment";
const argv = process.argv.slice(2);
if (argv.includes("--help")) {
  console.log("simulate-reserve.ts [--write <existing-directory/file.json>]. Simulation only; never signs or broadcasts.");
  process.exit(0);
}
if (suiNetwork() !== "mainnet") throw new Error("Select the isolated Mainnet environment");
const m = loadMainnetManifest("docs/mainnet/MANIFEST.json");
const { state } = await verifyMainnetObjects(m, { packageId: requireEnv("SISIH_PACKAGE_ID"), vaultId: vaultId(), operatorCapId: operatorCapId(), upgradeCapId: env("UPGRADE_CAP_ID") });
if (state.free !== BigInt(m.scenario.expected_final_free_base_units) || state.reserved !== BigInt(m.scenario.expected_final_reserved_base_units) || !state.policy || state.policy.paused) throw new Error("Run the two reviewed purchases first and simulate before revoking the agent");
const tx = new Transaction();
tx.setSender(m.roles.operator.address);
await setGas(tx, { budget: 20_000_000n, network: "mainnet" });
tx.moveCall({ target: target("release_to_agent"), typeArguments: [usdcType()], arguments: [tx.object(vaultId()), tx.object(operatorCapId()), tx.pure.u64(BigInt(m.merchant.price_base_units)), tx.pure.vector("u8", [...new TextEncoder().encode("mainnet-reserve-simulation")]), tx.object(CLOCK_ID)] });
const response = await suiClient("mainnet").simulateTransaction({ transaction: tx, include: { effects: true } });
const result = response.Transaction ?? response.FailedTransaction;
const error = result.status.success ? null : JSON.stringify(result.status.error);
const abort = vaultAbortName(error);
const artifact = { broadcast: false, signed: false, network: "sui:mainnet", plan_id: m.plan_id, package: requireEnv("SISIH_PACKAGE_ID"), vault: vaultId(), operator: m.roles.operator.address, amount: m.merchant.price_base_units, expected_abort: "EExceedsFree", actual_abort: abort, free: state.free.toString(), reserved: state.reserved.toString(), error };
if (argv.includes("--write")) writeFileSync(resolve(REPO_ROOT, argv[argv.indexOf("--write") + 1]!), JSON.stringify(artifact, null, 2) + "\n");
console.log(JSON.stringify(artifact, null, 2));
if (result.status.success || abort !== "EExceedsFree") process.exitCode = 1;
