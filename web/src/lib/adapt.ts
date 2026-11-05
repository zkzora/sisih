/**
 * Live API data -> the DemoState shape the screens already render. Pure and unit tested.
 * Obligation ids come only from the API. Amounts become number micro-USDC at this edge.
 */
import type { Activity, Category, DemoState, Memory, MemoryKind, Obligation, Rule, SessionStats, SpendRequest } from "./types";
import { toUnits, type LiveActivity, type LiveClock, type LiveHealth, type LiveInsights, type LiveMemory, type LiveRecall, type LiveRequest, type LiveRule, type LiveSession, type LiveState, type LiveSuggestion } from "./live";

export interface LiveInputs {
  state: LiveState;
  requests: LiveRequest[];
  rules: LiveRule[];
  memories: LiveMemory[];
  activity: LiveActivity[];
  insights: LiveInsights | null;
  sessions: LiveSession[];
  suggestions: LiveSuggestion[];
  clock: LiveClock | null;
  health: LiveHealth | null;
  recall: LiveRecall | null;
  defaultThreshold: number;
  prefs: { theme: "light" | "dark"; demoBanner: boolean };
  walletAddress: string | null;
  sseConnected: boolean;
  now?: number;
}

const DAY = 86_400_000;
const DAY_ZERO = Date.UTC(2026, 10, 5);

export const CATEGORY: Record<string, Category> = { data: "Data", search: "Search", inference: "Inference", research: "Research" };

const MEMORY_KIND: Record<LiveMemory["type"], MemoryKind> = {
  decision: "Decision",
  rule: "Rule learned",
  obligation_outcome: "Obligation outcome",
  reserve_change: "Reserve updated",
  rule_disabled: "Rule revoked",
  session_summary: "Session summary",
  merchant_note: "Merchant note",
};

const ACTIVITY_KIND: Record<string, Activity["kind"]> = {
  Deposit: "Deposit",
  Reserve: "Reserve funds",
  "Pay obligation": "Pay obligation",
  "Release to agent": "Release to agent",
  "x402 settle": "x402 settle",
  "Change reserve": "Update reserve",
  Withdraw: "Withdraw",
  "Agent permission": "Agent permission",
  "Vault created": "Vault created",
};

/** "[sisih:v1:rule] Always allow ... {json}" -> "Always allow ..." */
export function memorySentence(text: string): string {
  return text.replace(/^\[sisih:v1:[a-z_]+\]\s*/, "").replace(/\s*\{[\s\S]*\}\s*$/, "").trim();
}

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function sessionAt(ms: number | null, sessions: LiveSession[]): number {
  if (!ms) return sessions.at(-1)?.n ?? 1;
  const hit = [...sessions].reverse().find((s) => ms >= s.startedAt);
  return hit?.n ?? sessions[0]?.n ?? 1;
}

function mapObligation(o: LiveState["vault"]["obligations"][number], suggestions: LiveSuggestion[]): Obligation {
  const s = suggestions.find((x) => x.status === "open" && x.obligationId === o.id);
  return {
    id: String(o.id),
    name: o.name,
    recipient: o.payee,
    amount: toUnits(o.target),
    reserved: toUnits(o.reserve),
    cycle: o.cadenceLabel === "Weekly" ? "Weekly" : o.cadenceLabel === "One-time" || o.cycleMs === 0 ? "Once" : "Monthly",
    type: o.kind === "usage" ? "Usage-based" : "Fixed",
    priority: o.priority === "must" ? "Essential" : "Important",
    due: isoDate(o.nextDueMs),
    paid: false,
    suggestion: s ? toUnits(s.suggestedTarget) : undefined,
    nextDueMs: o.nextDueMs,
    cycleMs: o.cycleMs,
    kind: o.kind,
    suggestionId: s?.id,
    suggestionReason: s?.reason,
  };
}

export function mapRequest(r: LiveRequest, dayOf: (ms: number) => number): SpendRequest {
  const approved = r.status === "approved" || r.status === "auto_allowed";
  const settle = r.paymentDigests.find((d) => d.step === "x402_settle");
  return {
    id: r.id,
    merchant: r.merchant,
    item: r.item,
    category: CATEGORY[r.category] ?? "Data",
    amount: toUnits(r.amount),
    status: r.status === "held" ? "held" : approved ? (r.paymentStatus === "pending" ? "paying" : "approved") : "rejected",
    reason: r.reasons.join(" "),
    timestamp: new Date(r.createdAt).toISOString(),
    session: r.session,
    day: dayOf(r.createdAt),
    automatic: r.automatic,
    transactionId: settle?.digest,
    blockedAmount: r.code === "would_cut_reserve" && !approved ? toUnits(r.cutsReserveBy) : 0,
    live: r,
  };
}

