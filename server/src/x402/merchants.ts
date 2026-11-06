/**
 * Demo merchants (labeled demo in code, API responses and UI). Each route answers 402 first
 * with x402 V2 payment requirements, then verifies + settles the PAYMENT-SIGNATURE through the
 * facilitator and returns a small demo payload with PAYMENT-RESPONSE.
 */
import type { PaymentRequired, PaymentRequirements } from "@x402/core/types";
import { decodePaymentSignatureHeader, encodePaymentRequiredHeader, encodePaymentResponseHeader } from "@x402/core/http";
import { Hono } from "hono";
import { usdcType } from "../chain/sisih";
import { recordTx } from "../chain/vault";
import { publish } from "../lib/bus";
import { MERCHANTS, merchantAddress, type Merchant } from "../merchants/registry";
import { x402Facilitator, x402Network } from "./facilitator";

export function baseUrl(): string {
  // Hosted: the public deployment URL (the agent calls the demo merchants over real HTTP).
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return `http://127.0.0.1:${process.env.PORT ?? 8787}`;
}

export function requirementsFor(m: Merchant): PaymentRequirements {
  const payTo = merchantAddress(m);
  if (!payTo) throw new Error(`${m.addressEnv} is not set`);
  return {
    scheme: "exact",
    network: x402Network(),
    asset: usdcType(),
    amount: m.price.toString(),
    payTo,
    maxTimeoutSeconds: 120,
    extra: x402Facilitator().getExtra(x402Network()) as Record<string, unknown>,
  };
}

function paymentRequired(m: Merchant): PaymentRequired {
  return {
    x402Version: 2,
    resource: { url: `${baseUrl()}${m.path}`, description: `${m.name} (demo): ${m.item}`, mimeType: "application/json" },
    accepts: [requirementsFor(m)],
  };
}

/**
 * Fixed demo content. It is the same for every buyer and is NOT real-world or current market
 * data; every payload says so, so an agent quoting it can tell the user.
 */
const DEMO_NOTICE = "Demo service content from Sisih's demo merchant. Fixed sample data, not real-world or current market data.";
const DEMO_PAYLOADS: Record<Merchant["slug"], unknown> = {
  datamart: {
    notice: DEMO_NOTICE,
    series: "SUI/USD daily close (demo sample)",
    unit: "USD",
    points: [
      { day: 1, close: 1.12 },
      { day: 2, close: 1.18 },
      { day: 3, close: 1.15 },
      { day: 4, close: 1.21 },
    ],
    summary: "In this 4-day demo sample the close rose from 1.12 to 1.21 (+8.0%), with one dip on day 3.",
  },
  searchbox: {
    notice: DEMO_NOTICE,
    query: "SUI token price drivers",
    results: [
      { title: "Demo result: network activity and transaction fees", snippet: "Sample text: higher onchain activity is often cited as a driver of token demand." },
      { title: "Demo result: token unlock schedules", snippet: "Sample text: scheduled unlocks can add supply and are commonly tracked by analysts." },
      { title: "Demo result: stablecoin liquidity on the network", snippet: "Sample text: stablecoin supply on a chain is a common proxy for available liquidity." },
    ],
  },
  reportlab: {
    notice: DEMO_NOTICE,
    title: "Onchain activity report (demo)",
    sections: [
      { heading: "Activity", text: "Sample text: daily transactions trended up over the sample period." },
      { heading: "Liquidity", text: "Sample text: stablecoin balances were stable." },
      { heading: "Risks", text: "Sample text: supply unlocks are the main tracked risk." },
    ],
  },
};

export function merchantRoutes(): Hono {
  const app = new Hono();
  for (const m of MERCHANTS) {
    app.get(m.path, async (c) => {
      const sig = c.req.header("PAYMENT-SIGNATURE");
      const required = paymentRequired(m);
      if (!sig) {
        c.header("PAYMENT-REQUIRED", encodePaymentRequiredHeader(required));
        return c.json({ ...required, error: "payment required", merchant: m.name, demo: true }, 402);
      }
      const requirements = required.accepts[0]!;
      const payload = decodePaymentSignatureHeader(sig);
      const verify = await x402Facilitator().verify(payload, requirements);
      if (!verify.isValid) return c.json({ error: verify.invalidReason, message: verify.invalidMessage, demo: true }, 402);
      const settle = await x402Facilitator().settle(payload, requirements);
      // The library reports success:true with an empty digest when verify fails inside settle.
      if (!settle.success || !settle.transaction) return c.json({ error: settle.errorReason ?? "settle failed", message: settle.errorMessage, demo: true }, 402);
      const requestId = c.req.header("x-sisih-request-id") ?? undefined;
      // Proof through Tatum: 1 GetTransaction. Settlement does not touch the vault, so no vault read.
      const rec = await recordTx(settle.transaction, { source: "our", label: `x402 settle: ${m.name} (demo)`, requestId, refreshVault: false });
      publish("x402.settled", { merchant: m.name, digest: settle.transaction, verified: rec.status === "verified", requestId });
      c.header("PAYMENT-RESPONSE", encodePaymentResponseHeader(settle));
      return c.json({ demo: true, merchant: `${m.name} (demo)`, item: m.item, data: DEMO_PAYLOADS[m.slug], settlement: settle.transaction });
    });
  }
  return app;
}
