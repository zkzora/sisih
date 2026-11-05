/**
 * Policy engine: a pure function. Decides from the cached vault state and the rules cache;
 * never waits on Walrus. Hard rules (steps 1-3) mirror what the Move vault enforces, so a
 * request the contract would refuse is never sent to it. Memory (rules) can only decide
 * among requests that already fit in free funds.
 *
 * Order (docs/BUILD_PLAN.md Phase 2):
 *   1 agent paused / no permission / expired -> auto_deny
 *   2 over per-request cap or remaining daily window -> auto_deny
 *   3 amount > free -> hold "would use X of committed funds", approval disabled
 *   4 matching deny rule -> auto_deny
 *   5 matching allow rule -> auto_allow
 *   6 amount <= default threshold -> auto_allow
 *   7 merchant never seen -> hold "new merchant"
 *   8 otherwise -> hold "above learned rules"
 */
import { formatUsdc } from "../lib/env";
import type { Category, ObligationState, PaymentRequestInput, RecalledMemory, Rule, VaultState } from "../domain/types";

export const DAY_MS = 86_400_000;

export type EngineAction = "auto_allow" | "auto_deny" | "hold";

export type ReasonCode =
  | "agent_paused"
  | "agent_no_permission"
  | "agent_expired"
  | "over_per_request"
  | "over_daily"
  | "would_cut_reserve"
  | "deny_rule"
  | "allow_rule"
  | "default_threshold"
  | "new_merchant"
  | "above_rules";

export interface EngineDefaults {
  /** Auto-approve threshold for merchants without a rule (SPEC: 0.50 USDC). */
  autoAllowUpTo: bigint;
}

export interface EngineInput {
  request: PaymentRequestInput;
  vault: VaultState;
  rules: Rule[];
  /** Merchants with any earlier request or rule. */
  knownMerchants: ReadonlySet<string>;
  defaults: EngineDefaults;
  nowMs: number;
  /** Optional, attached later; the decision never depends on it arriving. */
  recalled?: RecalledMemory[];
}

export interface AffectedObligation {
  id: number;
  name: string;
  /** How much of this obligation's reserve the request would need. */
  amount: bigint;
}

export interface EngineResult {
  action: EngineAction;
  code: ReasonCode;
  reasons: string[];
  /** amount - free when the request would need committed funds, else 0. */
  cutsReserveBy: bigint;
  /** Owner approval is impossible: the contract locks reserves. */
  allowDisabled: boolean;
  matchedRuleIds: string[];
  memoryRefs: string[];
  simulation: {
    freeBefore: bigint;
    freeAfter: bigint;
    affected: AffectedObligation[];
  };
}

const key = (merchant: string) => merchant.trim().toLowerCase();

export function ruleMatches(rule: Rule, req: { merchant: string; category: Category; amount: bigint }, nowMs: number): boolean {
  return (
    rule.active &&
    key(rule.merchant) === key(req.merchant) &&
    rule.category === req.category &&
    req.amount <= rule.maxAmount &&
    nowMs < rule.expiresMs
  );
}

/** Newest matching rule of a given action (rules are ordered oldest first). */
function newestMatch(rules: Rule[], action: Rule["action"], req: PaymentRequestInput, nowMs: number): Rule | undefined {
  for (let i = rules.length - 1; i >= 0; i--) {
    const r = rules[i]!;
    if (r.action === action && ruleMatches(r, req, nowMs)) return r;
  }
  return undefined;
}

/**
 * Which reserves a cut of `shortBy` would eat into, for the balance simulation.
 * Mirrors fund_reserves in reverse: important before must, newest id first.
 */
export function affectedObligations(obligations: ObligationState[], shortBy: bigint): AffectedObligation[] {
  const order = [...obligations].sort((a, b) =>
    a.priority === b.priority ? b.id - a.id : a.priority === "important" ? -1 : 1,
  );
  const out: AffectedObligation[] = [];
  let left = shortBy;
  for (const o of order) {
    if (left <= 0n) break;
    if (o.reserve <= 0n) continue;
    const take = o.reserve < left ? o.reserve : left;
    out.push({ id: o.id, name: o.name, amount: take });
    left -= take;
  }
  return out;
}

export interface HardLimit {
  code: Extract<ReasonCode, "agent_paused" | "agent_no_permission" | "agent_expired" | "over_per_request" | "over_daily" | "would_cut_reserve">;
  reason: string;
  /** amount - free, when code is would_cut_reserve */
  short: bigint;
}

/**
 * The hard limits the Move vault enforces in release_to_agent, in the same order.
 * Used by the engine (steps 1-3) and as the pre-check before building a release transaction.
 */
