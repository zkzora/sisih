import { describe, expect, it } from "vitest";
import {
  UNIT,
  freeFunds,
  initialState,
  parseMoney,
  reserved,
  restoreDemo,
  transition,
} from "./engine";
import type { Action, DemoState } from "./types";

function run(s: DemoState, a: Action) {
  const result = transition(s, a);
  expect(result.error, result.message).toBeFalsy();
  expect(result.state.balance).toBeGreaterThanOrEqual(reserved(result.state));
  return result.state;
}
function learned() {
  return run(initialState(), {
    type: "decide",
    requestId: "request-search-demo",
    decision: "approve",
    remember: { maxAmount: 1_500_000, expires: "2026-12-05" },
  });
}

describe("vault policy", () => {
  it("keeps USDC in integer micro-units", () => {
    expect(parseMoney("0.000001")).toBe(1);
    expect(parseMoney("1.200001")).toBe(1_200_001);
    expect(parseMoney("0.0000001")).toBeNull();
    expect(parseMoney("-1")).toBeNull();
    expect(parseMoney("1e3")).toBeNull();
  });
  it("never lets owner approval or an allow rule consume commitments", () => {
    let s = learned();
    s = run(s, { type: "request", merchant: "DataMart" });
    s = run(s, { type: "request", merchant: "ReportLab" });
    const r = s.requests[0];
    expect(r.blockedAmount).toBe(1_200_000);
    const result = transition(s, {
      type: "decide",
      requestId: r.id,
      decision: "approve",
      remember: { maxAmount: 5 * UNIT, expires: "2026-12-05" },
    });
    expect(result.error).toBe(true);
    expect(result.state).toBe(s);
    expect(reserved(s)).toBe(16_500_000);
  });
  it("charges a resolved request exactly once", () => {
    const s = learned();
    expect(s.balance).toBe(18_800_000);
    const result = transition(s, {
      type: "decide",
      requestId: "request-search-demo",
      decision: "approve",
    });
    expect(result.error).toBe(true);
    expect(result.state.balance).toBe(s.balance);
  });
  it("uses remembered approvals across sessions", () => {
    let s = run(learned(), { type: "new-session" });
    s = run(s, { type: "request", merchant: "SearchBox" });
    expect(s.requests[0].automatic).toBe(true);
    expect(s.requests[0].status).toBe("approved");
    expect(s.requests[0].memoryId).toBe(s.rules[0].memoryId);
    expect(s.sessions).toHaveLength(1);
  });
  it("honors rule revocation and expiry", () => {
    let s = learned();
    s = run(s, { type: "toggle-rule", id: s.rules[0].id });
    s = run(s, { type: "request", merchant: "SearchBox" });
    expect(s.requests[0].status).toBe("held");
    s.rules[0].active = true;
    s.rules[0].expires = "2026-11-05";
    s = run(s, { type: "new-session" });
    s = run(s, { type: "request", merchant: "SearchBox" });
    expect(s.requests[0].status).toBe("held");
  });
  it("rechecks changed limits at approval time", () => {
    let s = initialState();
    s = run(s, {
      type: "settings",
      preferences: { ...s.preferences, perRequest: UNIT, perDay: UNIT },
    });
    expect(
      transition(s, {
        type: "decide",
        requestId: "request-search-demo",
        decision: "approve",
      }).error,
    ).toBe(true);
  });
  it("enforces a daily limit before matching an allow rule", () => {
    let s = learned();
    s = run(s, {
      type: "settings",
      preferences: {
        ...s.preferences,
        perRequest: 1_500_000,
        perDay: 2 * UNIT,
      },
    });
    s = run(s, { type: "request", merchant: "SearchBox" });
    expect(s.requests[0].status).toBe("rejected");
    expect(s.balance).toBe(18_800_000);
  });
  it("blocks payments while paused", () => {
    let s = run(initialState(), { type: "agent-status", status: "paused" });
    s = run(s, { type: "request", merchant: "DataMart" });
    expect(s.requests[0].status).toBe("rejected");
    expect(s.balance).toBe(20 * UNIT);
  });
  it("withdraws free funds only and never mints money when deleting a reserve", () => {
    let s = initialState();
    expect(transition(s, { type: "withdraw", amount: 4 * UNIT }).error).toBe(
      true,
    );
    s = run(s, { type: "delete-obligation", id: "inference" });
    expect(s.balance).toBe(20 * UNIT);
    expect(freeFunds(s)).toBe(9_500_000);
  });
  it("refills essentials first after an emergency withdrawal", () => {
    let s = run(initialState(), { type: "emergency-withdraw" });
    expect(s.agentStatus).toBe("paused");
    expect(s.obligations).toHaveLength(4);
    s = run(s, { type: "deposit", amount: 7 * UNIT });
    expect(s.obligations.find((o) => o.id === "inference")?.reserved).toBe(
      6 * UNIT,
    );
    expect(s.obligations.find((o) => o.id === "hosting")?.reserved).toBe(UNIT);
    expect(freeFunds(s)).toBe(0);
  });
  it("settles actual bills, learns the shortfall and requires owner approval of the next reserve", () => {
    let s = learned();
    s = run(s, { type: "request", merchant: "DataMart" });
    s = run(s, { type: "advance-cycle" });
    expect(s.balance).toBe(18 * UNIT);
    expect(s.outcome?.shortfall).toBe(800_000);
    expect(reserved(s)).toBe(15 * UNIT);
    expect(s.obligations.find((o) => o.id === "inference")?.suggestion).toBe(
      7 * UNIT,
    );
    s = run(s, { type: "accept-reserve", id: "inference", amount: 7 * UNIT });
    expect(reserved(s)).toBe(16 * UNIT);
    expect(freeFunds(s)).toBe(2 * UNIT);
    expect(
      s.activities.filter((a) => a.kind === "Pay obligation"),
    ).toHaveLength(4);
    expect(transition(s, { type: "advance-cycle" }).error).toBe(true);
  });
  it("rejects invalid dates and corrupt persisted vault balances", () => {
    const s = initialState();
    expect(
      transition(s, {
        type: "settings",
        preferences: { ...s.preferences, expires: "2026-99-99" },
      }).error,
    ).toBe(true);
    expect(restoreDemo(JSON.stringify({ ...s, balance: UNIT }))).toBeNull();
    expect(restoreDemo(JSON.stringify(learned()))?.rules).toHaveLength(1);
  });
});
