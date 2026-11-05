/**
 * Payment execution behind an interface.
 *  - stubPaymentExecutor: Phase 2 placeholder (records intent only).
 *  - x402PaymentExecutor: Phase 3. release_to_agent from the vault's free pool, then the agent
 *    pays the merchant's x402 invoice with exactly that coin; both digests are proven via Tatum.
 * SSE steps per request: x402.invoice_received, x402.funds_released, x402.payment_sent,
 * x402.settle_verified (or x402.failed).
 */
import { eq } from "drizzle-orm";
import { releaseToAgent } from "../chain/vault.js";
import { usdcType } from "../chain/sisih.js";
import { db, schema } from "../db/index.js";
import { publish } from "../lib/bus.js";
import { address } from "../lib/wallets.js";
import { findMerchant, merchantAddress } from "../merchants/registry.js";
import { payInvoice, type Invoice } from "../x402/agentPay.js";
import { recordTx } from "../chain/vault.js";

export interface PaymentTarget {
  requestId: string;
  merchant: string;
  amount: bigint;
}

export interface PaymentExecutor {
  readonly name: string;
  /** Must not throw for business failures; record them on the request instead. */
  execute(target: PaymentTarget): Promise<void>;
}

export const stubPaymentExecutor: PaymentExecutor = {
  name: "stub",
  async execute(t) {
    db().update(schema.requests).set({ paymentStatus: "stub" }).where(eq(schema.requests.id, t.requestId)).run();
    publish("request.payment", { id: t.requestId, status: "stub" });
  },
};

// Invoices the agent received (402 responses), by request id. In-process: the agent runner,
// the merchants and this executor all live in the server.
const invoices = new Map<string, Invoice>();
export function attachInvoice(requestId: string, invoice: Invoice): void {
  invoices.set(requestId, invoice);
  publish("x402.invoice_received", { id: requestId, url: invoice.url, amount: invoice.amount.toString(), payTo: invoice.payTo });
}

type Digest = { step: "release" | "x402_settle"; digest: string; verified: boolean };

function setPayment(id: string, status: "pending" | "paid" | "failed", digests: Digest[], error?: string) {
  db().update(schema.requests)
    .set({ paymentStatus: status, paymentDigests: JSON.stringify(digests) })
    .where(eq(schema.requests.id, id))
    .run();
  const row = db().select().from(schema.requests).where(eq(schema.requests.id, id)).get();
  publish("request.payment", { id, status, digests, error: error ?? null, reasons: row ? JSON.parse(row.reasons) : [] });
}

export const x402PaymentExecutor: PaymentExecutor = {
  name: "x402",
  async execute(t) {
    const fail = (reason: string, digests: Digest[] = []) => {
      setPayment(t.requestId, "failed", digests, reason);
      publish("x402.failed", { id: t.requestId, reason, digests });
    };
    const inv = invoices.get(t.requestId);
    if (!inv) return fail("No x402 invoice for this request (submitted without calling the merchant).");
    const m = findMerchant(t.merchant);
    // The invoice must match the merchant registry: amount, recipient and asset.
    if (!m || inv.payTo !== merchantAddress(m) || inv.amount !== t.amount || inv.asset !== usdcType()) {
      return fail("Invoice does not match the demo merchant registry (amount, recipient or asset).");
    }
    setPayment(t.requestId, "pending", []);

    // 1. Release exactly the amount from the vault's free pool to the agent.
    const rel = await releaseToAgent(t.amount, t.requestId);
    if (!rel.ok) return fail(`Vault refused the release (${rel.code}): ${rel.reason}`, rel.digest ? [{ step: "release", digest: rel.digest, verified: false }] : []);
    const agent = address("agent");
    const coin = rel.created.find((c) => c.type.includes("::coin::Coin<") && c.type.includes(usdcType().split("::")[0]!.replace(/^0x/, "")));
    const digests: Digest[] = [{ step: "release", digest: rel.digest, verified: rel.tx.status === "verified" }];
    if (!coin) return fail("Release succeeded but the released coin was not found in its effects.", digests);
    publish("x402.funds_released", { id: t.requestId, digest: rel.digest, coinId: coin.objectId, agent, amount: t.amount.toString() });

    // 2-3. Pay the invoice from that coin; the merchant settles through the facilitator.
    try {
      const paid = await payInvoice(inv, coin.objectId, t.requestId, () => publish("x402.payment_sent", { id: t.requestId, coinId: coin.objectId }));
      // 4. Settlement proven through Tatum (the merchant recorded it; re-read is idempotent and cheap to skip).
      const row = db().select().from(schema.txLog).where(eq(schema.txLog.digest, paid.settleDigest)).get();
      const verified = row?.status === "verified" || (await recordTx(paid.settleDigest, { source: "our", label: `x402 settle: ${t.merchant} (demo)`, requestId: t.requestId, refreshVault: false })).status === "verified";
      digests.push({ step: "x402_settle", digest: paid.settleDigest, verified });
      if (!verified) return fail("Settlement digest could not be verified through Tatum.", digests);
      publish("x402.settle_verified", { id: t.requestId, digest: paid.settleDigest });
      setPayment(t.requestId, "paid", digests);
      invoices.delete(t.requestId);
    } catch (err) {
      fail(`x402 payment failed: ${(err as Error).message.slice(0, 200)}. Released funds stay with the agent until the next recycle.`, digests);
    }
  },
};

let executor: PaymentExecutor = x402PaymentExecutor;

export function paymentExecutor(): PaymentExecutor {
  return executor;
}

export function setPaymentExecutor(next: PaymentExecutor): void {
  executor = next;
}
