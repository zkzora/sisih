/**
 * /api/sui-rpc: the browser's only path to Sui, forwarded to Tatum server-side.
 *   { op: "build", kind, args, sender }  -> { txJson }   (owner action, fully resolved)
 *   { op: "execute", bytes, signature }  -> { digest }   (wallet-signed bytes, validated)
 * The wallet only signs; it never submits through its own RPC. Demo-token gated and
 * rate-limited, like the server's mutating endpoints.
 */
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { buildOwnerTx, executeSigned, type OwnerArgs, type OwnerKind } from "@/server/owner-tx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const hits = new Map<string, number[]>();
function limited(ip: string, max = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const h = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (h.length >= max) {
    hits.set(ip, h);
    return true;
  }
  h.push(now);
  hits.set(ip, h);
  return false;
}

function tokenOk(given: string | null): boolean {
  const expected = process.env.DEMO_TOKEN;
  if (!expected) return true; // local development
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!tokenOk(req.headers.get("x-demo-token"))) {
    return NextResponse.json({ error: "Demo controls are locked. Enter the demo token to sign actions.", code: "demo_locked" }, { status: 401 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (limited(ip)) return NextResponse.json({ error: "Too many requests. Try again shortly.", code: "rate_limited" }, { status: 429 });
  let body: { op?: string; kind?: OwnerKind; args?: OwnerArgs; sender?: string; bytes?: string; signature?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON", code: "bad_json" }, { status: 400 });
  }
  try {
    if (body.op === "build") {
      if (!body.kind || !body.sender) return NextResponse.json({ error: "kind and sender are required" }, { status: 400 });
      return NextResponse.json({ txJson: await buildOwnerTx(body.kind, body.args ?? {}, body.sender) });
    }
    if (body.op === "execute") {
      if (!body.bytes || !body.signature) return NextResponse.json({ error: "bytes and signature are required" }, { status: 400 });
      return NextResponse.json(await executeSigned(body.bytes, body.signature));
    }
    return NextResponse.json({ error: "op must be build or execute" }, { status: 400 });
  } catch (err) {
    const message = (err as Error).message ?? String(err);
    // SDK simulation of a doomed transaction: surface the vault error name, spend no gas.
    const abort = message.match(/'(E[A-Za-z]+)'/)?.[1];
    return NextResponse.json({ error: message.slice(0, 300), code: abort ?? "rejected" }, { status: 422 });
  }
}
