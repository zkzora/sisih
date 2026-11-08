/** Independent read-only Mainnet identity/capability/balance verification. */
import { env, requireEnv, suiNetwork } from "../../src/lib/env";
import { verifyMainnetObjects } from "../../src/mainnet/deployment";
import { loadMainnetManifest } from "../../src/mainnet/manifest";
if (process.argv.includes("--help")) {
  console.log("verify-deployment.ts [--stage empty|setup|final]. Reads Tatum only, never signs or writes application state.");
  process.exit(0);
}
if (suiNetwork() !== "mainnet") throw new Error("Select Mainnet configuration");
const m = loadMainnetManifest("docs/mainnet/MANIFEST.json");
const result = await verifyMainnetObjects(m, { packageId: requireEnv("SISIH_PACKAGE_ID"), vaultId: requireEnv("VAULT_ID"), operatorCapId: requireEnv("OPERATOR_CAP_ID"), upgradeCapId: env("UPGRADE_CAP_ID") });
const stage = process.argv.includes("--stage") ? process.argv[process.argv.indexOf("--stage") + 1] : undefined;
const { state } = result;
if (stage === "empty" && (state.total !== 0n || state.obligations.length || state.policy)) throw new Error("Expected an empty vault");
if (stage === "setup" && (state.total !== BigInt(m.scenario.deposit_base_units) || state.reserved !== BigInt(m.scenario.commitment_base_units) || state.policy?.agent !== m.roles.agent.address || state.policy.maxPerRequest !== BigInt(m.scenario.per_request_cap_base_units) || state.policy.maxPerDay !== BigInt(m.scenario.per_day_cap_base_units) || state.policy.expiresMs !== Number(m.scenario.agent_policy_expires_ms))) throw new Error("Setup state differs from reviewed manifest");
if (stage === "final" && (state.total !== BigInt(m.scenario.expected_final_total_base_units) || state.reserved !== BigInt(m.scenario.expected_final_reserved_base_units) || state.free !== BigInt(m.scenario.expected_final_free_base_units) || state.policy)) throw new Error("Final state differs from reviewed balances/revocation");
if (stage && !["empty", "setup", "final"].includes(stage)) throw new Error("Invalid --stage");
console.log(JSON.stringify({ verified: true, stage: stage ?? "identity", ...result }, (_key, value) => typeof value === "bigint" ? value.toString() : value, 2));
