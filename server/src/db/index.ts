import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { env } from "../lib/env.js";
import * as schema from "./schema.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const DDL = `
CREATE TABLE IF NOT EXISTS sessions (n INTEGER PRIMARY KEY, started_at INTEGER NOT NULL, ended_at INTEGER,
  summary_memory_id TEXT, rules_loaded INTEGER, rules_load_ms INTEGER);
CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, session INTEGER NOT NULL, merchant TEXT NOT NULL,
  item TEXT NOT NULL, category TEXT NOT NULL, amount TEXT NOT NULL, task_context TEXT, action TEXT NOT NULL,
  code TEXT NOT NULL, status TEXT NOT NULL, reasons TEXT NOT NULL, cuts_reserve_by TEXT NOT NULL,
  allow_disabled INTEGER NOT NULL, matched_rule_ids TEXT NOT NULL, simulation TEXT NOT NULL,
  recall_results TEXT, recall_query TEXT, recall_ms INTEGER, recall_error TEXT, payment_status TEXT NOT NULL,
  payment_digests TEXT, decided_at INTEGER, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS decisions (id INTEGER PRIMARY KEY AUTOINCREMENT, request_id TEXT NOT NULL,
  kind TEXT NOT NULL, rule_id TEXT, memory_id TEXT, at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS rules_cache (id TEXT PRIMARY KEY, source_memory_id TEXT, source_blob_id TEXT,
  merchant TEXT NOT NULL, category TEXT NOT NULL, max_amount TEXT NOT NULL, action TEXT NOT NULL,
  expires_ms INTEGER NOT NULL, active INTEGER NOT NULL, sentence TEXT NOT NULL, times_used INTEGER NOT NULL,
  last_used_at INTEGER, origin TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY, type TEXT NOT NULL, text TEXT NOT NULL,
  payload TEXT NOT NULL, session INTEGER NOT NULL, job_id TEXT, status TEXT NOT NULL, blob_id TEXT,
  namespace TEXT NOT NULL, error TEXT, used_in_decisions TEXT NOT NULL, created_at INTEGER NOT NULL, stored_at INTEGER);
CREATE TABLE IF NOT EXISTS suggestions (id TEXT PRIMARY KEY, obligation_id INTEGER NOT NULL,
  obligation_name TEXT NOT NULL, current_target TEXT NOT NULL, suggested_target TEXT NOT NULL, reason TEXT NOT NULL,
  source_memory_id TEXT, source_digest TEXT, status TEXT NOT NULL, digest TEXT, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS tx_log (digest TEXT PRIMARY KEY, source TEXT NOT NULL, label TEXT, status TEXT NOT NULL,
  success INTEGER, checkpoint TEXT, timestamp_ms INTEGER, events TEXT, gas_mist TEXT, error TEXT,
  request_id TEXT, memory_id TEXT, recorded_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

export type Db = BetterSQLite3Database<typeof schema>;

/** file:./server/data/sisih.db (relative to the repo root) or :memory: */
export function databasePath(url = env("DATABASE_URL") ?? "file:./server/data/sisih.db"): string {
  const p = url.replace(/^file:/, "");
  if (p === ":memory:") return p;
  return isAbsolute(p) ? p : resolve(REPO_ROOT, p);
}

export function openDb(path = databasePath()): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(DDL);
  return drizzle(sqlite, { schema });
}

let shared: Db | undefined;
export function db(): Db {
  shared ??= openDb();
  return shared;
}

export { schema };
