/**
 * Verify recorded transaction digests through Tatum. READ ONLY.
 *
 *   pnpm --filter @sisih/server exec tsx scripts/mainnet/verify-evidence.ts <network> <digest>[:label] ...
 *   pnpm --filter @sisih/server exec tsx scripts/mainnet/verify-evidence.ts testnet --file docs/evidence/final-run-sisih-hosted-9/digests.txt
 *
 * For each digest: success or failure, checkpoint, time and gas, as the chain reports them. An
 * expected failure (for example EExceedsFree) is printed as a failure, never as a success.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "../../src/lib/env";
import { verifyTransaction } from "../../src/lib/tatum";

const [network, ...rest] = process.argv.slice(2);
if (network !== "testnet" && network !== "mainnet") {
  console.error("usage: verify-evidence.ts <testnet|mainnet> <digest[:label]>... | --file <path>");
  process.exit(2);
}
const items =
  rest[0] === "--file"
    ? readFileSync(resolve(REPO_ROOT, rest[1]!), "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
    : rest;
let bad = 0;
for (const it of items) {
  const [digest, label = ""] = it.split(/[:\s]+(.*)/s);
  try {
    const v = await verifyTransaction(digest!, { network, tries: 3 });
    console.log(`${v.success ? "success" : "FAILED "} ${digest} checkpoint ${v.checkpoint} ${v.timestampMs ? new Date(v.timestampMs).toISOString() : "-"} gas ${(Number(v.gasMist) / 1e9).toFixed(6)} SUI ${label}${v.success ? "" : ` · ${(v.error ?? "").slice(0, 120)}`}`);
  } catch (err) {
    bad++;
    console.log(`NOTFOUND ${digest} ${label} · ${(err as Error).message.slice(0, 80)}`);
  }
}
process.exit(bad ? 1 : 0);
