/**
 * Phase 2 gate: import known digests through POST /api/tx (the same path the browser uses
 * for owner-signed transactions), measure the Tatum calls each one costs, and print the
 * activity feed with verification status.
 */
import { formatUsdc } from "../src/lib/env.js";

const API = process.env.API_URL ?? "http://127.0.0.1:8787";
const DIGESTS: [string, string][] = [
  ["E1yi2YGwQKvptBFmpJ6JXgJzChKfnwFeZB7YnomnXSax", "Publish sisih package"],
  ["BPpnht7M5SKmzETvfYH11FhqkBCUsQqVxe7oZPEZPuDL", "Create vault"],
  ["6CGR8T7aEwX8kRQz39XpyV7dEh8rCqjTpNjaqQmW9tma", "Seed vault"],
  ["BdvJPeHs5a9W9fHALBwHNVxtNbiSz4kxbhpmMCefWTPs", "Release to agent 0.50 (gate)"],
  ["BQyCnzJuPWTxm5YijiSJkYduCQycqX7ex3XtDrxQiJ1w", "Release to agent 5.00 (gate, must fail)"],
  ["8G4cQRFVnv4KyMgnjSiVB9NYs9o7QpWfRuZkvMRXFVCv", "x402 settle 0.01 DataMart (spike)"],
];

type Health = { tatum: { byMethod: Record<string, number>; calls: number } };
const health = async () => (await (await fetch(`${API}/api/health`)).json()) as Health;
const diff = (a: Record<string, number>, b: Record<string, number>) =>
  Object.fromEntries(Object.keys(b).map((k) => [k, (b[k] ?? 0) - (a[k] ?? 0)]).filter(([, v]) => (v as number) > 0));

let budgetOk = true;
for (const [digest, label] of DIGESTS) {
  const before = (await health()).tatum.byMethod;
  const res = await fetch(`${API}/api/tx`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ digest, label, source: "import" }) });
  const body = (await res.json()) as { status: string; events: unknown[]; error: string | null };
  const delta = diff(before, (await health()).tatum.byMethod);
  const reads = Object.values(delta).reduce<number>((s, n) => s + Number(n), 0);
  if (reads !== 2) budgetOk = false;
  console.log(`${label.padEnd(42)} ${body.status.padEnd(9)} events=${String(body.events.length).padEnd(2)} tatum calls ${JSON.stringify(delta)}`);
}

const rows = (await (await fetch(`${API}/api/activity`)).json()) as Array<{ kind: string; amount: string | null; from: string; to: string; verification: string; failureReason: string | null; digest: string; checkpoint: string | null }>;
console.log(`\nGET /api/activity: ${rows.length} rows`);
for (const r of rows) {
  const amt = r.amount !== null && /^\d+$/.test(r.amount) ? formatUsdc(BigInt(r.amount)).padStart(6) : "      ";
  console.log(`  ${r.verification.padEnd(8)} ${r.kind.padEnd(17)} ${amt}  ${(r.from || "-").slice(0, 22).padEnd(22)} -> ${(r.to || "-").slice(0, 22).padEnd(22)} ${r.digest.slice(0, 10)}… cp ${r.checkpoint ?? "-"}${r.failureReason ? `  (${r.failureReason})` : ""}`);
}
console.log(budgetOk ? "\nPASS: every recorded transaction cost exactly 2 Tatum reads (GetTransaction + vault getObject)" : "\nCHECK: some transactions did not cost exactly 2 reads");
process.exit(0);
