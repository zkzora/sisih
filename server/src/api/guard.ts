/**
 * Public URL is read-only by default. Every mutating /api/* call needs the demo token
 * (x-demo-token, constant-time compare) and is rate-limited per client IP. GETs and SSE stay
 * public. CORS is locked to WEB_ORIGIN.
 */
import { timingSafeEqual } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { env } from "../lib/env";

export const DEMO_TOKEN_HEADER = "x-demo-token";

export function allowedOrigins(): string[] {
  const raw = env("WEB_ORIGIN") ?? "http://localhost:3000,http://127.0.0.1:3000";
  return raw.split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
}

export function tokenMatches(given: string | undefined, expected: string | undefined): boolean {
  if (!expected) return true; // no token configured: local development only (see index.ts)
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function clientIp(c: Context): string {
  const fwd = c.req.header("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return c.req.header("x-real-ip") ?? "local";
}

interface Bucket {
  hits: number[];
}

/** Sliding-window limiter: at most `max` hits per `windowMs` per key. */
export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  constructor(private max: number, private windowMs: number) {}
  /** true when allowed (and the hit is counted). */
  hit(key: string, now = Date.now()): boolean {
    const b = this.buckets.get(key) ?? { hits: [] };
    b.hits = b.hits.filter((t) => now - t < this.windowMs);
    if (b.hits.length >= this.max) {
      this.buckets.set(key, b);
      return false;
    }
    b.hits.push(now);
    this.buckets.set(key, b);
    return true;
  }
  retryAfterSeconds(key: string, now = Date.now()): number {
    const b = this.buckets.get(key);
    if (!b || b.hits.length === 0) return 0;
    return Math.max(1, Math.ceil((this.windowMs - (now - b.hits[0]!)) / 1000));
  }
}

const LIMITS: { match: (path: string) => boolean; limiter: RateLimiter; name: string }[] = [
  { name: "reset", match: (p) => p === "/api/demo/reset", limiter: new RateLimiter(3, 10 * 60_000) },
  { name: "run-task", match: (p) => p === "/api/demo/run-task", limiter: new RateLimiter(10, 60_000) },
  { name: "mutations", match: () => true, limiter: new RateLimiter(30, 60_000) },
];

export function demoGuard(): MiddlewareHandler {
  return async (c, next) => {
    const method = c.req.method;
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();
    if (!tokenMatches(c.req.header(DEMO_TOKEN_HEADER), env("DEMO_TOKEN"))) {
      return c.json({ error: "Demo controls are locked. Enter the demo token to run actions.", code: "demo_locked" }, 401);
    }
    const ip = clientIp(c);
    for (const l of LIMITS) {
      if (!l.match(c.req.path)) continue;
      if (!l.limiter.hit(`${l.name}:${ip}`)) {
        c.header("Retry-After", String(l.limiter.retryAfterSeconds(`${l.name}:${ip}`)));
        return c.json({ error: `Too many ${l.name} requests. Try again shortly.`, code: "rate_limited" }, 429);
      }
    }
    return next();
  };
}