function mapMemory(m: LiveMemory): Memory {
  const merchant = typeof m.payload.merchant === "string" ? m.payload.merchant : undefined;
  return {
    id: m.id,
    kind: MEMORY_KIND[m.type] ?? "Decision",
    text: memorySentence(m.text),
    timestamp: new Date(m.createdAt).toISOString(),
    session: m.session,
    merchant,
    usedBy: m.usedInDecisions,
    status: m.status,
    blobId: m.blobId,
    walrusUrl: m.walrusUrl,
    createdAtMs: m.createdAt,
    namespace: m.namespace,
    error: m.error,
  };
}

function mapRule(r: LiveRule): Rule {
  return {
    id: r.id,
    memoryId: r.sourceMemoryId ?? r.sourceBlobId ?? "",
    merchant: r.merchant,
    category: CATEGORY[r.category] ?? "Data",
    maxAmount: toUnits(r.maxAmount),
    action: r.action,
    active: r.active,
    expires: isoDate(r.expiresMs),
    sentence: r.sentence,
    origin: r.origin,
    timesUsed: r.timesUsed,
    walrusUrl: r.walrusUrl,
  };
}

function mapActivity(a: LiveActivity, sessions: LiveSession[]): Activity {
  const kind = ACTIVITY_KIND[a.kind] ?? "Other";
  const parts = [a.from, a.to].filter(Boolean);
  return {
    id: a.id,
    kind,
    amount: toUnits(a.amount),
    description: a.label && !parts.length ? a.label : parts.join(" → ") || a.label || kind,
    timestamp: a.timestampMs ? new Date(a.timestampMs).toISOString() : new Date().toISOString(),
    session: sessionAt(a.timestampMs, sessions),
    requestId: a.requestId ?? undefined,
    memoryId: a.memoryId ?? undefined,
    digest: a.digest,
    verification: a.verification,
    failureReason: a.failureReason,
    explorerUrl: a.explorerUrl,
    checkpoint: a.checkpoint,
    from: a.from,
    to: a.to,
  };
}

function mapSession(s: LiveInsights["sessions"][number]): SessionStats {
  const spend = Object.fromEntries(Object.entries(CATEGORY).map(([k, label]) => [label, toUnits(s.spendByCategory[k])])) as Record<Category, number>;
  return {
    session: s.session,
    total: s.requests,
    manual: s.manualReviews,
    automatic: s.automatic,
    falseHolds: s.falseHolds,
    blocked: toUnits(s.moneyProtected),
    funded: s.obligationsOnTime,
    underfunded: s.obligationsUnderfunded,
    categorySpend: spend,
  };
}

export function buildState(i: LiveInputs): DemoState {
  const now = i.now ?? Date.now();
  const dayOf = (ms: number) => Math.floor((ms - DAY_ZERO) / DAY);
  const v = i.state.vault;
  const p = v.policy;
  const open = i.suggestions.find((s) => s.status === "open");
  return {
    version: 1,
    balance: toUnits(v.total),
    session: i.state.session,
    day: dayOf(now),
    agentStatus: !p ? "revoked" : p.paused ? "paused" : "active",
    walletConnected: Boolean(i.walletAddress),
    obligations: v.obligations.map((o) => mapObligation(o, i.suggestions)),
    requests: i.requests.map((r) => mapRequest(r, dayOf)),
    memories: i.memories.map(mapMemory),
    rules: i.rules.map(mapRule),
    activities: i.activity.map((a) => mapActivity(a, i.sessions)),
    sessions: (i.insights?.sessions ?? []).map(mapSession),
    preferences: {
      defaultAction: "hold",
      defaultThreshold: i.defaultThreshold,
      perRequest: p ? toUnits(p.maxPerRequest) : 5_000_000,
      perDay: p ? toUnits(p.maxPerDay) : 10_000_000,
      expires: isoDate(p?.expiresMs ?? now + 30 * DAY),
      network: i.state.network === "mainnet" ? "Mainnet" : "Testnet",
      theme: i.prefs.theme,
      demoBanner: i.prefs.demoBanner,
    },
    cycle: i.clock?.cycle ?? 1,
    cycleAdvanced: false,
    outcome: open
      ? { needed: toUnits(open.suggestedTarget), reserved: toUnits(open.currentTarget), shortfall: toUnits(open.suggestedTarget) - toUnits(open.currentTarget), session: i.state.session }
      : undefined,
    live: {
      network: i.state.network,
      vaultId: v.vaultId,
      owner: v.owner,
      explorerUrl: v.explorerUrl,
      readAtMs: i.state.readAtMs,
      tatum: i.health?.tatum ?? i.state.tatum,
      memory: i.state.memory,
      policy: p,
      clock: i.clock,
      health: i.health,
      recall: i.recall,
      insights: i.insights,
      sessions: i.sessions,
      suggestions: i.suggestions,
      sseConnected: i.sseConnected,
    },
  };
}
