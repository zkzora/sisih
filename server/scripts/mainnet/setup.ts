/** Mainnet vault setup. Default is an exact plan; live mode is manifest-bound and journaled. */
import { coinWithBalance, Transaction } from "@mysten/sui/transactions";
import { parseVault } from "../../src/chain/vault";
import { CLOCK_ID, KIND, PRIORITY, target, usdcType, vaultId } from "../../src/chain/sisih";
import { env, suiNetwork } from "../../src/lib/env";
import { setGas, suiClient } from "../../src/lib/tatum";
import { address, keypair } from "../../src/lib/wallets";
import { acquireJournalLock, journaledTransaction, loadJournal } from "../../src/mainnet/journal";
import { assertManifestIdentity, loadMainnetManifest } from "../../src/mainnet/manifest";
import { verifyMainnetObjects } from "../../src/mainnet/deployment";

const argv = process.argv.slice(2);
const option = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
if (argv.includes("--help")) {
  console.log("setup.ts --manifest <file> [--execute --acknowledge <plan-id>] [--resubmit-known]. Default does not sign or broadcast.");
  process.exit(0);
}
if (suiNetwork() !== "mainnet") throw new Error("Select .env.mainnet plus its public runtime/deployment layers");
const path = option("--manifest");
if (!path) throw new Error("--manifest is required");
const manifest = loadMainnetManifest(path);
assertManifestIdentity(manifest, { owner: address("owner"), operator: address("operator"), agent: address("agent"), facilitator: address("facilitator"), asset: usdcType() });
if (env("MERCHANT_CHAINSCOPE_ADDRESS")?.toLowerCase() !== manifest.merchant.recipient.toLowerCase()) throw new Error("configured ChainScope recipient does not match the manifest");
const execute = argv.includes("--execute");
if (execute && option("--acknowledge") !== manifest.plan_id) throw new Error(`Live setup requires --acknowledge ${manifest.plan_id}`);
const operation = manifest.operations.find((value) => value.id === "setup-vault");
if (!operation) throw new Error("setup-vault operation is missing from the manifest");
const deposit = BigInt(manifest.scenario.deposit_base_units);
const commitment = BigInt(manifest.scenario.commitment_base_units);
const perRequest = BigInt(manifest.scenario.per_request_cap_base_units);
const perDay = BigInt(manifest.scenario.per_day_cap_base_units);
const expiry = BigInt(manifest.scenario.agent_policy_expires_ms);
const cycle = BigInt(manifest.scenario.commitment_cycle_ms);
const firstDue = BigInt(manifest.scenario.commitment_first_due_ms);
console.log(JSON.stringify({
  plan_id: manifest.plan_id,
  vault: env("VAULT_ID") ?? "not-created-yet",
  owner: address("owner"),
  agent: address("agent"),
  deposit_base_units: deposit.toString(),
  commitment_base_units: commitment.toString(),
  commitment_payee: address("owner"),
  per_request_base_units: perRequest.toString(),
  per_day_base_units: perDay.toString(),
  agent_policy_expires_ms: expiry.toString(),
  gas_budget_mist: operation.gas_budget_mist,
}, null, 2));
if (!execute) {
  console.log("PLAN ONLY. Nothing was signed, simulated or broadcast. Simulation becomes possible after publish/create_vault.");
  process.exit(0);
}
if (expiry <= BigInt(Date.now())) throw new Error("The reviewed agent policy has expired; revise and approve a new plan before setup");
if (!env("SISIH_PACKAGE_ID") || !env("VAULT_ID") || !env("OPERATOR_CAP_ID")) throw new Error("Publish/create_vault must complete and .env.mainnet.deployment must be selected first");
const service = await suiClient("mainnet").ledgerService.getServiceInfo({});
if (service.response.chainId !== manifest.chain_id) throw new Error("connected chain does not match the manifest");
acquireJournalLock(manifest.plan_id);
const journal = loadJournal(manifest.plan_id);
for (const key of ["SISIH_PACKAGE_ID", "VAULT_ID", "OPERATOR_CAP_ID"] as const) {
  if (journal.ids[key] && journal.ids[key].toLowerCase() !== env(key)?.toLowerCase()) throw new Error(`${key} differs from the restart journal`);
}

// An existing non-empty vault without this operation's journal is not safe to set up again.
await verifyMainnetObjects(manifest, { packageId: env("SISIH_PACKAGE_ID")!, vaultId: vaultId(), operatorCapId: env("OPERATOR_CAP_ID")!, upgradeCapId: env("UPGRADE_CAP_ID") });
if (!journal.operations["setup-vault"]) {
  const { object } = await suiClient("mainnet").getObject({ objectId: vaultId(), include: { json: true } });
  const state = parseVault(object.objectId, object.json as Record<string, unknown>);
  if (state.total !== 0n || state.obligations.length || state.policy) throw new Error("vault is not empty but setup-vault is absent from the journal; reconcile rather than depositing again");
}

const owner = keypair("owner");
const tx = new Transaction();
tx.setSender(owner.toSuiAddress());
await setGas(tx, { budget: BigInt(operation.gas_budget_mist), network: "mainnet" });
const vault = tx.object(vaultId());
tx.moveCall({ target: target("deposit"), typeArguments: [usdcType()], arguments: [vault, coinWithBalance({ type: usdcType(), balance: deposit })] });
tx.moveCall({
  target: target("add_obligation"),
  typeArguments: [usdcType()],
  arguments: [vault, tx.pure.string("Savings reserve"), tx.pure.address(owner.toSuiAddress()), tx.pure.u64(commitment), tx.pure.u8(KIND.fixed), tx.pure.u64(cycle), tx.pure.u64(firstDue), tx.pure.u8(PRIORITY.must), tx.pure.string("Monthly")],
});
tx.moveCall({
  target: target("set_agent_policy"),
  typeArguments: [usdcType()],
  arguments: [vault, tx.pure.address(address("agent")), tx.pure.u64(perRequest), tx.pure.u64(perDay), tx.pure.u64(expiry), tx.object(CLOCK_ID)],
});
const result = await journaledTransaction({ journal, operation: "setup-vault", transaction: tx, signer: owner, network: "mainnet", gasAuthorizationMist: BigInt(manifest.gas.authorized_per_role_mist.owner), resubmitKnown: argv.includes("--resubmit-known") });
if (!result.success) throw new Error(`setup failed: ${result.error}`);
const { object } = await suiClient("mainnet").getObject({ objectId: vaultId(), include: { json: true } });
const state = parseVault(object.objectId, object.json as Record<string, unknown>);
if (state.total !== deposit || state.reserved !== commitment || state.free !== deposit - commitment) throw new Error("setup transaction succeeded but the vault read-back does not match the manifest");
console.log(`setup ${result.digest} verified: total=${state.total} reserved=${state.reserved} free=${state.free} gas=${result.gasUsedMist} MIST`);
