export type View =
  | "home"
  | "overview"
  | "obligations"
  | "agent"
  | "memory"
  | "learning"
  | "activity"
  | "settings"
  | "tour"
  | "connect";
import type { LiveClock, LiveHealth, LiveInsights, LivePolicy, LiveRecall, LiveRequest, LiveSession, LiveSuggestion, TatumStatus } from "./live";
export type Category = "Data" | "Search" | "Inference" | "Research";
export type RequestStatus = "held" | "approved" | "rejected" | "paying";
export type Obligation = {
  id: string;
  name: string;
  recipient: string;
  amount: number;
  reserved: number;
  cycle: "Monthly" | "Weekly" | "Once";
  type: "Fixed" | "Usage-based";
  priority: "Essential" | "Important";
  due: string;
  paid: boolean;
  suggestion?: number;
  /** Live fields (server). Ids come only from the API. */
  nextDueMs?: number;
  cycleMs?: number;
  kind?: "fixed" | "usage";
  suggestionId?: string;
  suggestionReason?: string;
};
export type SpendRequest = {
  id: string;
  merchant: string;
  item: string;
  category: Category;
  amount: number;
  status: RequestStatus;
  reason: string;
  timestamp: string;
  session: number;
  day: number;
  automatic: boolean;
  memoryId?: string;
  transactionId?: string;
  blockedAmount: number;
  /** The full server record (reasons, recall, x402 digests). */
  live?: LiveRequest;
};
export type MemoryKind =
  | "Decision"
  | "Rule learned"
  | "Obligation outcome"
  | "Reserve updated"
  | "Rule revoked"
  | "Session summary"
  | "Merchant note";
export type Memory = {
  id: string;
  kind: MemoryKind;
  text: string;
  timestamp: string;
  session: number;
  merchant?: string;
  usedBy: string[];
  /** Live fields: Walrus write status and identifiers. */
  status?: "writing" | "stored" | "failed";
  blobId?: string | null;
  walrusUrl?: string | null;
  createdAtMs?: number;
  namespace?: string;
  error?: string | null;
};
export type Rule = {
  id: string;
  memoryId: string;
  merchant: string;
  category: Category;
  maxAmount: number;
  action: "allow" | "deny";
  active: boolean;
  expires: string;
  /** Live fields */
  sentence?: string;
  origin?: "local" | "walrus";
  timesUsed?: number;
  walrusUrl?: string | null;
};
export type Activity = {
  id: string;
  kind:
    | "Deposit"
    | "Reserve funds"
    | "Agent payment"
    | "Pay obligation"
    | "Update reserve"
    | "Withdraw"
    | "Release to agent"
    | "x402 settle"
    | "Agent permission"
    | "Vault created"
    | "Other";
  amount: number;
  description: string;
  timestamp: string;
  session: number;
  requestId?: string;
  obligationId?: string;
  memoryId?: string;
  /** Live fields: proof through Tatum */
  digest?: string;
  verification?: "verified" | "pending" | "failed" | "error";
  failureReason?: string | null;
  explorerUrl?: string;
  checkpoint?: string | null;
  from?: string;
  to?: string;
};
export type SessionStats = {
  session: number;
  total: number;
  manual: number;
  automatic: number;
  falseHolds: number;
  blocked: number;
  funded: number;
  underfunded: number;
  categorySpend: Record<Category, number>;
};
export type Preferences = {
  defaultAction: "hold" | "allow";
  defaultThreshold: number;
  perRequest: number;
  perDay: number;
  expires: string;
  network: "Testnet" | "Mainnet";
  theme: "light" | "dark";
  demoBanner: boolean;
};
export type DemoState = {
  version: 1;
  balance: number;
  session: number;
  day: number;
  agentStatus: "active" | "paused" | "revoked";
  walletConnected: boolean;
  obligations: Obligation[];
  requests: SpendRequest[];
  memories: Memory[];
  rules: Rule[];
  activities: Activity[];
  sessions: SessionStats[];
  preferences: Preferences;
  cycle: number;
  cycleAdvanced: boolean;
  outcome?: {
    needed: number;
    reserved: number;
    shortfall: number;
    session: number;
  };
  /** Live server context (absent in fixtures). */
  live?: LiveContext;
};
export type LiveContext = {
  network: "testnet" | "mainnet";
  vaultId: string;
  owner: string;
  explorerUrl: string;
  readAtMs: number;
  tatum: TatumStatus;
  memory: { namespace: string; stored: number; writing: number; failed: number };
  policy: LivePolicy | null;
  clock: LiveClock | null;
  health: LiveHealth | null;
  recall: LiveRecall | null;
  insights: LiveInsights | null;
  sessions: LiveSession[];
  suggestions: LiveSuggestion[];
  sseConnected: boolean;
};
export type Action =
  | { type: "deposit"; amount: number }
  | { type: "withdraw"; amount: number }
  | { type: "emergency-withdraw" }
  | { type: "request"; merchant: "DataMart" | "SearchBox" | "ReportLab" }
  | {
      type: "decide";
      requestId: string;
      decision: "approve" | "deny";
      remember?: { maxAmount: number; expires: string };
    }
  | { type: "save-obligation"; obligation: Obligation }
  | { type: "delete-obligation"; id: string }
  | { type: "pay-obligation"; id: string }
  | { type: "accept-reserve"; id: string; amount: number }
  | { type: "dismiss-suggestion"; id: string }
  | { type: "toggle-rule"; id: string }
  | { type: "agent-status"; status: DemoState["agentStatus"] }
  | { type: "wallet"; connected: boolean }
  | { type: "settings"; preferences: Preferences }
  | { type: "advance-cycle" }
  | { type: "new-session" };
export type Outcome = { state: DemoState; message: string; error?: boolean };
