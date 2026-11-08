/**
 * Postgres access. DATABASE_URL = postgres://... (Supabase, transaction pooler) in production;
 * anything else (default) uses embedded PGlite under server/data/pglite for local dev, or
 * ":memory:" for tests. Tables are created on first use (CREATE TABLE IF NOT EXISTS).
 * Call `await initDb()` once before queries (the API middleware and scripts do).
 */
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env, suiNetwork } from "../lib/env";
import * as schema from "./schema";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const DDL = [
  `CREATE TABLE IF NOT EXISTS sessions (n INTEGER PRIMARY KEY, started_at BIGINT NOT NULL, ended_at BIGINT,
    summary_memory_id TEXT, rules_loaded INTEGER, rules_load_ms INTEGER)`,
  `CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, session INTEGER NOT NULL, merchant TEXT NOT NULL,
    item TEXT NOT NULL, category TEXT NOT NULL, amount TEXT NOT NULL, task_context TEXT, action TEXT NOT NULL,
    code TEXT NOT NULL, status TEXT NOT NULL, reasons TEXT NOT NULL, cuts_reserve_by TEXT NOT NULL,
    allow_disabled BOOLEAN NOT NULL, matched_rule_ids TEXT NOT NULL, simulation TEXT NOT NULL,
    recall_results TEXT, recall_query TEXT, recall_ms INTEGER, recall_error TEXT, invoice TEXT,
    payment_status TEXT NOT NULL, payment_digests TEXT, decided_at BIGINT, created_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS decisions (id BIGSERIAL PRIMARY KEY, request_id TEXT NOT NULL,
    kind TEXT NOT NULL, rule_id TEXT, memory_id TEXT, at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS rules_cache (id TEXT PRIMARY KEY, source_memory_id TEXT, source_blob_id TEXT,
    merchant TEXT NOT NULL, category TEXT NOT NULL, max_amount TEXT NOT NULL, action TEXT NOT NULL,
    expires_ms BIGINT NOT NULL, active BOOLEAN NOT NULL, sentence TEXT NOT NULL, times_used INTEGER NOT NULL,
    last_used_at BIGINT, origin TEXT NOT NULL, created_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY, type TEXT NOT NULL, text TEXT NOT NULL,
    payload TEXT NOT NULL, session INTEGER NOT NULL, job_id TEXT, status TEXT NOT NULL, blob_id TEXT,
    namespace TEXT NOT NULL, error TEXT, used_in_decisions TEXT NOT NULL, created_at BIGINT NOT NULL, stored_at BIGINT)`,
  `CREATE TABLE IF NOT EXISTS suggestions (id TEXT PRIMARY KEY, obligation_id INTEGER NOT NULL,
    obligation_name TEXT NOT NULL, current_target TEXT NOT NULL, suggested_target TEXT NOT NULL, reason TEXT NOT NULL,
    source_memory_id TEXT, source_digest TEXT, status TEXT NOT NULL, digest TEXT, created_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS tx_log (digest TEXT PRIMARY KEY, source TEXT NOT NULL, label TEXT, status TEXT NOT NULL,
    success BOOLEAN, checkpoint TEXT, timestamp_ms BIGINT, events TEXT, gas_mist TEXT, error TEXT,
    request_id TEXT, memory_id TEXT, recorded_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS events (id BIGSERIAL PRIMARY KEY, type TEXT NOT NULL, at BIGINT NOT NULL, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS leases (key TEXT PRIMARY KEY, holder TEXT NOT NULL, until BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, window_start BIGINT NOT NULL, hits INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS execution_budgets (key TEXT PRIMARY KEY, authorized BIGINT NOT NULL,
    reserved BIGINT NOT NULL, spent BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS execution_operations (id TEXT PRIMARY KEY, budget_key TEXT NOT NULL,
    maximum BIGINT NOT NULL, actual BIGINT, status TEXT NOT NULL, digest TEXT,
    created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS events_at ON events (at)`,
];

type PgDb = ReturnType<typeof drizzlePg<typeof schema>>;
export type Db = PgDb;

let instance: Db | undefined;
let ready: Promise<void> | undefined;
let exec: ((sql: string) => Promise<unknown>) | undefined;

