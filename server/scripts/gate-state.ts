/**
 * Phase 2 gate: GET /api/state must equal an independent read of the Vault through Tatum.
 * Compares totals, every obligation (target, reserve, due) and the agent policy.
 */
import { parseVault } from "../src/chain/vault.js";
import { explorerObjectUrl } from "../src/chain/activity.js";
import { vaultId } from "../src/chain/sisih.js";
import { formatUsdc } from "../src/lib/env.js";
import { suiClient } from "../src/lib/tatum.js";

const API = process.env.API_URL ?? "http://127.0.0.1:8787";
const api = (await (await fetch(`${API}/api/state`)).json()) as { vault: Record<string, unknown>; readAtMs: number; verifiedVia: string };
const { object } = await suiClient().getObject({ objectId: vaultId(), include: { json: true } });
const chain = parseVault(object.objectId, object.json as Record<string, unknown>);

const rows: [string, string, string][] = [];
const cmp = (field: string, a: unknown, b: unknown) => rows.push([field, String(a), String(b)]);
const v = api.vault as { free: string; reserved: string; total: string; obligations: Array<Record<string, unknown>>; policy: Record<string, unknown> | null };
cmp("free", v.free, chain.free);
cmp("reserved", v.reserved, chain.reserved);
cmp("total", v.total, chain.total);
for (const o of chain.obligations) {
  const a = v.obligations.find((x) => Number(x.id) === o.id) ?? {};
  cmp(`#${o.id} ${o.name} target`, a.target, o.target);
  cmp(`#${o.id} ${o.name} reserve`, a.reserve, o.reserve);
  cmp(`#${o.id} ${o.name} nextDueMs`, a.nextDueMs, o.nextDueMs);
}
cmp("obligation count", v.obligations.length, chain.obligations.length);
cmp("policy maxPerRequest", v.policy?.maxPerRequest, chain.policy?.maxPerRequest);
cmp("policy maxPerDay", v.policy?.maxPerDay, chain.policy?.maxPerDay);
cmp("policy spentInWindow", v.policy?.spentInWindow, chain.policy?.spentInWindow);
cmp("policy paused", v.policy?.paused, chain.policy?.paused);

let mismatches = 0;
for (const [f, a, b] of rows) {
  const same = a === b;
  if (!same) mismatches++;
  console.log(`${same ? "ok  " : "DIFF"} ${f.padEnd(34)} api=${a.padEnd(16)} chain=${b}`);
}
console.log(`\nAPI (cached, read ${new Date(api.readAtMs).toISOString()} via ${api.verifiedVia}): total ${formatUsdc(BigInt(v.total))} committed ${formatUsdc(BigInt(v.reserved))} free ${formatUsdc(BigInt(v.free))}`);
console.log(`Explorer: ${explorerObjectUrl(vaultId())}`);
console.log(mismatches === 0 ? "PASS: /api/state equals the chain" : `FAIL: ${mismatches} mismatches`);
process.exit(mismatches === 0 ? 0 : 1);
