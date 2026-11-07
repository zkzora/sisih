/**
 * Payment execution behind an interface.
 *  - stubPaymentExecutor: Phase 2 placeholder (records intent only).
 *  - x402PaymentExecutor: release_to_agent from the vault's free pool, then the agent pays the
 *    merchant's x402 invoice with exactly that coin; both digests are proven via Tatum.
 * The invoice is stored on the request row, so a held request approved later (by another
 * serverless instance) can still be paid.
 * SSE steps per request: x402.invoice_received, x402.funds_released, x402.payment_sent,
 * x402.settle_verified (or x402.failed).
 */
import { and, eq } from "drizzle-orm";
import { recordTx, releaseToAgent } from "../chain/vault";
import { usdcType } from "../chain/sisih";
import { db, schema } from "../db/index";
import { publish } from "../lib/bus";
import { formatUsdc } from "../lib/env";
import { address } from "../lib/wallets";
import { findMerchant, merchantAddress } from "../merchants/registry";
import { MerchantRefused, payInvoice, type Invoice } from "../x402/agentPay";
import { kvRead, kvSet } from "./state";

export const purchaseResultKey = (requestId: string) => `purchase_result:${requestId}`;
export const paymentErrorKey = (requestId: string) => `payment_error:${requestId}`;
export const paymentRecoveryKey = (requestId: string) => `payment_recovery:${requestId}`;

/**
 * What actually happened to the money when a payment did not finish. Release (vault -> agent) and
 * settlement (agent -> merchant through the facilitator) are separate transactions:
 * - not_released: the vault released nothing (refused, or the invoice did not match).
 * - released_not_sent: the vault released the amount to the agent's address, and the payment was
 *   never sent to the merchant. The released coin stays at the agent address. Only the operator
 *   can move it back, with the Testnet recycle tooling; on Mainnet it is a manual operator
 *   transfer recorded in the evidence. Sisih never releases again for this request.
 * - merchant_refused: the payment was sent and the merchant answered without settling (for example
 *   ChainScope's 503 when its live read through Tatum fails). The merchant reported no settlement,
 *   so the released coin should still be at the agent address; it was handed a signed payment, so
 *   confirm the coin is unspent through Tatum before recovering it.
 * - sent_outcome_unknown: the signed payment was sent, but no verified settlement came back
 *   (lost response, merchant error). The coin may or may not have been spent. Check the merchant's
 *   settlement and the coin through Tatum before any manual action. Sisih never pays again for
 *   this request automatically.
 */
export type PaymentRecoveryState = "not_released" | "released_not_sent" | "merchant_refused" | "sent_outcome_unknown";
export interface PaymentRecovery {
  state: PaymentRecoveryState;
  release_digest: string | null;
  released_coin_id: string | null;
  agent_address: string | null;
  amount: string;
  reason: string;
  at: number;
}

export async function paymentRecovery(requestId: string): Promise<PaymentRecovery | null> {
  const raw = await kvRead(paymentRecoveryKey(requestId));
  return raw ? (JSON.parse(raw) as PaymentRecovery) : null;
}

export async function paymentError(requestId: string): Promise<string | null> {
  return (await kvRead(paymentErrorKey(requestId))) ?? null;
}

/** The merchant's response for a settled request, or null if there is none (yet). */
export async function purchaseResult(requestId: string): Promise<unknown | null> {
  const raw = await kvRead(purchaseResultKey(requestId));
  return raw === null || raw === undefined ? null : JSON.parse(raw);
}

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
    await db().update(schema.requests).set({ paymentStatus: "stub" }).where(eq(schema.requests.id, t.requestId));
    publish("request.payment", { id: t.requestId, status: "stub" });
  },
};

export function serializeInvoice(inv: Invoice): string {
  return JSON.stringify({ ...inv, amount: inv.amount.toString() });
}

function reviveInvoice(raw: string): Invoice {
  const j = JSON.parse(raw) as Omit<Invoice, "amount"> & { amount: string };
  return { ...j, amount: BigInt(j.amount) };
}

export function invoiceReceived(requestId: string, invoice: Invoice): void {
  publish("x402.invoice_received", { id: requestId, url: invoice.url, amount: invoice.amount.toString(), payTo: invoice.payTo });
}

type Digest = { step: "release" | "x402_settle"; digest: string; verified: boolean };

async function setPayment(id: string, status: "pending" | "paid" | "failed", digests: Digest[], error?: string) {
  await db().update(schema.requests).set({ paymentStatus: status, paymentDigests: JSON.stringify(digests) }).where(eq(schema.requests.id, id));
  const [row] = await db().select().from(schema.requests).where(eq(schema.requests.id, id));
  publish("request.payment", { id, status, digests, error: error ?? null, reasons: row ? JSON.parse(row.reasons) : [] });
}

