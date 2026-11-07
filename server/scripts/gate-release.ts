/**
 * Contract check (Phase 1 gate, reused as evidence): see src/demo/gate-release.ts.
 *   tsx scripts/gate-release.ts --help
 *   tsx scripts/gate-release.ts --yes --skip-success --amount 1.20
 * The failing transaction is executed onchain with a small explicit gas budget, so the abort has
 * a digest as evidence.
 */
import { Inputs, Transaction } from "@mysten/sui/transactions";
import { CLOCK_ID, vaultAbortName as abortName, operatorCapId, target, usdc, usdcType, vaultId } from "../src/chain/sisih";
import { runGateRelease } from "../src/demo/gate-release";
import { setGas, signAndExecuteDetailed, suiClient, verifyTransaction } from "../src/lib/tatum";
import { address, keypair } from "../src/lib/wallets";

const operator = () => keypair("operator");
const agentUsdc = async () => BigInt((await suiClient().core.getBalance({ owner: address("agent"), coinType: usdcType() })).balance.balance);

/**
 * Build release_to_agent. With unsimulated = true every input is a fully specified object
 * reference and gas payment is explicit, so the SDK skips its resolution simulation (which
 * would throw on the abort) and the node executes the transaction: the abort gets a digest.
 */
async function release(amount: bigint, requestId: string, unsimulated = false) {
  const tx = new Transaction();
  const sender = operator().toSuiAddress();
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
  return signAndExecuteDetailed(tx, operator());
}

// Arguments are checked first (src/demo/gate-release.ts): --help, unknown options and a missing
// --yes never reach release().
process.exit(
  await runGateRelease(process.argv.slice(2), {
    release: (amount, requestId, unsimulated) => release(usdc(amount), requestId, unsimulated),
    verify: (d) => verifyTransaction(d),
    agentUsdc,
    abortName: (e) => abortName(e ?? null),
    log: (l) => console.log(l),
  }),
);
