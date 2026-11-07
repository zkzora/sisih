/**
 * One authenticated context for every consumer of the Sisih domain (MCP, owner HTTP routes, CLI).
 *
 * Authority comes only from a verified credential. Tool arguments, model text, MCP clientInfo,
 * client names and any caller-supplied role header are ignored.
 *
 * Credentials (bearer tokens, constant-time compared):
 * - SISIH_AGENT_TOKEN: the delegated spending agent. Budget, services, purchase, status, end session.
 * - Owner token: the owner assistant / owner CLI.
 *   - Testnet: SISIH_OWNER_MCP_TOKEN, else DEMO_TOKEN (the judges' owner token).
 *   - Mainnet: SISIH_OWNER_MCP_TOKEN only. It must differ from DEMO_TOKEN.
 *     On Mainnet an owner token alone never moves money or changes policy: every owner effect also
 *     needs the owner's local signature (owner/intents.ts).
 *
 * Fail closed:
 * - Identical agent and owner credentials are rejected (no ambiguous role).
 * - Mainnet never allows a missing-credential bypass, not even locally.
 * - The Testnet local-development bypass (no SISIH_AGENT_TOKEN, not on Vercel) grants the agent
 *   role only, never the owner role.
 *
 * This deployment has one configured owner and one spending identity. The context does not imply
 * multiple users or independent agents.
 */
import { timingSafeEqual } from "node:crypto";
import { env, suiNetwork, type SuiNetwork } from "../lib/env";

export type Role = "agent" | "owner";

export const AGENT_CAPABILITIES = ["budget.read", "services.read", "purchase.request", "purchase.status", "session.end"] as const;
export const OWNER_CAPABILITIES = ["owner.read", "owner.decide", "owner.configure", "owner.permission", "owner.session"] as const;
export const DEMO_CAPABILITIES = ["demo.control"] as const;
export type Capability = (typeof AGENT_CAPABILITIES)[number] | (typeof OWNER_CAPABILITIES)[number] | (typeof DEMO_CAPABILITIES)[number];

/** How an owner effect is authorized and signed in this environment. */
export type OwnerSigning = "server_demo" | "local_owner";

export interface AuthContext {
  role: Role;
  network: SuiNetwork;
  vaultId: string | null;
  capabilities: ReadonlySet<Capability>;
  ownerSigning: OwnerSigning;
  /** Lease holder for the shared demo run. */
  holder: string;
}

export type AuthResult = { ok: true; ctx: AuthContext } | { ok: false; status: 401 | 503; error: string; code: string };

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Owner effects on Testnet are server-signed by the labeled demo owner unless local signing is selected. */
export function ownerSigningMode(network: SuiNetwork = suiNetwork()): OwnerSigning {
  if (network === "mainnet") return "local_owner";
  return env("SISIH_OWNER_SIGNING") === "local" ? "local_owner" : "server_demo";
}

interface Credentials {
  agent?: string;
  owner?: string;
}

/** Validated credential configuration for this environment; an error string means fail closed. */
export function credentialConfig(network: SuiNetwork = suiNetwork()): Credentials & { error?: string } {
  const agent = env("SISIH_AGENT_TOKEN");
  const demo = env("DEMO_TOKEN");
  const ownerMcp = env("SISIH_OWNER_MCP_TOKEN");
  const owner = network === "mainnet" ? ownerMcp : (ownerMcp ?? demo);
  if (network === "mainnet" && ownerMcp && demo && same(ownerMcp, demo)) {
    return { error: "On Mainnet the owner credential must not be the shared demo token." };
  }
  if (agent && owner && same(agent, owner)) return { error: "The agent and owner credentials are identical; refusing an ambiguous role." };
  for (const [name, v] of [["agent", agent], ["owner", owner]] as const) {
    if (v !== undefined && v.length < 16 && (network === "mainnet" || env("VERCEL"))) return { error: `The ${name} credential is too short.` };
  }
  return { agent, owner };
}

function bearer(header: (name: string) => string | undefined | null): string {
  const raw = header("authorization") ?? "";
  return /^Bearer\s+/i.test(raw) ? raw.replace(/^Bearer\s+/i, "").trim() : "";
}

function context(role: Role, network: SuiNetwork, holder: string): AuthContext {
  const caps: Capability[] = role === "agent" ? [...AGENT_CAPABILITIES] : [...OWNER_CAPABILITIES, ...(network === "testnet" ? DEMO_CAPABILITIES : [])];
  return { role, network, vaultId: env("VAULT_ID") ?? null, capabilities: new Set(caps), ownerSigning: ownerSigningMode(network), holder };
}

/**
 * Resolve the caller's role from its bearer credential. `holder` names the lease holder for the
 * shared demo run (the agent's is fixed; the owner's comes from x-demo-client, or "owner:mcp").
 */
export function resolveAuth(header: (name: string) => string | undefined | null, opts: { ownerHolder?: string } = {}): AuthResult {
  let network: SuiNetwork;
  try {
    network = suiNetwork();
  } catch (err) {
    return { ok: false, status: 503, error: (err as Error).message, code: "config_error" };
  }
  const creds = credentialConfig(network);
  if (creds.error) return { ok: false, status: 503, error: creds.error, code: "credential_config" };
  const given = bearer(header);
  if (given) {
    if (creds.agent && same(given, creds.agent)) return { ok: true, ctx: context("agent", network, "agent:demo") };
    if (creds.owner && same(given, creds.owner)) return { ok: true, ctx: context("owner", network, opts.ownerHolder ?? "owner:mcp") };
    return { ok: false, status: 401, error: "Invalid credential. Send Authorization: Bearer <agent credential> or <owner credential>.", code: "bad_credential" };
  }
  // No credential at all.
  if (!creds.agent && network === "testnet" && !env("VERCEL")) return { ok: true, ctx: context("agent", network, "agent:demo") }; // local Testnet development only
  if (!creds.agent && !creds.owner && (network === "mainnet" || env("VERCEL"))) {
    return { ok: false, status: 503, error: "The agent endpoint is not configured on this deployment.", code: "unconfigured" };
  }
  return { ok: false, status: 401, error: "Missing credential. Send Authorization: Bearer <SISIH_AGENT_TOKEN> (spending agent) or the owner credential (owner assistant).", code: "missing_credential" };
}

export function can(ctx: AuthContext, cap: Capability): boolean {
  return ctx.capabilities.has(cap);
}

export class AuthorityError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/** Re-checked inside every owner handler, independent of which tools were listed. */
export function requireCapability(ctx: AuthContext, cap: Capability): void {
  if (!can(ctx, cap)) throw new AuthorityError(`This credential (${ctx.role}) is not authorized for ${cap}.`);
}
