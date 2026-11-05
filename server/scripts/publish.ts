/**
 * Publish contracts/sisih and create the vault, all through Tatum.
 *   1. sui move build --dump-bytecode-as-base64 --build-env <SUI_NETWORK>
 *   2. OWNER publishes (owner keeps the UpgradeCap)
 *   3. OWNER calls create_vault<USDC>(operator); the OperatorCap goes to the operator
 *   4. Writes SISIH_PACKAGE_ID, VAULT_ID, OPERATOR_CAP_ID, UPGRADE_CAP_ID to the root .env
 * Refuses to run when SISIH_PACKAGE_ID is already set, unless --force.
 */
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Transaction } from "@mysten/sui/transactions";
import { target, usdcType } from "../src/chain/sisih";
import { env, suiNetwork } from "../src/lib/env";
import { upsertEnv } from "../src/lib/env-file";
import { setGas, signAndExecuteDetailed, verifyTransaction, type CreatedObject } from "../src/lib/tatum";
import { address, keypair } from "../src/lib/wallets";

const network = suiNetwork();
if (env("SISIH_PACKAGE_ID") && !process.argv.includes("--force")) {
  console.error(`SISIH_PACKAGE_ID is already set (${env("SISIH_PACKAGE_ID")}). Pass --force to publish a new package.`);
  process.exit(1);
}

const contracts = resolve(dirname(fileURLToPath(import.meta.url)), "../../contracts/sisih");
const out = execFileSync("sui", ["move", "build", "--dump-bytecode-as-base64", "--build-env", network], {
  cwd: contracts,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});
const build = JSON.parse(out.slice(out.indexOf("{"))) as { modules: string[]; dependencies: string[]; digest: number[] };
console.log(`built ${build.modules.length} module(s) for ${network}`);

const owner = keypair("owner");
const ownerAddr = owner.toSuiAddress();
const find = (created: CreatedObject[], pred: (c: CreatedObject) => boolean, what: string) => {
  const hit = created.find(pred);
  if (!hit) throw new Error(`could not find ${what} in created objects: ${JSON.stringify(created)}`);
  return hit.objectId;
};
const sui = (mist: bigint) => (Number(mist) / 1e9).toFixed(4);

// 1. publish
const pub = new Transaction();
pub.setSender(ownerAddr);
await setGas(pub, { budget: 500_000_000n, network });
const [upgradeCap] = pub.publish({ modules: build.modules, dependencies: build.dependencies });
pub.transferObjects([upgradeCap!], ownerAddr);
const published = await signAndExecuteDetailed(pub, owner, network);
if (!published.success) throw new Error(`publish failed: ${published.error}`);
const packageId = find(published.created, (c) => c.type === "package", "package");
const upgradeCapId = find(published.created, (c) => c.type.endsWith("::package::UpgradeCap"), "UpgradeCap");
console.log(`publish ${published.digest} package ${packageId} gas ${sui(published.gasUsedMist)} SUI`);
const pubCheck = await verifyTransaction(published.digest, { network });
console.log(`  verified through Tatum: success=${pubCheck.success} checkpoint=${pubCheck.checkpoint}`);

// 2. create_vault (retry: the gateway may route the build to a node that has not seen the package yet)
let createdVault: Awaited<ReturnType<typeof signAndExecuteDetailed>> | undefined;
for (let attempt = 1; attempt <= 6 && !createdVault; attempt++) {
  try {
    const tx = new Transaction();
    tx.setSender(ownerAddr);
    await setGas(tx, { budget: 50_000_000n, network });
    tx.moveCall({
      target: target("create_vault", packageId),
      typeArguments: [usdcType()],
      arguments: [tx.pure.address(address("operator"))],
    });
    createdVault = await signAndExecuteDetailed(tx, owner, network);
  } catch (err) {
    console.log(`  create_vault attempt ${attempt} failed: ${(err as Error).message.slice(0, 120)}`);
    await new Promise((r) => setTimeout(r, 2000));
  }
}
if (!createdVault?.success) throw new Error(`create_vault failed: ${createdVault?.error ?? "no attempt succeeded"}`);
const vaultId = find(createdVault.created, (c) => c.type.includes("::vault::Vault<"), "Vault");
const operatorCapId = find(createdVault.created, (c) => c.type.endsWith("::vault::OperatorCap"), "OperatorCap");
console.log(`create_vault ${createdVault.digest} vault ${vaultId} operator cap ${operatorCapId} gas ${sui(createdVault.gasUsedMist)} SUI`);
const vaultCheck = await verifyTransaction(createdVault.digest, { network });
console.log(`  verified through Tatum: success=${vaultCheck.success} checkpoint=${vaultCheck.checkpoint} events=${vaultCheck.events.length}`);

upsertEnv({ SISIH_PACKAGE_ID: packageId, VAULT_ID: vaultId, OPERATOR_CAP_ID: operatorCapId, UPGRADE_CAP_ID: upgradeCapId });
console.log("wrote SISIH_PACKAGE_ID, VAULT_ID, OPERATOR_CAP_ID, UPGRADE_CAP_ID to .env");
process.exit(0);
