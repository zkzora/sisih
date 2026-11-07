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
  status: 401 | 403 | 423 | 429 | 503;
  body: { error: string; code: string; retryAfterSeconds?: number };
}

// --- agent and owner credentials ---------------------------------------------------------
/**
 * /api/mcp and /api/owner/* authenticate a bearer credential themselves (auth/context.ts): the
 * delegated agent (SISIH_AGENT_TOKEN) or the owner. Everything else below is the legacy Testnet
 * demo-token path. The holder below identifies the one configured demo agent's run.
 */
export const AGENT_HOLDER = "agent:demo";
export const MCP_PATH = "/api/mcp";
export const OWNER_PREFIX = "/api/owner/";

/**
 * While the demo agent holds the demo run, a demo-token owner may still decide that agent's
 * requests and start a new session (the dashboard is the owner's approval interface). Every other
 * mutation stays blocked, so two visitors' runs never mix.
 */
const OWNER_PATHS_DURING_AGENT_RUN = [
  /^\/api\/requests\/[^/]+\/decision$/,
  /^\/api\/demo\/new-session$/,
  // The owner stays in charge of the agent's authority during its run: pause, resume, revoke,
  // limits, reserves and preferences. Demo-run actions (reset, cycle, built-in tasks) stay blocked.
  /^\/api\/demo\/owner-action$/,
  /^\/api\/rules(\/[^/]+)?$/,
  /^\/api\/settings$/,
];

/** The checks every mutating request passes, wherever it is served. null = allowed. */
export async function demoAccess(req: { method: string; path: string; header: (name: string) => string | undefined | null }): Promise<Denied | null> {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return null;
  // /api/mcp authenticates the agent credential itself (agentAuth); it never accepts DEMO_TOKEN as
  // a substitute and exposes no owner operation.
  if (req.path === MCP_PATH || req.path.startsWith(OWNER_PREFIX)) return null;
  // Mainnet: no shared-token shortcut. Every owner effect goes through /api/owner/* (owner
  // credential plus the owner's local signature); demo controls, server-owner signing, transaction
  // import and the legacy decision/rule/settings routes are refused before any side effect.
  if (env("SUI_NETWORK") === "mainnet") {
    return { status: 403, body: { error: "This route is not available on Mainnet. Owner actions use the owner MCP tools or pnpm sisih, signed with the owner's key.", code: "mainnet_route_disabled" } };
  }
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
  // token-check reports the lease, release gives it back, agent-credential only reads; none takes it.
  if (req.path === "/api/demo/token-check" || req.path === "/api/demo/release" || req.path === "/api/demo/agent-credential") return null;
  const lease = await acquireLease(DEMO_RUN_LEASE, demoHolder(req.header), DEMO_RUN_IDLE_MS);
  if (!lease.acquired) {
    if (lease.holder === AGENT_HOLDER && OWNER_PATHS_DURING_AGENT_RUN.some((re) => re.test(req.path))) return null;
    const retryAfterSeconds = Math.max(1, Math.ceil((lease.until - Date.now()) / 1000));
    const minutes = Math.ceil(retryAfterSeconds / 60);
    return {
      status: 423,
      body: {
        error:
          lease.holder === AGENT_HOLDER
            ? `A connected agent is running the demo. You can approve or deny its requests in Agent & requests; other actions free up within ${minutes} min or when the agent ends its session.`
            : `Another visitor is running the demo. It frees up within ${minutes} min.`,
        code: lease.holder === AGENT_HOLDER ? "agent_run_active" : "demo_busy",
        retryAfterSeconds,
      },
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
