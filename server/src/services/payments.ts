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
import { markReleaseBudgetUnknown, recordFailedReleaseBudget, recordReleaseBudget, releasePurchaseBudget, reservePurchaseBudget, resolveReleaseBudget, type PurchaseBudgetReservation } from "../mainnet/runtime";
import { verifyTransaction } from "../lib/tatum";
import { isMainnet, suiNetwork } from "../lib/env";
import { verifyMainnetSettlement } from "../mainnet/settlement";
import { MerchantRefused, payInvoice, type Invoice } from "../x402/agentPay";
import { kvRead, kvSet } from "./state";

export const purchaseResultKey = (requestId: string) => `purchase_result:${requestId}`;
export const paymentErrorKey = (requestId: string) => `payment_error:${requestId}`;
export const paymentRecoveryKey = (requestId: string) => `payment_recovery:${requestId}`;
export const merchantResultKey = (requestId: string) => `merchant_result:${requestId}`;
export const merchantPendingResultKey = (requestId: string) => `merchant_pending_result:${requestId}`;

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
export type PaymentRecoveryState = "not_released" | "release_outcome_unknown" | "released_not_sent" | "merchant_refused" | "sent_outcome_unknown";
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

/**
 * Read-only chain reconciliation for a stopped payment. It never signs, broadcasts or retries.
 * A release timeout is resolved from its known digest. A lost merchant response is resolved from
 * the merchant's durable result plus its verified settlement tx_log row.
 */
