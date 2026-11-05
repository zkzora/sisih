import { describe, expect, it } from "vitest";
import { buildState, memorySentence, type LiveInputs } from "./adapt";
import { freeFunds, reserved, sessionStats } from "./engine";
import type { LiveRequest, LiveState } from "./live";

const NOW = Date.UTC(2026, 10, 5, 12);

const state: LiveState = {
  network: "testnet",
  vault: {
    vaultId: "0xvault",
    owner: "0xowner",
    free: "3500000",
    reserved: "16500000",
    total: "20000000",
    obligations: [
      { id: 12, name: "Inference API", payee: "0xp", target: "6000000", reserve: "6000000", kind: "usage", priority: "must", cycleMs: 120000, nextDueMs: NOW + 120000, cadenceLabel: "Monthly", status: "funded" },
      { id: 15, name: "Domain renewal", payee: "0xd", target: "1500000", reserve: "1500000", kind: "fixed", priority: "important", cycleMs: 0, nextDueMs: NOW + 120000, cadenceLabel: "One-time", status: "funded" },
    ],
    policy: { agent: "0xa", maxPerRequest: "5000000", maxPerDay: "10000000", spentInWindow: "0", windowStartMs: NOW, expiresMs: NOW + 30 * 86_400_000, paused: false },
    readAtMs: NOW,
    explorerUrl: "https://suiscan.xyz/testnet/object/0xvault",
  },
  verifiedVia: "Tatum Sui gRPC",
  agentAddress: "0xa",
  readAtMs: NOW,
  session: 1,
  heldRequests: 1,
  memory: { namespace: "sisih-demo-4", stored: 0, writing: 1, failed: 0 },
  tatum: { level: "green", host: "h", network: "testnet", lastOkAt: NOW, lastLatencyMs: 200, calls: 3, failures: 0, lastError: null },
};

const req = (over: Partial<LiveRequest>): LiveRequest => ({
  id: "r1",
  session: 1,
  merchant: "ReportLab",
  merchantDemo: true,
  item: "Onchain research report",
  category: "research",
  amount: "3000000",
  taskContext: null,
  action: "hold",
  code: "would_cut_reserve",
  status: "held",
  automatic: false,
  reasons: ["Would use 1.20 USDC of committed funds."],
  cutsReserveBy: "1200000",
  allowDisabled: true,
  matchedRuleIds: [],
  simulation: { freeBefore: "1800000", freeAfter: "0", affected: [] },
  recall: { query: null, pending: true, results: [] },
  paymentStatus: "none",
  paymentDigests: [],
  createdAt: NOW,
  decidedAt: null,
  ...over,
});

const inputs = (over: Partial<LiveInputs> = {}): LiveInputs => ({
  state,
  requests: [req({}), req({ id: "r2", merchant: "DataMart", category: "data", amount: "500000", action: "auto_allow", code: "default_threshold", status: "auto_allowed", automatic: true, cutsReserveBy: "0", paymentStatus: "paid", paymentDigests: [{ step: "release", digest: "REL", verified: true }, { step: "x402_settle", digest: "SET", verified: true }] })],
  rules: [],
  memories: [{ id: "m1", type: "rule", text: '[sisih:v1:rule] Always allow search from SearchBox up to 1.50 USDC until 2026-12-05 {"ruleId":"x"}', payload: { merchant: "SearchBox" }, session: 1, status: "writing", jobId: null, blobId: null, walrusUrl: null, namespace: "sisih-demo-4", error: null, usedInDecisions: [], createdAt: NOW, storedAt: null }],
  activity: [],
  insights: null,
  sessions: [],
  suggestions: [{ id: "s1", obligationId: 12, obligationName: "Inference API", currentTarget: "6000000", suggestedTarget: "7000000", reason: "raise", sourceMemoryId: null, status: "open", createdAt: NOW }],
  clock: null,
  health: null,
  recall: null,
  defaultThreshold: 500000,
  prefs: { theme: "light", demoBanner: true },
  walletAddress: null,
  sseConnected: true,
  now: NOW,
  ...over,
});

describe("buildState", () => {
  it("keeps the vault equation and the API obligation ids", () => {
    const s = buildState(inputs());
    expect(s.balance).toBe(20_000_000);
    expect(reserved(s)).toBe(7_500_000);
    expect(s.obligations.map((o) => o.id)).toEqual(["12", "15"]);
    expect(s.obligations[1]!.cycle).toBe("Once");
    expect(s.obligations[0]!.suggestion).toBe(7_000_000);
    expect(s.obligations[0]!.suggestionId).toBe("s1");
  });

  it("maps request status, blocked amount and settlement digest", () => {
    const s = buildState(inputs());
    const [held, paid] = s.requests;
    expect(held!.status).toBe("held");
    expect(held!.blockedAmount).toBe(1_200_000);
    expect(paid!.status).toBe("approved");
    expect(paid!.automatic).toBe(true);
    expect(paid!.transactionId).toBe("SET");
    expect(sessionStats(s).automatic).toBe(1);
  });

  it("maps agent status from the on-chain policy", () => {
    expect(buildState(inputs()).agentStatus).toBe("active");
    expect(buildState(inputs({ state: { ...state, vault: { ...state.vault, policy: null } } })).agentStatus).toBe("revoked");
    const paused = { ...state.vault.policy!, paused: true };
    expect(buildState(inputs({ state: { ...state, vault: { ...state.vault, policy: paused } } })).agentStatus).toBe("paused");
  });

  it("strips the memory tag and payload for display, and keeps write status", () => {
    const m = buildState(inputs()).memories[0]!;
    expect(m.text).toBe("Always allow search from SearchBox up to 1.50 USDC until 2026-12-05");
    expect(m.kind).toBe("Rule learned");
    expect(m.status).toBe("writing");
  });

  it("free funds follow total minus reserves", () => {
    const s = buildState(inputs({ state: { ...state, vault: { ...state.vault, total: "8000000" } } }));
    expect(freeFunds(s)).toBe(500_000);
  });
});

describe("memorySentence", () => {
  it("leaves plain text alone", () => expect(memorySentence("hello")).toBe("hello"));
});
