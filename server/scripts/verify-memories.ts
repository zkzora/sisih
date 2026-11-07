/**
 * Verify, per memory, that a namespace's memories are stored on Walrus Mainnet.
 *   SISIH_URL=https://sisih-azure.vercel.app pnpm --filter @sisih/server exec tsx scripts/verify-memories.ts [namespace]
 *
 * 1. Reads the memory rows the deployment recorded (public GET /api/memories): job id, blob id.
 * 2. For each row, asks the relayer for that job (getRememberStatus): must be "done" with the same
 *    blob id. This checks each memory individually instead of inferring a total.
 * 3. Pages through the account's full memory listing WITHOUT the namespace filter (the filtered
 *    listing returned 0 on 2026-11-07) and matches namespace_id, as a second, independent count.
 * Recall results are printed as sources only, never used as a count (recall is top-k).
 * Needs MEMWAL_KEY / MEMWAL_ACCOUNT_ID (the same Walrus Memory account) in the root .env.
 */
import "../src/lib/env";
import { memwalClient } from "../src/memory/memwal";

const base = (process.env.SISIH_URL ?? "https://sisih-azure.vercel.app").replace(/\/$/, "");
const state = await (await fetch(`${base}/api/state`)).json();
const ns = process.argv[2] ?? state.memory.namespace;
const raw = await (await fetch(`${base}/api/memories`)).json();
const rows = ((Array.isArray(raw) ? raw : raw.memories) as any[]).filter((m) => m.namespace === ns);
const m = memwalClient();

console.log(`namespace ${ns}: ${rows.length} memory rows recorded by ${base}`);
let confirmed = 0;
const results: { id: string; type: string; job: string; status: string; blob: string; match: boolean }[] = [];
for (const r of rows) {
  if (!r.jobId) {
    results.push({ id: r.id, type: r.type, job: "-", status: `no job id (row ${r.status})`, blob: r.blobId ?? "-", match: false });
    continue;
  }
  try {
    const s = await m.getRememberStatus(r.jobId);
    const match = s.status === "done" && Boolean(s.blob_id) && s.blob_id === r.blobId;
    if (match) confirmed++;
    results.push({ id: r.id, type: r.type, job: r.jobId, status: s.status, blob: s.blob_id ?? "-", match });
  } catch (e) {
    results.push({ id: r.id, type: r.type, job: r.jobId, status: `error: ${(e as Error).message.slice(0, 60)}`, blob: r.blobId ?? "-", match: false });
  }
}
for (const x of results) console.log(`  ${x.match ? "stored " : "CHECK  "} ${x.type.padEnd(18)} job ${x.job.slice(0, 8)} relayer ${x.status.padEnd(6)} blob ${x.blob}`);

// Independent count: the whole account listing, filtered here by namespace_id.
let cursor: string | undefined;
const listed = new Set<string>();
let pages = 0;
for (; pages < 200; pages++) {
  const res: any = await m.listMemories({ cursor, limit: 100 });
  for (const x of res.memories) if (x.namespace_id === ns) listed.add(x.blob_id);
  if (!res.has_more || !res.next_cursor) break;
  cursor = res.next_cursor;
}
const rowBlobs = new Set(rows.map((r) => r.blobId).filter(Boolean));
const both = [...rowBlobs].filter((b) => listed.has(b)).length;
console.log(`\nper-memory relayer check: ${confirmed} of ${rows.length} done with a matching blob id`);
console.log(`full account listing (${pages + 1} pages, unfiltered): ${listed.size} memories in ${ns}; ${both} of ${rowBlobs.size} recorded blob ids present`);

const rec: any = await m.recall({ query: `${ns} decision rule ChainScope vault report owner approved`, limit: 5, namespace: ns });
console.log(`recall sample (top 5, sources only): ${rec.results.map((x: any) => `${x.blob_id.slice(0, 10)} d=${x.distance.toFixed(3)}`).join(", ")}`);
process.exit(confirmed === rows.length && rows.length > 0 ? 0 : 1);