export function hardLimit(vault: VaultState, amount: bigint, nowMs: number): HardLimit | null {
  const p = vault.policy;
  const none = (code: HardLimit["code"], reason: string): HardLimit => ({ code, reason, short: 0n });
  if (!p) return none("agent_no_permission", "Agent permission has been revoked. No funds can be released.");
  if (p.paused) return none("agent_paused", "Agent is paused. All requests are denied.");
  if (nowMs >= p.expiresMs) return none("agent_expired", "Agent permission has expired.");
  if (amount > p.maxPerRequest) return none("over_per_request", `Exceeds the ${formatUsdc(p.maxPerRequest)} USDC per-request limit.`);
  const spent = nowMs >= p.windowStartMs + DAY_MS ? 0n : p.spentInWindow;
  const dayLeft = p.maxPerDay - spent;
  if (amount > dayLeft) {
    return none("over_daily", `Exceeds the daily limit: ${formatUsdc(dayLeft > 0n ? dayLeft : 0n)} of ${formatUsdc(p.maxPerDay)} USDC left today.`);
  }
  if (amount > vault.free) {
    const short = amount - vault.free;
    return { code: "would_cut_reserve", reason: `Would use ${formatUsdc(short)} USDC of committed funds. Reserves are locked by the contract.`, short };
  }
  return null;
}

export function decide(input: EngineInput): EngineResult {
  const { request: req, vault, rules, defaults, nowMs } = input;
  const amt = req.amount;
  const free = vault.free;
  const memoryRefs = (input.recalled ?? []).map((m) => m.memoryId ?? m.blobId);
  const base = {
    cutsReserveBy: 0n,
    allowDisabled: false,
    matchedRuleIds: [] as string[],
    memoryRefs,
    simulation: { freeBefore: free, freeAfter: free - amt >= 0n ? free - amt : 0n, affected: [] as AffectedObligation[] },
  };
  const result = (action: EngineAction, code: ReasonCode, reasons: string[], extra: Partial<EngineResult> = {}): EngineResult => ({
    ...base,
    action,
    code,
    reasons,
    ...extra,
    simulation: { ...base.simulation, ...(extra.simulation ?? {}) },
  });
  const noMove = { simulation: { freeBefore: free, freeAfter: free, affected: [] } };

  // 1-3. Hard limits (on-chain): permission, caps, free funds
  const hard = hardLimit(vault, amt, nowMs);
  const denyRule = newestMatch(rules, "deny", req, nowMs);
  if (hard && hard.code !== "would_cut_reserve") return result("auto_deny", hard.code, [hard.reason], noMove);

  // 3. Free funds: never cut a reserve; the owner cannot approve this either
  if (hard) {
    const short = hard.short;
    const affected = affectedObligations(vault.obligations, short);
    const reasons = [hard.reason];
    if (denyRule) reasons.push(`You denied this before: ${denyRule.sentence}.`);
    return result("hold", "would_cut_reserve", reasons, {
      cutsReserveBy: short,
      allowDisabled: true,
      matchedRuleIds: denyRule ? [denyRule.id] : [],
      simulation: { freeBefore: free, freeAfter: 0n, affected },
    });
  }

  // 4. Deny rule (soft, memory)
  if (denyRule) {
    return result("auto_deny", "deny_rule", [`Denied by your remembered rule: ${denyRule.sentence}.`], {
      matchedRuleIds: [denyRule.id],
      ...noMove,
    });
  }

  // 5. Allow rule (soft, memory)
  const allowRule = newestMatch(rules, "allow", req, nowMs);
  if (allowRule) {
    return result("auto_allow", "allow_rule", [`Approved by your remembered rule: ${allowRule.sentence}. All vault limits passed.`], {
      matchedRuleIds: [allowRule.id],
    });
  }

  // 6. Default threshold
  if (amt <= defaults.autoAllowUpTo) {
    return result("auto_allow", "default_threshold", [
      `Within the default ${formatUsdc(defaults.autoAllowUpTo)} USDC auto-approve threshold. All vault limits passed.`,
    ]);
  }

  // 7-8. Ask the owner
  if (!input.knownMerchants.has(key(req.merchant))) {
    return result("hold", "new_merchant", [`New merchant. Free funds are sufficient, but ${req.merchant} has no approved rule yet.`]);
  }
  return result("hold", "above_rules", [`Above your learned rules for ${req.merchant}. Free funds are sufficient.`]);
}

export function merchantKey(merchant: string): string {
  return key(merchant);
}
