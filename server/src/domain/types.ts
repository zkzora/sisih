/** Shared server types. USDC amounts are bigint base units (6 decimals) everywhere. */

export type Category = "data" | "search" | "inference" | "research";

export interface ObligationState {
  id: number;
  name: string;
  payee: string;
  target: bigint;
  reserve: bigint;
  kind: "fixed" | "usage";
  priority: "must" | "important";
  cycleMs: number;
  nextDueMs: number;
  cadenceLabel: string;
  status: "funded" | "underfunded";
}

export interface AgentPolicyState {
  agent: string;
  maxPerRequest: bigint;
  maxPerDay: bigint;
  spentInWindow: bigint;
  windowStartMs: number;
  expiresMs: number;
  paused: boolean;
}

export interface VaultState {
  vaultId: string;
  version: number;
  owner: string;
  free: bigint;
  reserved: bigint;
  total: bigint;
  obligations: ObligationState[];
  /** null = no permission (never set, or revoked). */
  policy: AgentPolicyState | null;
  /** When this snapshot was read through Tatum. */
  readAtMs: number;
}

export interface Rule {
  id: string;
  merchant: string;
  category: Category;
  maxAmount: bigint;
  action: "allow" | "deny";
  expiresMs: number;
  active: boolean;
  sentence: string;
  sourceMemoryId: string | null;
}

export interface PaymentRequestInput {
  merchant: string;
  item: string;
  category: Category;
  amount: bigint;
  taskContext?: string;
}

export interface RecalledMemory {
  memoryId: string | null;
  blobId: string;
  text: string;
  distance: number;
}
