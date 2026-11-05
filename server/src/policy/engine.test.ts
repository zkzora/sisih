/**
 * The 6 sample agent requests from docs/SPEC.md ("Sample data: agent requests"), replayed in
 * order from SPEC fixtures (never the live vault). Free funds drop as approved requests are
 * paid, exactly as in the SPEC balance table.
 */
import { describe, expect, it } from "vitest";
import type { ObligationState, PaymentRequestInput, Rule, VaultState } from "../domain/types";
import { draftRule, ruleSentence } from "./composer";
import { DAY_MS, decide, merchantKey, type EngineInput } from "./engine";

const U = 1_000_000n;
const NOW = Date.UTC(2026, 10, 5, 12, 0, 0);
const usd = (s: string) => BigInt(Math.round(Number(s) * 1e6));

function obligation(id: number, name: string, target: string, priority: "must" | "important", kind: "fixed" | "usage" = "fixed"): ObligationState {
  const t = usd(target);
  return { id, name, payee: `0x${id}`, target: t, reserve: t, kind, priority, cycleMs: 120_000, nextDueMs: NOW + 120_000, cadenceLabel: "Monthly", status: "funded" };
}

/** SPEC "start of Session 1": 20.00 total, 16.50 committed, 3.50 free. */
function session1Vault(): VaultState {
  const obligations = [
    obligation(0, "Inference API", "6.00", "must", "usage"),
    obligation(1, "Hosting VPS", "5.00", "must"),
    obligation(2, "Weekly savings", "4.00", "important"),
    obligation(3, "Domain renewal", "1.50", "important"),
  ];
  return vault(obligations, usd("3.50"));
}

/** SPEC "start of Session 2": 18.00 total, 16.00 committed (Inference now 7.00, domain paid), 2.00 free. */
function session2Vault(): VaultState {
  const obligations = [
    obligation(0, "Inference API", "7.00", "must", "usage"),
    obligation(1, "Hosting VPS", "5.00", "must"),
    obligation(2, "Weekly savings", "4.00", "important"),
  ];
  return vault(obligations, usd("2.00"));
}

function vault(obligations: ObligationState[], free: bigint): VaultState {
  const reserved = obligations.reduce((s, o) => s + o.reserve, 0n);
  return {
    vaultId: "0xvault",
    version: 1,
    owner: "0xowner",
    free,
    reserved,
    total: free + reserved,
    obligations,
    policy: { agent: "0xagent", maxPerRequest: 5n * U, maxPerDay: 10n * U, spentInWindow: 0n, windowStartMs: NOW, expiresMs: NOW + 30 * DAY_MS, paused: false },
    readAtMs: NOW,
  };
}

const REQ = {
  datamart: { merchant: "DataMart", item: "Historical token prices", category: "data", amount: usd("0.50") },
  searchbox: { merchant: "SearchBox", item: "Premium search", category: "search", amount: usd("1.20") },
  reportlab: { merchant: "ReportLab", item: "Onchain research report", category: "research", amount: usd("3.00") },
} satisfies Record<string, PaymentRequestInput>;

function ruleFrom(req: PaymentRequestInput, action: "allow" | "deny", id: string): Rule {
  const f = draftRule(req, action, NOW);
  return { id, ...f, active: true, sentence: ruleSentence(f), sourceMemoryId: `mem-${id}` };
}

function input(v: VaultState, request: PaymentRequestInput, rules: Rule[], known: string[]): EngineInput {
  return { request, vault: v, rules, knownMerchants: new Set(known.map(merchantKey)), defaults: { autoAllowUpTo: usd("0.50") }, nowMs: NOW };
}

