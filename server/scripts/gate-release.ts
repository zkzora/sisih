/**
 * Phase 1 gate: operator releases 0.50 to the agent (must succeed), then 5.00 (must abort
 * with EExceedsFree: within the 5.00 per-request cap, but only 3.00 is free).
 * The failing transaction is executed on-chain with a small explicit gas budget, so the
 * abort has a digest as evidence.
 */
import { Inputs, Transaction } from "@mysten/sui/transactions";
import { CLOCK_ID, vaultAbortName as abortName, operatorCapId, target, usdc, usdcType, vaultId } from "../src/chain/sisih.js";
import { formatUsdc } from "../src/lib/env.js";
import { setGas, signAndExecuteDetailed, suiClient, verifyTransaction } from "../src/lib/tatum.js";
import { address, keypair } from "../src/lib/wallets.js";

const operator = keypair("operator");
const agent = address("agent");
const agentUsdc = async () => BigInt((await suiClient().core.getBalance({ owner: agent, coinType: usdcType() })).balance.balance);

/**
 * Build release_to_agent. With unsimulated = true every input is a fully specified object
 * reference and gas payment is explicit, so the SDK skips its resolution simulation (which
 * would throw on the abort) and the node executes the transaction: the abort gets a digest.
 */
async function release(amount: bigint, requestId: string, unsimulated = false) {
  const tx = new Transaction();
  const sender = operator.toSuiAddress();
  tx.setSender(sender);
  await setGas(tx, { budget: 20_000_000n });
  let vaultArg, capArg, clockArg;
  if (unsimulated) {
    const client = suiClient();
    const { object: vault } = await client.getObject({ objectId: vaultId() });
    if (vault.owner.$kind !== "Shared") throw new Error("vault is not shared");
    const { object: cap } = await client.getObject({ objectId: operatorCapId() });
    const { objects: coins } = await client.core.listCoins({ owner: sender, coinType: "0x2::sui::SUI" });
    const big = [...coins].sort((a, b) => (BigInt(b.balance) > BigInt(a.balance) ? 1 : -1))[0]; // largest, skip dust
    if (big && BigInt(big.balance) >= 20_000_000n) {
      tx.setGasPayment([{ objectId: big.objectId, version: big.version, digest: big.digest }]);
    } else {
      // Faucet SUI sits in the address balance: pay gas from it. That needs a ValidDuring
      // expiration (replay protection without a gas object version).
      const [{ systemState }, { chainIdentifier }] = await Promise.all([
        client.core.getCurrentSystemState(),
        client.core.getChainIdentifier(),
      ]);
      const epoch = Number(systemState.epoch);
      tx.setGasPayment([]);
      tx.setExpiration({
        ValidDuring: { chain: chainIdentifier, minEpoch: epoch, maxEpoch: epoch + 1, minTimestamp: null, maxTimestamp: null, nonce: (Math.random() * 2 ** 32) >>> 0 },
      });
    }
    vaultArg = tx.object(Inputs.SharedObjectRef({ objectId: vault.objectId, mutable: true, initialSharedVersion: vault.owner.Shared.initialSharedVersion }));
    capArg = tx.object(Inputs.ObjectRef({ objectId: cap.objectId, version: cap.version, digest: cap.digest }));
    clockArg = tx.object(Inputs.SharedObjectRef({ objectId: CLOCK_ID, mutable: false, initialSharedVersion: 1 }));
  } else {
    vaultArg = tx.object(vaultId());
    capArg = tx.object(operatorCapId());
    clockArg = tx.object(CLOCK_ID);
  }
  tx.moveCall({
    target: target("release_to_agent"),
    typeArguments: [usdcType()],
    arguments: [vaultArg, capArg, tx.pure.u64(amount), tx.pure.vector("u8", [...new TextEncoder().encode(requestId)]), clockArg],
  });
  return signAndExecuteDetailed(tx, operator);
}

let okPass = true;
if (!process.argv.includes("--skip-success")) {
  const before = await agentUsdc();
  const ok = await release(usdc("0.50"), "gate-0.50");
  const okV = await verifyTransaction(ok.digest);
  const after = await agentUsdc();
  console.log(`release 0.50: ${ok.digest} success=${ok.success} verified=${okV.success} agent USDC ${formatUsdc(before)} -> ${formatUsdc(after)}`);
  okPass = ok.success && okV.success && after - before === usdc("0.50");
}

const bad = await release(usdc("5.00"), "gate-5.00", true);
const badV = await verifyTransaction(bad.digest);
console.log(`release 5.00: ${bad.digest} success=${bad.success} verified-on-chain=${!badV.success ? "failed as expected" : "UNEXPECTED SUCCESS"}`);
console.log(`  abort: ${abortName(bad.error)}  raw: ${bad.error?.slice(0, 300)}`);

const pass = okPass && !bad.success && !badV.success && abortName(bad.error) === "EExceedsFree";
console.log(pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
