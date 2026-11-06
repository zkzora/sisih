/** Demo x402 merchants (labeled demo), served by the Sisih server (see server/hosted-api). */
import { handle } from "@/server/hosted-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// x402: verify + facilitator settle + Tatum verification of the digest, all throttled (3 req/s).
export const maxDuration = 300;

export { handle as GET, handle as POST };
