/** Read-only public evidence snapshot; never copies signed bytes, keys or authorization headers. */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { env, REPO_ROOT, suiNetwork } from "../../src/lib/env";
import { suiClient } from "../../src/lib/tatum";
import { loadJournal } from "../../src/mainnet/journal";
import { loadMainnetManifest } from "../../src/mainnet/manifest";

if (process.argv.includes("--help")) { console.log("capture-proof.ts [--out <directory>]. Read-only chain/API snapshot of the reviewed local Mainnet proof."); process.exit(0); }
if (suiNetwork() !== "mainnet") throw new Error("Mainnet config required");
const m = loadMainnetManifest("docs/mainnet/MANIFEST.json");
const args = process.argv.slice(2);
const out = resolve(REPO_ROOT, args.includes("--out") ? args[args.indexOf("--out") + 1]! : "docs/evidence/mainnet-20261108");
mkdirSync(out, { recursive: true });
const save = (name: string, value: unknown) => writeFileSync(resolve(out, name), JSON.stringify(value, (_k, v) => typeof v === "bigint" ? v.toString() : v, 2) + "\n");
const snapshots: Record<string, any> = {};
for (const endpoint of ["state", "requests", "memories", "rules", "sessions", "activity"]) {
  const res = await fetch(`${m.deployment.execution_origin}/api/${endpoint}`);
  if (!res.ok) throw new Error(`${endpoint} HTTP ${res.status}`);
  const data = await res.json();
  snapshots[endpoint] = data;
  save(`${endpoint}.json`, data);
}
const journal = loadJournal(m.plan_id);
const digests = new Map(Object.entries(journal.operations).map(([id, op]) => [op.digest, id]));
const requests = Array.isArray(snapshots.requests) ? snapshots.requests : snapshots.requests.requests;
for (const request of requests) for (const receipt of request.paymentDigests ?? []) digests.set(receipt.digest, `${request.id}-${receipt.step}`);
const activity = Array.isArray(snapshots.activity) ? snapshots.activity : snapshots.activity.activity;
for (const item of activity ?? []) if (item.digest) digests.set(item.digest, item.label ?? item.digest);
const client = suiClient("mainnet");
const service = await client.ledgerService.getServiceInfo({});
const transactions = [];
for (const [digest, id] of digests) {
  const result = await client.core.getTransaction({ digest, include: { transaction: true, effects: true, events: true, objectTypes: true, balanceChanges: true } });
  const tx = result.Transaction ?? result.FailedTransaction;
  transactions.push({ id, ...tx });
}
save("transactions.json", transactions);
const balances: Record<string, unknown> = {};
for (const [name, role] of [...Object.entries(m.roles), ["merchant", { address: m.merchant.recipient }]] as Array<[string, { address: string }]>) {
  const sui = await client.getBalance({ owner: role.address });
  const usdc = await client.getBalance({ owner: role.address, coinType: m.asset.coin_type });
  balances[name] = { address: role.address, sui_mist: String(sui.balance.balance), usdc_base_units: String(usdc.balance.balance) };
}
save("balances.json", { captured_at: new Date().toISOString(), balances });
save("context.json", { captured_at: new Date().toISOString(), network: "sui:mainnet", chain_id: service.response.chainId, checkpoint: String(service.response.checkpointHeight), origin: m.deployment.execution_origin, mcp_endpoint: m.deployment.execution_mcp_endpoint, namespace: m.deployment.memwal_namespace_prefix, plan_id: m.plan_id, ids: journal.ids, asset: m.asset.coin_type, owner_interface: "Sisih CLI, owner key signs locally", external_client: "Codex CLI 0.164.0-alpha.11.1; fresh process per prompt", public_deployment: false });
console.log(`Captured public proof: ${transactions.length} chain transactions, ${requests.length} requests. No signing or broadcast.`);
process.exit(0);
