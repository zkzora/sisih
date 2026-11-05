/**
 * Spike C (Sui testnet, USDC): x402 "exact" end to end with @tentaclepay/sui-x402 + @x402/core.
 *   demo merchant route (402 for 0.01 USDC) -> agent client pays -> facilitator verifies,
 *   co-signs as gas owner and executes -> merchant returns the resource + PAYMENT-RESPONSE.
 * Every Sui call goes through lib/tatum.ts (clientRegistry overrides the library's fullnode).
 * Also answers: does the library pay from coin objects, address balances, or both?
 */
import { serve } from "@hono/node-server";
import { fromBase64 } from "@mysten/sui/utils";
import { createSuiClientRegistry, toFacilitatorSuiSigner, type ClientSuiSigner } from "@tentaclepay/sui-x402";
import { ExactSuiScheme as ExactSuiClientScheme } from "@tentaclepay/sui-x402/exact/client";
import { ExactSuiScheme as ExactSuiFacilitatorScheme } from "@tentaclepay/sui-x402/exact/facilitator";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import {
  decodePaymentSignatureHeader,
  encodePaymentRequiredHeader,
  encodePaymentResponseHeader,
} from "@x402/core/http";
import type { PaymentRequired, PaymentRequirements } from "@x402/core/types";
import { Hono } from "hono";
import { formatUsdc, requireEnv } from "../src/lib/env";
import { suiClient, verifyTransaction } from "../src/lib/tatum";
import { keypair } from "../src/lib/wallets";

const NETWORK = "sui:testnet" as const;
const PRICE = 10_000n; // 0.01 USDC in base units
const PORT = 4402;
const USDC = requireEnv("USDC_COIN_TYPE");
const MERCHANT = requireEnv("MERCHANT_DATAMART_ADDRESS") as `0x${string}`;

const sui = suiClient("testnet");
const registry = createSuiClientRegistry();
registry.set(NETWORK, sui); // route the library through Tatum instead of its default fullnode

// --- facilitator (gas owner) ---
const facKp = keypair("facilitator");
const facilitator = new ExactSuiFacilitatorScheme(
  toFacilitatorSuiSigner({
    address: facKp.toSuiAddress() as `0x${string}`,
    signTransaction: async (b64) => (await facKp.signTransaction(fromBase64(b64))).signature,
  }),
  { clientRegistry: registry },
);

// --- demo merchant (labeled demo) ---
const requirements: PaymentRequirements = {
  scheme: "exact",
  network: NETWORK,
  asset: USDC,
  amount: PRICE.toString(),
  payTo: MERCHANT,
  maxTimeoutSeconds: 120,
  extra: facilitator.getExtra(NETWORK) as Record<string, unknown>,
};
const paymentRequired: PaymentRequired = {
  x402Version: 2,
  resource: { url: `http://127.0.0.1:${PORT}/merchants/datamart/spike`, description: "DataMart (demo) spike resource", mimeType: "application/json" },
  accepts: [requirements],
};

let settledDigest = "";
const app = new Hono();
app.get("/merchants/datamart/spike", async (c) => {
  const sig = c.req.header("PAYMENT-SIGNATURE");
  if (!sig) {
    c.header("PAYMENT-REQUIRED", encodePaymentRequiredHeader(paymentRequired));
    return c.json({ ...paymentRequired, error: "payment required", demo: true }, 402);
  }
  const payload = decodePaymentSignatureHeader(sig);
  const verify = await facilitator.verify(payload, requirements);
  console.log("facilitator.verify:", JSON.stringify(verify));
  if (!verify.isValid) return c.json({ error: verify.invalidReason, demo: true }, 402);
  const settle = await facilitator.settle(payload, requirements);
  console.log("facilitator.settle:", JSON.stringify(settle));
  // settle() reports success:true with an empty digest when verification fails; never trust it alone.
  if (!settle.success || !settle.transaction) return c.json({ error: settle.errorReason ?? "settle failed", demo: true }, 402);
  settledDigest = settle.transaction;
  c.header("PAYMENT-RESPONSE", encodePaymentResponseHeader(settle));
  return c.json({ demo: true, merchant: "DataMart (demo)", data: { note: "spike resource" } });
});
const server = serve({ fetch: app.fetch, port: PORT, hostname: "127.0.0.1" });

// --- agent client ---
const agentKp = keypair("agent");
const agent = agentKp.toSuiAddress();
const signer: ClientSuiSigner = {
  address: agent as `0x${string}`,
  signTransaction: async (b64) => (await agentKp.signTransaction(fromBase64(b64))).signature,
};
const httpClient = new x402HTTPClient(
  new x402Client().register(NETWORK, new ExactSuiClientScheme(signer, { clientRegistry: registry })),
);

const balance = async (owner: string) => (await sui.core.getBalance({ owner, coinType: USDC })).balance;
const before = { agent: await balance(agent), merchant: await balance(MERCHANT) };
console.log("agent before   ", JSON.stringify(before.agent));
console.log("merchant before", JSON.stringify(before.merchant));

let exitCode = 1;
try {
  const url = paymentRequired.resource.url;
  const first = await fetch(url);
  console.log(`GET -> ${first.status}`);
  const required = httpClient.getPaymentRequiredResponse((h) => first.headers.get(h), await first.json());
  const payload = await httpClient.createPaymentPayload(required);
  const second = await fetch(url, { headers: httpClient.encodePaymentSignatureHeader(payload) });
  const body = await second.json();
  console.log(`GET with PAYMENT-SIGNATURE -> ${second.status}`, JSON.stringify(body));
  if (second.status !== 200) throw new Error("payment was not accepted");
  const receipt = httpClient.getPaymentSettleResponse((h) => second.headers.get(h));
  console.log("PAYMENT-RESPONSE:", JSON.stringify(receipt));

  const v = await verifyTransaction(receipt.transaction, { network: "testnet" });
  console.log(`settlement verified through Tatum: digest=${v.digest} success=${v.success} checkpoint=${v.checkpoint} (attempt ${v.attempts})`);

  const after = { agent: await balance(agent), merchant: await balance(MERCHANT) };
  console.log("agent after    ", JSON.stringify(after.agent));
  console.log("merchant after ", JSON.stringify(after.merchant));
  const paid = BigInt(before.agent.balance) - BigInt(after.agent.balance);
  const got = BigInt(after.merchant.balance) - BigInt(before.merchant.balance);
  console.log(`agent paid ${formatUsdc(paid)} USDC (${paid} base units), merchant received ${got} base units`);
  console.log(
    `agent funds came from: coin objects ${BigInt(before.agent.coinBalance) - BigInt(after.agent.coinBalance)}, ` +
      `address balance ${BigInt(before.agent.addressBalance) - BigInt(after.agent.addressBalance)}; ` +
      `merchant received into: coin objects ${BigInt(after.merchant.coinBalance) - BigInt(before.merchant.coinBalance)}, ` +
      `address balance ${BigInt(after.merchant.addressBalance) - BigInt(before.merchant.addressBalance)}`,
  );
  exitCode = v.success && paid === PRICE && got === PRICE && receipt.transaction === settledDigest ? 0 : 1;
  console.log(exitCode === 0 ? "PASS" : "FAIL");
} catch (err) {
  console.error("Spike C failed:", (err as Error).message);
} finally {
  server.close();
  process.exit(exitCode);
}
