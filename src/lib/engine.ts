import type {
  Action,
  Activity,
  Category,
  DemoState,
  MemoryKind,
  Obligation,
  Outcome,
  SessionStats,
  SpendRequest,
} from "./types";

export const UNIT = 1_000_000;
export const address =
  "0x7a2c94a12c4b607c2a3174596f24cd4675cc106cdaaa09c49f18311e502c9f31";
export const categories: Category[] = [
  "Data",
  "Search",
  "Inference",
  "Research",
];
export const storageKey = "sisih-dashboard-v1";
export function money(value: number, digits = 2): string {
  return (value / UNIT).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: Math.max(digits, 6),
  });
}
export function parseMoney(value: string): number | null {
  if (!/^\d+(\.\d{1,6})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const amount = Number(whole) * UNIT + Number(fraction.padEnd(6, "0"));
  return Number.isSafeInteger(amount) &&
    amount > 0 &&
    amount <= 1_000_000 * UNIT
    ? amount
    : null;
}
export function amountInput(value: number) {
  return String(value / UNIT);
}
export function reserved(state: DemoState) {
  return state.obligations.reduce(
    (sum, o) => sum + (o.paid ? 0 : o.reserved),
    0,
  );
}
export function freeFunds(state: DemoState) {
  return state.balance - reserved(state);
}
export function spentToday(state: DemoState) {
  return state.requests
    .filter((r) => r.status === "approved" && r.day === state.day)
    .reduce((sum, r) => sum + r.amount, 0);
}
export function demoDay(state: DemoState) {
  return new Date(Date.UTC(2026, 10, 5 + state.day)).toISOString().slice(0, 10);
}
export function short(value: string) {
  return value.length > 16 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}
const id = (prefix: string) =>
  `${prefix}-${globalThis.crypto.randomUUID().slice(0, 12)}`;
const now = () => new Date().toISOString();
export const merchantInfo = {
  DataMart: {
    item: "Historical token prices",
    category: "Data" as Category,
    amount: 500_000,
  },
  SearchBox: {
    item: "Premium web search",
    category: "Search" as Category,
    amount: 1_200_000,
  },
  ReportLab: {
    item: "Onchain research report",
    category: "Research" as Category,
    amount: 3_000_000,
  },
};
export function initialState(): DemoState {
  const obligations: Obligation[] = [
    {
      id: "inference",
      name: "Inference API",
      recipient: "0x" + "a".repeat(64),
      amount: 6 * UNIT,
      reserved: 6 * UNIT,
      cycle: "Monthly",
      type: "Usage-based",
      priority: "Essential",
      due: "2026-11-10",
      paid: false,
    },
    {
      id: "hosting",
      name: "Hosting VPS",
      recipient: "0x" + "b".repeat(64),
      amount: 5 * UNIT,
      reserved: 5 * UNIT,
      cycle: "Monthly",
      type: "Fixed",
      priority: "Essential",
      due: "2026-11-12",
      paid: false,
    },
    {
      id: "savings",
      name: "Weekly savings",
      recipient: "0x" + "c".repeat(64),
      amount: 4 * UNIT,
      reserved: 4 * UNIT,
      cycle: "Weekly",
      type: "Fixed",
      priority: "Important",
      due: "2026-11-14",
      paid: false,
    },
    {
      id: "domain",
      name: "Domain renewal",
      recipient: "0x" + "d".repeat(64),
      amount: 1_500_000,
      reserved: 1_500_000,
      cycle: "Once",
      type: "Fixed",
      priority: "Important",
      due: "2026-11-18",
      paid: false,
    },
  ];
  return {
    version: 1,
    balance: 20 * UNIT,
    session: 1,
    day: 0,
    cycle: 1,
    cycleAdvanced: false,
    agentStatus: "active",
    walletConnected: false,
    obligations,
    requests: [
      {
        id: "request-search-demo",
        merchant: "SearchBox",
        ...merchantInfo.SearchBox,
        status: "held",
        reason:
          "New merchant. Available funds are sufficient, but SearchBox has no approved rule yet.",
        timestamp: now(),
        session: 1,
        day: 0,
        automatic: false,
        blockedAmount: 0,
      },
    ],
    memories: [],
    rules: [],
    activities: [
      {
        id: "activity-reserve-demo",
        kind: "Reserve funds",
        amount: 16_500_000,
        description: "Reserved across four commitments",
        timestamp: now(),
        session: 1,
      },
      {
        id: "activity-deposit-demo",
        kind: "Deposit",
        amount: 20 * UNIT,
        description: "Opening demo deposit",
        timestamp: now(),
        session: 1,
      },
    ],
    sessions: [],
    preferences: {
      defaultAction: "hold",
      defaultThreshold: 500_000,
      perRequest: 5 * UNIT,
      perDay: 10 * UNIT,
      expires: "2026-12-05",
      network: "Testnet",
      theme: "light",
      demoBanner: true,
    },
  };
}
function memory(
  s: DemoState,
  kind: MemoryKind,
  text: string,
  merchant?: string,
  usedBy: string[] = [],
) {
  const entry = {
    id: id("memory"),
    kind,
    text,
    timestamp: now(),
    session: s.session,
    merchant,
    usedBy,
  };
  s.memories.unshift(entry);
  return entry.id;
}
function activity(
  s: DemoState,
  kind: Activity["kind"],
  amount: number,
  description: string,
  extra: Partial<Activity> = {},
) {
  const entry = {
    id: id("demo-tx"),
    kind,
    amount,
    description,
    timestamp: now(),
    session: s.session,
    ...extra,
  };
  s.activities.unshift(entry);
  return entry.id;
}
function hardLimit(s: DemoState, amount: number): string | null {
  if (s.agentStatus !== "active")
    return s.agentStatus === "paused"
      ? "Agent is paused. Resume the agent before approving payments."
      : "Agent permission has been revoked. Grant permission again in Settings.";
  if (demoDay(s) > s.preferences.expires)
    return "Agent permission has expired. Update its expiry in Settings.";
  if (amount > s.preferences.perRequest)
    return `Exceeds the ${money(s.preferences.perRequest)} USDC per-request limit.`;
  if (spentToday(s) + amount > s.preferences.perDay)
    return `Exceeds the ${money(s.preferences.perDay)} USDC daily limit.`;
  if (amount > freeFunds(s))
    return `Would use ${money(amount - freeFunds(s))} USDC of committed funds. Reserved money is unavailable to the agent.`;
  return null;
}
export function requestConstraint(s: DemoState, r: SpendRequest) {
  return hardLimit(s, r.amount);
}
export function matchingRule(
  s: DemoState,
  r: Pick<SpendRequest, "merchant" | "category" | "amount">,
) {
  return [...s.rules]
    .reverse()
    .find(
      (rule) =>
        rule.active &&
        rule.merchant === r.merchant &&
        rule.category === r.category &&
        r.amount <= rule.maxAmount &&
        rule.expires >= demoDay(s),
    );
}
function settle(s: DemoState, r: SpendRequest, automatic: boolean) {
  const constraint = hardLimit(s, r.amount);
  if (constraint) return constraint;
  s.balance -= r.amount;
  r.status = "approved";
  r.automatic = automatic;
  r.reason = automatic
    ? r.memoryId
      ? "Approved by a remembered rule. All vault limits passed."
      : r.amount <= s.preferences.defaultThreshold
        ? "Within the default small-payment threshold. All vault limits passed."
        : "Approved by your default merchant policy. All vault limits passed."
    : "Approved by you. All vault limits passed.";
  r.transactionId = activity(
    s,
    "Agent payment",
    r.amount,
    `${r.merchant} · ${r.item}`,
    { requestId: r.id },
  );
  memory(
    s,
    "Decision",
    `${r.merchant}: ${money(r.amount)} USDC approved ${automatic ? "automatically" : "by the owner"}. ${r.reason}`,
    r.merchant,
    [r.id],
  );
  return null;
}
export function sessionStats(s: DemoState): SessionStats {
  const rs = s.requests.filter((r) => r.session === s.session);
  const categorySpend = Object.fromEntries(
    categories.map((c) => [
      c,
      rs
        .filter((r) => r.category === c && r.status === "approved")
        .reduce((v, r) => v + r.amount, 0),
    ]),
  ) as Record<Category, number>;
  return {
    session: s.session,
    total: rs.length,
    manual: rs.filter((r) => !r.automatic).length,
    automatic: rs.filter((r) => r.automatic).length,
    falseHolds: rs.filter((r) => r.status === "approved" && !r.automatic)
      .length,
    blocked: rs.reduce((v, r) => v + r.blockedAmount, 0),
    funded: s.obligations.filter((o) => o.paid || o.reserved >= o.amount)
      .length,
    underfunded: s.obligations.filter((o) => !o.paid && o.reserved < o.amount)
      .length,
    categorySpend,
  };
}
function fundObligations(s: DemoState) {
  let budget = s.balance;
  const ordered = [...s.obligations]
    .filter((o) => !o.paid)
    .sort((a, b) =>
      a.priority === b.priority
        ? a.due.localeCompare(b.due)
        : a.priority === "Essential"
          ? -1
          : 1,
    );
  for (const o of ordered) {
    o.reserved = Math.min(o.amount, budget);
    budget -= o.reserved;
  }
}
function validAmount(n: number) {
  return Number.isSafeInteger(n) && n > 0 && n <= 1_000_000 * UNIT;
}
function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function transition(previous: DemoState, action: Action): Outcome {
  const s = structuredClone(previous);
  const fail = (message: string): Outcome => ({
    state: previous,
    message,
    error: true,
  });
  const ok = (message: string): Outcome => ({ state: s, message });
  switch (action.type) {
    case "deposit": {
      if (
        !validAmount(action.amount) ||
        s.balance + action.amount > 1_000_000 * UNIT
      )
        return fail(
          "Enter an amount between 0.000001 and 1,000,000 USDC within the vault limit.",
        );
      s.balance += action.amount;
      fundObligations(s);
      activity(s, "Deposit", action.amount, "Demo deposit added to the vault");
      return ok(`${money(action.amount)} demo USDC deposited.`);
    }
    case "withdraw": {
      if (!validAmount(action.amount) || action.amount > freeFunds(s))
        return fail("You can only withdraw uncommitted funds.");
      s.balance -= action.amount;
      activity(
        s,
        "Withdraw",
        action.amount,
        "Owner withdrew uncommitted demo funds",
      );
      return ok(`${money(action.amount)} demo USDC withdrawn.`);
    }
    case "emergency-withdraw": {
      const amount = s.balance;
      s.balance = 0;
      s.obligations.forEach((o) => (o.reserved = 0));
      s.agentStatus = "paused";
      activity(
        s,
        "Withdraw",
        amount,
        "Emergency withdrawal released every reserve and paused the agent",
      );
      return ok("Demo vault emptied. Reserves released and agent paused.");
    }
    case "request": {
      const info = merchantInfo[action.merchant];
      const r: SpendRequest = {
        id: id("request"),
        merchant: action.merchant,
        ...info,
        status: "held",
        reason:
          "New merchant. Review this payment before the agent can proceed.",
        timestamp: now(),
        session: s.session,
        day: s.day,
        automatic: false,
        blockedAmount: 0,
      };
      s.requests.unshift(r);
      const block = hardLimit(s, r.amount);
      if (block) {
        r.reason = block;
        r.blockedAmount = Math.max(0, r.amount - freeFunds(s));
        if (
          s.agentStatus !== "active" ||
          info.amount > s.preferences.perRequest ||
          spentToday(s) + info.amount > s.preferences.perDay ||
          demoDay(s) > s.preferences.expires
        ) {
          r.status = "rejected";
          r.automatic = true;
        }
        memory(
          s,
          "Decision",
          `${r.merchant}: ${money(r.amount)} USDC ${r.status === "held" ? "held" : "rejected"}. ${block}`,
          r.merchant,
          [r.id],
        );
        return ok(
          `Payment ${r.status === "held" ? "held for review" : "rejected"}.`,
        );
      }
      const rule = matchingRule(s, r);
      if (rule) {
        r.memoryId = rule.memoryId;
        const source = s.memories.find((m) => m.id === rule.memoryId);
        source?.usedBy.push(r.id);
        if (rule.action === "deny") {
          r.status = "rejected";
          r.automatic = true;
          r.reason = "Rejected by your remembered merchant rule.";
          memory(
            s,
            "Decision",
            `${r.merchant}: ${money(r.amount)} USDC rejected by an active rule.`,
            r.merchant,
            [r.id],
          );
          return ok("Payment rejected by a remembered rule.");
        }
        settle(s, r, true);
        return ok("Demo payment completed using a remembered rule.");
      }
      if (
        r.amount <= s.preferences.defaultThreshold ||
        s.preferences.defaultAction === "allow"
      ) {
        settle(s, r, true);
        return ok("Demo payment completed within the default policy.");
      }
      memory(
        s,
        "Decision",
        `${r.merchant}: ${money(r.amount)} USDC held because no matching rule exists.`,
        r.merchant,
        [r.id],
      );
      return ok("New payment needs your review.");
    }
    case "decide": {
      const r = s.requests.find((r) => r.id === action.requestId);
      if (!r || r.status !== "held")
        return fail("This request has already been resolved.");
      if (
        action.remember &&
        (!validAmount(action.remember.maxAmount) ||
          !validDate(action.remember.expires) ||
          action.remember.expires < demoDay(s))
      )
        return fail(
          "Use a positive rule amount and an expiry on or after the demo date.",
        );
      if (action.decision === "approve") {
        const constraint = settle(s, r, false);
        if (constraint) return fail(constraint);
      } else {
        r.status = "rejected";
        r.reason = "Rejected by you. No funds were released.";
        memory(
          s,
          "Decision",
          `${r.merchant}: ${money(r.amount)} USDC rejected by the owner.`,
          r.merchant,
          [r.id],
        );
      }
      if (action.remember) {
        const text = `${action.decision === "approve" ? "Allow" : "Deny"} ${r.category.toLowerCase()} from ${r.merchant} up to ${money(action.remember.maxAmount)} USDC through ${action.remember.expires}.`;
        const memoryId = memory(s, "Rule learned", text, r.merchant, [r.id]);
        s.rules.push({
          id: id("rule"),
          memoryId,
          merchant: r.merchant,
          category: r.category,
          maxAmount: action.remember.maxAmount,
          action: action.decision === "approve" ? "allow" : "deny",
          active: true,
          expires: action.remember.expires,
        });
      }
      return ok(
        action.decision === "approve"
          ? "Demo payment completed." +
              (action.remember ? " Rule saved for the next request." : "")
          : "Request rejected." + (action.remember ? " Rule saved." : ""),
      );
    }
    case "save-obligation": {
      const o = action.obligation;
      if (
        !o.name.trim() ||
        !validAmount(o.amount) ||
        !/^0x[0-9a-fA-F]{64}$/.test(o.recipient) ||
        !validDate(o.due) ||
        o.due < demoDay(s)
      )
        return fail(
          "Check the obligation name, amount, Sui address, and future due date.",
        );
      const old = s.obligations.find((v) => v.id === o.id);
      if (old?.paid)
        return fail("Paid obligations cannot be edited in this cycle.");
      const existing = old?.reserved || 0;
      const nextReserve = Math.min(o.amount, freeFunds(s) + existing);
      const saved = {
        ...o,
        id: old?.id || id("obligation"),
        name: o.name.trim(),
        reserved: nextReserve,
        paid: false,
      };
      s.obligations = old
        ? s.obligations.map((v) => (v.id === o.id ? saved : v))
        : [...s.obligations, saved];
      activity(s, "Reserve funds", nextReserve, `${saved.name} reserved`, {
        obligationId: saved.id,
      });
      return ok(
        nextReserve < o.amount
          ? "Obligation saved. Add funds to cover the shortfall."
          : "Obligation saved and funds reserved.",
      );
    }
    case "delete-obligation": {
      const o = s.obligations.find((o) => o.id === action.id);
      if (!o) return fail("Obligation not found.");
      s.obligations = s.obligations.filter((o) => o.id !== action.id);
      return ok(`${o.name} removed. Its reserved funds are now available.`);
    }
    case "pay-obligation": {
      const o = s.obligations.find((o) => o.id === action.id);
      if (!o || o.paid)
        return fail("This obligation has already been paid or removed.");
      if (o.reserved < o.amount)
        return fail(
          `Add ${money(o.amount - o.reserved)} USDC to fully fund this obligation first.`,
        );
      s.balance -= o.amount;
      o.paid = true;
      o.reserved = 0;
      const mid = memory(
        s,
        "Obligation outcome",
        `${o.name} paid in full: ${money(o.amount)} demo USDC. No reserve shortfall.`,
      );
      activity(s, "Pay obligation", o.amount, `${o.name} paid in the demo`, {
        obligationId: o.id,
        memoryId: mid,
      });
      return ok(`${o.name} paid with demo funds.`);
    }
    case "accept-reserve": {
      const o = s.obligations.find((o) => o.id === action.id);
      if (!o || o.paid || !validAmount(action.amount))
        return fail("Choose an unpaid obligation and a valid reserve amount.");
      const extra = Math.max(0, action.amount - o.reserved);
      if (extra > freeFunds(s))
        return fail(
          `Add ${money(extra - freeFunds(s))} USDC before increasing this reserve.`,
        );
      const old = o.amount;
      o.amount = action.amount;
      o.reserved = action.amount;
      delete o.suggestion;
      const mid = memory(
        s,
        "Reserve updated",
        `${o.name}: owner approved reserve change from ${money(old)} to ${money(action.amount)} USDC.`,
      );
      activity(
        s,
        "Update reserve",
        action.amount,
        `${o.name} reserve updated`,
        { obligationId: o.id, memoryId: mid },
      );
      return ok("Reserve updated. The agent cannot spend this money.");
    }
    case "dismiss-suggestion": {
      const o = s.obligations.find((o) => o.id === action.id);
      if (o) delete o.suggestion;
      memory(
        s,
        "Decision",
        "Owner dismissed the reserve suggestion; the current amount is unchanged.",
      );
      return ok("Suggestion dismissed. Your current reserve is unchanged.");
    }
    case "toggle-rule": {
      const rule = s.rules.find((r) => r.id === action.id);
      if (!rule) return fail("Rule not found.");
      rule.active = !rule.active;
      memory(
        s,
        rule.active ? "Rule learned" : "Rule revoked",
        `${rule.merchant} ${rule.category.toLowerCase()} rule ${rule.active ? "reactivated" : "deactivated"}. Its earlier memory is retained.`,
        rule.merchant,
      );
      return ok(
        rule.active
          ? "Rule enabled."
          : "Rule disabled. Earlier decisions remain in history.",
      );
    }
    case "agent-status": {
      s.agentStatus = action.status;
      return ok(
        action.status === "active"
          ? "Demo agent resumed."
          : action.status === "paused"
            ? "Agent paused. New payments are blocked."
            : "Agent permission revoked. New payments are blocked.",
      );
    }
    case "wallet": {
      s.walletConnected = action.connected;
      return ok(
        action.connected
          ? "Demo wallet connected. No real wallet was accessed."
          : "Demo wallet disconnected.",
      );
    }
    case "settings": {
      const p = action.preferences;
      if (
        !validAmount(p.perRequest) ||
        !validAmount(p.perDay) ||
        p.perRequest > p.perDay ||
        !validAmount(p.defaultThreshold) ||
        p.defaultThreshold > p.perRequest ||
        !validDate(p.expires) ||
        p.expires < demoDay(s)
      )
        return fail(
          "Use a default threshold ≤ per-request limit ≤ daily limit, and a future expiry.",
        );
      s.preferences = p;
      return ok("Demo policy saved.");
    }
    case "advance-cycle": {
      if (s.cycleAdvanced)
        return fail(
          "This cycle is already advanced. Start a new session first.",
        );
      if (s.balance + 17 * UNIT > 1_000_000 * UNIT)
        return fail(
          "Withdraw some demo funds before adding the next-cycle income.",
        );
      s.balance += 17 * UNIT;
      activity(s, "Deposit", 17 * UNIT, "Simulated next-cycle income");

      for (const o of s.obligations.filter((o) => !o.paid)) {
        const needed = o.id === "inference" ? 6_800_000 : o.amount;
        const shortfall = Math.max(0, needed - o.reserved);
        if (o.id === "inference") {
          s.outcome = {
            needed,
            reserved: o.reserved,
            shortfall,
            session: s.session,
          };
          if (shortfall) {
            o.suggestion = Math.max(o.amount, 7 * UNIT);
            memory(
              s,
              "Decision",
              `Suggest reserving ${money(o.suggestion)} USDC for Inference API after a ${money(shortfall)} USDC demo shortfall.`,
            );
          }
        }
        if (needed > freeFunds(s) + o.reserved) {
          memory(
            s,
            "Obligation outcome",
            `${o.name}: ${money(needed)} USDC due. Insufficient funds to settle without using another commitment's reserve.`,
          );
          continue;
        }
        const mid = memory(
          s,
          "Obligation outcome",
          `${o.name}: paid ${money(needed)} demo USDC. Reserved ${money(o.reserved)} USDC; reserve shortfall ${money(shortfall)} USDC covered by available funds.`,
        );
        s.balance -= needed;
        o.reserved = 0;
        o.paid = true;
        activity(
          s,
          "Pay obligation",
          needed,
          `${o.name} settled in the demo billing cycle`,
          { obligationId: o.id, memoryId: mid },
        );
      }
      for (const o of s.obligations.filter(
        (o) => o.paid && o.cycle !== "Once",
      )) {
        o.paid = false;
        o.reserved = 0;
        const due = new Date(o.due + "T00:00:00Z");
        if (o.cycle === "Weekly") due.setUTCDate(due.getUTCDate() + 7);
        else due.setUTCMonth(due.getUTCMonth() + 1);
        o.due = due.toISOString().slice(0, 10);
      }
      fundObligations(s);
      s.cycle++;
      s.day++;
      s.cycleAdvanced = true;
      return ok(
        "17.00 demo USDC received. Bills settled where funded; recurring commitments reserved again.",
      );
    }
    case "new-session": {
      const stats = sessionStats(s);
      s.sessions.push(stats);
      memory(
        s,
        "Session summary",
        `Session ${s.session}: ${stats.total} requests, ${stats.automatic} automatic, ${stats.manual} reviewed or held; ${s.rules.filter((r) => r.active).length} active rules.`,
      );
      s.session++;
      s.day++;
      s.cycleAdvanced = false;
      return ok(
        `Session ${s.session} started. Saved rules and balances carry over.`,
      );
    }
  }
}
export function restoreDemo(raw: string): DemoState | null {
  try {
    const s = JSON.parse(raw) as DemoState;
    if (
      s.version !== 1 ||
      !Number.isSafeInteger(s.balance) ||
      s.balance < 0 ||
      !Array.isArray(s.obligations) ||
      !Array.isArray(s.requests) ||
      !Array.isArray(s.memories) ||
      !Array.isArray(s.activities) ||
      !Array.isArray(s.sessions) ||
      !Array.isArray(s.rules) ||
      !s.preferences ||
      reserved(s) > s.balance ||
      s.obligations.some(
        (o) =>
          !Number.isSafeInteger(o.reserved) ||
          o.reserved < 0 ||
          !Number.isSafeInteger(o.amount) ||
          o.amount <= 0,
      )
    )
      return null;
    return s;
  } catch {
    return null;
  }
}
