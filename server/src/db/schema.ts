/**
 * App state in Postgres (Supabase in production, embedded PGlite for local dev and tests).
 * Amounts are base-unit strings (bigint-safe); millisecond timestamps are bigint (mode number).
 * Chain state is never stored as truth here: the vault is read through Tatum; tx_log keeps the
 * digests we know about plus what Tatum returned for them.
 */
import { bigint, bigserial, boolean, integer, pgTable, text } from "drizzle-orm/pg-core";

const ms = (name: string) => bigint(name, { mode: "number" });

export const sessions = pgTable("sessions", {
  n: integer("n").primaryKey(),
  startedAt: ms("started_at").notNull(),
  endedAt: ms("ended_at"),
  summaryMemoryId: text("summary_memory_id"),
  rulesLoaded: integer("rules_loaded"),
  rulesLoadMs: integer("rules_load_ms"),
});

export const requests = pgTable("requests", {
  id: text("id").primaryKey(),
  session: integer("session").notNull(),
  merchant: text("merchant").notNull(),
  item: text("item").notNull(),
  category: text("category").notNull(),
  amount: text("amount").notNull(),
  taskContext: text("task_context"),
  /** Engine verdict: auto_allow | auto_deny | hold */
  action: text("action").notNull(),
  code: text("code").notNull(),
  /** auto_allowed | auto_denied | held | approved | denied */
  status: text("status").notNull(),
  reasons: text("reasons").notNull(), // JSON string[]
  cutsReserveBy: text("cuts_reserve_by").notNull(),
  allowDisabled: boolean("allow_disabled").notNull(),
  matchedRuleIds: text("matched_rule_ids").notNull(), // JSON string[]
  simulation: text("simulation").notNull(), // JSON
  recallResults: text("recall_results"), // JSON RecalledMemory[] once recall returns
  recallQuery: text("recall_query"),
  recallMs: integer("recall_ms"),
  recallError: text("recall_error"),
  /** The merchant's x402 invoice (JSON), kept so a held request can be paid later. */
  invoice: text("invoice"),
  /** none | stub | pending | paid | failed */
  paymentStatus: text("payment_status").notNull(),
  paymentDigests: text("payment_digests"), // JSON
  decidedAt: ms("decided_at"),
  createdAt: ms("created_at").notNull(),
});

export const decisions = pgTable("decisions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  requestId: text("request_id").notNull(),
  /** auto_allow | auto_deny | approve_once | approve_and_remember | deny | deny_and_remember */
  kind: text("kind").notNull(),
  ruleId: text("rule_id"),
  memoryId: text("memory_id"),
  at: ms("at").notNull(),
});

export const rulesCache = pgTable("rules_cache", {
  id: text("id").primaryKey(),
  sourceMemoryId: text("source_memory_id"),
  sourceBlobId: text("source_blob_id"),
  merchant: text("merchant").notNull(),
  category: text("category").notNull(),
  maxAmount: text("max_amount").notNull(),
  action: text("action").notNull(),
  expiresMs: ms("expires_ms").notNull(),
  active: boolean("active").notNull(),
  sentence: text("sentence").notNull(),
  timesUsed: integer("times_used").notNull(),
  lastUsedAt: ms("last_used_at"),
  /** local = created this session; walrus = rebuilt from Walrus recall at session start */
  origin: text("origin").notNull(),
  createdAt: ms("created_at").notNull(),
});

export const memories = pgTable("memories", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  text: text("text").notNull(),
  payload: text("payload").notNull(), // JSON
  session: integer("session").notNull(),
  jobId: text("job_id"),
  /** writing | stored | failed */
  status: text("status").notNull(),
  blobId: text("blob_id"),
  namespace: text("namespace").notNull(),
  error: text("error"),
  usedInDecisions: text("used_in_decisions").notNull(), // JSON string[] (request ids)
  createdAt: ms("created_at").notNull(),
  storedAt: ms("stored_at"),
});

export const suggestions = pgTable("suggestions", {
  id: text("id").primaryKey(),
  obligationId: integer("obligation_id").notNull(),
  obligationName: text("obligation_name").notNull(),
  currentTarget: text("current_target").notNull(),
  suggestedTarget: text("suggested_target").notNull(),
  reason: text("reason").notNull(),
  sourceMemoryId: text("source_memory_id"),
  sourceDigest: text("source_digest"),
  /** open | accepted | rejected */
  status: text("status").notNull(),
  digest: text("digest"),
  createdAt: ms("created_at").notNull(),
});

export const txLog = pgTable("tx_log", {
  digest: text("digest").primaryKey(),
  /** our = signed by the server; owner = posted by the browser/scripts; import = backfill */
  source: text("source").notNull(),
  label: text("label"),
  /** pending | verified | failed (executed but aborted) | error (could not read) */
  status: text("status").notNull(),
  success: boolean("success"),
  checkpoint: text("checkpoint"),
  timestampMs: ms("timestamp_ms"),
  events: text("events"), // JSON TxEvent[]
  gasMist: text("gas_mist"),
  error: text("error"),
  requestId: text("request_id"),
  memoryId: text("memory_id"),
  recordedAt: ms("recorded_at").notNull(),
});

/** The live event feed (replaces in-process SSE so every serverless instance shares it). */
export const events = pgTable("events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  type: text("type").notNull(),
  at: ms("at").notNull(),
  data: text("data").notNull(), // JSON
});

export const kv = pgTable("kv", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/** Short leases shared by every instance: the demo-run lock, the action mutex, memory resubmits. */
export const leases = pgTable("leases", {
  key: text("key").primaryKey(),
  holder: text("holder").notNull(),
  until: ms("until").notNull(),
});

/** Fixed-window rate limits shared by every instance (key = limit name + client IP). */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: ms("window_start").notNull(),
  hits: integer("hits").notNull(),
});

/** Mainnet proof budgets. Amounts are integer base units (MIST or USDC micro-units). */
export const executionBudgets = pgTable("execution_budgets", {
  key: text("key").primaryKey(),
  authorized: bigint("authorized", { mode: "bigint" }).notNull(),
  reserved: bigint("reserved", { mode: "bigint" }).notNull(),
  spent: bigint("spent", { mode: "bigint" }).notNull(),
});

/** Durable idempotency and unknown-outcome record for each budgeted external operation. */
export const executionOperations = pgTable("execution_operations", {
  id: text("id").primaryKey(),
  budgetKey: text("budget_key").notNull(),
  maximum: bigint("maximum", { mode: "bigint" }).notNull(),
  actual: bigint("actual", { mode: "bigint" }),
  /** reserved | spent | released | unknown */
  status: text("status").notNull(),
  digest: text("digest"),
  createdAt: ms("created_at").notNull(),
  updatedAt: ms("updated_at").notNull(),
});
