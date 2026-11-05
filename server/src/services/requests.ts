/**
 * Agent payment requests: decide from caches, persist, notify, remember, pay.
 * The decision never waits on Walrus; recall runs in parallel and is attached when it lands.
 */
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { cachedVault, vaultState } from "../chain/vault.js";
import { db, schema } from "../db/index.js";
import type { Category, PaymentRequestInput } from "../domain/types.js";
import { jsonSafe, publish } from "../lib/bus.js";
import { formatUsdc } from "../lib/env.js";
import { recall, recallQueryFor, remember } from "../memory/memwal.js";
import { findMerchant, CATEGORY_LABEL } from "../merchants/registry.js";
import { draftRule, ruleSentence, type RuleFields } from "../policy/composer.js";
import { decide, hardLimit, type EngineResult } from "../policy/engine.js";
import { paymentExecutor } from "./payments.js";
import { addLocalRule, cachedRules, currentSession, defaultThreshold, knownMerchants, kvSet, markRulesUsed } from "./state.js";

export class ApiError extends Error {
  constructor(public status: 400 | 404 | 409, message: string, public code = "bad_request") {
    super(message);
  }
}

type RequestRow = typeof schema.requests.$inferSelect;

export type RequestStatus = "auto_allowed" | "auto_denied" | "held" | "approved" | "denied";

export function requestView(r: RequestRow) {
  return {
    id: r.id,
    session: r.session,
    merchant: r.merchant,
    merchantDemo: true,
    item: r.item,
    category: r.category,
    amount: r.amount,
    taskContext: r.taskContext,
    action: r.action,
    code: r.code,
    status: r.status as RequestStatus,
    automatic: r.status === "auto_allowed" || r.status === "auto_denied",
    reasons: JSON.parse(r.reasons) as string[],
    cutsReserveBy: r.cutsReserveBy,
    allowDisabled: r.allowDisabled,
    matchedRuleIds: JSON.parse(r.matchedRuleIds) as string[],
    simulation: JSON.parse(r.simulation),
    recall: r.recallResults
      ? { query: r.recallQuery, ms: r.recallMs, results: JSON.parse(r.recallResults) }
      : r.recallError
        ? { query: r.recallQuery, ms: r.recallMs, error: r.recallError, results: [] }
        : { query: r.recallQuery, pending: true, results: [] },
    paymentStatus: r.paymentStatus,
    paymentDigests: r.paymentDigests ? JSON.parse(r.paymentDigests) : [],
    createdAt: r.createdAt,
    decidedAt: r.decidedAt,
  };
}

export function getRequest(id: string): RequestRow {
  const r = db().select().from(schema.requests).where(eq(schema.requests.id, id)).get();
  if (!r) throw new ApiError(404, `No request ${id}`, "not_found");
  return r;
}

export function listRequests(limit = 200): RequestRow[] {
  return db().select().from(schema.requests).orderBy(desc(schema.requests.createdAt)).limit(limit).all();
}

function statusFor(result: EngineResult): RequestStatus {
  return result.action === "auto_allow" ? "auto_allowed" : result.action === "auto_deny" ? "auto_denied" : "held";
}

function decisionSentence(r: RequestRow, decision: string, by: "automatically" | "by the owner", reason: string): string {
  return `${r.merchant} (demo) ${CATEGORY_LABEL[r.category as Category].toLowerCase()} "${r.item}" ${formatUsdc(BigInt(r.amount))} USDC: ${decision} ${by}. ${reason}`;
}

function writeDecisionMemory(r: RequestRow, kind: string, decision: string, by: "automatically" | "by the owner", reason: string, ruleId?: string) {
  return remember(
    "decision",
    decisionSentence(r, decision, by, reason),
    { requestId: r.id, merchant: r.merchant, category: r.category, amount: r.amount, decision: kind, by: by === "automatically" ? "auto" : "owner", code: r.code, session: r.session, ruleId: ruleId ?? null },
    { session: r.session, usedIn: [r.id] },
  );
}

/** Kick off recall for a request without blocking anything; attach results when they arrive. */
function attachRecall(id: string, req: PaymentRequestInput): void {
  const query = recallQueryFor(req);
  db().update(schema.requests).set({ recallQuery: query }).where(eq(schema.requests.id, id)).run();
  const t0 = Date.now();
  recall(query, 5)
    .then((res) => {
      db().update(schema.requests).set({ recallResults: JSON.stringify(res.results), recallMs: res.ms }).where(eq(schema.requests.id, id)).run();
      kvSet("last_recall", JSON.stringify({ requestId: id, query, ms: res.ms, results: res.results, at: Date.now() }));
      publish("request.recall", { id, query, ms: res.ms, results: res.results });
    })
    .catch((err) => {
      const message = (err as Error).message.slice(0, 200);
      db().update(schema.requests).set({ recallError: message, recallMs: Date.now() - t0 }).where(eq(schema.requests.id, id)).run();
      publish("request.recall_failed", { id, error: message });
    });
}

export interface SubmitInput {
  merchant: string;
  amount?: string; // base units; defaults to the merchant's listed price
  item?: string;
  taskContext?: string;
}

