/**
 * The Sisih server (server/src, Hono) mounted inside Next.js route handlers, so the hosted demo
 * is one Vercel project on one origin: /api/* and /merchants/* (demo x402 merchants).
 * Background work (Walrus Memory jobs, event inserts, recall) is drained with after(), which
 * keeps the function alive until it settles, up to the route's maxDuration.
 */
import "server-only";
import "./root-env";
import { after } from "next/server";
import { createApp } from "../../../server/src/api/app";
import { drainBackground } from "../../../server/src/lib/background";

let app: ReturnType<typeof createApp> | undefined;

export async function handle(req: Request): Promise<Response> {
  // Local `next dev`: the agent reaches the demo merchants on this same origin.
  if (!process.env.PUBLIC_BASE_URL && !process.env.VERCEL_PROJECT_PRODUCTION_URL) process.env.PUBLIC_BASE_URL = new URL(req.url).origin;
  app ??= createApp();
  try {
    return await app.fetch(req);
  } finally {
    after(drainBackground);
  }
}
