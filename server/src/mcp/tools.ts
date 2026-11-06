/**
 * What an external agent may do through MCP, on top of the existing backend. No balances, rules
 * or payments of its own: budget comes from the cached vault (read through Tatum), purchases go
 * through the merchant's real 402 invoice -> submitRequest (policy engine) -> the x402 executor,
 * held requests wait for the owner in the dashboard, and the purchased content is the merchant's
 * stored response.
 *
 * Trust boundary: the agent names a service from list_services and describes its task. Price,
 * recipient, category and URL come from the merchant registry and the merchant's own invoice; the
 * executor re-checks the invoice against the registry before paying.
 */
import { createHash } from "node:crypto";
import { vaultState } from "../chain/vault";
import { acquireLease, currentLease, releaseLease } from "../lib/leases";
import { formatUsdc } from "../lib/env";
import { CATEGORY_LABEL, findMerchant, MERCHANTS, type Merchant } from "../merchants/registry";
import { paymentError, purchaseResult } from "../services/payments";
import { getRequest, requestView, submitRequest } from "../services/requests";
import { currentSession, defaultThreshold, kvRead, kvSet } from "../services/state";
import { fetchInvoice } from "../x402/agentPay";
import { baseUrl } from "../x402/merchants";
import { AGENT_HOLDER, DEMO_RUN_IDLE_MS, DEMO_RUN_LEASE, withActionLock } from "../api/guard";
import { explorerTxUrl } from "../chain/activity";

export const NETWORKS = "Vault and x402 on Sui Testnet (testnet USDC, through Tatum); memory on Walrus Mainnet";
const DEMO_NOTE = "Demo services run by the Sisih team with fixed sample content; payments use testnet USDC.";

export type Outcome = "awaiting_owner_approval" | "processing" | "settled" | "denied" | "blocked" | "failed" | "busy";

export interface PurchaseStatus {
  request_id: string;
  outcome: Outcome;
  paid: boolean;
  message: string;
  next_step: string;
  service: string;
  amount_usdc: string;
  task: string | null;
  reasons: string[];
  decision_code: string;
  owner_dashboard_url: string;
  settlement?: { release_digest: string | null; settle_digest: string | null; verified_via_tatum: boolean; explorer_url: string | null };
  result?: unknown;
  networks: string;
}

type View = ReturnType<typeof requestView>;

const dashboardUrl = (id: string) => `${baseUrl()}/agent?request=${encodeURIComponent(id)}`;

