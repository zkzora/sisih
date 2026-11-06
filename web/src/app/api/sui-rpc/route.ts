/**
 * /api/sui-rpc: the browser's only path to Sui, forwarded to Tatum server-side.
 *   { op: "build", kind, args, sender }  -> { txJson }   (owner action, fully resolved)
 *   { op: "execute", bytes, signature }  -> { digest }   (wallet-signed bytes, validated)
 * The wallet only signs; it never submits through its own RPC. Demo-token gated and
 * rate-limited, like the server's mutating endpoints.
 */
import { NextResponse, type NextRequest } from "next/server";
import { guardRequest } from "@/server/hosted-api";
import { buildOwnerTx, executeSigned, type OwnerArgs, type OwnerKind } from "@/server/owner-tx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Build resolves objects and simulates; execute waits for effects. Both go through the Tatum throttle.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  // Same checks as every mutating /api/* call: token, shared rate limits, demo-run lease.
  const denied = await guardRequest(req, "/api/sui-rpc");
  if (denied) {
    const headers = denied.body.retryAfterSeconds ? { "Retry-After": String(denied.body.retryAfterSeconds) } : undefined;
    return NextResponse.json(denied.body, { status: denied.status, headers });
  }
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
