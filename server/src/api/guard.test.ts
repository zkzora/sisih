import { Hono } from "hono";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

// Leases and rate limits live in Postgres so every serverless instance shares them.
process.env.DATABASE_URL = "pglite::memory:";

const { initDb } = await import("../db/index");
const { acquireLease, currentLease, rateHit, releaseLease } = await import("../lib/leases");
const { actionLock, demoGuard, releaseDemoRun, tokenMatches, withActionLock } = await import("./guard");

beforeAll(async () => {
  await initDb();
});

describe("tokenMatches", () => {
  it("requires the exact token when one is configured", () => {
    expect(tokenMatches("abc", "abc")).toBe(true);
    expect(tokenMatches("abd", "abc")).toBe(false);
    expect(tokenMatches(undefined, "abc")).toBe(false);
  });
  it("allows everything when no token is configured (local dev)", () => {
    expect(tokenMatches(undefined, undefined)).toBe(true);
  });
});

describe("rateHit (shared fixed window)", () => {
  it("allows max hits per window, then refuses until the window ends", async () => {
    expect((await rateHit("t:k", 2, 1000, 0)).allowed).toBe(true);
    expect((await rateHit("t:k", 2, 1000, 10)).allowed).toBe(true);
    const third = await rateHit("t:k", 2, 1000, 20);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBe(1);
    expect((await rateHit("t:k", 2, 1000, 1001)).allowed).toBe(true); // new window
    expect((await rateHit("t:other", 2, 1000, 20)).allowed).toBe(true);
  });
});

describe("leases", () => {
  it("one holder at a time; same holder extends; expired leases can be taken", async () => {
    expect((await acquireLease("t:l", "a", 1000, 0)).acquired).toBe(true);
    expect((await acquireLease("t:l", "b", 1000, 500)).acquired).toBe(false);
    expect((await acquireLease("t:l", "a", 1000, 900)).acquired).toBe(true); // extends to 1900
    expect((await acquireLease("t:l", "b", 1000, 1500)).acquired).toBe(false);
    expect((await acquireLease("t:l", "b", 1000, 2000)).acquired).toBe(true); // a's lease expired (killed function)
    await releaseLease("t:l", "a"); // not the holder: no effect
    expect((await currentLease("t:l", 2100))?.holder).toBe("b");
    await releaseLease("t:l", "b");
    expect(await currentLease("t:l", 2100)).toBeNull();
  });
});

describe("demoGuard", () => {
  beforeEach(() => {
    process.env.DEMO_TOKEN = "secret-token";
    delete process.env.VERCEL;
  });
  const app = new Hono();
  app.use("/api/*", demoGuard());
  app.get("/api/state", (c) => c.json({ ok: true }));
  app.post("/api/requests", (c) => c.json({ ok: true }));
  app.post("/api/demo/token-check", (c) => c.json({ ok: true }));
  const as = (ip: string, client?: string) => ({ "x-demo-token": "secret-token", "x-forwarded-for": ip, ...(client ? { "x-demo-client": client } : {}) });

  it("keeps reads public", async () => {
    expect((await app.request("/api/state")).status).toBe(200);
  });
  it("locks mutations without the token", async () => {
    const res = await app.request("/api/requests", { method: "POST" });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "demo_locked" });
  });
  it("fails closed on Vercel when no token is configured", async () => {
    delete process.env.DEMO_TOKEN;
    process.env.VERCEL = "1";
    const res = await app.request("/api/requests", { method: "POST" });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: "demo_unconfigured" });
  });
  it("one demo run at a time: a second visitor gets 423 until the first lets go", async () => {
    expect((await app.request("/api/requests", { method: "POST", headers: as("10.0.0.1", "judge-one-aaaa") })).status).toBe(200);
    const busy = await app.request("/api/requests", { method: "POST", headers: as("10.0.0.3", "judge-two-bbbb") });
    expect(busy.status).toBe(423);
    expect(await busy.json()).toMatchObject({ code: "demo_busy" });
    expect(busy.headers.get("retry-after")).not.toBeNull();
    // Unlocking the dock only reports the lease; it does not steal it.
    expect((await app.request("/api/demo/token-check", { method: "POST", headers: as("10.0.0.3", "judge-two-bbbb") })).status).toBe(200);
    expect((await app.request("/api/requests", { method: "POST", headers: as("10.0.0.1", "judge-one-aaaa") })).status).toBe(200);
    await releaseLease("demo_run", "client:judge-one-aaaa");
    expect((await app.request("/api/requests", { method: "POST", headers: as("10.0.0.3", "judge-two-bbbb") })).status).toBe(200);
    await releaseLease("demo_run", "client:judge-two-bbbb");
  });
  it("Lock in the dock gives the demo back at once, but only the holder's own lease", async () => {
    expect((await app.request("/api/requests", { method: "POST", headers: as("10.0.0.4", "judge-three-dddd") })).status).toBe(200);
    await releaseDemoRun((n) => (n === "x-demo-client" ? "judge-four-eeee" : null)); // not the holder
    expect((await app.request("/api/requests", { method: "POST", headers: as("10.0.0.5", "judge-four-eeee") })).status).toBe(423);
    await releaseDemoRun((n) => (n === "x-demo-client" ? "judge-three-dddd" : null));
    expect((await app.request("/api/requests", { method: "POST", headers: as("10.0.0.5", "judge-four-eeee") })).status).toBe(200);
    await releaseLease("demo_run", "client:judge-four-eeee");
  });
  it("rate-limits mutations per IP", async () => {
    let last = 200;
    for (let i = 0; i < 31; i++) last = (await app.request("/api/requests", { method: "POST", headers: as("10.0.0.2", "judge-rate-cccc") })).status;
    expect(last).toBe(429);
    await releaseLease("demo_run", "client:judge-rate-cccc");
  });
});

describe("actionLock", () => {
  it("runs fund-moving actions one at a time and frees the lock afterwards", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const first = withActionLock(() => gate.then(() => "first"));
    await new Promise((r) => setTimeout(r, 50)); // first holds the lock
    expect(await withActionLock(async () => "second")).toMatchObject({ ok: false });
    release();
    expect(await first).toEqual({ ok: true, value: "first" });
    expect(await withActionLock(async () => "third")).toEqual({ ok: true, value: "third" });
  });
  it("answers 409 while another action holds the lock", async () => {
    const app = new Hono();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    app.use("/api/demo/run-task", actionLock());
    app.post("/api/demo/run-task", async (c) => {
      await gate;
      return c.json({ ok: true });
    });
    const first = app.request("/api/demo/run-task", { method: "POST" });
    await new Promise((r) => setTimeout(r, 50));
    const second = await app.request("/api/demo/run-task", { method: "POST" });
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ code: "demo_action_running" });
    release();
    expect((await first).status).toBe(200);
  });
});
