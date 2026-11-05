/**
 * Testnet plumbing: operator -> agent USDC for spikes and tests.
 *   pnpm tsx scripts/fund-agent.ts coin 0.01     -> agent receives a Coin object
 *   pnpm tsx scripts/fund-agent.ts address 0.01  -> agent receives into its address balance
 * Draws from the operator with coinWithBalance / tx.balance, so it works whether the operator's
 * USDC sits in coin objects or in its address balance.
 */
import { Transaction, coinWithBalance } from "@mysten/sui/transactions";
import { formatUsdc, requireEnv, suiNetwork } from "../src/lib/env";
import { setGas, signAndExecute, suiClient, verifyTransaction } from "../src/lib/tatum";
import { address, keypair } from "../src/lib/wallets";

const [mode = "coin", amountArg = "0.01"] = process.argv.slice(2);
if (mode !== "coin" && mode !== "address") throw new Error("mode must be coin or address");
if (suiNetwork() !== "testnet") throw new Error("fund-agent is testnet plumbing only");
const amount = BigInt(Math.round(Number(amountArg) * 1_000_000));
const USDC = requireEnv("USDC_COIN_TYPE");

const operator = keypair("operator");
const agent = address("agent");
const tx = new Transaction();
tx.setSender(operator.toSuiAddress());
await setGas(tx, { budget: 10_000_000n });
if (mode === "coin") {
  tx.transferObjects([coinWithBalance({ type: USDC, balance: amount })], agent);
} else {
  tx.moveCall({
    target: "0x2::balance::send_funds",
    typeArguments: [USDC],
    arguments: [tx.balance({ type: USDC, balance: amount, useGasCoin: false }), tx.pure.address(agent)],
  });
}
const sent = await signAndExecute(tx, operator);
const v = await verifyTransaction(sent.digest);
const b = (await suiClient().core.getBalance({ owner: agent, coinType: USDC })).balance;
console.log(`sent ${formatUsdc(amount)} USDC to agent as ${mode}: ${sent.digest} success=${v.success}`);
console.log(`agent now: coin ${b.coinBalance}, address balance ${b.addressBalance}`);
process.exit(v.success ? 0 : 1);