/** Map the existing request state onto the agent-facing outcome. Pure, unit tested. */
export function outcomeFor(v: View, result: unknown | null, failure: string | null = null): Omit<PurchaseStatus, "networks"> {
  const amount = formatUsdc(BigInt(v.amount));
  const base = {
    request_id: v.id,
    service: `${v.merchant} (demo)`,
    amount_usdc: amount,
    task: v.taskContext,
    reasons: v.reasons,
    decision_code: v.code,
    owner_dashboard_url: dashboardUrl(v.id),
  };
  const digests = v.paymentDigests as { step: string; digest: string; verified: boolean }[];
  const release = digests.find((d) => d.step === "release");
  const settle = digests.find((d) => d.step === "x402_settle");
  const settlement = { release_digest: release?.digest ?? null, settle_digest: settle?.digest ?? null, verified_via_tatum: Boolean(settle?.verified), explorer_url: settle ? explorerTxUrl(settle.digest) : null };
  const check = `Call get_request_status with request_id "${v.id}" to check it again; it never starts a payment.`;

  if (v.status === "held") {
    if (v.allowDisabled || v.code === "would_cut_reserve") {
      return { ...base, outcome: "blocked", paid: false, message: `Not paid. ${v.reasons[0] ?? "This purchase would use committed funds."} The vault only pays from free funds, so the owner cannot approve it unless free funds grow.`, next_step: `Tell the user the purchase is blocked by their commitments. Do not retry it with another service to get around the limit. ${check}` };
    }
    return { ...base, outcome: "awaiting_owner_approval", paid: false, message: `Payment has NOT been made. The owner must review this purchase first: ${v.reasons[0] ?? "it needs owner review"}`, next_step: `Ask the owner to open ${dashboardUrl(v.id)} (Agent & requests) and approve or deny. Then call get_request_status with request_id "${v.id}"; do not submit the purchase again.` };
  }
  if (v.status === "denied") return { ...base, outcome: "denied", paid: false, message: "The owner denied this purchase. Nothing was paid.", next_step: "Continue the task without this service, or ask the owner." };
  if (v.status === "auto_denied") {
    const byRule = v.code === "deny_rule";
    return {
      ...base,
      outcome: byRule ? "denied" : "blocked",
      paid: false,
      message: `Nothing was paid. ${v.reasons[0] ?? ""}`.trim(),
      next_step: byRule ? "The owner's remembered preference refuses this service. Continue without it." : "A hard spending limit (vault, caps or agent permission) refuses this purchase. Tell the user; do not retry.",
    };
  }
  // auto_allowed or approved: payment runs or ran through the vault and x402.
  if (v.paymentStatus === "paid") {
    return { ...base, outcome: "settled", paid: true, settlement, result, message: `Paid ${amount} testnet USDC; the x402 settlement was verified through Tatum on Sui Testnet. The purchased content is in "result".`, next_step: "Use the result in your answer and say it is demo service content." };
  }
  if (v.paymentStatus === "failed") {
    return { ...base, outcome: "failed", paid: false, settlement, message: `The payment did not complete: ${failure ?? "see the request in the dashboard"}. No settlement was verified.`, next_step: "Tell the user the purchase failed. Do not retry automatically." };
  }
  return { ...base, outcome: "processing", paid: false, settlement, message: "Approved; the payment is being released and settled. It is not settled until Tatum verifies the settlement.", next_step: `Wait a few seconds, then ${check.charAt(0).toLowerCase()}${check.slice(1)}` };
}

const agentRequestKey = (id: string) => `mcp:request:${id}`;
const idemKey = (key: string) => `mcp:idem:${key}`;

export function serviceView(m: Merchant) {
  return {
    service: m.slug,
    name: `${m.name} (demo)`,
    provides: m.item,
    category: CATEGORY_LABEL[m.category],
    price_usdc: formatUsdc(m.price),
    demo: true,
    note: DEMO_NOTE,
  };
}

export function listServices() {
  return { services: MERCHANTS.map(serviceView), networks: NETWORKS, note: "Prices and recipients come from Sisih's merchant registry and each merchant's x402 invoice, not from the agent." };
}

export async function getBudget() {
  const [v, threshold, session] = await Promise.all([vaultState(), defaultThreshold(), currentSession()]);
  const p = v.policy;
  const now = Date.now();
  const windowOpen = p ? now - p.windowStartMs < 86_400_000 : false;
  const spent = p && windowOpen ? p.spentInWindow : 0n;
  const permission = !p ? "revoked" : p.paused ? "paused" : p.expiresMs <= now ? "expired" : "active";
  return {
    networks: NETWORKS,
    session,
    vault: {
      total_usdc: formatUsdc(v.total),
      committed_usdc: formatUsdc(v.reserved),
      free_usdc: formatUsdc(v.free),
      explanation: "Committed funds are reserved for the owner's bills and savings. The agent can only ever be paid from free funds.",
      read_through_tatum_at: new Date(v.readAtMs).toISOString(),
    },
    agent_permission: p
      ? {
          status: permission,
          max_per_request_usdc: formatUsdc(p.maxPerRequest),
          max_per_day_usdc: formatUsdc(p.maxPerDay),
          spent_in_current_24h_usdc: formatUsdc(spent),
          remaining_today_usdc: formatUsdc(p.maxPerDay > spent ? p.maxPerDay - spent : 0n),
          expires_at: new Date(p.expiresMs).toISOString(),
        }
      : { status: "revoked" },
    owner_preferences: { automatic_approval_up_to_usdc: formatUsdc(threshold), note: "New merchants and amounts above remembered rules wait for the owner." },
  };
}

