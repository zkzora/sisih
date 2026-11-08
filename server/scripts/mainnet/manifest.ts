/** Validate and print the reviewed manifest; never silently changes authorization. */
import { loadMainnetManifest } from "../../src/mainnet/manifest";
const argv = process.argv.slice(2);
if (argv.includes("--help")) {
  console.log("manifest.ts [--manifest <file>]. Read-only validation; no signatures, writes or broadcasts.");
  process.exit(0);
}
const path = argv.includes("--manifest") ? argv[argv.indexOf("--manifest") + 1] : "docs/mainnet/MANIFEST.json";
if (!path) throw new Error("--manifest needs a path");
const m = loadMainnetManifest(path);
console.log(JSON.stringify({ valid: true, plan_id: m.plan_id, approval: m.approval, execution_origin: m.deployment.execution_origin, max_usdc_allocation: m.scenario.deposit_base_units, max_merchant_outflow: m.scenario.max_merchant_outflow_base_units, gas_authorization_mist: m.gas.authorized_per_role_mist, aggregate_gas_mist: m.gas.aggregate_authorized_mist }, null, 2));
