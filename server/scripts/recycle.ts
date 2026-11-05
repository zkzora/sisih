/**
 * Demo plumbing: sweep USDC from demo payees, demo merchants and agent leftovers back to the
 * operator. Every transfer is logged with its digest (verified through Tatum).
 *   pnpm tsx scripts/recycle.ts            # includes the agent
 *   pnpm tsx scripts/recycle.ts --no-agent
 */
import { formatUsdc } from "../src/lib/env";
import { address } from "../src/lib/wallets";
import { recycle, usdcBalance } from "../src/demo/recycle";

const before = await usdcBalance(address("operator"));
const records = await recycle({ includeAgent: !process.argv.includes("--no-agent") });
const after = await usdcBalance(address("operator"));
console.log(`operator USDC ${formatUsdc(before)} -> ${formatUsdc(after)} (${records.filter((r) => r.digest).length} transfers, ${records.filter((r) => r.error).length} failed)`);
process.exit(records.some((r) => r.error) ? 1 : 0);
