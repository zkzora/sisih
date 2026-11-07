/**
 * Mainnet vault setup for the bounded proof, signed with the owner's LOCAL key, through Tatum.
 * One transaction:
 * - deposit the manifest's USDC;
 * - add ONE commitment, paid to the owner's own address;
 * - set the agent policy (per-request, per-day, 7 days).
 *
 * Without --execute it prints the plan and SIMULATES the transaction through Tatum. Nothing is
 * signed or broadcast.
 *
 *   SISIH_ENV_FILE=.env.mainnet,.env.mainnet.deployment pnpm --filter @sisih/server exec tsx \
 *     scripts/mainnet/setup.ts --manifest docs/mainnet/MANIFEST.json [--execute]
 *
 * Every amount comes from the reviewed manifest and is checked against it. The deposit is built
 * with coinWithBalance, so USDC can sit in address balances or coin objects.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { coinWithBalance, Transaction } from "@mysten/sui/transactions";
import { CLOCK_ID, KIND, PRIORITY, target, usdc, usdcType, vaultId } from "../../src/chain/sisih";
import { REPO_ROOT, suiNetwork } from "../../src/lib/env";
import { setGas, signAndExecute, suiClient, verifyTransaction } from "../../src/lib/tatum";
import { address, keypair } from "../../src/lib/wallets";

const argv = process.argv.slice(2);
if (argv.includes("--help")) {
  console.log("setup.ts --manifest <file> [--execute]. Without --execute: plan and simulation only.");
  process.exit(0);
}
if (suiNetwork() !== "mainnet") {
  console.error("Refusing: this is the Mainnet proof setup (use SISIH_ENV_FILE=.env.mainnet,.env.mainnet.deployment). The Testnet demo uses seed-vault.ts.");
  process.exit(2);
}
const mPath = argv[argv.indexOf("--manifest") + 1];
if (!argv.includes("--manifest") || !mPath) {
  console.error("--manifest docs/mainnet/MANIFEST.json is required");
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(resolve(REPO_ROOT, mPath), "utf8"));
const owner = keypair("owner");
if (manifest.network !== "sui:mainnet" || manifest.roles.owner.address.toLowerCase() !== owner.toSuiAddress().toLowerCase() || manifest.asset.coin_type !== usdcType()) {
  console.error("Manifest does not match this network, owner key or asset. Refusing.");
  process.exit(2);
}
const deposit = usdc(manifest.usdc.deposit_usdc);
const commitment = usdc(manifest.usdc.commitment_usdc);
const perRequest = usdc(manifest.usdc.per_request_cap_usdc);
const perDay = usdc(manifest.usdc.per_day_cap_usdc);
if (deposit > usdc(manifest.usdc.max_allocation_usdc)) {
  console.error("Deposit exceeds the manifest's maximum USDC allocation. Refusing.");
  process.exit(2);
}
const now = BigInt(Date.now());
const month = 30n * 86_400_000n;

const tx = new Transaction();
tx.setSender(owner.toSuiAddress());
await setGas(tx, { budget: 100_000_000n, network: "mainnet" });
const vault = tx.object(vaultId());
tx.moveCall({ target: target("deposit"), typeArguments: [usdcType()], arguments: [vault, coinWithBalance({ type: usdcType(), balance: deposit })] });
tx.moveCall({
  target: target("add_obligation"),
  typeArguments: [usdcType()],
  arguments: [vault, tx.pure.string("Savings reserve"), tx.pure.address(owner.toSuiAddress()), tx.pure.u64(commitment), tx.pure.u8(KIND.fixed), tx.pure.u64(month), tx.pure.u64(now + month), tx.pure.u8(PRIORITY.must), tx.pure.string("Monthly")],
});
tx.moveCall({
  target: target("set_agent_policy"),
  typeArguments: [usdcType()],
  arguments: [vault, tx.pure.address(address("agent")), tx.pure.u64(perRequest), tx.pure.u64(perDay), tx.pure.u64(now + 7n * 86_400_000n), tx.object(CLOCK_ID)],
});

console.log(`Plan: deposit ${manifest.usdc.deposit_usdc} USDC, commitment "Savings reserve" ${manifest.usdc.commitment_usdc} to the owner's own address, agent ${address("agent")} limits ${manifest.usdc.per_request_cap_usdc}/${manifest.usdc.per_day_cap_usdc} for 7 days, on vault ${vaultId()}.`);
if (!argv.includes("--execute")) {
  const sim = await suiClient("mainnet").simulateTransaction({ transaction: tx, include: { effects: true } });
  const t = sim.Transaction ?? sim.FailedTransaction;
  console.log(`SIMULATION ONLY (no --execute): success=${t.status.success}${t.status.success ? "" : ` error=${JSON.stringify(t.status.error).slice(0, 200)}`}. Nothing was signed or broadcast.`);
  process.exit(0);
}
const res = await signAndExecute(tx, owner, "mainnet");
const v = await verifyTransaction(res.digest, { network: "mainnet" });
console.log(`setup ${res.digest} success=${res.success} verified through Tatum=${v.success} checkpoint=${v.checkpoint} gas ${(Number(v.gasMist) / 1e9).toFixed(6)} SUI`);
process.exit(res.success ? 0 : 1);
