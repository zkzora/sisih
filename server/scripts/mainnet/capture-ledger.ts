/** Read the isolated runtime ledger only after stopping the PGlite server. */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { db, initDb, schema } from "../../src/db/index";
import { REPO_ROOT, suiNetwork } from "../../src/lib/env";
if (process.argv.includes("--help")) { console.log("capture-ledger.ts. Stop the isolated PGlite server first. Reads budget, operation and lease rows; never signs or broadcasts."); process.exit(0); }
if (suiNetwork() !== "mainnet") throw new Error("Select isolated Mainnet configuration");
await initDb();
const budgets = await db().select().from(schema.executionBudgets);
const operations = await db().select().from(schema.executionOperations);
const leases = await db().select().from(schema.leases);
if (budgets.some(row => row.reserved !== 0n) || operations.some(row => row.status === "unknown" || row.status === "reserved")) throw new Error("Unresolved execution accounting exists");
const usdc = budgets.find(row => row.key.endsWith(":usdc"));
if (usdc?.spent !== 1600000n) throw new Error("Expected exactly two approved purchase allocations");
writeFileSync(resolve(REPO_ROOT, "docs/evidence/mainnet-20261108/runtime-ledger.json"), JSON.stringify({ captured_at: new Date().toISOString(), budgets, operations, leases, note: "Runtime owner gas spending is conservatively floored at zero for the net-rebate revoke. Independent receipt accounting retains its negative net charge. Publication/setup gas lives in the separate local journal and verified receipt report." }, (_k, value) => typeof value === "bigint" ? value.toString() : value, 2) + "\n");
console.log("Ledger checked: 1,600,000 USDC base units spent, no unresolved operations or reservations.");
process.exit(0);
