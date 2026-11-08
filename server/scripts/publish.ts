/**
 * Publish and create the vault. Default is build/plan only. Mainnet execution requires the exact
 * validated manifest plus an acknowledgement, and journals signed bytes/digests before broadcast.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Transaction } from "@mysten/sui/transactions";
import { createHash } from "node:crypto";
import { target, usdcType } from "../src/chain/sisih";
import { env, suiNetwork } from "../src/lib/env";
import { upsertEnv } from "../src/lib/env-file";
import { setGas, signAndExecuteDetailed, suiClient, type CreatedObject } from "../src/lib/tatum";
import { address, keypair } from "../src/lib/wallets";
import { assertManifestIdentity, loadMainnetManifest, type MainnetManifest } from "../src/mainnet/manifest";
import { acquireJournalLock, journaledTransaction, loadJournal, saveJournal } from "../src/mainnet/journal";

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(name);
const option = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
if (flag("--help") || flag("-h")) {
  console.log("publish.ts [--execute --manifest <file> --acknowledge <plan-id>] [--out <file>] [--resubmit-known]. Default only builds and prints the plan.");
  process.exit(0);
}

const network = suiNetwork();
const execute = flag("--execute");
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
let outFile = resolve(repoRoot, ".env");
let manifest: MainnetManifest | null = null;
if (network === "mainnet") {
  const path = option("--manifest");
  if (!path) throw new Error("Mainnet publish requires --manifest docs/mainnet/MANIFEST.json");
  manifest = loadMainnetManifest(path);
  const sourceHash = createHash("sha256").update(readFileSync(resolve(repoRoot, "contracts/sisih/sources/vault.move"))).digest("hex");
  if (sourceHash !== manifest.primitive.source_sha256) throw new Error("Move source differs from the reviewed manifest");
  assertManifestIdentity(manifest, { owner: address("owner"), operator: address("operator"), agent: address("agent"), facilitator: address("facilitator"), asset: usdcType() });
  if (env("MERCHANT_CHAINSCOPE_ADDRESS")?.toLowerCase() !== manifest.merchant.recipient.toLowerCase()) throw new Error("MERCHANT_CHAINSCOPE_ADDRESS does not match the reviewed manifest recipient");
  outFile = resolve(repoRoot, option("--out") ?? ".env.mainnet.deployment");
  if (["", ".env", ".env.mainnet"].includes(basename(outFile)) || outFile.endsWith(`${sep}.env`)) throw new Error("Mainnet IDs must go to a separate deployment env file");
  if (execute && option("--acknowledge") !== manifest.plan_id) throw new Error(`Live execution requires --acknowledge ${manifest.plan_id}`);
}
if (network !== "mainnet" && env("SISIH_PACKAGE_ID") && !flag("--force")) throw new Error("SISIH_PACKAGE_ID already exists; use --force only for the Testnet workflow");

const contracts = resolve(repoRoot, "contracts/sisih");
const output = execFileSync("sui", ["move", "build", "--dump-bytecode-as-base64", "--build-env", network], { cwd: contracts, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const build = JSON.parse(output.slice(output.indexOf("{"))) as { modules: string[]; dependencies: string[] };
console.log(`built ${build.modules.length} module(s) for ${network}`);
if (!execute) {
  console.log(`PLAN ONLY: publish as ${address("owner")}, create_vault<${usdcType()}>(operator ${address("operator")}), write public IDs to ${outFile}. Nothing was signed or broadcast.`);
  process.exit(0);
}

if (!manifest) {
  const owner = keypair("owner");
  const pub = new Transaction();
  pub.setSender(owner.toSuiAddress());
  await setGas(pub, { budget: 200_000_000n, network });
  const [cap] = pub.publish(build);
  pub.transferObjects([cap!], owner.toSuiAddress());
  const published = await signAndExecuteDetailed(pub, owner, network);
  if (!published.success) throw new Error(`Testnet publish failed: ${published.error}`);
  const packageId = published.created.find((c) => c.type === "package")?.objectId;
  const upgrade = published.created.find((c) => c.type.endsWith("::package::UpgradeCap"))?.objectId;
  if (!packageId || !upgrade) throw new Error("Testnet publication objects missing; inspect the digest before retrying");
  if (!existsSync(outFile)) writeFileSync(outFile, "# Testnet deployment IDs\n");
  upsertEnv({ SISIH_PACKAGE_ID: packageId, UPGRADE_CAP_ID: upgrade }, outFile);
  const create = new Transaction();
  create.setSender(owner.toSuiAddress());
  await setGas(create, { network });
  create.moveCall({ target: target("create_vault", packageId), typeArguments: [usdcType()], arguments: [create.pure.address(address("operator"))] });
  const result = await signAndExecuteDetailed(create, owner, network);
  if (!result.success) throw new Error(`Testnet create_vault failed: ${result.error}`);
  const vault = result.created.find((c) => c.type.includes("::vault::Vault<"))?.objectId;
  const operator = result.created.find((c) => c.type.endsWith("::vault::OperatorCap"))?.objectId;
  if (!vault || !operator) throw new Error("Testnet vault objects missing; inspect the digest before retrying");
  upsertEnv({ VAULT_ID: vault, OPERATOR_CAP_ID: operator }, outFile);
  console.log(`Testnet publish ${published.digest}; create ${result.digest}`);
  process.exit(0);
}
const service = await suiClient("mainnet").ledgerService.getServiceInfo({});
if (service.response.chainId !== manifest.chain_id) throw new Error(`Connected chain ${service.response.chainId} does not match manifest ${manifest.chain_id}`);
const budget = (id: string) => {
  const op = manifest!.operations.find((value) => value.id === id);
  if (!op) throw new Error(`manifest operation ${id} is missing`);
  return BigInt(op.gas_budget_mist);
};
const find = (created: CreatedObject[], predicate: (value: CreatedObject) => boolean, label: string) => {
  const hit = created.find(predicate);
  if (!hit) throw new Error(`could not find ${label} in created objects: ${JSON.stringify(created)}`);
  return hit.objectId;
};
const owner = keypair("owner");
acquireJournalLock(manifest.plan_id);
const ownerAddress = owner.toSuiAddress();
const journal = loadJournal(manifest.plan_id);

const publish = new Transaction();
publish.setSender(ownerAddress);
await setGas(publish, { budget: budget("publish-package"), network: "mainnet" });
const [upgradeCap] = publish.publish({ modules: build.modules, dependencies: build.dependencies });
publish.transferObjects([upgradeCap!], ownerAddress);
const published = await journaledTransaction({ journal, operation: "publish-package", transaction: publish, signer: owner, network: "mainnet", gasAuthorizationMist: BigInt(manifest.gas.authorized_per_role_mist.owner), resubmitKnown: flag("--resubmit-known") });
if (!published.success) throw new Error(`publish failed: ${published.error}`);
const packageId = journal.ids.SISIH_PACKAGE_ID ?? find(published.created, (c) => c.type === "package", "package");
const upgradeCapId = journal.ids.UPGRADE_CAP_ID ?? find(published.created, (c) => c.type.endsWith("::package::UpgradeCap"), "UpgradeCap");
journal.ids.SISIH_PACKAGE_ID = packageId;
journal.ids.UPGRADE_CAP_ID = upgradeCapId;
saveJournal(journal);
if (!existsSync(outFile)) writeFileSync(outFile, "# Sisih Mainnet deployment IDs (public values; restart-safe journal is .sisih-mainnet/)\n");
upsertEnv({ SISIH_PACKAGE_ID: packageId, UPGRADE_CAP_ID: upgradeCapId }, outFile);
console.log(`publish ${published.digest} package ${packageId}; IDs persisted before create_vault`);

const create = new Transaction();
create.setSender(ownerAddress);
await setGas(create, { budget: budget("create-vault"), network: "mainnet" });
create.moveCall({ target: target("create_vault", packageId), typeArguments: [usdcType()], arguments: [create.pure.address(address("operator"))] });
const created = await journaledTransaction({ journal, operation: "create-vault", transaction: create, signer: owner, network: "mainnet", gasAuthorizationMist: BigInt(manifest.gas.authorized_per_role_mist.owner), resubmitKnown: flag("--resubmit-known") });
if (!created.success) throw new Error(`create_vault failed: ${created.error}`);
const vaultId = journal.ids.VAULT_ID ?? find(created.created, (c) => c.type.includes("::vault::Vault<"), "Vault");
const operatorCapId = journal.ids.OPERATOR_CAP_ID ?? find(created.created, (c) => c.type.endsWith("::vault::OperatorCap"), "OperatorCap");
journal.ids.VAULT_ID = vaultId;
journal.ids.OPERATOR_CAP_ID = operatorCapId;
saveJournal(journal);
upsertEnv({ SISIH_PACKAGE_ID: packageId, VAULT_ID: vaultId, OPERATOR_CAP_ID: operatorCapId, UPGRADE_CAP_ID: upgradeCapId }, outFile);
console.log(`create_vault ${created.digest} vault ${vaultId} operator cap ${operatorCapId}; all IDs written to ${outFile}`);
