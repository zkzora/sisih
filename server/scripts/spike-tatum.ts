/**
 * Spike A (testnet): every call through Tatum's Sui gRPC gateway via lib/tatum.ts.
 * 1. latest checkpoint  2. agent USDC balance  3. operator SUI self-transfer  4. read it back
 */
import { Transaction } from "@mysten/sui/transactions";
import { formatUsdc, requireEnv, suiNetwork } from "../src/lib/env";
import { setGas, signAndExecute, suiClient, tatumGrpcHost, verifyTransaction } from "../src/lib/tatum";
import { address, keypair } from "../src/lib/wallets";

const network = suiNetwork();
const client = suiClient(network);
console.log(`network ${network} via ${tatumGrpcHost(network)}`);

const { chainIdentifier } = await client.core.getChainIdentifier();
const { response: cp } = await client.ledgerService.getCheckpoint({ checkpointId: { oneofKind: undefined } });
console.log(`chain ${chainIdentifier}, latest checkpoint ${cp.checkpoint?.sequenceNumber} (${cp.checkpoint?.digest})`);

const agent = address("agent");
const usdc = await client.core.getBalance({ owner: agent, coinType: requireEnv("USDC_COIN_TYPE") });
console.log(
  `agent ${agent} USDC ${formatUsdc(BigInt(usdc.balance.balance))} ` +
    `(coin ${usdc.balance.coinBalance}, address balance ${usdc.balance.addressBalance})`,
);

const operator = keypair("operator");
const me = operator.toSuiAddress();
const tx = new Transaction();
tx.setSender(me);
await setGas(tx, { budget: 10_000_000n, network });
const [coin] = tx.splitCoins(tx.gas, [1_000n]); // 1000 MIST
tx.transferObjects([coin], me);
const sent = await signAndExecute(tx, operator, network);
console.log(`self-transfer digest ${sent.digest} success=${sent.success}${sent.error ? ` error=${sent.error}` : ""}`);

const v = await verifyTransaction(sent.digest, { network });
console.log(
  `read back through Tatum: success=${v.success} checkpoint=${v.checkpoint} ` +
    `timestampMs=${v.timestampMs} events=${v.events.length} (attempt ${v.attempts})`,
);
if (!sent.success || !v.success) process.exit(1);
process.exit(0);
