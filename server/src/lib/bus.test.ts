import { beforeAll, describe, expect, it } from "vitest";

// In-memory PGlite: the same pg-core queries the hosted Supabase database runs.
process.env.DATABASE_URL = "pglite::memory:";

const { initDb, schemaExists } = await import("../db/index");
const { latestEventId, publish, since } = await import("./bus");
const { drainBackground } = await import("./background");
const { currentSession, defaultThreshold, kvSet } = await import("../services/state");

beforeAll(async () => {
  await initDb();
});

describe("event feed (polling, any instance)", () => {
  it("stores published events in order and serves them after an id", async () => {
    const start = await latestEventId();
    publish("request.created", { id: "req-1", amount: 500000n });
    publish("x402.funds_released", { id: "req-1" });
    await drainBackground(); // what after() does on Vercel
    const evs = await since(start);
    expect(evs.map((e) => e.type)).toEqual(["request.created", "x402.funds_released"]);
    expect(evs[0]!.data).toEqual({ id: "req-1", amount: "500000" }); // bigint as base-unit string
    expect(await latestEventId()).toBe(evs[1]!.id);
    expect(await since(evs[1]!.id)).toEqual([]);
  });
});

describe("schema bootstrap", () => {
  it("sees the full schema after initDb, so cold starts skip DDL (no ShareLock on events)", async () => {
    expect(await schemaExists()).toBe(true);
    await initDb(); // idempotent
    expect(await schemaExists()).toBe(true);
  });
});

describe("state in Postgres", () => {
  it("starts at session 1 and keeps settings in kv", async () => {
    expect(await currentSession()).toBe(1);
    expect(await defaultThreshold()).toBe(500000n);
    await kvSet("default_threshold", "750000");
    await kvSet("default_threshold", "800000"); // upsert
    expect(await defaultThreshold()).toBe(800000n);
  });
});
