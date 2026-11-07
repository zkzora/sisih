/**
 * Publish contracts/sisih and create the vault, all through Tatum.
 *   1. sui move build --dump-bytecode-as-base64 --build-env <SUI_NETWORK>
 *   2. OWNER publishes (owner keeps the UpgradeCap)
 *   3. OWNER calls create_vault<USDC>(operator); the OperatorCap goes to the operator
 *   4. Writes SISIH_PACKAGE_ID, VAULT_ID, OPERATOR_CAP_ID, UPGRADE_CAP_ID to the output env file
 *
 * Without --execute it only builds locally and prints the plan: nothing is signed or broadcast.
 *   Testnet: tsx scripts/publish.ts --execute                       (writes the root .env)
 *   Mainnet: SISIH_ENV_FILE=.env.mainnet tsx scripts/publish.ts --execute  *              --manifest docs/mainnet/MANIFEST.json --out .env.mainnet.deployment
 *            The manifest must be for sui:mainnet and name this owner address. Output goes to its own
 *            file, never to .env (Testnet demo) or .env.mainnet (protected keys).
 * Refuses to run when SISIH_PACKAGE_ID is already set, unless --force.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Transaction } from "@mysten/sui/transactions";
import { target, usdcType } from "../src/chain/sisih";
import { env, suiNetwork } from "../src/lib/env";
import { upsertEnv } from "../src/lib/env-file";
import { setGas, signAndExecuteDetailed, verifyTransaction, type CreatedObject } from "../src/lib/tatum";
import { address, keypair } from "../src/lib/wallets";

const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(n);
const opt = (n: string) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : undefined);
if (flag("--help") || flag("-h")) {
  console.log("publish.ts [--execute] [--manifest <file>] [--out <env file>] [--force]. Without --execute: build and plan only, nothing broadcast.");
  process.exit(0);
}
const network = suiNetwork();
const execute = flag("--execute");
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
let outFile = resolve(repoRoot, ".env");
if (network === "mainnet") {
  const manifestPath = opt("--manifest");
  if (!manifestPath || !existsSync(resolve(repoRoot, manifestPath))) {
    console.error("Mainnet publish needs --manifest docs/mainnet/MANIFEST.json (the reviewed funding and transaction manifest).");
    process.exit(2);
  }
  const manifest = JSON.parse(readFileSync(resolve(repoRoot, manifestPath), "utf8"));
  if (manifest.network !== "sui:mainnet" || manifest.roles?.owner?.address?.toLowerCase() !== address("owner").toLowerCase()) {
    console.error("The manifest is not for sui:mainnet with this owner address. Refusing.");
    process.exit(2);
  }
  outFile = resolve(repoRoot, opt("--out") ?? ".env.mainnet.deployment");
  if (["", ".env", ".env.mainnet"].includes(basename(outFile)) || outFile.endsWith(`${sep}.env`)) {
    console.error("Mainnet output must go to its own file (for example .env.mainnet.deployment), never .env or .env.mainnet.");
    process.exit(2);
  }
  if (existsSync(outFile) && /^SISIH_PACKAGE_ID=\S/m.test(readFileSync(outFile, "utf8")) && !flag("--force")) {
    console.error(`${outFile} already has a SISIH_PACKAGE_ID. Refusing to publish again.`);
    process.exit(2);
  }
}
if (env("SISIH_PACKAGE_ID") && !flag("--force")) {
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
if (!execute) {
  console.log(`PLAN ONLY (no --execute): publish as ${address("owner")} on sui:${network} through Tatum, then create_vault<${usdcType()}>(operator ${address("operator")}); IDs would go to ${outFile}. Nothing was signed or broadcast.`);
  process.exit(0);
}

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
await setGas(pub, { budget: 200_000_000n, network });
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

if (!existsSync(outFile)) writeFileSync(outFile, `# Sisih ${network} deployment IDs (written by publish.ts; public values)\n`);
upsertEnv({ SISIH_PACKAGE_ID: packageId, VAULT_ID: vaultId, OPERATOR_CAP_ID: operatorCapId, UPGRADE_CAP_ID: upgradeCapId }, outFile);
console.log(`wrote SISIH_PACKAGE_ID, VAULT_ID, OPERATOR_CAP_ID, UPGRADE_CAP_ID to ${outFile}`);
process.exit(0);
