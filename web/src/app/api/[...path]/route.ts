/** Every /api/* route except /api/sui-rpc is served by the Sisih server (see server/hosted-api). */
import { handle } from "@/server/hosted-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Reset, advance-cycle and new-session wait on Tatum and Walrus Memory jobs (~25 s per memory).
export const maxDuration = 300;

export { handle as GET, handle as POST, handle as PATCH, handle as OPTIONS };
