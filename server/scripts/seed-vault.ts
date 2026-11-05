/**
 * Seed the vault with the SPEC starting state (OWNER signs; scripts only). See src/demo/owner.ts.
 * Usually you want POST /api/demo/reset instead, which also empties the vault and recycles funds.
 */
import { seedVault } from "../src/demo/owner.js";
import { formatUsdc } from "../src/lib/env.js";

const res = await seedVault();
if (!res.ok) throw new Error(`seed failed at ${res.stage}: ${res.reason}`);
console.log(`seed ${res.digest} verified=${res.tx.status} checkpoint=${res.tx.checkpoint} events=${res.tx.events.length} (read back through Tatum)`);
const deposited = res.tx.events.find((e) => e.type.endsWith("::vault::Deposited"));
if (deposited?.json) console.log(`deposited ${formatUsdc(BigInt(String(deposited.json.amount)))} USDC`);
process.exit(0);