// Hosted: DATABASE_URL, or POSTGRES_URL as set by the Vercel x Supabase integration (transaction
// pooler, 6543). Not the session pooler (5432): it caps clients at 15, and suspended serverless
// instances keep theirs open. Every query must finish inside the request or background() (after()).
const databaseUrl = () => {
  const url = env("DATABASE_URL") ?? env("POSTGRES_URL");
  if (url) return url;
  // Mainnet state never falls back to the Testnet demo's local database.
  if (suiNetwork() === "mainnet") throw new Error("DATABASE_URL must be set explicitly for Mainnet (a database separate from the Testnet demo).");
  return "pglite:./server/data/pglite";
};
const isPostgresUrl = (url: string) => /^postgres(ql)?:\/\//.test(url);

function createPostgres(url: string): Db {
  // node-postgres, not postgres-js: with prepare: false postgres-js sends every parameterized query
  // in two round trips (Parse/Describe/Flush, then Bind/Execute/Sync). Through Supabase's
  // transaction pooler on Vercel, backends got stuck between the two ("active / ClientRead") while
  // holding locks, and the whole API hung (2026-11-06). pg sends an unnamed statement in one
  // round trip and never prepares named statements unless asked, which the pooler supports.
  const u = new URL(url);
  u.searchParams.delete("supa"); // the integration's informational param
  // sslmode=require with libpq semantics: encrypted, as the Supabase connection string intends.
  if (u.searchParams.get("sslmode") === "require") u.searchParams.set("uselibpqcompat", "true");
  const pool = new Pool({ connectionString: u.toString(), max: 3, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 15_000 });
  pool.on("error", (err) => console.error("postgres pool:", err.message)); // idle client dropped
  exec = (text) => pool.query(text);
  return drizzlePg(pool, { schema });
}

/** Embedded Postgres for local dev and tests. Loaded lazily so hosted bundles never include it. */
async function createPglite(url: string): Promise<Db> {
  const [{ PGlite }, { drizzle: drizzlePglite }] = await Promise.all([import("@electric-sql/pglite"), import("drizzle-orm/pglite")]);
  const path = url.replace(/^(pglite|file):/, "");
  let pg: InstanceType<typeof PGlite>;
  if (path === ":memory:" || path === "") pg = new PGlite();
  else {
    const dir = isAbsolute(path) ? path : resolve(REPO_ROOT, path);
    mkdirSync(dirname(dir), { recursive: true });
    pg = new PGlite(dir);
  }
  exec = (sql) => pg.exec(sql);
  // drizzle's pglite and postgres-js drivers share the pg-core query API.
  return drizzlePglite(pg, { schema }) as unknown as Db;
}

export function db(): Db {
  if (!instance) {
    const url = databaseUrl();
    if (!isPostgresUrl(url)) throw new Error("Database not ready: await initDb() first (PGlite opens asynchronously).");
    instance = createPostgres(url);
  }
  return instance;
}

const SCHEMA_OBJECTS = ["sessions", "requests", "decisions", "rules_cache", "memories", "suggestions", "tx_log", "events", "kv", "leases", "rate_limits", "execution_budgets", "execution_operations", "events_at"];

export async function schemaExists(): Promise<boolean> {
  const res = (await instance!.execute(
    sql`select count(*)::int as n from pg_class c join pg_namespace s on s.oid = c.relnamespace
        where s.nspname = current_schema() and c.relname in ${SCHEMA_OBJECTS}`,
  )) as unknown as { n: number }[] | { rows: { n: number }[] };
  const rows = Array.isArray(res) ? res : res.rows; // node-postgres and PGlite both return { rows }
  return Number(rows[0]?.n) === SCHEMA_OBJECTS.length;
}

/** Open the database and create tables once per process. Safe to call many times. */
export function initDb(): Promise<void> {
  ready ??= (async () => {
    const url = databaseUrl();
    if (!instance) instance = isPostgresUrl(url) ? createPostgres(url) : await createPglite(url);
    // Skip DDL when the schema exists: CREATE INDEX IF NOT EXISTS still takes a ShareLock on
    // events, so on every serverless cold start it queued behind any open writer and then blocked
    // every later events query until the statement timeout (2026-11-06). Catalog reads take no locks.
    if (await schemaExists()) return;
    for (const stmt of DDL) await exec!(stmt);
  })();
  return ready;
}

export { schema };
