import { normalizeStructTag, normalizeSuiAddress } from "@mysten/sui/utils";
import { suiClient } from "../lib/tatum";
import { address } from "../lib/wallets";
import type { Invoice } from "../x402/agentPay";

export interface SettlementObservation {
  success: boolean;
  sender: string;
  gasOwner: string;
  gasBudget: bigint;
  balances: Array<{ address: string; coinType: string; amount: string }>;
}

export function assertSettlementEffects(observed: SettlementObservation, expected: { agent: string; facilitator: string; recipient: string; asset: string; amount: bigint }): void {
  if (!observed.success) throw new Error("Settlement transaction failed onchain");
  const same = (a: string, b: string) => normalizeSuiAddress(a) === normalizeSuiAddress(b);
  if (!same(observed.sender, expected.agent) || !same(observed.gasOwner, expected.facilitator)) throw new Error("Settlement signer or gas owner differs from the reviewed roles");
  if (observed.gasBudget !== 0n) throw new Error("Mainnet proof authorizes gasless settlement only");
  const changes = observed.balances.filter((b) => normalizeStructTag(b.coinType) === normalizeStructTag(expected.asset));
  if (!changes.some((b) => same(b.address, expected.recipient) && BigInt(b.amount) === expected.amount)) throw new Error("Settlement recipient/asset/amount mismatch");
  if (!changes.some((b) => same(b.address, expected.agent) && BigInt(b.amount) === -expected.amount)) throw new Error("Settlement payer debit does not equal the reviewed amount");
  if (changes.some((b) => !same(b.address, expected.agent) && !same(b.address, expected.recipient))) throw new Error("Settlement contains an unexpected USDC transfer");
}

export async function verifyMainnetSettlement(digest: string, invoice: Invoice): Promise<void> {
  const result = await suiClient("mainnet").core.getTransaction({ digest, include: { transaction: true, balanceChanges: true } });
  const tx = result.Transaction ?? result.FailedTransaction;
  assertSettlementEffects({ success: tx.status.success, sender: tx.transaction.sender ?? "", gasOwner: tx.transaction.gasData.owner ?? "", gasBudget: BigInt(tx.transaction.gasData.budget ?? "0"), balances: tx.balanceChanges }, {
    agent: address("agent"), facilitator: address("facilitator"), recipient: invoice.payTo, asset: invoice.asset, amount: invoice.amount,
  });
}
