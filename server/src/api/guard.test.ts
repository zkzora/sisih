import { Hono } from "hono";
import { describe, expect, it, beforeEach } from "vitest";
import { RateLimiter, demoGuard, tokenMatches } from "./guard";

describe("tokenMatches", () => {
  it("requires the exact token when one is configured", () => {
    expect(tokenMatches("abc", "abc")).toBe(true);
    expect(tokenMatches("abd", "abc")).toBe(false);
    expect(tokenMatches("ab", "abc")).toBe(false);
    expect(tokenMatches(undefined, "abc")).toBe(false);
  });
  it("allows everything when no token is configured (local dev)", () => {
    expect(tokenMatches(undefined, undefined)).toBe(true);
  });
});

describe("RateLimiter", () => {
  it("allows max hits per window, then refuses until the window slides", () => {
    const l = new RateLimiter(2, 1000);
    expect(l.hit("k", 0)).toBe(true);
    expect(l.hit("k", 10)).toBe(true);
    expect(l.hit("k", 20)).toBe(false);
    expect(l.retryAfterSeconds("k", 20)).toBe(1);
    expect(l.hit("k", 1001)).toBe(true);
    expect(l.hit("other", 20)).toBe(true);
  });
});

describe("demoGuard", () => {
  beforeEach(() => {
    process.env.DEMO_TOKEN = "secret-token";
  });
  const app = new Hono();
  app.use("/api/*", demoGuard());
  app.get("/api/state", (c) => c.json({ ok: true }));
  app.post("/api/requests", (c) => c.json({ ok: true }));

  it("keeps reads public", async () => {
    expect((await app.request("/api/state")).status).toBe(200);
  });
  it("locks mutations without the token", async () => {
    const res = await app.request("/api/requests", { method: "POST" });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "demo_locked" });
  });
  it("allows mutations with the token", async () => {
    const res = await app.request("/api/requests", { method: "POST", headers: { "x-demo-token": "secret-token", "x-forwarded-for": "10.0.0.1" } });
    expect(res.status).toBe(200);
  });
  it("rate-limits mutations per IP", async () => {
    const h = { "x-demo-token": "secret-token", "x-forwarded-for": "10.0.0.2" };
    let last = 200;
    for (let i = 0; i < 31; i++) last = (await app.request("/api/requests", { method: "POST", headers: h })).status;
    expect(last).toBe(429);
  });
});
