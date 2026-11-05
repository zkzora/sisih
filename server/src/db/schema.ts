/**
 * App state in SQLite. Amounts are stored as base-unit strings (bigint-safe).
 * Chain state is never stored as truth here: the vault is read through Tatum; tx_log keeps
 * the digests we know about plus what Tatum returned for them.
 */
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
  n: integer("n").primaryKey(),
  startedAt: integer("started_at").notNull(),
  endedAt: integer("ended_at"),
  summaryMemoryId: text("summary_memory_id"),
  rulesLoaded: integer("rules_loaded"),
  rulesLoadMs: integer("rules_load_ms"),
});

export const requests = sqliteTable("requests", {
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
  allowDisabled: integer("allow_disabled", { mode: "boolean" }).notNull(),
  matchedRuleIds: text("matched_rule_ids").notNull(), // JSON string[]
  simulation: text("simulation").notNull(), // JSON
  recallResults: text("recall_results"), // JSON RecalledMemory[] once recall returns
  recallQuery: text("recall_query"),
  recallMs: integer("recall_ms"),
  recallError: text("recall_error"),
  /** none | stub | pending | paid | failed */
  paymentStatus: text("payment_status").notNull(),
  paymentDigests: text("payment_digests"), // JSON
  decidedAt: integer("decided_at"),
  createdAt: integer("created_at").notNull(),
});

export const decisions = sqliteTable("decisions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestId: text("request_id").notNull(),
  /** auto_allow | auto_deny | approve_once | approve_and_remember | deny | deny_and_remember */
  kind: text("kind").notNull(),
  ruleId: text("rule_id"),
  memoryId: text("memory_id"),
  at: integer("at").notNull(),
});

export const rulesCache = sqliteTable("rules_cache", {
  id: text("id").primaryKey(),
  sourceMemoryId: text("source_memory_id"),
  sourceBlobId: text("source_blob_id"),
  merchant: text("merchant").notNull(),
  category: text("category").notNull(),
  maxAmount: text("max_amount").notNull(),
  action: text("action").notNull(),
  expiresMs: integer("expires_ms").notNull(),
  active: integer("active", { mode: "boolean" }).notNull(),
  sentence: text("sentence").notNull(),
  timesUsed: integer("times_used").notNull(),
  lastUsedAt: integer("last_used_at"),
  /** local = created this session; walrus = rebuilt from Walrus recall at session start */
  origin: text("origin").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const memories = sqliteTable("memories", {
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
  createdAt: integer("created_at").notNull(),
  storedAt: integer("stored_at"),
});

export const suggestions = sqliteTable("suggestions", {
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
  createdAt: integer("created_at").notNull(),
});

export const txLog = sqliteTable("tx_log", {
  digest: text("digest").primaryKey(),
  /** our = signed by the server; owner = posted by the browser/scripts; import = backfill */
  source: text("source").notNull(),
  label: text("label"),
  /** pending | verified | failed (executed but aborted) | error (could not read) */
  status: text("status").notNull(),
  success: integer("success", { mode: "boolean" }),
  checkpoint: text("checkpoint"),
  timestampMs: integer("timestamp_ms"),
  events: text("events"), // JSON TxEvent[]
  gasMist: text("gas_mist"),
  error: text("error"),
  requestId: text("request_id"),
  memoryId: text("memory_id"),
  recordedAt: integer("recorded_at").notNull(),
});

export const kv = sqliteTable("kv", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
