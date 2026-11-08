/** Reviewed limits for the bounded proof, loaded from durable state rather than client input. */
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index";
import { env, isMainnet } from "../lib/env";
import { kvRead } from "../services/state";
import type { OwnerAction } from "../owner/apply";
import { validateMainnetManifest, type MainnetManifest } from "./manifest";
import { address } from "../lib/wallets";

export async function proofManifest(): Promise<MainnetManifest> {
  const plan = env("MAINNET_PLAN_ID");
  if (!plan) throw new Error("MAINNET_PLAN_ID is required");
  const raw = await kvRead(`mainnet_manifest:${plan}`);
  if (!raw) throw new Error("The reviewed Mainnet manifest has not been initialized in this database");
  const manifest = validateMainnetManifest(JSON.parse(raw));
  if (manifest.plan_id !== plan) throw new Error("Persisted Mainnet plan differs from runtime");
  const deployment = await kvRead(`mainnet_deployment:${plan}`);
  if (!deployment) throw new Error("Mainnet deployment IDs are not initialized");
  for (const [key, value] of Object.entries(JSON.parse(deployment) as Record<string, string>)) {
    if (env(key)?.toLowerCase() !== value.toLowerCase()) throw new Error(`${key} differs from the persisted Mainnet deployment`);
  }
  for (const role of ["owner", "operator", "agent", "facilitator"] as const) {
    if (address(role).toLowerCase() !== manifest.roles[role].address.toLowerCase()) throw new Error(`${role} differs from the reviewed Mainnet identity`);
  }
  if (env("USDC_COIN_TYPE") !== manifest.asset.coin_type || env("MERCHANT_CHAINSCOPE_ADDRESS") !== manifest.merchant.recipient) throw new Error("Mainnet asset or merchant differs from the reviewed manifest");
  if (env("PUBLIC_BASE_URL") !== manifest.deployment.execution_origin) throw new Error("Mainnet origin differs from the reviewed execution target");
  return manifest;
}

export async function assertProofOwnerAction(action: OwnerAction): Promise<void> {
  if (!isMainnet()) return;
  const m = await proofManifest();
  if (action.action === "set_agent_permission" && action.state === "revoke") return;
  if (action.action === "start_next_session") return;
  if (action.action === "decide_request") {
    const [request] = await db().select().from(schema.requests).where(eq(schema.requests.id, action.request_id));
    if (!request || request.merchant !== "ChainScope" || request.amount !== m.merchant.price_base_units) throw new Error("Owner action is outside the reviewed Mainnet purchase");
    if (action.max_amount && BigInt(action.max_amount) > BigInt(m.merchant.price_base_units)) throw new Error("Preference exceeds reviewed purchase limit");
    if (action.days && action.days > 7) throw new Error("Preference exceeds reviewed seven-day validity");
    return;
  }
  throw new Error(`${action.action} is outside this bounded proof authorization; revise the reviewed plan before changing it`);
}
