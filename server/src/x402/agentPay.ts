/**
 * The Research Agent's x402 client. Pays an invoice with EXACTLY the coin that
 * release_to_agent just sent: the signed payload is decoded and refused unless it spends that
 * coin object and draws nothing from the agent's address balance.
 */
import { Transaction } from "@mysten/sui/transactions";
import { fromBase64 } from "@mysten/sui/utils";
import type { ClientSuiSigner } from "@tentaclepay/sui-x402";
import { ExactSuiScheme as ExactSuiClientScheme } from "@tentaclepay/sui-x402/exact/client";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import type { PaymentRequired } from "@x402/core/types";
import { keypair } from "../lib/wallets";
import { tatumRegistry, x402Network } from "./facilitator";

let http: x402HTTPClient | undefined;
function client(): x402HTTPClient {
  if (!http) {
    const kp = keypair("agent");
    const signer: ClientSuiSigner = {
      address: kp.toSuiAddress() as `0x${string}`,
      signTransaction: async (b64) => (await kp.signTransaction(fromBase64(b64))).signature,
    };
    http = new x402HTTPClient(new x402Client().register(x402Network(), new ExactSuiClientScheme(signer, { clientRegistry: tatumRegistry() })));
  }
  return http;
}

export interface Invoice {
  url: string;
  paymentRequired: PaymentRequired;
  amount: bigint;
  payTo: string;
  asset: string;
}

/** Step 1: call the merchant and read its 402 invoice. */
export async function fetchInvoice(url: string): Promise<Invoice> {
  const res = await fetch(url);
  if (res.status !== 402) throw new Error(`expected 402 from ${url}, got ${res.status}`);
  const paymentRequired = client().getPaymentRequiredResponse((h) => res.headers.get(h), await res.json());
  const req = paymentRequired.accepts[0];
  if (!req) throw new Error("402 had no payment requirements");
  return { url, paymentRequired, amount: BigInt(req.amount), payTo: req.payTo, asset: req.asset };
}

/** Refuse a payload unless it spends exactly `coinId` and no address balance. */
export function assertPaysFromCoin(txBase64: string, coinId: string): void {
  const data = Transaction.from(fromBase64(txBase64)).getData();
  const objectInputs = data.inputs.filter((i) => i.Object?.ImmOrOwnedObject).map((i) => i.Object!.ImmOrOwnedObject!.objectId);
  const fromAddressBalance = data.inputs.some((i) => i.FundsWithdrawal);
  const norm = (id: string) => id.toLowerCase().replace(/^0x0+/, "0x");
  if (fromAddressBalance) throw new Error("payment would draw from the agent's address balance, not the released coin");
  if (!objectInputs.map(norm).includes(norm(coinId))) throw new Error(`payment does not spend the released coin ${coinId}`);
}

export interface Paid {
  settleDigest: string;
  resource: unknown;
}

/** Steps 3-4: sign the payment from the released coin, send it, read the settlement. */
export async function payInvoice(inv: Invoice, coinId: string, requestId: string, onSent?: () => void): Promise<Paid> {
  const payload = await client().createPaymentPayload(inv.paymentRequired);
  assertPaysFromCoin(String((payload.payload as { transaction: string }).transaction), coinId);
  onSent?.();
  const res = await fetch(inv.url, { headers: { ...client().encodePaymentSignatureHeader(payload), "x-sisih-request-id": requestId } });
  const body = (await res.json()) as Record<string, unknown>;
  if (res.status !== 200) throw new Error(`merchant refused payment (${res.status}): ${String(body.error ?? "")} ${String(body.message ?? "")}`.trim());
  const receipt = client().getPaymentSettleResponse((h) => res.headers.get(h));
  if (!receipt.success || !receipt.transaction) throw new Error(`settlement failed: ${receipt.errorReason ?? "no digest"}`);
  return { settleDigest: receipt.transaction, resource: body };
}