export async function reconcilePaymentRecovery(requestId: string): Promise<PaymentRecovery | null> {
  let recovery = await paymentRecovery(requestId);
  if (!recovery) {
    const prepared = await kvRead(`release_prepared:${requestId}`);
    const [request] = await db().select().from(schema.requests).where(eq(schema.requests.id, requestId));
    if (prepared && request?.paymentStatus === "pending") {
      recovery = { state: "release_outcome_unknown", release_digest: JSON.parse(prepared).digest, released_coin_id: null, agent_address: address("agent"), amount: request.amount, reason: "Process stopped after preparing release; read-back required.", at: Date.now() };
    }
  }
  if (!recovery) return null;
  if (recovery.state === "release_outcome_unknown" && recovery.release_digest) {
    const v = await verifyTransaction(recovery.release_digest, { network: suiNetwork(), tries: 3 });
    const coin = v.created.find((c) => c.type.includes("::coin::Coin<") && c.type.includes(usdcType().split("::")[0]!.replace(/^0x/, "")));
    await resolveReleaseBudget(requestId, { spent: v.success, amount: BigInt(recovery.amount), gasMist: v.gasMist, digest: recovery.release_digest });
    const next: PaymentRecovery = v.success
      ? { ...recovery, state: "released_not_sent", released_coin_id: coin?.objectId ?? null, reason: "Release verified onchain after an unknown transport outcome; no merchant payment was sent." }
      : { ...recovery, state: "not_released", release_digest: recovery.release_digest, released_coin_id: null, agent_address: null, reason: "Release transaction was found and failed onchain; no funds left the vault." };
    await kvSet(paymentRecoveryKey(requestId), JSON.stringify(next));
    await kvSet(paymentErrorKey(requestId), next.reason);
    return next;
  }
  if (recovery.state === "sent_outcome_unknown") {
    const prepared = await kvRead(`settlement_prepared:${requestId}`);
    if (isMainnet() && prepared) {
      const [request] = await db().select().from(schema.requests).where(eq(schema.requests.id, requestId));
      if (!request?.invoice) throw new Error("Cannot reconcile without the exact stored invoice");
      const digest = JSON.parse(prepared).digest as string;
      await verifyMainnetSettlement(digest, reviveInvoice(request.invoice));
      await recordTx(digest, { source: "our", label: "x402 settle: ChainScope (reconciled)", requestId, refreshVault: false });
      const pending = await kvRead(merchantPendingResultKey(requestId));
      if (pending) await kvSet(merchantResultKey(requestId), JSON.stringify({ ...JSON.parse(pending), settlement: digest }));
    }
    const settlements = await db().select().from(schema.txLog).where(and(eq(schema.txLog.requestId, requestId), eq(schema.txLog.status, "verified")));
    const settle = settlements.find((r) => r.label?.startsWith("x402 settle:"));
    const result = await kvRead(merchantResultKey(requestId));
    if (settle && result !== undefined) {
      await kvSet(purchaseResultKey(requestId), result);
      await setPayment(requestId, "paid", [
        ...(recovery.release_digest ? [{ step: "release" as const, digest: recovery.release_digest, verified: true }] : []),
        { step: "x402_settle", digest: settle.digest, verified: true },
      ]);
      await kvSet(paymentErrorKey(requestId), "");
      return null;
    }
  }
  return recovery;
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
    let releaseUnknown = false;
    let budget: PurchaseBudgetReservation | null = null;
    const fail = async (reason: string, digests: Digest[] = []) => {
      const state: PaymentRecoveryState = releaseUnknown ? "release_outcome_unknown" : !releaseDigest ? "not_released" : !sent ? "released_not_sent" : refused ? "merchant_refused" : "sent_outcome_unknown";
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

    try {
      budget = await reservePurchaseBudget(t.requestId, t.amount);
    } catch (err) {
      return fail(`Mainnet execution budget refused this purchase: ${(err as Error).message}`);
    }

    // 1. Release exactly the amount from the vault's free pool to the agent.
    let rel;
    try {
      rel = await releaseToAgent(t.amount, t.requestId);
    } catch (err) {
      // The submission helper converts all post-submit transport errors to stage=unknown.
      // A throw here is a build/read error before submission; no replacement is attempted.
      await releasePurchaseBudget(budget);
      return fail(`Release could not be built: ${(err as Error).message}`);
    }
    if (!rel.ok) {
      if (rel.stage === "unknown" && rel.digest) {
        releaseDigest = rel.digest;
        releaseUnknown = true;
        await markReleaseBudgetUnknown(budget, rel.digest);
      } else if (rel.digest && budget) {
        const verified = await verifyTransaction(rel.digest, { tries: 3 });
        await recordFailedReleaseBudget(budget, verified.gasMist, rel.digest);
      } else {
        await releasePurchaseBudget(budget);
      }
      return fail(`Vault refused or could not confirm the release (${rel.code}): ${rel.reason}`, rel.digest ? [{ step: "release", digest: rel.digest, verified: false }] : []);
    }
    const agent = address("agent");
    const coin = rel.created.find((c) => c.type.includes("::coin::Coin<") && c.type.includes(usdcType().split("::")[0]!.replace(/^0x/, "")));
    const digests: Digest[] = [{ step: "release", digest: rel.digest, verified: rel.tx.status === "verified" }];
    releaseDigest = rel.digest;
    coinId = coin?.objectId ?? null;
    try {
      await recordReleaseBudget(budget, t.amount, rel.tx.gasMist ?? budget?.gasMaximum ?? 0n, rel.digest);
    } catch (err) {
      return fail(`Release succeeded, but its persistent budget accounting needs reconciliation: ${(err as Error).message}`, digests);
    }
    if (!coin) return fail("Release succeeded but the released coin was not found in its effects.", digests);
    if (rel.tx.status !== "verified") return fail("Release executed, but independent Tatum read-back has not verified it. Reconcile before merchant settlement.", digests);
    await kvSet(paymentRecoveryKey(t.requestId), JSON.stringify({ state: "released_not_sent", release_digest: rel.digest, released_coin_id: coin.objectId, agent_address: agent, amount: t.amount.toString(), reason: "Release completed; merchant payment not sent yet.", at: Date.now() } satisfies PaymentRecovery));
    publish("x402.funds_released", { id: t.requestId, digest: rel.digest, coinId: coin.objectId, agent, amount: t.amount.toString() });

    // 2-3. Pay the invoice from that coin; the merchant settles through the facilitator.
    try {
      const paid = await payInvoice(inv, coin.objectId, t.requestId, async (digest) => {
        await kvSet(`settlement_prepared:${t.requestId}`, JSON.stringify({ digest }));
        await kvSet(paymentRecoveryKey(t.requestId), JSON.stringify({ state: "sent_outcome_unknown", release_digest: rel.digest, released_coin_id: coin.objectId, agent_address: agent, amount: t.amount.toString(), reason: "Signed payment is being sent; reconcile if the process stops.", at: Date.now() } satisfies PaymentRecovery));
        sent = true;
        publish("x402.payment_sent", { id: t.requestId, coinId: coin.objectId });
      });
      if (isMainnet()) await verifyMainnetSettlement(paid.settleDigest, inv);
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
