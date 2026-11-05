/** Demo x402 merchants (labeled demo), served by the Sisih server (see server/hosted-api). */
import { handle } from "@/server/hosted-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export { handle as GET, handle as POST };
