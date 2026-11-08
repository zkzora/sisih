/** Publish completed Mainnet state into an isolated hosted schema. No Sui signing/broadcast. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import { env, REPO_ROOT, suiNetwork } from "../../src/lib/env";
import { loadMainnetManifest } from "../../src/mainnet/manifest";
const args = process.argv.slice(2);
if (args.includes("--help")) { console.log("publish-runtime-state.ts [--execute]. Migrates the completed isolated PGlite proof into a new hosted schema and prepares a signer-free server env. No blockchain writes."); process.exit(0); }
if (suiNetwork() !== "mainnet") throw new Error("Select .env.mainnet.server");
const m = loadMainnetManifest("docs/mainnet/MANIFEST.json");
const schemaName = "sisih_mainnet_proof_20261107";
const origin = "https://sisih-azure.vercel.app";
if (!args.includes("--execute")) { console.log(`PLAN: copy completed proof to isolated hosted schema ${schemaName}, publish read-only at ${origin}. No blockchain signing or broadcast.`); process.exit(0); }
const previous = parse(readFileSync(resolve(REPO_ROOT, ".env.vercel.production.previous")));
const pgUrl = previous.POSTGRES_URL ?? previous.DATABASE_URL;
if (!pgUrl || !/^postgres(?:ql)?:/.test(pgUrl)) throw new Error("Hosted Postgres credential unavailable");
const url = new URL(pgUrl); url.searchParams.delete("supa");
if (url.searchParams.get("sslmode") === "require") url.searchParams.set("uselibpqcompat", "true");
const sourcePath = env("DATABASE_URL");
if (sourcePath !== "pglite:./server/data/mainnet-proof-20261107") throw new Error("Unexpected source database");
const source = new PGlite(resolve(REPO_ROOT, sourcePath.replace(/^pglite:/, "")));
// The exact chain state is independently checked separately; this migration also checks all
// consequential runtime budgets rather than resetting them to a fresh authorization.
const budgets = (await source.query<any>("SELECT * FROM execution_budgets")).rows;
if (!budgets.some(b => b.key === `${m.plan_id}:usdc` && String(b.spent) === "1600000" && String(b.reserved) === "0")) throw new Error("Proof outflow allocation is not fully consumed/reconciled");
const unsettled = (await source.query<any>("SELECT count(*)::int AS n FROM execution_operations WHERE status IN ('unknown','reserved')")).rows[0]?.n;
if (unsettled) throw new Error("Unresolved transaction accounting");
const sourceManifest = (await source.query<any>("SELECT value FROM kv WHERE key=$1", [`mainnet_manifest:${m.plan_id}`])).rows[0]?.value;
if (sourceManifest !== JSON.stringify(m)) throw new Error("Source manifest differs from the reviewed proof");
process.env.DATABASE_URL = pgUrl;
process.env.DATABASE_SCHEMA = schemaName;
const { initDb } = await import("../../src/db/index");
await initDb();
const pool = new Pool({ connectionString: url.toString(), max: 1 });
const client = await pool.connect();
const tables = ["sessions", "requests", "decisions", "rules_cache", "memories", "suggestions", "tx_log", "events", "kv", "leases", "rate_limits", "execution_budgets", "execution_operations"];
const counts: Record<string, number> = {};
const binding = { plan_id: m.plan_id, origin, network: "sui:mainnet", read_only: true, authorization: "Owner requested removal of the public Testnet runtime and Mainnet-only publication on 8 November 2026", source: "completed isolated proof; no new spending authorization" };
try {
  await client.query("BEGIN");
  const prior = await client.query(`SELECT value FROM "${schemaName}".kv WHERE key=$1`, [`mainnet_public_deployment:${m.plan_id}`]);
  if (prior.rows.length) {
    if (prior.rows[0].value !== JSON.stringify(binding)) throw new Error("Public deployment binding differs");
    console.log("Existing identical publication binding found; no state was recopied.");
  } else {
    for (const table of tables) {
      const existing = await client.query(`SELECT count(*)::int AS n FROM "${schemaName}"."${table}"`);
      if (existing.rows[0].n) throw new Error(`Target ${table} is not empty; refusing overwrite`);
      const rows = (await source.query<Record<string, unknown>>(`SELECT * FROM "${table}"`)).rows;
      counts[table] = rows.length;
      for (const row of rows) {
        const columns = Object.keys(row);
        await client.query(`INSERT INTO "${schemaName}"."${table}" (${columns.map(c => `"${c}"`).join(",")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(",")})`, Object.values(row));
      }
    }
    await client.query(`INSERT INTO "${schemaName}".kv (key,value) VALUES ($1,$2)`, [`mainnet_public_deployment:${m.plan_id}`, JSON.stringify(binding)]);
    for (const table of ["events", "decisions"]) await client.query(`SELECT setval(pg_get_serial_sequence('"${schemaName}"."${table}"','id'), greatest(coalesce((SELECT max(id) FROM "${schemaName}"."${table}"),0),1), coalesce((SELECT max(id)>0 FROM "${schemaName}"."${table}"),false))`);
  }
  const verified = JSON.parse(readFileSync(resolve(REPO_ROOT, "docs/verification/mainnet-pre-submit-recheck.json"), "utf8"));
  if (!verified.passed || verified.network !== "mainnet") throw new Error("Independent Mainnet recheck must pass before publication");
  for (const receipt of verified.observations) {
    await client.query(`INSERT INTO "${schemaName}".tx_log (digest,source,label,status,success,checkpoint,timestamp_ms,events,gas_mist,recorded_at) VALUES ($1,'our',$2,'verified',true,$3,$4,$5,$6,$7) ON CONFLICT (digest) DO NOTHING`, [receipt.actual.digest, receipt.id, String(receipt.checkpoint), receipt.timestamp_ms, JSON.stringify(receipt.actual.events), receipt.gas.net_mist, Date.now()]);
  }
  for (const table of tables) counts[table] = (await client.query(`SELECT count(*)::int AS n FROM "${schemaName}"."${table}"`)).rows[0].n;
  await client.query("COMMIT");
} catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); await pool.end(); await source.close(); }
const local = parse(readFileSync(resolve(REPO_ROOT, ".env.mainnet.server")));
const allow = ["SUI_NETWORK", "TATUM_API_KEY_MAINNET", "USDC_COIN_TYPE", "SISIH_PACKAGE_ID", "VAULT_ID", "OPERATOR_CAP_ID", "OWNER_ADDRESS", "MEMWAL_KEY", "MEMWAL_ACCOUNT_ID", "MEMWAL_NAMESPACE_PREFIX", "MAINNET_PLAN_ID", "MAINNET_OPERATOR_TX_GAS_BUDGET_MIST", "MERCHANT_CHAINSCOPE_ADDRESS", "SISIH_AGENT_TOKEN", "SISIH_OWNER_MCP_TOKEN"];
const values: Record<string, string> = Object.fromEntries(allow.filter(key => local[key]).map(key => [key, local[key]!]));
for (const role of ["owner", "operator", "agent", "facilitator"] as const) values[`${role.toUpperCase()}_ADDRESS`] = m.roles[role].address;
Object.assign(values, { DATABASE_URL: pgUrl, DATABASE_SCHEMA: schemaName, MAINNET_READ_ONLY: "true", PUBLIC_BASE_URL: origin, WEB_ORIGIN: origin, NEXT_PUBLIC_SUI_NETWORK: "mainnet", NEXT_PUBLIC_DEV_STATES: "0" });
writeFileSync(resolve(REPO_ROOT, ".env.mainnet.public"), Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join("\n") + "\n", { mode: 0o600 });
writeFileSync(resolve(REPO_ROOT, "docs/mainnet/PUBLIC_DEPLOYMENT.json"), JSON.stringify({ generated_at: new Date().toISOString(), ...binding, database_isolation: { strategy: "dedicated PostgreSQL schema with schema-qualified queries", schema: schemaName, server: "existing managed Postgres instance; no Testnet table copied or overwritten" }, migrated_counts: counts, private_signing_keys_uploaded: false, environment_names: Object.keys(values), blockchain_writes: false }, null, 2) + "\n");
console.log(`Copied completed Mainnet proof into ${schemaName}. Signer-free env prepared locally; no secrets printed. No chain transaction executed.`);
process.exit(0);
