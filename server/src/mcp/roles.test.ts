/**
 * One MCP URL, two roles, through a real MCP SDK client (Client + Streamable HTTP transport) on
 * the wire to handleMcp in-process. Isolated fixture: in-memory PGlite; the vault read, merchant
 * invoice, Walrus Memory, payment executor and demo-owner signer are stubbed and counted, so
 * "effect" means one of those ran. Proves transport and authority, not compatibility with any
 * particular AI app.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { VaultState } from "../domain/types";

process.env.DATABASE_URL = "pglite::memory:";
process.env.PUBLIC_BASE_URL = "https://sisih.test";
process.env.SUI_NETWORK = "testnet";
process.env.SISIH_AGENT_TOKEN = "agent-secret-0123456789";
process.env.DEMO_TOKEN = "owner-secret-0123456789";
delete process.env.SISIH_OWNER_MCP_TOKEN;
delete process.env.SISIH_OWNER_SIGNING;

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
const memories: string[] = [];
vi.mock("../memory/memwal", () => ({
  remember: async (type: string) => {
    memories.push(type);
    return { id: `mem-${type}-${Math.random().toString(36).slice(2, 8)}`, status: "writing" };
  },
  recall: async () => ({ query: "", ms: 1, results: [] }),
  recallQueryFor: () => "q",
  namespace: async () => "roles-namespace",
}));
vi.mock("../x402/agentPay", async () => {
  const { MERCHANTS } = await import("../merchants/registry");
  return {
    MerchantRefused: class extends Error {},
    fetchInvoice: async (url: string) => {
      const m = MERCHANTS.find((x) => url.endsWith(x.path))!;
      return { url, paymentRequired: { x402Version: 2, accepts: [] }, amount: m.price, payTo: "0xmerchant", asset: "usdc" };
    },
  };
});
const ownerSigned: { action: string; body: unknown }[] = [];
vi.mock("../demo/owner", async (orig) => {
  const real = await orig<typeof import("../demo/owner")>();
  return {
    ...real,
    demoOwnerAction: async (action: string, body: unknown) => {
      ownerSigned.push({ action, body });
      return { action, digest: `demo-${action}`, signer: real.DEMO_OWNER_LABEL, verification: "verified" };
    },
  };
});
const resets: number[] = [];
vi.mock("../demo/controls", () => ({ resetDemo: async () => (resets.push(1), { reset: true }), advanceCycle: async () => ({ cycle: true }), clock: async () => ({}) }));

const { initDb, db, schema } = await import("../db/index");
const { handleMcp, AGENT_TOOLS, OWNER_TOOLS, DEMO_TOOLS } = await import("./server");
const { setPaymentExecutor, purchaseResultKey } = await import("../services/payments");
const { kvSet } = await import("../services/state");
const { acquireLease, releaseLease } = await import("../lib/leases");
const { eq } = await import("drizzle-orm");

let charges: string[] = [];
setPaymentExecutor({
  name: "test",
  async execute(t) {
    charges.push(t.requestId);
    await kvSet(purchaseResultKey(t.requestId), JSON.stringify({ demo: true }));
    await db().update(schema.requests).set({ paymentStatus: "paid", paymentDigests: JSON.stringify([{ step: "release", digest: `rel-${t.requestId}`, verified: true }, { step: "x402_settle", digest: `set-${t.requestId}`, verified: true }]) }).where(eq(schema.requests.id, t.requestId));
  },
});

let ipN = 0;
async function connect(token: string, extraHeaders: Record<string, string> = {}) {
  const client = new Client({ name: "owner-assistant-or-agent", version: "1.0.0" });
  const ip = `10.9.0.${++ipN}`;
  const transport = new StreamableHTTPClientTransport(new URL("https://sisih.test/api/mcp"), {
    requestInit: { headers: { authorization: `Bearer ${token}`, ...extraHeaders } },
    fetch: (url, init) => handleMcp(new Request(url, init as RequestInit), ip),
  });
  await client.connect(transport);
  return client;
}
const call = async (client: Client, name: string, args: Record<string, unknown> = {}) => {
  const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
  let body: unknown;
  try {
    body = JSON.parse(r.content[0]!.text);
  } catch {
    body = r.content[0]?.text;
  }
  return { isError: Boolean(r.isError), body: body as Record<string, any> };
};
const effects = () => ({ charges: charges.length, ownerSigned: ownerSigned.length, memories: memories.length, resets: resets.length });
const AGENT = "agent-secret-0123456789";
const OWNER = "owner-secret-0123456789";

beforeAll(async () => {
  await initDb();
});
beforeEach(async () => {
  charges = [];
  vault.state = { ...vault.state, free: 3_500_000n };
  await releaseLease("demo_run", "agent:demo");
});

describe("one MCP URL, role-scoped tools", () => {
  it("the agent sees only the agent tools; the owner sees the owner tools (and Testnet demo tooling)", async () => {
    const agent = await connect(AGENT);
    expect((await agent.listTools()).tools.map((t) => t.name).sort()).toEqual([...AGENT_TOOLS].sort());
    const owner = await connect(OWNER);
    const names = (await owner.listTools()).tools.map((t) => t.name).sort();
    expect(names).toEqual([...OWNER_TOOLS, ...DEMO_TOOLS].sort());
    expect(names).not.toContain("request_purchase"); // the owner does not buy as the agent
  });

  it("direct agent calls to every owner tool fail with zero signing, payment, configuration or reset effects", async () => {
    const owner = await connect(OWNER);
    const agent = await connect(AGENT);
    const held = (await call(agent, "request_purchase", { service: "searchbox", task: "Find docs", idempotency_key: "roles-held-1" })).body;
    expect(held.outcome).toBe("awaiting_owner_approval");
    const before = effects();
    const attempts: [string, Record<string, unknown>][] = [
      ["decide_request", { request_id: held.request_id, decision: "approve", remember: true }],
      ["set_limits", { per_request_usdc: "50", per_day_usdc: "50" }],
      ["set_reserve", { commitment_id: 0, amount_usdc: "0.01" }],
      ["set_agent_permission", { state: "resume" }],
      ["add_preference", { merchant: "searchbox", action: "allow", max_usdc: "50" }],
      ["set_threshold", { max_usdc: "50" }],
      ["demo_reset", { confirm: true }],
      ["owner_status", {}],
    ];
    for (const [name, args] of attempts) {
      const r = await call(agent, name, args);
      expect(r.isError, name).toBe(true);
    }
    expect(effects()).toEqual(before);
    // the held request is still held and unpaid
    const status = (await call(agent, "get_request_status", { request_id: held.request_id })).body;
    expect(status.outcome).toBe("awaiting_owner_approval");
    void owner;
  });

  it("a role hint in headers or clientInfo cannot raise the agent's authority", async () => {
    const agent = await connect(AGENT, { "x-sisih-role": "owner", "x-demo-token": OWNER });
    expect((await agent.listTools()).tools.map((t) => t.name)).not.toContain("decide_request");
  });
});

describe("owner assistant through the shared engine", () => {
  it("decide_request approves the agent's held request once; the agent resumes the same request", async () => {
    const agent = await connect(AGENT);
    const owner = await connect(OWNER);
    const held = (await call(agent, "request_purchase", { service: "reportlab", task: "Research report", idempotency_key: "roles-held-2" })).body;
    expect(held.outcome).toBe("awaiting_owner_approval");
    expect(held.owner_continuation.owner_assistant_tool.name).toBe("decide_request");

    const pending = (await call(owner, "list_requests", { held_only: true })).body as unknown as { request_id: string }[];
    expect(pending.map((r) => r.request_id)).toContain(held.request_id);
    const decided = await call(owner, "decide_request", { request_id: held.request_id, decision: "approve", remember: true, max_usdc: "3.50", days: 7 });
    expect(decided.isError).toBe(false);
    expect(decided.body.status).toBe("done");
    expect(charges).toEqual([held.request_id]);
    expect(memories).toContain("rule");

    // a second decision on the same request is refused and pays nothing
    const again = await call(owner, "decide_request", { request_id: held.request_id, decision: "approve" });
    expect(again.isError).toBe(true);
    expect(charges).toEqual([held.request_id]);

    const resumed = (await call(agent, "get_request_status", { request_id: held.request_id })).body;
    expect(resumed.outcome).toBe("settled");
    // the agent retrying the same purchase gets the same request, never a second charge
    const dup = (await call(agent, "request_purchase", { service: "reportlab", task: "Research report", idempotency_key: "roles-held-2" })).body;
    expect(dup).toMatchObject({ duplicate: true, request_id: held.request_id });
    expect(charges).toEqual([held.request_id]);
  });

  it("owner configuration goes through the labeled Testnet demo-owner signer, while the agent holds the run", async () => {
    const agent = await connect(AGENT);
    await call(agent, "request_purchase", { service: "datamart", task: "Hold the run", idempotency_key: "roles-lease" }); // agent takes the shared run
    const owner = await connect(OWNER);
    const r = await call(owner, "set_limits", { per_request_usdc: "2.00", per_day_usdc: "6.00", days: 30 });
    expect(r.isError).toBe(false);
    expect(r.body.signer).toBe("Demo owner (server-signed, testnet)");
    expect(ownerSigned.at(-1)).toEqual({ action: "set_limits", body: { maxPerRequest: "2000000", maxPerDay: "6000000", days: 30 } });
    // invalid input is rejected before any signing
    const n = ownerSigned.length;
    const bad = await call(owner, "set_limits", { per_request_usdc: "7.00", per_day_usdc: "6.00" });
    expect(bad.isError).toBe(true);
    expect(ownerSigned.length).toBe(n);
  });

  it("an unrelated visitor's run blocks routine owner changes but never an emergency pause", async () => {
    await acquireLease("demo_run", "client:someone-else", 60_000);
    const owner = await connect(OWNER);
    const routine = await call(owner, "set_threshold", { max_usdc: "1.00" });
    expect(routine.isError).toBe(true);
    expect(routine.body.code).toBe("demo_busy");
    const pause = await call(owner, "set_agent_permission", { state: "pause" });
    expect(pause.isError).toBe(false);
    expect(ownerSigned.at(-1)?.action).toBe("pause_agent");
    await releaseLease("demo_run", "client:someone-else");
  });
});
