/**
 * Public URL is read-only. Every mutating call (/api/* and /api/sui-rpc) needs the demo token
 * (x-demo-token, constant-time compare) and passes three checks shared by every serverless
 * instance (Postgres, see lib/leases.ts):
 *  1. Rate limits per client IP.
 *  2. Demo-run lease: one visitor runs the demo at a time. The holder is the browser's
 *     x-demo-client id (or the IP); the lease extends on every action and frees after
 *     DEMO_RUN_IDLE_MS without one, so an abandoned run never blocks the next judge.
 *  3. Action mutex (actionLock): fund-moving and long actions run one at a time, held for the
 *     handler only and capped at the function's maxDuration, so a killed function frees it.
 * GETs stay public. CORS is locked to WEB_ORIGIN. On Vercel a missing DEMO_TOKEN locks everything.
 */
import { randomUUID, timingSafeEqual } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { env } from "../lib/env";
import { acquireLease, currentLease, rateHit, releaseLease } from "../lib/leases";

export const DEMO_TOKEN_HEADER = "x-demo-token";
export const DEMO_CLIENT_HEADER = "x-demo-client";
export const DEMO_RUN_LEASE = "demo_run";
export const DEMO_RUN_IDLE_MS = 10 * 60_000;
const ACTION_LEASE = "demo_action";
const ACTION_TTL_MS = 330_000; // route maxDuration (300 s) + margin

export function allowedOrigins(): string[] {
  const raw = env("WEB_ORIGIN") ?? "http://localhost:3000,http://127.0.0.1:3000";
  return raw.split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
}

export function tokenMatches(given: string | undefined | null, expected: string | undefined): boolean {
  if (!expected) return true; // no token configured: local development only (see demoAccess)
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function ipFrom(header: (name: string) => string | undefined | null): string {
  const fwd = header("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return header("x-real-ip") ?? "local";
}

export function clientIp(c: Context): string {
  return ipFrom((n) => c.req.header(n));
}

/** Demo-run holder: the browser's random client id, else the caller's IP (scripts). */
export function demoHolder(header: (name: string) => string | undefined | null): string {
  const id = header(DEMO_CLIENT_HEADER);
  return id && /^[A-Za-z0-9-]{8,64}$/.test(id) ? `client:${id}` : `ip:${ipFrom(header)}`;
}

const LIMITS: { name: string; match: (path: string) => boolean; max: number; windowMs: number }[] = [
  { name: "reset", match: (p) => p === "/api/demo/reset", max: 3, windowMs: 10 * 60_000 },
  { name: "run-task", match: (p) => p === "/api/demo/run-task", max: 10, windowMs: 60_000 },
  { name: "sign", match: (p) => p === "/api/sui-rpc" || p === "/api/demo/owner-action", max: 20, windowMs: 60_000 },
  { name: "mutations", match: () => true, max: 30, windowMs: 60_000 },
];

export interface Denied {
  status: 401 | 423 | 429 | 503;
  body: { error: string; code: string; retryAfterSeconds?: number };
}

/** The checks every mutating request passes, wherever it is served. null = allowed. */
export async function demoAccess(req: { method: string; path: string; header: (name: string) => string | undefined | null }): Promise<Denied | null> {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return null;
  const expected = env("DEMO_TOKEN");
  if (!expected && env("VERCEL")) return { status: 503, body: { error: "Demo controls are not configured on this deployment.", code: "demo_unconfigured" } };
  if (!tokenMatches(req.header(DEMO_TOKEN_HEADER), expected)) {
    return { status: 401, body: { error: "Demo controls are locked. Enter the demo token to run actions.", code: "demo_locked" } };
  }
  const ip = ipFrom(req.header);
  for (const l of LIMITS) {
    if (!l.match(req.path)) continue;
    const r = await rateHit(`${l.name}:${ip}`, l.max, l.windowMs);
    if (!r.allowed) return { status: 429, body: { error: `Too many ${l.name} requests. Try again shortly.`, code: "rate_limited", retryAfterSeconds: r.retryAfterSeconds } };
  }
  // token-check reports the lease and release gives it back; neither takes it.
  if (req.path === "/api/demo/token-check" || req.path === "/api/demo/release") return null;
  const lease = await acquireLease(DEMO_RUN_LEASE, demoHolder(req.header), DEMO_RUN_IDLE_MS);
  if (!lease.acquired) {
    const retryAfterSeconds = Math.max(1, Math.ceil((lease.until - Date.now()) / 1000));
    return {
      status: 423,
      body: { error: `Another visitor is running the demo. It frees up within ${Math.ceil(retryAfterSeconds / 60)} min.`, code: "demo_busy", retryAfterSeconds },
    };
  }
  return null;
}

/** Give the demo back (the dock's Lock button) so the next visitor does not wait for the idle timeout. */
export async function releaseDemoRun(header: (name: string) => string | undefined | null): Promise<void> {
  await releaseLease(DEMO_RUN_LEASE, demoHolder(header));
}

/** Who holds the demo right now, as seen by this caller (token-check, dock). */
export async function demoRunStatus(header: (name: string) => string | undefined | null): Promise<{ busy: boolean; freeInSeconds: number }> {
  const lease = await currentLease(DEMO_RUN_LEASE);
  if (!lease || lease.holder === demoHolder(header)) return { busy: false, freeInSeconds: 0 };
  return { busy: true, freeInSeconds: Math.max(1, Math.ceil((lease.until - Date.now()) / 1000)) };
}

export function demoGuard(): MiddlewareHandler {
  return async (c, next) => {
    const denied = await demoAccess({ method: c.req.method, path: c.req.path, header: (n) => c.req.header(n) });
    if (!denied) return next();
    if (denied.body.retryAfterSeconds) c.header("Retry-After", String(denied.body.retryAfterSeconds));
    return c.json(denied.body, denied.status);
  };
}

/** Run `fn` while holding the action mutex; null when another action still holds it. */
export async function withActionLock<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; retryAfterSeconds: number }> {
  const holder = randomUUID();
  const lease = await acquireLease(ACTION_LEASE, holder, ACTION_TTL_MS);
  if (!lease.acquired) return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((lease.until - Date.now()) / 1000)) };
  try {
    return { ok: true, value: await fn() };
  } finally {
    await releaseLease(ACTION_LEASE, holder);
  }
}

/** Hono middleware form of withActionLock for fund-moving and long routes. */
export function actionLock(): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.method !== "POST") return next();
    const r = await withActionLock(() => next());
    if (r.ok) return;
    return c.json({ error: "Another demo action is still running. Try again in a moment.", code: "demo_action_running", retryAfterSeconds: r.retryAfterSeconds }, 409);
  };
}
