/** Initialize the durable Mainnet proof budgets after the exact plan is approved. No chain call. */
import { initDb } from "../../src/db/index";
import { env, suiNetwork } from "../../src/lib/env";
import { initializeBudget } from "../../src/mainnet/budget";
import { loadMainnetManifest } from "../../src/mainnet/manifest";
import { kvRead } from "../../src/services/state";
import { db, schema } from "../../src/db/index";

const argv = process.argv.slice(2);
const option = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
if (argv.includes("--help")) {
  console.log("init-budget.ts --manifest <file> [--execute --acknowledge <plan-id>]. Default is read-only.");
  process.exit(0);
}
if (suiNetwork() !== "mainnet") throw new Error("Mainnet configuration is required");
const path = option("--manifest");
if (!path) throw new Error("--manifest is required");
const manifest = loadMainnetManifest(path);
const expected = {
  [`${manifest.plan_id}:usdc`]: BigInt(manifest.scenario.max_merchant_outflow_base_units),
  [`${manifest.plan_id}:operator-gas`]: BigInt(manifest.gas.authorized_per_role_mist.operator),
};
console.log(JSON.stringify({ plan_id: manifest.plan_id, budgets: Object.fromEntries(Object.entries(expected).map(([k, v]) => [k, v.toString()])), writes_chain: false }, null, 2));
if (!argv.includes("--execute")) {
  console.log("PLAN ONLY. Database was not changed.");
  process.exit(0);
}
if (option("--acknowledge") !== manifest.plan_id) throw new Error(`--acknowledge ${manifest.plan_id} is required`);
await initDb();
const manifestKey = `mainnet_manifest:${manifest.plan_id}`;
const serialized = JSON.stringify(manifest);
if (!(await kvRead(manifestKey))) {
  const [session] = await db().select().from(schema.sessions).limit(1);
  const [memory] = await db().select().from(schema.memories).limit(1);
  const [request] = await db().select().from(schema.requests).limit(1);
  if (session || memory || request) throw new Error("Refusing to initialize a Mainnet proof in a database that already contains application state");
}
const deployment = Object.fromEntries(["SISIH_PACKAGE_ID", "VAULT_ID", "OPERATOR_CAP_ID"].map((key) => {
  const value = env(key);
  if (!value) throw new Error(`${key} is required before initializing runtime budgets`);
  return [key, value];
}));
const deploymentKey = `mainnet_deployment:${manifest.plan_id}`;
const deploymentJson = JSON.stringify(deployment);
await db().insert(schema.kv).values({ key: deploymentKey, value: deploymentJson }).onConflictDoNothing();
if ((await kvRead(deploymentKey)) !== deploymentJson) throw new Error("Persisted Mainnet deployment IDs differ from this configuration");
await db().insert(schema.kv).values({ key: manifestKey, value: serialized }).onConflictDoNothing();
if ((await kvRead(manifestKey)) !== serialized) throw new Error("This plan id is already bound to a different manifest; use a new approved plan");
for (const [key, authorized] of Object.entries(expected)) await initializeBudget(key, authorized);
await initializeBudget(`${manifest.plan_id}:owner-runtime-gas`, BigInt(manifest.operations.find((op) => op.id === "revoke-agent")!.gas_budget_mist));
console.log("Durable execution budgets initialized. Re-running with the same plan and amounts is idempotent.");
