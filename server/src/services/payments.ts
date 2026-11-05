/**
 * Payment execution behind an interface. Phase 2 ships a stub that records the intent;
 * Phase 3 replaces it with release_to_agent + x402 settlement.
 */
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { publish } from "../lib/bus.js";

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
    publish("request.payment", { id: t.requestId, status: "stub", note: "Phase 2 stub: no funds moved. Phase 3 releases from the vault and settles over x402." });
  },
};

let executor: PaymentExecutor = stubPaymentExecutor;

export function paymentExecutor(): PaymentExecutor {
  return executor;
}

export function setPaymentExecutor(next: PaymentExecutor): void {
  executor = next;
}
