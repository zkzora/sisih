/**
 * Spike B (Walrus Memory, always mainnet): health -> remember -> wait for the job -> recall.
 * Logs every field returned so PROGRESS.md can record which identifiers the UI can show.
 * Writes to the "sisih-spike" namespace so demo namespaces start with zero memories.
 */
import { MemWal } from "@mysten-incubation/memwal";
import { env, requireEnv } from "../src/lib/env.js";

const RELAYER = "https://relayer.memory.walrus.xyz";
const namespace = env("SPIKE_MEMWAL_NAMESPACE") ?? "sisih-spike";
const show = (label: string, v: unknown) => console.log(`${label}:`, JSON.stringify(v, null, 2));

const memwal = MemWal.create({
  key: requireEnv("MEMWAL_KEY"),
  accountId: requireEnv("MEMWAL_ACCOUNT_ID"),
  serverUrl: RELAYER,
  namespace,
});

const health = await memwal.health();
console.log(`relayer ${RELAYER} status=${health.status} version=${health.version} write_ready=${health.write_ready}`);
console.log(`namespace ${namespace}, delegate public key ${await memwal.getPublicKeyHex()}`);

const stamp = new Date().toISOString();
const text =
  `[sisih:v1:spike] Phase 0 spike memory written ${stamp}. ` +
  `Sisih keeps committed USDC reserved so the Research Agent spends only free funds.`;

const t0 = Date.now();
const accepted = await memwal.remember(text, namespace);
show("remember() accepted", accepted);

const polled = await memwal.getRememberStatus(accepted.job_id);
show("getRememberStatus() right after accept", polled);

const finished = await memwal.waitForRememberJob(accepted.job_id, { pollIntervalMs: 2000, timeoutMs: 180_000 });
show("waitForRememberJob() result", finished);
console.log(`remember job finished in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

const recall = await memwal.recall({ query: "what does Sisih protect from the agent?", limit: 5, namespace });
show("recall()", recall);

const hit = recall.results.find((r) => r.blob_id === finished.blob_id || r.text.includes(stamp));
console.log(hit ? `PASS: recalled blob ${hit.blob_id} (distance ${hit.distance})` : "FAIL: spike memory not in recall results");
process.exit(hit ? 0 : 1);
