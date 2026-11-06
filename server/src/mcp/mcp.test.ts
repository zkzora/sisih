/**
 * MCP adapter and its authority boundaries, through a real MCP client (SDK Client + Streamable HTTP
 * transport) talking to handleMcp in-process. Postgres is in-memory PGlite; the network edges are
 * stubbed: vault read (Tatum), the merchant's 402 invoice, Walrus Memory, and the payment executor
 * (replaced by a counting fake, so "charged" means "the executor ran").
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Hono } from "hono";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { VaultState } from "../domain/types";

process.env.DATABASE_URL = "pglite::memory:";
process.env.PUBLIC_BASE_URL = "https://sisih.test";
process.env.SISIH_AGENT_TOKEN = "agent-secret";
process.env.DEMO_TOKEN = "owner-secret";

const vault: { state: VaultState } = {
  state: {
    vaultId: "0xvault",
    version: 1,
    owner: "0xowner",
    total: 20_000_000n,
    reserved: 16_500_000n,
    free: 3_500_000n,
    obligations: [],
    policy: { agent: "0xagent", maxPerRequest: 5_000_000n, maxPerDay: 10_000_000n, spentInWindow: 0n, windowStartMs: Date.now(), expiresMs: Date.now() + 86_400_000 * 30, paused: false },
    readAtMs: Date.now(),
  },
};
vi.mock("../chain/vault", () => ({ vaultState: async () => vault.state, cachedVault: async () => vault.state, recordTx: async () => ({ status: "verified" }), releaseToAgent: async () => ({ ok: false }) }));
vi.mock("../memory/memwal", () => ({
  remember: async (type: string) => ({ id: `mem-${type}-${Math.random().toString(36).slice(2, 8)}`, status: "writing" }),
  recall: async () => ({ query: "", ms: 1, results: [] }),
  recallQueryFor: () => "q",
}));
vi.mock("../x402/agentPay", async () => {
  const { findMerchant, MERCHANTS } = await import("../merchants/registry");
  return {
    fetchInvoice: async (url: string) => {
      const m = MERCHANTS.find((x) => url.endsWith(x.path)) ?? findMerchant("datamart")!;
      return { url, paymentRequired: { x402Version: 2, accepts: [] }, amount: m.price, payTo: "0xmerchant", asset: "usdc" };
    },
  };
});

const { initDb, db, schema } = await import("../db/index");
const { handleMcp } = await import("./server");
const { setPaymentExecutor, purchaseResultKey } = await import("../services/payments");
const { ownerDecision } = await import("../services/requests");
const { kvSet } = await import("../services/state");
const { demoGuard, actionLock } = await import("../api/guard");
const { releaseLease } = await import("../lib/leases");
const { eq } = await import("drizzle-orm");

// Counting executor: marks the request paid and stores the merchant content, like the real one.
let charges: string[] = [];
let inFlight = 0;
let maxInFlight = 0;
setPaymentExecutor({
  name: "test",
  async execute(t) {
    charges.push(t.requestId);
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 30));
    await kvSet(purchaseResultKey(t.requestId), JSON.stringify({ demo: true, forRequest: t.requestId, merchant: t.merchant }));
    await db()
      .update(schema.requests)
      .set({ paymentStatus: "paid", paymentDigests: JSON.stringify([{ step: "release", digest: `rel-${t.requestId}`, verified: true }, { step: "x402_settle", digest: `set-${t.requestId}`, verified: true }]) })
      .where(eq(schema.requests.id, t.requestId));
    inFlight--;
  },
});

async function connect(token = "agent-secret") {
  const client = new Client({ name: "test-agent", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL("https://sisih.test/api/mcp"), {
    requestInit: { headers: { authorization: `Bearer ${token}` } },
    fetch: (url, init) => handleMcp(new Request(url, init as RequestInit), "10.0.0.1"),
  });
  await client.connect(transport);
  return client;
}
const call = async (client: Client, name: string, args: Record<string, unknown> = {}) => {
  const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
  return { isError: Boolean(r.isError), body: JSON.parse(r.content[0]!.text) };
};

beforeAll(async () => {
  await initDb();
});
beforeEach(async () => {
  charges = [];
  maxInFlight = 0;
  vault.state = { ...vault.state, free: 3_500_000n };
  await releaseLease("demo_run", "agent:demo");
});

describe("connection and discovery", () => {
  it("a fresh client discovers exactly the agent tools", async () => {
    const client = await connect();
    const names = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(names).toEqual(["end_demo_session", "get_budget", "get_request_status", "list_services", "request_purchase"]);
    const services = (await call(client, "list_services")).body.services;
    expect(services.map((s: { service: string }) => s.service)).toEqual(["datamart", "searchbox", "reportlab"]);
    expect(services.every((s: { demo: boolean }) => s.demo)).toBe(true);
    const budget = (await call(client, "get_budget")).body;
    expect(budget.vault).toMatchObject({ total_usdc: "20.00", committed_usdc: "16.50", free_usdc: "3.50" });
    expect(budget.agent_permission.status).toBe("active");
  });

  it("refuses a missing or wrong agent credential, and never accepts the owner token instead", async () => {
    const r1 = await handleMcp(new Request("https://sisih.test/api/mcp", { method: "POST", body: "{}" }), "10.0.0.2");
    expect(r1.status).toBe(401);
    expect((await r1.json()).error.message).toMatch(/agent credential/);
    const r2 = await handleMcp(new Request("https://sisih.test/api/mcp", { method: "POST", headers: { "x-demo-token": "owner-secret" }, body: "{}" }), "10.0.0.2");
    expect(r2.status).toBe(401);
    await expect(connect("wrong")).rejects.toThrow();
  });
});

describe("role separation: the agent credential has no owner authority", () => {
  const app = new Hono();
  app.use("/api/*", demoGuard());
  for (const p of ["/api/requests/:id/decision", "/api/demo/reset", "/api/demo/owner-action", "/api/demo/advance-cycle", "/api/demo/run-task", "/api/rules/:id", "/api/settings", "/api/tx", "/api/demo/agent-credential"]) {
    app.post(p, (c) => c.json({ reached: true }));
    app.patch(p, (c) => c.json({ reached: true }));
  }
  it.each([
    ["POST", "/api/requests/req-1/decision"],
    ["POST", "/api/demo/reset"],
    ["POST", "/api/demo/owner-action"],
    ["POST", "/api/demo/advance-cycle"],
    ["POST", "/api/demo/run-task"],
    ["PATCH", "/api/rules/rule-1"],
    ["PATCH", "/api/settings"],
    ["POST", "/api/tx"],
    ["POST", "/api/demo/agent-credential"],
  ])("%s %s is refused with the agent credential", async (method, path) => {
    const res = await app.request(path, { method, headers: { authorization: "Bearer agent-secret", "x-forwarded-for": "10.0.9.9" } });
    expect(res.status).toBe(401);
  });
  it("the MCP surface has no approve, deny, reset, withdraw or reserve tool", async () => {
    const client = await connect();
    const names = (await client.listTools()).tools.map((t) => t.name).join(" ");
    expect(names).not.toMatch(/approve|deny|reset|withdraw|reserve|decision|sign|transfer/);
  });
});

describe("purchases, holds and continuation", () => {
  it("a held purchase is not charged; polling and duplicates never charge; approval resumes the same request once", async () => {
    const client = await connect();
    const first = (await call(client, "request_purchase", { service: "searchbox", task: "Find recent news about SUI" })).body;
    expect(first.outcome).toBe("awaiting_owner_approval");
    expect(first.paid).toBe(false);
    expect(first.message).toMatch(/NOT been made/);
    expect(first.owner_dashboard_url).toBe(`https://sisih.test/agent?request=${first.request_id}`);
    expect(first.next_step).toMatch(/get_request_status/);
    expect(charges).toEqual([]);

    for (let i = 0; i < 3; i++) expect((await call(client, "get_request_status", { request_id: first.request_id })).body.outcome).toBe("awaiting_owner_approval");
    const dup = (await call(client, "request_purchase", { service: "searchbox", task: "Find recent news about SUI" })).body;
    expect(dup.request_id).toBe(first.request_id);
    expect(dup.duplicate).toBe(true);
    expect(charges).toEqual([]);

    await ownerDecision(first.request_id, "approve_once"); // the owner, in the dashboard
    expect(charges).toEqual([first.request_id]);
    const done = (await call(client, "get_request_status", { request_id: first.request_id })).body;
    expect(done.outcome).toBe("settled");
    expect(done.paid).toBe(true);
    expect(done.result).toMatchObject({ forRequest: first.request_id, merchant: "SearchBox" });
    expect(done.settlement.verified_via_tatum).toBe(true);

    await call(client, "get_request_status", { request_id: first.request_id });
    await call(client, "request_purchase", { service: "searchbox", task: "Find recent news about SUI" });
    await expect(ownerDecision(first.request_id, "approve_once")).rejects.toThrow(/not held/);
    expect(charges).toEqual([first.request_id]); // still exactly one payment
  });

  it("a second concurrent approval of the same request cannot pay twice", async () => {
    const client = await connect();
    const r = (await call(client, "request_purchase", { service: "searchbox", task: "Concurrent approval check" })).body;
    const results = await Promise.allSettled([ownerDecision(r.request_id, "approve_once"), ownerDecision(r.request_id, "approve_once")]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(charges.filter((c) => c === r.request_id)).toHaveLength(1);
  });

  it("denied and blocked requests can never be resumed into a payment", async () => {
    const client = await connect();
    const held = (await call(client, "request_purchase", { service: "searchbox", task: "Something the owner will deny" })).body;
    await ownerDecision(held.request_id, "deny");
    expect((await call(client, "get_request_status", { request_id: held.request_id })).body).toMatchObject({ outcome: "denied", paid: false });
    await expect(ownerDecision(held.request_id, "approve_once")).rejects.toThrow(/not held/);

    vault.state = { ...vault.state, free: 300_000n }; // ReportLab 3.00 would cut reserves
    const blocked = (await call(client, "request_purchase", { service: "reportlab", task: "Buy a report while free funds are low" })).body;
    expect(blocked.outcome).toBe("blocked");
    expect(blocked.paid).toBe(false);
    await expect(ownerDecision(blocked.request_id, "approve_once")).rejects.toThrow(/committed funds|Reserves/);
    expect(charges).toEqual([]);
  });

  it("an auto-approved purchase settles in the same call and returns its own content", async () => {
    const client = await connect();
    const a = (await call(client, "request_purchase", { service: "datamart", task: "Price history for SUI, first look" })).body;
    const b = (await call(client, "request_purchase", { service: "datamart", task: "Price history for SUI, second look" })).body;
    expect(a.outcome).toBe("settled");
    expect(b.outcome).toBe("settled");
    expect(a.request_id).not.toBe(b.request_id);
    expect(a.result.forRequest).toBe(a.request_id);
    expect(b.result.forRequest).toBe(b.request_id);
  });

  it("concurrent purchases are serialized: never two payments at once", async () => {
    const client = await connect();
    const outs = await Promise.all(["one", "two", "three"].map((n) => call(client, "request_purchase", { service: "datamart", task: `Parallel purchase ${n}` })));
    const outcomes = outs.map((o) => o.body.outcome);
    expect(outcomes.every((o) => o === "settled" || o === "busy")).toBe(true);
    expect(maxInFlight).toBe(1);
    expect(outs.filter((o) => o.body.outcome === "busy").every((o) => o.body.paid === false && o.body.retry_after_seconds > 0)).toBe(true);
  });
});

describe("understandable errors and the shared demo", () => {
  it("an unknown request id or bad input is a tool error the agent can fix", async () => {
    const client = await connect();
    const r = await call(client, "get_request_status", { request_id: "req-not-mine" });
    expect(r.isError).toBe(true);
    expect(r.body.error).toMatch(/No request/);
  });
  it("busy when another visitor holds the demo; end_demo_session hands it back", async () => {
    const { acquireLease } = await import("../lib/leases");
    await acquireLease("demo_run", "client:someone-else", 60_000);
    const client = await connect();
    const busy = (await call(client, "request_purchase", { service: "datamart", task: "While someone else runs the demo" })).body;
    expect(busy).toMatchObject({ outcome: "busy", paid: false });
    await releaseLease("demo_run", "client:someone-else");
    expect((await call(client, "request_purchase", { service: "datamart", task: "After the demo is free" })).body.outcome).toBe("settled");
    expect((await call(client, "end_demo_session")).body.ended).toBe(true);
  });
  it("while the agent holds the run, the owner may still decide its requests but not reset", async () => {
    const { acquireLease } = await import("../lib/leases");
    await acquireLease("demo_run", "agent:demo", 60_000);
    const app = new Hono();
    app.use("/api/*", demoGuard());
    app.post("/api/requests/:id/decision", (c) => c.json({ ok: true }));
    app.post("/api/demo/reset", (c) => c.json({ ok: true }));
    const owner = { "x-demo-token": "owner-secret", "x-demo-client": "owner-tab-1234", "x-forwarded-for": "10.0.5.5" };
    expect((await app.request("/api/requests/req-1/decision", { method: "POST", headers: owner })).status).toBe(200);
    const reset = await app.request("/api/demo/reset", { method: "POST", headers: owner });
    expect(reset.status).toBe(423);
    expect((await reset.json()).code).toBe("agent_run_active");
    void actionLock;
  });
});