export async function submitRequest(input: SubmitInput) {
  const m = findMerchant(input.merchant);
  if (!m) throw new ApiError(400, `Unknown merchant ${input.merchant}. Demo merchants: DataMart, SearchBox, ReportLab.`);
  const amount = input.amount !== undefined ? BigInt(input.amount) : m.price;
  if (amount <= 0n) throw new ApiError(400, "Amount must be positive");
  const req: PaymentRequestInput = { merchant: m.name, item: input.item ?? m.item, category: m.category, amount, taskContext: input.taskContext };

  const vault = cachedVault() ?? (await vaultState());
  const nowMs = Date.now();
  const result = decide({ request: req, vault, rules: cachedRules(), knownMerchants: knownMerchants(), defaults: { autoAllowUpTo: defaultThreshold() }, nowMs });

  const id = `req-${randomUUID().slice(0, 12)}`;
  const session = currentSession();
  const status = statusFor(result);
  db().insert(schema.requests)
    .values({
      id,
      session,
      merchant: req.merchant,
      item: req.item,
      category: req.category,
      amount: amount.toString(),
      taskContext: req.taskContext ?? null,
      action: result.action,
      code: result.code,
      status,
      reasons: JSON.stringify(result.reasons),
      cutsReserveBy: result.cutsReserveBy.toString(),
      allowDisabled: result.allowDisabled,
      matchedRuleIds: JSON.stringify(result.matchedRuleIds),
      simulation: JSON.stringify(jsonSafe(result.simulation)),
      paymentStatus: "none",
      decidedAt: result.action === "hold" ? null : nowMs,
      createdAt: nowMs,
    })
    .run();
  attachRecall(id, req); // parallel, never awaited

  const row = getRequest(id);
  publish("request.created", requestView(row));

  if (result.action !== "hold") {
    db().insert(schema.decisions).values({ requestId: id, kind: result.action, ruleId: result.matchedRuleIds[0] ?? null, at: nowMs }).run();
    markRulesUsed(result.matchedRuleIds);
    writeDecisionMemory(row, result.action, result.action === "auto_allow" ? "approved" : "denied", "automatically", result.reasons[0] ?? "", result.matchedRuleIds[0]);
    if (result.action === "auto_allow") await paymentExecutor().execute({ requestId: id, merchant: req.merchant, amount });
  }
  return requestView(getRequest(id));
}

export type OwnerDecision = "approve_once" | "approve_and_remember" | "deny" | "deny_and_remember";

export interface RuleInput {
  merchant?: string;
  category?: Category;
  maxAmount?: string;
  action?: "allow" | "deny";
  expiresMs?: number;
}

function rowInput(r: RequestRow): PaymentRequestInput {
  return { merchant: r.merchant, item: r.item, category: r.category as Category, amount: BigInt(r.amount), taskContext: r.taskContext ?? undefined };
}

/** Prefilled rule fields + sentence for the composer. */
export function ruleDraft(id: string, action?: "allow" | "deny") {
  const r = getRequest(id);
  const act = action ?? (r.code === "would_cut_reserve" ? "deny" : "allow");
  const fields = draftRule(rowInput(r), act, Date.now());
  return { ...fields, maxAmount: fields.maxAmount.toString(), sentence: ruleSentence(fields) };
}

export async function ownerDecision(id: string, kind: OwnerDecision, ruleInput?: RuleInput) {
  const r = getRequest(id);
  if (r.status !== "held") throw new ApiError(409, `Request is ${r.status}, not held`, "not_held");
  const approve = kind === "approve_once" || kind === "approve_and_remember";
  const nowMs = Date.now();

  if (approve) {
    // Re-check hard limits against the current cache: reserves are locked by the contract.
    const vault = cachedVault() ?? (await vaultState());
    const blocked = hardLimit(vault, BigInt(r.amount), nowMs);
    if (blocked) throw new ApiError(409, blocked.reason, blocked.code === "would_cut_reserve" ? "reserves_locked" : blocked.code);
  }

  let ruleId: string | undefined;
  let ruleMemoryId: string | undefined;
  if (kind === "approve_and_remember" || kind === "deny_and_remember") {
    const draft = draftRule(rowInput(r), approve ? "allow" : "deny", nowMs);
    const fields: RuleFields = {
      merchant: ruleInput?.merchant ?? draft.merchant,
      category: ruleInput?.category ?? draft.category,
      maxAmount: ruleInput?.maxAmount !== undefined ? BigInt(ruleInput.maxAmount) : draft.maxAmount,
      action: ruleInput?.action ?? draft.action,
      expiresMs: ruleInput?.expiresMs ?? draft.expiresMs,
    };
    if (!findMerchant(fields.merchant)) throw new ApiError(400, `Unknown merchant ${fields.merchant}`);
    if (fields.maxAmount <= 0n) throw new ApiError(400, "Rule max amount must be positive");
    const sentence = ruleSentence(fields);
    ruleId = `rule-${randomUUID().slice(0, 8)}`;
    const mem = remember(
      "rule",
      sentence,
      { ruleId, merchant: fields.merchant, category: fields.category, maxAmount: fields.maxAmount.toString(), action: fields.action, expiresMs: fields.expiresMs, requestId: r.id },
      { session: r.session, usedIn: [r.id] },
    );
    ruleMemoryId = mem.id;
    const rule = addLocalRule({ ...fields, sentence }, mem.id, ruleId); // applies immediately from the local cache
    publish("rule.created", jsonSafe(rule));
  }

  db().update(schema.requests).set({ status: approve ? "approved" : "denied", decidedAt: nowMs }).where(eq(schema.requests.id, id)).run();
  db().insert(schema.decisions).values({ requestId: id, kind, ruleId: ruleId ?? null, memoryId: ruleMemoryId ?? null, at: nowMs }).run();
  const updated = getRequest(id);
  writeDecisionMemory(updated, kind, approve ? "approved" : "denied", "by the owner", JSON.parse(r.reasons)[0] ?? "", ruleId);
  publish("request.updated", requestView(updated));
  if (approve) await paymentExecutor().execute({ requestId: id, merchant: r.merchant, amount: BigInt(r.amount) });
  return { request: requestView(getRequest(id)), ruleId: ruleId ?? null, ruleMemoryId: ruleMemoryId ?? null };
}
