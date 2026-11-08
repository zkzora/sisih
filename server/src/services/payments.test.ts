/**
 * The real x402 payment executor around its edges (vault release, merchant payment, Tatum
 * read-back stubbed; in-memory PGlite). Release and settlement are separate transactions: these
 * tests check what Sisih records and tells the agent when they diverge, and that an ambiguous
 * outcome never leads to a second release.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL = "pglite::memory:";
process.env.USDC_COIN_TYPE = `0x${"d4".repeat(32)}::usdc::USDC`;
process.env.MERCHANT_CHAINSCOPE_ADDRESS = `0x${"c1".repeat(32)}`;
process.env.AGENT_ADDRESS = `0x${"a9".repeat(32)}`;
process.env.PUBLIC_BASE_URL = "https://sisih.test";

const releases: string[] = [];
vi.mock("../chain/vault", () => ({
  releaseToAgent: async (_amount: bigint, requestId: string) => {
    releases.push(requestId);
    return { ok: true, digest: `rel-${requestId}`, tx: { status: "verified" }, created: [{ objectId: `0xcoin-${requestId}`, type: `0x2::coin::Coin<0x${"d4".repeat(32)}::usdc::USDC>`, owner: "AddressOwner" }] };
  },
  recordTx: async () => ({ status: "verified" }),
}));
const pay = { mode: "ok" as "ok" | "refused" | "lost" | "before_send" };
vi.mock("../x402/agentPay", () => {
  class MerchantRefused extends Error {}
  return {
    MerchantRefused,
    payInvoice: async (_inv: unknown, _coin: string, requestId: string, onSent?: (digest: string) => void | Promise<void>) => {
      if (pay.mode === "before_send") throw new Error("could not build the payment payload");
      await onSent?.(`set-${requestId}`);
      if (pay.mode === "refused") throw new MerchantRefused("merchant refused payment (503): live_data_unavailable");
      if (pay.mode === "lost") throw new Error("fetch failed: socket hang up");
      return { settleDigest: `set-${requestId}`, resource: { content_type: "live onchain data" } };
    },
  };
});

const { initDb, db, schema } = await import("../db/index");
const { x402PaymentExecutor, paymentRecovery, serializeInvoice } = await import("./payments");
const { requestView } = await import("./requests");
const { outcomeFor } = await import("../mcp/tools");
const { eq } = await import("drizzle-orm");

let n = 0;
async function makeRequest() {
  const id = `req-pay-${++n}`;
  await db().insert(schema.requests).values({
    id,
    session: 1,
    merchant: "ChainScope",
    category: "data",
    item: "Live Sui vault report",
    amount: "800000",
    taskContext: "vault health",
    status: "approved",
    action: "hold",
    code: "new_merchant",
    reasons: JSON.stringify(["New merchant"]),
    matchedRuleIds: "[]",
    cutsReserveBy: "0",
    allowDisabled: false,
    simulation: "{}",
    paymentStatus: "none",
    paymentDigests: "[]",
    createdAt: Date.now(),
    invoice: serializeInvoice({ url: "https://sisih.test/merchants/chainscope/vault-report", paymentRequired: { x402Version: 2, accepts: [] } as never, amount: 800_000n, payTo: process.env.MERCHANT_CHAINSCOPE_ADDRESS!, asset: process.env.USDC_COIN_TYPE! }),
  } as never);
  return id;
}
const row = async (id: string) => (await db().select().from(schema.requests).where(eq(schema.requests.id, id)))[0]!;
const run = (id: string) => x402PaymentExecutor.execute({ requestId: id, merchant: "ChainScope", amount: 800_000n });

beforeAll(async () => {
  await initDb();
});
beforeEach(() => {
  pay.mode = "ok";
  releases.length = 0;
});

describe("release and settlement are reported separately", () => {
  it("a successful purchase is released once and settled", async () => {
    const id = await makeRequest();
    await run(id);
    expect((await row(id)).paymentStatus).toBe("paid");
    expect(releases).toEqual([id]);
  });

  it("merchant refusal after the release (ChainScope 503): recorded as released, not settled, never 'nothing was paid'", async () => {
    pay.mode = "refused";
    const id = await makeRequest();
    await run(id);
    const r = await row(id);
    expect(r.paymentStatus).toBe("failed");
    const rec = await paymentRecovery(id);
    expect(rec).toMatchObject({ state: "merchant_refused", release_digest: `rel-${id}`, released_coin_id: `0xcoin-${id}`, agent_address: process.env.AGENT_ADDRESS });
    const out = outcomeFor(requestView(r), null, "merchant refused", rec);
    expect(out.outcome).toBe("failed");
    expect(out.payment).toMatchObject({ state: "merchant_refused", released: true, settled: false });
    expect(out.message).not.toMatch(/nothing was paid/i);
  });

  it("a lost response after sending is 'outcome unknown', and re-running the executor never releases again", async () => {
    pay.mode = "lost";
    const id = await makeRequest();
    await run(id);
    const rec = await paymentRecovery(id);
    expect(rec?.state).toBe("sent_outcome_unknown");
    expect(outcomeFor(requestView(await row(id)), null, "lost", rec).payment).toMatchObject({ released: true, settled: "unknown" });
    pay.mode = "ok";
    await run(id); // retry / restart / duplicate trigger
    await run(id);
    expect(releases).toEqual([id]);
    expect((await row(id)).paymentStatus).toBe("failed");
  });

  it("a failure before sending says the funds were released to the agent address and not sent", async () => {
    pay.mode = "before_send";
    const id = await makeRequest();
    await run(id);
    expect((await paymentRecovery(id))?.state).toBe("released_not_sent");
  });

  it("concurrent executions of one request release exactly once", async () => {
    const id = await makeRequest();
    await Promise.all([run(id), run(id), run(id)]);
    expect(releases).toEqual([id]);
    expect((await row(id)).paymentStatus).toBe("paid");
  });
});
