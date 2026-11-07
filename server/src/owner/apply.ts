/**
 * The owner's effects, implemented once and shared by every consumer: owner MCP tools, the owner
 * HTTP route (CLI), the legacy Testnet routes and signed owner intents. No second engine: these
 * call the same request, rule, suggestion, session and vault functions the rest of Sisih uses.
 */
import { CLOCK_ID, KIND, PRIORITY, packageId, usdc, usdcType, vaultId } from "../chain/sisih";
import { recordTx, vaultSharedVersion, vaultState } from "../chain/vault";
import { env, formatUsdc, suiNetwork } from "../lib/env";
import { address } from "../lib/wallets";
import { remember } from "../memory/memwal";
import { findMerchant, MERCHANTS } from "../merchants/registry";
import { acceptSuggestion, listSuggestions, onVaultEvents, rejectSuggestion } from "../services/chainEvents";
import { ApiError, createOwnerRule, ownerDecision, type OwnerDecision } from "../services/requests";
import { startSession } from "../services/sessions";
import { addLocalRule, cachedRule, currentSession, defaultThreshold, kvSet, setRuleActive } from "../services/state";
import type { OwnerCallArgs, OwnerTxTarget } from "./tx";

void CLOCK_ID;

// --- normalized owner actions (base units, validated) -------------------------------------

export type OwnerAction =
  | { action: "decide_request"; request_id: string; decision: "approve" | "deny"; remember: boolean; max_amount?: string; days?: number }
  | { action: "add_preference"; merchant: string; rule_action: "allow" | "deny"; max_amount: string; days: number }
  | { action: "set_preference_enabled"; rule_id: string; enabled: boolean }
  | { action: "set_threshold"; max_amount: string }
  | { action: "reject_suggestion"; suggestion_id: string }
  | { action: "accept_suggestion"; suggestion_id: string }
  | { action: "set_reserve"; commitment_id: number; amount: string }
  | { action: "add_commitment"; name: string; payee: string; amount: string; recurring: boolean; usage: boolean; important: boolean; cadence: string }
  | { action: "set_limits"; per_request: string; per_day: string; days: number }
  | { action: "set_agent_permission"; state: "pause" | "resume" | "revoke" }
  | { action: "start_next_session" };

export type OwnerActionName = OwnerAction["action"];
export const ONCHAIN_ACTIONS: ReadonlySet<OwnerActionName> = new Set(["accept_suggestion", "set_reserve", "add_commitment", "set_limits", "set_agent_permission"]);
export const isOnchain = (a: OwnerAction) => ONCHAIN_ACTIONS.has(a.action);

/** Emergency actions: allowed even while another visitor holds the shared demo run. */
export const isEmergency = (a: OwnerAction) => a.action === "set_agent_permission" && a.state !== "resume";

export const OWNER_AMOUNT_MAX = usdc("100.00");
export const LIMIT_MAX = usdc("50.00");

/** "1.50" -> "1500000", positive, at most 6 decimals, at most `max`. */
export function usdcInput(v: unknown, what: string, max: bigint = OWNER_AMOUNT_MAX): string {
  if (typeof v !== "string" || !/^\d+(\.\d{1,6})?$/.test(v.trim())) throw new ApiError(400, `${what} must be a USDC amount such as 1.50`, "bad_amount");
  const base = usdc(v.trim());
  if (base <= 0n || base > max) throw new ApiError(400, `${what} must be more than 0 and at most ${formatUsdc(max)} USDC`, "bad_amount");
  return base.toString();
}

const days = (v: unknown, def = 30) => {
  const n = v === undefined ? def : Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 90) throw new ApiError(400, "days must be a whole number from 1 to 90", "bad_days");
  return n;
};
const id = (v: unknown, what: string) => {
  if (typeof v !== "string" || !/^[A-Za-z0-9-]{3,64}$/.test(v)) throw new ApiError(400, `${what} is not a valid id`, "bad_id");
  return v;
};

