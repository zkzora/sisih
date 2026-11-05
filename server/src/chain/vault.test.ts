import { describe, expect, it } from "vitest";
import { mapVaultEvent } from "./activity";
import { parseVault } from "./vault";

/** Shape of the gRPC getObject JSON for Vault<USDC>, as returned by Tatum on testnet. */
const RAW = {
  version: "1",
  agent_policy: {
    spent_in_window: "500000",
    window_start_ms: "1793869533330",
    agent: "0xagent",
    expires_ms: "1796461529935",
    max_per_day: "10000000",
    max_per_request: "5000000",
    paused: false,
  },
  free: "3000000",
  id: "0xvault",
  owner: "0xowner",
  next_obligation_id: "4",
  obligations: {
    contents: [
      { key: "0", value: { reserve: "6000000", cadence_label: "Monthly", cycle_ms: "120000", kind: 1, payee: "0xp0", priority: 0, target: "6000000", name: "Inference API", next_due_ms: "1793869649935" } },
      { key: "3", value: { reserve: "1000000", cadence_label: "One-time", cycle_ms: "0", kind: 0, payee: "0xp3", priority: 1, target: "1500000", name: "Domain renewal", next_due_ms: "1793869649935" } },
    ],
  },
};

describe("parseVault", () => {
  it("parses balances, obligations and the agent policy as bigint", () => {
    const v = parseVault("0xvault", RAW, 1);
    expect(v.free).toBe(3_000_000n);
    expect(v.reserved).toBe(7_000_000n);
    expect(v.total).toBe(10_000_000n);
    expect(v.obligations.map((o) => [o.id, o.kind, o.priority, o.status])).toEqual([
      [0, "usage", "must", "funded"],
      [3, "fixed", "important", "underfunded"],
    ]);
    expect(v.policy).toMatchObject({ maxPerRequest: 5_000_000n, spentInWindow: 500_000n, paused: false });
  });

  it("treats a missing policy as no permission", () => {
    expect(parseVault("0xvault", { ...RAW, agent_policy: null }).policy).toBeNull();
  });
});

describe("mapVaultEvent", () => {
  const ev = (name: string, json: Record<string, unknown>) => ({ type: `0xpkg::vault::${name}`, sender: "0xs", json });
  it("maps payments, releases and reserve changes to activity kinds", () => {
    expect(mapVaultEvent(ev("ObligationPaid", { name: "Domain renewal", bill: "1500000" }))).toEqual({ kind: "Pay obligation", amount: "1500000", from: "Vault", to: "Domain renewal" });
    expect(mapVaultEvent(ev("ReleasedToAgent", { amount: "500000" }))?.kind).toBe("Release to agent");
    expect(mapVaultEvent(ev("ObligationAdded", { name: "Hosting VPS", reserved: "5000000" }))?.kind).toBe("Reserve");
    expect(mapVaultEvent(ev("ObligationTargetChanged", { id: "0", old_target: "6000000", new_target: "7000000" }))?.kind).toBe("Change reserve");
    expect(mapVaultEvent(ev("Deposited", { amount: "20000000", from: "0xowner" }))).toMatchObject({ kind: "Deposit", from: "0xowner" });
    expect(mapVaultEvent(ev("Unknown", {}))).toBeNull();
  });
});