export const x402PaymentExecutor: PaymentExecutor = {
  name: "x402",
  async execute(t) {
    let releaseDigest: string | null = null;
    let coinId: string | null = null;
    let sent = false;
    let refused = false;
    const fail = async (reason: string, digests: Digest[] = []) => {
      const state: PaymentRecoveryState = !releaseDigest ? "not_released" : !sent ? "released_not_sent" : refused ? "merchant_refused" : "sent_outcome_unknown";
      const recovery: PaymentRecovery = { state, release_digest: releaseDigest, released_coin_id: coinId, agent_address: releaseDigest ? address("agent") : null, amount: t.amount.toString(), reason, at: Date.now() };
      // Recovery first: it must survive even if the status update below is lost.
      await kvSet(paymentRecoveryKey(t.requestId), JSON.stringify(recovery));
      await kvSet(paymentErrorKey(t.requestId), reason); // shown to the owner and to the agent (MCP)
      await setPayment(t.requestId, "failed", digests, reason);
      publish("x402.failed", { id: t.requestId, reason, digests, recovery: state });
    };
    const [row] = await db().select().from(schema.requests).where(eq(schema.requests.id, t.requestId));
    if (row && row.paymentStatus !== "none") return; // already claimed, paid or failed: never touch it again
    if (!row?.invoice) return fail("No x402 invoice for this request (submitted without calling the merchant).");
    const inv = reviveInvoice(row.invoice);
    const m = findMerchant(t.merchant);
    // The invoice must match the merchant registry: amount, recipient and asset.
    if (!m || inv.payTo !== merchantAddress(m) || inv.amount !== t.amount || inv.asset !== usdcType()) {
      return fail("Invoice does not match the demo merchant registry (amount, recipient or asset).");
    }
    // Claim the payment exactly once (none -> pending). A second execute for the same request (a
    // retry, a lost response, a restarted function) finds it already claimed and never releases again.
    const claimed = await db()
      .update(schema.requests)
      .set({ paymentStatus: "pending", paymentDigests: "[]" })
      .where(and(eq(schema.requests.id, t.requestId), eq(schema.requests.paymentStatus, "none")))
      .returning({ id: schema.requests.id });
    if (!claimed.length) {
      publish("x402.duplicate_execute_refused", { id: t.requestId, paymentStatus: row.paymentStatus });
      return;
    }
    await setPayment(t.requestId, "pending", []);

    // 1. Release exactly the amount from the vault's free pool to the agent.
    const rel = await releaseToAgent(t.amount, t.requestId);
    if (!rel.ok) return fail(`Vault refused the release (${rel.code}): ${rel.reason}`, rel.digest ? [{ step: "release", digest: rel.digest, verified: false }] : []);
    const agent = address("agent");
    const coin = rel.created.find((c) => c.type.includes("::coin::Coin<") && c.type.includes(usdcType().split("::")[0]!.replace(/^0x/, "")));
    const digests: Digest[] = [{ step: "release", digest: rel.digest, verified: rel.tx.status === "verified" }];
    releaseDigest = rel.digest;
    coinId = coin?.objectId ?? null;
    if (!coin) return fail("Release succeeded but the released coin was not found in its effects.", digests);
    publish("x402.funds_released", { id: t.requestId, digest: rel.digest, coinId: coin.objectId, agent, amount: t.amount.toString() });

    // 2-3. Pay the invoice from that coin; the merchant settles through the facilitator.
    try {
      const paid = await payInvoice(inv, coin.objectId, t.requestId, () => {
        sent = true;
        publish("x402.payment_sent", { id: t.requestId, coinId: coin.objectId });
      });
      // 4. Settlement proven through Tatum (the merchant recorded it; re-read only if missing).
      const [logged] = await db().select().from(schema.txLog).where(eq(schema.txLog.digest, paid.settleDigest));
      const verified =
        logged?.status === "verified" ||
        (await recordTx(paid.settleDigest, { source: "our", label: `x402 settle: ${t.merchant} (demo)`, requestId: t.requestId, refreshVault: false })).status === "verified";
      digests.push({ step: "x402_settle", digest: paid.settleDigest, verified });
      if (!verified) return fail("Settlement digest could not be verified through Tatum.", digests);
      publish("x402.settle_verified", { id: t.requestId, digest: paid.settleDigest });
      // Keep what the merchant returned for this request (the agent reads it through MCP). Written
      // before "paid", so a settled request always has its purchased content.
      await kvSet(purchaseResultKey(t.requestId), JSON.stringify(paid.resource ?? null));
      await setPayment(t.requestId, "paid", digests);
    } catch (err) {
      refused = err instanceof MerchantRefused;
      await fail(
        refused
          ? `The merchant did not settle the payment: ${(err as Error).message.slice(0, 200)}. The vault already released ${formatUsdc(t.amount)} USDC to the agent address; Sisih will not pay this request again.`
          : sent
          ? `x402 payment sent but no verified settlement came back: ${(err as Error).message.slice(0, 200)}. The released funds may or may not have reached the merchant; Sisih will not pay this request again.`
          : `x402 payment was not sent: ${(err as Error).message.slice(0, 200)}. The vault already released ${formatUsdc(t.amount)} USDC to the agent address; it stays there until the operator recovers it.`,
        digests,
      );
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
