/**
 * Live API client and response types for the Sisih server (server/src/api/app.ts).
 * Amounts arrive as base-unit strings; convert with toUnits() only at the display edge.
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
export const TOKEN_KEY = "sisih-demo-token";

export function demoToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setDemoToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: token lives only for this page */
  }
}

/** Base-unit string -> number of micro-USDC (safe: demo amounts are tiny). */
export const toUnits = (v: string | number | null | undefined): number => (v === null || v === undefined || v === "" ? 0 : Number(v));

export class ApiFailure extends Error {
  constructor(public status: number, message: string, public code: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {}): Promise<T> {
  const method = init.method ?? "GET";
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (method !== "GET") {
    const t = demoToken();
    if (t) headers["x-demo-token"] = t;
  }
  const res = await fetch(`${API_URL}${path}`, { method, headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiFailure(res.status, json?.error ?? `${method} ${path} failed (${res.status})`, json?.code ?? "error");
  return json as T;
}

// ---------------------------------------------------------------------------------------
export interface LiveObligation {
  id: number;
  name: string;
  payee: string;
  target: string;
  reserve: string;
  kind: "fixed" | "usage";
  priority: "must" | "important";
  cycleMs: number;
  nextDueMs: number;
  cadenceLabel: string;
  status: "funded" | "underfunded";
  suggestion?: LiveSuggestion | null;
}

export interface LivePolicy {
  agent: string;
  maxPerRequest: string;
  maxPerDay: string;
  spentInWindow: string;
  windowStartMs: number;
  expiresMs: number;
  paused: boolean;
}

export interface TatumStatus {
  level: "green" | "yellow" | "red";
  host: string;
  network: string;
  lastOkAt: number | null;
  lastLatencyMs: number | null;
  calls: number;
  failures: number;
  lastError: { at: number; code: string; message: string } | null;
}

export interface LiveState {
  network: "testnet" | "mainnet";
  vault: {
    vaultId: string;
    owner: string;
    free: string;
    reserved: string;
    total: string;
    obligations: LiveObligation[];
    policy: LivePolicy | null;
    readAtMs: number;
    explorerUrl: string;
  };
  verifiedVia: string;
  agentAddress: string;
  readAtMs: number;
  session: number;
  heldRequests: number;
  memory: { namespace: string; stored: number; writing: number; failed: number };
  tatum: TatumStatus;
}

export type RecalledMemory = { memoryId: string | null; blobId: string; text: string; distance: number };

export interface LiveRequest {
  id: string;
  session: number;
  merchant: string;
  merchantDemo: true;
  item: string;
  category: "data" | "search" | "inference" | "research";
  amount: string;
  taskContext: string | null;
  action: "auto_allow" | "auto_deny" | "hold";
  code: string;
  status: "auto_allowed" | "auto_denied" | "held" | "approved" | "denied";
  automatic: boolean;
  reasons: string[];
  cutsReserveBy: string;
  allowDisabled: boolean;
  matchedRuleIds: string[];
  simulation: { freeBefore: string; freeAfter: string; affected: { id: number; name: string; amount: string }[] };
  recall: { query: string | null; ms?: number | null; pending?: boolean; error?: string; results: RecalledMemory[] };
  paymentStatus: "none" | "stub" | "pending" | "paid" | "failed";
  paymentDigests: { step: "release" | "x402_settle"; digest: string; verified: boolean }[];
  createdAt: number;
  decidedAt: number | null;
}

export interface LiveRule {
  id: string;
  merchant: string;
  category: string;
  maxAmount: string;
  action: "allow" | "deny";
  expiresMs: number;
  active: boolean;
  sentence: string;
  sourceMemoryId: string | null;
  sourceBlobId: string | null;
  walrusUrl: string | null;
  origin: "local" | "walrus";
  timesUsed: number;
  lastUsedAt: number | null;
  createdAt: number;
}

export interface LiveMemory {
  id: string;
  type: "decision" | "rule" | "obligation_outcome" | "reserve_change" | "merchant_note" | "rule_disabled" | "session_summary";
  text: string;
  payload: Record<string, unknown>;
  session: number;
  status: "writing" | "stored" | "failed";
  jobId: string | null;
  blobId: string | null;
  walrusUrl: string | null;
  namespace: string;
  error: string | null;
  usedInDecisions: string[];
  createdAt: number;
  storedAt: number | null;
}

export interface LiveActivity {
  id: string;
  digest: string;
  kind: string;
  amount: string | null;
  from: string;
  to: string;
  timestampMs: number | null;
  checkpoint: string | null;
  verification: "verified" | "pending" | "failed" | "error";
  failureReason: string | null;
  explorerUrl: string;
  label: string | null;
  memoryId: string | null;
  requestId: string | null;
  eventType: string | null;
}

export interface LiveInsights {
  source: string;
  sessions: {
    session: number;
    requests: number;
    manualReviews: number;
    automatic: number;
    automaticPct: number | null;
    falseHolds: number;
    moneyProtected: string;
    moneyProtectedCumulative: string;
    obligationsOnTime: number;
    obligationsUnderfunded: number;
    spendByCategory: Record<string, string>;
  }[];
  cards: { memoriesStored: number; memoriesWriting: number; activeRules: number; automaticPctLastSession: number | null; moneyProtectedTotal: string };
}

export interface LiveSuggestion {
  id: string;
  obligationId: number;
  obligationName: string;
  currentTarget: string;
  suggestedTarget: string;
  reason: string;
  sourceMemoryId: string | null;
  status: "open" | "accepted" | "rejected";
  createdAt: number;
}

export interface LiveSession {
  n: number;
  startedAt: number;
  endedAt: number | null;
  summaryMemoryId: string | null;
  rulesLoaded: number | null;
  rulesLoadMs: number | null;
  stats: { session: number; requests: number; held: number; automatic: number; approved: number; denied: number; newRules: number };
}

export interface LiveClock {
  cycle: number;
  session: number;
  namespace: string;
  cycleMs: number;
  nextDueMs: number | null;
  secondsToNextDue: number | null;
}

export interface LiveHealth {
  tatum: TatumStatus;
  memwal: { ok: boolean; status: string; ms: number; relayer: string; namespace: string; agentId: string | null; pending: number };
  payments: { executor: string };
}

export interface LiveTx {
  digest: string;
  source: string;
  label: string | null;
  status: string;
  success: boolean | null;
  checkpoint: string | null;
  timestampMs: number | null;
  events: { type: string; sender: string; json: Record<string, unknown> | null }[];
  gasMist: string | null;
  error: string | null;
  explorerUrl: string;
}

export interface LiveRecall {
  requestId: string;
  query: string;
  ms: number;
  results: RecalledMemory[];
  at: number;
  request: LiveRequest | null;
}