/** Validate and normalize raw input (MCP arguments or HTTP JSON) into an OwnerAction. */
export function normalizeOwnerAction(action: string, p: Record<string, unknown>): OwnerAction {
  switch (action) {
    case "decide_request": {
      if (p.decision !== "approve" && p.decision !== "deny") throw new ApiError(400, "decision must be approve or deny", "bad_decision");
      const remember = p.remember === true;
      return {
        action,
        request_id: id(p.request_id, "request_id"),
        decision: p.decision,
        remember,
        ...(remember && p.max_usdc !== undefined ? { max_amount: usdcInput(p.max_usdc, "max_usdc") } : {}),
        ...(remember && p.days !== undefined ? { days: days(p.days) } : {}),
      };
    }
    case "add_preference": {
      const m = findMerchant(String(p.merchant ?? ""));
      if (!m) throw new ApiError(400, `Unknown merchant ${String(p.merchant)}. Services: ${MERCHANTS.map((x) => x.slug).join(", ")}.`, "bad_merchant");
      if (p.action !== "allow" && p.action !== "deny") throw new ApiError(400, "action must be allow or deny", "bad_rule_action");
      return { action, merchant: m.name, rule_action: p.action, max_amount: usdcInput(p.max_usdc, "max_usdc"), days: days(p.days) };
    }
    case "set_preference_enabled":
      if (typeof p.enabled !== "boolean") throw new ApiError(400, "enabled must be true or false", "bad_enabled");
      return { action, rule_id: id(p.rule_id, "rule_id"), enabled: p.enabled };
    case "set_threshold":
      return { action, max_amount: usdcInput(p.max_usdc, "max_usdc", LIMIT_MAX) };
    case "reject_suggestion":
    case "accept_suggestion":
      return { action, suggestion_id: id(p.suggestion_id, "suggestion_id") };
    case "set_reserve": {
      const cid = Number(p.commitment_id);
      if (!Number.isInteger(cid) || cid < 0) throw new ApiError(400, "commitment_id must be a commitment id from owner_status", "bad_id");
      return { action, commitment_id: cid, amount: usdcInput(p.amount_usdc, "amount_usdc") };
    }
    case "add_commitment": {
      const name = String(p.name ?? "").trim();
      if (!/^[A-Za-z0-9 .,'&()-]{2,40}$/.test(name)) throw new ApiError(400, "name must be 2 to 40 letters, digits, spaces or simple punctuation", "bad_name");
      const payee = String(p.payee ?? "");
      if (!/^0x[0-9a-fA-F]{64}$/.test(payee)) throw new ApiError(400, "payee must be a full Sui address (0x + 64 hex)", "bad_payee");
      const recurring = p.recurring !== false;
      const cadence = String(p.cadence ?? (recurring ? "Monthly" : "One-time")).slice(0, 20);
      if (!/^[A-Za-z -]{3,20}$/.test(cadence)) throw new ApiError(400, "cadence must be a short label such as Monthly", "bad_cadence");
      return { action, name, payee: payee.toLowerCase(), amount: usdcInput(p.amount_usdc, "amount_usdc"), recurring, usage: p.usage === true, important: p.important === true, cadence };
    }
    case "set_limits": {
      const perRequest = usdcInput(p.per_request_usdc, "per_request_usdc", LIMIT_MAX);
      const perDay = usdcInput(p.per_day_usdc, "per_day_usdc", LIMIT_MAX);
      if (BigInt(perRequest) > BigInt(perDay)) throw new ApiError(400, "per_request_usdc must not exceed per_day_usdc", "bad_limits");
      return { action, per_request: perRequest, per_day: perDay, days: days(p.days) };
    }
    case "set_agent_permission":
      if (p.state !== "pause" && p.state !== "resume" && p.state !== "revoke") throw new ApiError(400, "state must be pause, resume or revoke", "bad_state");
      return { action, state: p.state };
    case "start_next_session":
      return { action };
    default:
      throw new ApiError(400, `Unknown owner action ${action}`, "bad_action");
  }
}

/** One line a human (or the owner's local signer) can read before authorizing. */
export function describeOwnerAction(a: OwnerAction): string {
  const u = (s: string) => `${formatUsdc(BigInt(s))} USDC`;
  switch (a.action) {
    case "decide_request":
      return `${a.decision === "approve" ? "Approve" : "Deny"} request ${a.request_id}${a.remember ? " and remember it as a preference" : ""}${a.max_amount ? ` (up to ${u(a.max_amount)})` : ""}`;
    case "add_preference":
      return `Remember: always ${a.rule_action} ${a.merchant} up to ${u(a.max_amount)} for ${a.days} days`;
    case "set_preference_enabled":
      return `${a.enabled ? "Enable" : "Disable"} preference ${a.rule_id}`;
    case "set_threshold":
      return `Automatic approval threshold ${u(a.max_amount)}`;
    case "reject_suggestion":
      return `Reject reserve suggestion ${a.suggestion_id}`;
    case "accept_suggestion":
      return `Accept reserve suggestion ${a.suggestion_id}`;
    case "set_reserve":
      return `Set commitment ${a.commitment_id} reserve to ${u(a.amount)}`;
    case "add_commitment":
      return `Add commitment ${a.name}: ${u(a.amount)} to ${a.payee} (${a.cadence})`;
    case "set_limits":
      return `Agent limits ${u(a.per_request)} per request, ${u(a.per_day)} per day, for ${a.days} days`;
    case "set_agent_permission":
      return `${a.state === "pause" ? "Pause" : a.state === "resume" ? "Resume" : "Revoke"} the agent's spending permission`;
    case "start_next_session":
      return "Start the next session (rules rebuilt from Walrus recall)";
  }
}

// --- shared offchain effects ---------------------------------------------------------------

export async function addPreference(merchant: string, action: "allow" | "deny", maxAmount: bigint, nDays: number) {
  const m = findMerchant(merchant);
  if (!m) throw new ApiError(400, `Unknown merchant ${merchant}`);
  const created = await createOwnerRule(
    { merchant: m.name, category: m.category, maxAmount, action, expiresMs: Date.now() + nDays * 86_400_000 },
    { session: await currentSession() },
  );
  return { ruleId: created.ruleId, memoryId: created.memoryId, sentence: created.sentence };
}

/** Disable writes a rule_disabled memory; enabling writes the rule again under a new id (Walrus memories are never deleted). */
export async function setPreferenceEnabled(ruleId: string, active: boolean) {
  const rule = await cachedRule(ruleId);
  if (!rule) throw new ApiError(404, `No rule ${ruleId}`, "not_found");
  if (active === rule.active) return { ruleId, active, changed: false };
  const session = await currentSession();
  if (!active) {
    const mem = await remember("rule_disabled", `Rule disabled: ${rule.sentence}`, { ruleId }, { session });
    await setRuleActive(ruleId, false);
    return { ruleId, active: false, changed: true, memoryId: mem.id };
  }
  const mem = await remember(
    "rule",
    rule.sentence,
    { ruleId: `${ruleId}-r`, merchant: rule.merchant, category: rule.category, maxAmount: rule.maxAmount.toString(), action: rule.action, expiresMs: rule.expiresMs },
    { session },
  );
  const copy = await addLocalRule(
    { merchant: rule.merchant, category: rule.category, maxAmount: rule.maxAmount, action: rule.action, expiresMs: rule.expiresMs, sentence: rule.sentence },
    mem.id,
    `${ruleId}-r`,
  );
  return { ruleId: copy.id, active: true, changed: true, memoryId: mem.id };
}

/** Apply an offchain owner action (no vault transaction). */
export async function applyOffchain(a: OwnerAction): Promise<unknown> {
  switch (a.action) {
    case "decide_request": {
      const kind: OwnerDecision = a.decision === "approve" ? (a.remember ? "approve_and_remember" : "approve_once") : a.remember ? "deny_and_remember" : "deny";
      const rule = a.remember
        ? { ...(a.max_amount ? { maxAmount: a.max_amount } : {}), ...(a.days ? { expiresMs: Date.now() + a.days * 86_400_000 } : {}) }
        : undefined;
      return ownerDecision(a.request_id, kind, rule);
    }
    case "add_preference":
      return addPreference(a.merchant, a.rule_action, BigInt(a.max_amount), a.days);
    case "set_preference_enabled":
      return setPreferenceEnabled(a.rule_id, a.enabled);
    case "set_threshold":
      await kvSet("default_threshold", a.max_amount);
      return { defaultThreshold: (await defaultThreshold()).toString() };
    case "reject_suggestion":
      return rejectSuggestion(a.suggestion_id);
    case "start_next_session":
      return startSession();
    default:
      throw new ApiError(400, `${a.action} changes the vault and needs an onchain owner transaction`, "onchain_action");
  }
}

// --- onchain owner actions -----------------------------------------------------------------

const DAY = 86_400_000n;
/** Commitment cycle for owner-signed commitments (the Testnet demo uses DEMO_CYCLE_MS instead). */
export function cadenceCycleMs(cadence: string, recurring: boolean): bigint {
  if (!recurring) return 0n;
  const c = cadence.toLowerCase();
  if (c.startsWith("week")) return 7n * DAY;
  if (c.startsWith("year") || c.startsWith("annual")) return 365n * DAY;
  return 30n * DAY;
}

/** The validated config that onchain owner transactions are built against (this process's env). */
export async function ownerTxTarget(): Promise<OwnerTxTarget> {
  return {
    network: suiNetwork(),
    packageId: packageId(),
    vaultId: vaultId(),
    vaultSharedVersion: await vaultSharedVersion(),
    usdcType: usdcType(),
    ownerAddress: address("owner"),
  };
}

/** Resolve an onchain action into the exact vault call, from current state. */
export async function resolveOnchainCall(a: OwnerAction, nowMs = Date.now()): Promise<OwnerCallArgs> {
  switch (a.action) {
    case "accept_suggestion": {
      const s = (await listSuggestions()).find((x) => x.id === a.suggestion_id);
      if (!s) throw new ApiError(404, `No suggestion ${a.suggestion_id}`, "not_found");
      if (s.status !== "open") throw new ApiError(409, `Suggestion is ${s.status}`, "not_open");
      return { call: "set_obligation_target", obligation_id: String(s.obligationId), target: String(s.suggestedTarget) };
    }
    case "set_reserve": {
      const o = (await vaultState()).obligations.find((x) => x.id === a.commitment_id);
      if (!o) throw new ApiError(404, `No commitment with id ${a.commitment_id}`, "not_found");
      return { call: "set_obligation_target", obligation_id: String(o.id), target: a.amount };
    }
    case "add_commitment": {
      const cycle = cadenceCycleMs(a.cadence, a.recurring);
      return {
        call: "add_obligation",
        name: a.name,
        payee: a.payee,
        target: a.amount,
        kind: a.usage ? KIND.usage : KIND.fixed,
        cycle_ms: cycle.toString(),
        first_due_ms: (BigInt(nowMs) + (cycle || 30n * DAY)).toString(),
        priority: a.important ? PRIORITY.important : PRIORITY.must,
        cadence: a.cadence,
      };
    }
    case "set_limits":
      return { call: "set_agent_policy", agent: address("agent"), max_per_request: a.per_request, max_per_day: a.per_day, expires_ms: (BigInt(nowMs) + BigInt(a.days) * DAY).toString() };
    case "set_agent_permission":
      return { call: a.state === "pause" ? "pause_agent" : a.state === "resume" ? "resume_agent" : "revoke_agent" };
    default:
      throw new ApiError(400, `${a.action} is not an onchain action`, "offchain_action");
  }
}

/** After an owner-signed vault transaction landed: prove it through Tatum and run the same follow-up as any vault event. */
export async function afterOnchain(a: OwnerAction, digest: string, label: string) {
  if (a.action === "accept_suggestion") return acceptSuggestion(a.suggestion_id, digest, "owner");
  const rec = await recordTx(digest, { source: "owner", label });
  await onVaultEvents(rec);
  return { digest, verification: rec.status };
}

/** Map an onchain action onto the labeled Testnet demo-owner signer (body in base units). */
export function demoOwnerBodyFor(a: OwnerAction): { action: string; body: Record<string, unknown> } {
  switch (a.action) {
    case "accept_suggestion":
      return { action: "accept_suggestion", body: { suggestionId: a.suggestion_id } };
    case "set_reserve":
      return { action: "set_reserve", body: { obligationId: a.commitment_id, amount: a.amount } };
    case "add_commitment":
      return {
        action: "add_commitment",
        body: { name: a.name, payee: a.payee, amount: a.amount, recurring: a.recurring, kind: a.usage ? "usage" : "fixed", priority: a.important ? "important" : "must", cadence: a.cadence },
      };
    case "set_limits":
      return { action: "set_limits", body: { maxPerRequest: a.per_request, maxPerDay: a.per_day, days: a.days } };
    case "set_agent_permission":
      return { action: a.state === "pause" ? "pause_agent" : a.state === "resume" ? "resume_agent" : "revoke_agent", body: {} };
    default:
      throw new ApiError(400, `${a.action} is not an onchain action`, "offchain_action");
  }
}

void env;