async function lease(): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
  const l = await acquireLease(DEMO_RUN_LEASE, AGENT_HOLDER, DEMO_RUN_IDLE_MS);
  return l.acquired ? { ok: true } : { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((l.until - Date.now()) / 1000)) };
}

function busy(retryAfterSeconds: number, why: string) {
  return {
    outcome: "busy" as const,
    paid: false,
    message: `${why} Nothing was requested or paid.`,
    retry_after_seconds: retryAfterSeconds,
    next_step: `The live demo is one shared workspace with one run at a time. Wait about ${Math.ceil(retryAfterSeconds / 60)} min and try again, or tell the user.`,
    networks: NETWORKS,
  };
}

export async function statusOf(id: string): Promise<PurchaseStatus> {
  const v = requestView(await getRequest(id));
  const result = v.paymentStatus === "paid" ? await purchaseResult(id) : null;
  const failure = v.paymentStatus === "failed" ? await paymentError(id) : null;
  return { ...outcomeFor(v, result, failure), networks: NETWORKS };
}

export interface PurchaseInput {
  service: string;
  task: string;
  idempotency_key?: string;
}

/**
 * Request a purchase. Idempotent: the same idempotency_key (or, without one, the same service and
 * task in the same session) returns the existing request and never pays twice. Serialized with
 * every other fund-moving action through the shared action mutex.
 */
export async function requestPurchase(input: PurchaseInput) {
  const m = findMerchant(input.service);
  if (!m) throw new AgentInputError(`Unknown service "${input.service}". Call list_services; supported: ${MERCHANTS.map((x) => x.slug).join(", ")}.`);
  const task = input.task.trim();
  if (!task) throw new AgentInputError("Describe the task this purchase is for.");

  const held = await lease();
  if (!held.ok) return busy(held.retryAfterSeconds, "Another visitor is running the shared demo right now.");

  const session = await currentSession();
  const key = createHash("sha256").update(input.idempotency_key?.trim() || `${m.slug}|${task.toLowerCase()}|session-${session}`).digest("hex").slice(0, 32);
  const locked = await withActionLock(async () => {
    const existing = await kvRead(idemKey(key));
    if (existing) return { ...(await statusOf(existing)), duplicate: true, duplicate_note: "Same purchase as before: returned the existing request, nothing new was paid." };
    const invoice = await fetchInvoice(`${baseUrl()}${m.path}`); // the merchant's own 402 invoice
    const view = await submitRequest({
      merchant: m.name,
      taskContext: task.slice(0, 500),
      invoice,
      onCreated: async (id) => {
        await kvSet(idemKey(key), id);
        await kvSet(agentRequestKey(id), JSON.stringify({ at: Date.now(), key }));
      },
    });
    return { ...(await statusOf(view.id)), duplicate: false };
  });
  if (!locked.ok) return busy(locked.retryAfterSeconds, "Another payment in the demo is still being processed.");
  return locked.value;
}

/** Status of one of this agent's requests. Read only: it never starts or retries a payment. */
export async function getRequestStatus(id: string) {
  if (!(await kvRead(agentRequestKey(id)))) throw new AgentInputError(`No request "${id}" was made by this agent. Use the request_id returned by request_purchase.`);
  const current = await currentLease(DEMO_RUN_LEASE);
  if (current?.holder === AGENT_HOLDER) await acquireLease(DEMO_RUN_LEASE, AGENT_HOLDER, DEMO_RUN_IDLE_MS); // keep the run while waiting for the owner
  return statusOf(id);
}

/** Hand the shared demo back so the next visitor or agent can use it. */
export async function endDemoSession() {
  const current = await currentLease(DEMO_RUN_LEASE);
  if (current?.holder !== AGENT_HOLDER) return { ended: false, message: "This agent does not hold the demo right now; nothing to end." };
  await releaseLease(DEMO_RUN_LEASE, AGENT_HOLDER);
  return { ended: true, message: "The shared demo is free for the next visitor." };
}

/** A mistake in what the agent asked for (shown to the model as a tool error it can fix). */
export class AgentInputError extends Error {}