describe("SPEC sample requests", () => {
  it("replays session 1 and session 2 exactly", () => {
    const rules: Rule[] = [];
    const known: string[] = [];

    // Session 1, start 20.00 / 16.50 / 3.50
    const v1 = session1Vault();

    // 1. DataMart 0.50 -> auto-approved: within the default 0.50 threshold
    const r1 = decide(input(v1, REQ.datamart, rules, known));
    expect(r1.action).toBe("auto_allow");
    expect(r1.code).toBe("default_threshold");
    expect(r1.reasons[0]).toContain("0.50 USDC");
    v1.free -= REQ.datamart.amount; // paid
    known.push("DataMart");

    // 2. SearchBox 1.20 -> held: new merchant; owner approves and remembers
    const r2 = decide(input(v1, REQ.searchbox, rules, known));
    expect(r2.action).toBe("hold");
    expect(r2.code).toBe("new_merchant");
    expect(r2.allowDisabled).toBe(false);
    rules.push(ruleFrom(REQ.searchbox, "allow", "searchbox-allow"));
    expect(rules[0]!.maxAmount).toBe(usd("1.50"));
    expect(rules[0]!.sentence).toMatch(/^Always allow search from SearchBox up to 1\.50 USDC/);
    v1.free -= REQ.searchbox.amount; // approved manually, paid
    known.push("SearchBox");
    expect(v1.free).toBe(usd("1.80")); // SPEC end of session 1 free

    // 3. ReportLab 3.00 -> held: would cut reserves by 1.20, approval disabled; owner denies and remembers
    const r3 = decide(input(v1, REQ.reportlab, rules, known));
    expect(r3.action).toBe("hold");
    expect(r3.code).toBe("would_cut_reserve");
    expect(r3.cutsReserveBy).toBe(usd("1.20"));
    expect(r3.allowDisabled).toBe(true);
    expect(r3.reasons[0]).toContain("1.20 USDC of committed funds");
    expect(r3.simulation.affected).toEqual([{ id: 3, name: "Domain renewal", amount: usd("1.20") }]);
    rules.push(ruleFrom(REQ.reportlab, "deny", "reportlab-deny"));
    known.push("ReportLab");

    // Session 2, start 18.00 / 16.00 / 2.00 (after the cycle, simulated income 17.00)
    const v2 = session2Vault();
    expect(v2.total).toBe(usd("18.00"));
    expect(v2.reserved).toBe(usd("16.00"));

    // 4. SearchBox 1.20 -> auto-approved by the SearchBox rule up to 1.50
    const r4 = decide(input(v2, REQ.searchbox, rules, known));
    expect(r4.action).toBe("auto_allow");
    expect(r4.code).toBe("allow_rule");
    expect(r4.matchedRuleIds).toEqual(["searchbox-allow"]);
    v2.free -= REQ.searchbox.amount;

    // 5. DataMart 0.50 -> auto-approved: within the default 0.50 threshold
    const r5 = decide(input(v2, REQ.datamart, rules, known));
    expect(r5.action).toBe("auto_allow");
    expect(r5.code).toBe("default_threshold");
    v2.free -= REQ.datamart.amount;
    expect(v2.free).toBe(usd("0.30"));

    // 6. ReportLab 3.00 -> held: would cut reserves by 2.70, denied before
    const r6 = decide(input(v2, REQ.reportlab, rules, known));
    expect(r6.action).toBe("hold");
    expect(r6.code).toBe("would_cut_reserve");
    expect(r6.cutsReserveBy).toBe(usd("2.70"));
    expect(r6.allowDisabled).toBe(true);
    expect(r6.matchedRuleIds).toEqual(["reportlab-deny"]);
    expect(r6.reasons.some((r) => r.startsWith("You denied this before"))).toBe(true);

    // Requests needing review: 2 of 3 in session 1, 1 of 3 in session 2 (SPEC memory table)
    expect([r1, r2, r3].filter((r) => r.action === "hold")).toHaveLength(2);
    expect([r4, r5, r6].filter((r) => r.action === "hold")).toHaveLength(1);
  });
});

describe("hard rules come before memory", () => {
  const known = ["SearchBox"];
  const allow = [ruleFrom(REQ.searchbox, "allow", "a")];

  it("paused agent is auto-denied even with an allow rule", () => {
    const v = session1Vault();
    v.policy!.paused = true;
    const r = decide(input(v, REQ.searchbox, allow, known));
    expect(r.action).toBe("auto_deny");
    expect(r.code).toBe("agent_paused");
  });

  it("revoked agent (no policy) is auto-denied", () => {
    const v = session1Vault();
    v.policy = null;
    expect(decide(input(v, REQ.datamart, [], known)).code).toBe("agent_no_permission");
  });

  it("expired permission is auto-denied", () => {
    const v = session1Vault();
    v.policy!.expiresMs = NOW;
    expect(decide(input(v, REQ.datamart, [], known)).code).toBe("agent_expired");
  });

  it("over the per-request cap is auto-denied", () => {
    const v = session1Vault();
    const r = decide(input(v, { ...REQ.searchbox, amount: 5n * U + 1n }, allow, known));
    expect(r.code).toBe("over_per_request");
  });

  it("over the remaining daily window is auto-denied, and the window resets after 24 h", () => {
    const v = session1Vault();
    v.policy!.spentInWindow = usd("9.50");
    expect(decide(input(v, REQ.searchbox, allow, known)).code).toBe("over_daily");
    v.policy!.windowStartMs = NOW - DAY_MS;
    expect(decide(input(v, REQ.searchbox, allow, known)).code).toBe("allow_rule");
  });

  it("an allow rule cannot unlock reserves", () => {
    const v = session1Vault();
    v.free = usd("1.00");
    const r = decide(input(v, REQ.searchbox, allow, known));
    expect(r.action).toBe("hold");
    expect(r.code).toBe("would_cut_reserve");
    expect(r.allowDisabled).toBe(true);
  });

  it("a deny rule auto-denies when funds are sufficient", () => {
    const v = session1Vault();
    const r = decide(input(v, REQ.searchbox, [ruleFrom(REQ.searchbox, "deny", "d")], known));
    expect(r.action).toBe("auto_deny");
    expect(r.code).toBe("deny_rule");
  });

  it("known merchant above its rule is held as above learned rules", () => {
    const v = session1Vault();
    const r = decide(input(v, { ...REQ.searchbox, amount: usd("2.00") }, allow, known));
    expect(r.code).toBe("above_rules");
  });

  it("disabled or expired rules are ignored", () => {
    const v = session1Vault();
    const off = { ...allow[0]!, active: false };
    expect(decide(input(v, REQ.searchbox, [off], known)).code).toBe("above_rules");
    const old = { ...allow[0]!, expiresMs: NOW };
    expect(decide(input(v, REQ.searchbox, [old], known)).code).toBe("above_rules");
  });

  it("free funds equal to the amount are enough", () => {
    const v = session1Vault();
    v.free = usd("1.20");
    expect(decide(input(v, REQ.searchbox, allow, known)).action).toBe("auto_allow");
  });
});
