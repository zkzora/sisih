/**
 * Read the Vault object through Tatum and print total / committed / free and each obligation.
 * Phase 2 lifts the parsing into server/src/chain/vault.ts.
 */
import { vaultId } from "../src/chain/sisih";
import { formatUsdc, suiNetwork } from "../src/lib/env";
import { suiClient } from "../src/lib/tatum";

type Json = Record<string, unknown>;
const num = (v: unknown): bigint => {
  if (typeof v === "string" || typeof v === "number" || typeof v === "bigint") return BigInt(v);
  if (v && typeof v === "object" && "value" in v) return num((v as Json).value); // Balance { value }
  throw new Error(`not a number: ${JSON.stringify(v)}`);
};

const { object } = await suiClient().getObject({ objectId: vaultId(), include: { json: true } });
const v = object.json as Json;
if (process.argv.includes("--raw")) console.log(JSON.stringify(v, null, 2));

const free = num(v.free);
const contents = ((v.obligations as Json)?.contents ?? []) as Array<{ key: unknown; value: Json }>;
const obligations = contents.map(({ key, value }) => ({
  id: num(key),
  name: String(value.name),
  target: num(value.target),
  reserve: num(value.reserve),
  kind: Number(value.kind) === 1 ? "usage" : "fixed",
  priority: Number(value.priority) === 0 ? "must" : "important",
  cadence: String(value.cadence_label),
  nextDueMs: Number(num(value.next_due_ms)),
}));
const committed = obligations.reduce((s, o) => s + o.reserve, 0n);

console.log(`vault ${vaultId()} on ${suiNetwork()} (read through Tatum), version ${String(v.version)}`);
console.log(`total ${formatUsdc(free + committed)}  committed ${formatUsdc(committed)}  free ${formatUsdc(free)} USDC`);
for (const o of obligations) {
  const status = o.reserve >= o.target ? "funded" : "underfunded";
  console.log(
    `  #${o.id} ${o.name.padEnd(15)} ${formatUsdc(o.reserve).padStart(6)} / ${formatUsdc(o.target).padStart(6)}  ` +
      `${o.kind}/${o.priority}/${o.cadence}  ${status}  due ${new Date(o.nextDueMs).toISOString()}`,
  );
}
const policy = (v.agent_policy as Json | null) ?? null;
const p = policy && "vec" in policy ? ((policy.vec as Json[])[0] ?? null) : policy;
console.log(
  p
    ? `agent ${String(p.agent)} per request ${formatUsdc(num(p.max_per_request))} per day ${formatUsdc(num(p.max_per_day))} ` +
        `spent ${formatUsdc(num(p.spent_in_window))} paused=${String(p.paused)} expires ${new Date(Number(num(p.expires_ms))).toISOString()}`
    : "agent: no policy",
);
process.exit(0);
