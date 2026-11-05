export type View =
  | "overview"
  | "obligations"
  | "agent"
  | "memory"
  | "learning"
  | "activity"
  | "settings";
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
};
export type MemoryKind =
  | "Decision"
  | "Rule learned"
  | "Obligation outcome"
  | "Reserve updated"
  | "Rule revoked"
  | "Session summary";
export type Memory = {
  id: string;
  kind: MemoryKind;
  text: string;
  timestamp: string;
  session: number;
  merchant?: string;
  usedBy: string[];
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
};
export type Activity = {
  id: string;
  kind:
    | "Deposit"
    | "Reserve funds"
    | "Agent payment"
    | "Pay obligation"
    | "Update reserve"
    | "Withdraw";
  amount: number;
  description: string;
  timestamp: string;
  session: number;
  requestId?: string;
  obligationId?: string;
  memoryId?: string;
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
