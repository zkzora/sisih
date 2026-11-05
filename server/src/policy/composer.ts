/**
 * Rule composer. No LLM: structured fields are prefilled from the request, and the sentence
 * is generated from those fields, so the rule the owner sees is exactly the rule applied.
 */
import { formatUsdc } from "../lib/env.js";
import type { Category, PaymentRequestInput } from "../domain/types.js";
import { CATEGORY_LABEL } from "../merchants/registry.js";

export const RULE_STEP = 500_000n; // round max amounts up to the next 0.50 USDC
export const DEFAULT_RULE_DAYS = 30;

export interface RuleFields {
  merchant: string;
  category: Category;
  maxAmount: bigint;
  action: "allow" | "deny";
  expiresMs: number;
}

/** Round up to the next multiple of `step` (an exact multiple stays as is). */
export function roundUp(amount: bigint, step = RULE_STEP): bigint {
  if (amount <= 0n) return step;
  return ((amount + step - 1n) / step) * step;
}

export function draftRule(req: PaymentRequestInput, action: "allow" | "deny", nowMs: number): RuleFields {
  return {
    merchant: req.merchant,
    category: req.category,
    maxAmount: roundUp(req.amount),
    action,
    expiresMs: nowMs + DEFAULT_RULE_DAYS * 86_400_000,
  };
}

export function ruleSentence(r: RuleFields): string {
  const what = CATEGORY_LABEL[r.category].toLowerCase();
  const until = new Date(r.expiresMs).toISOString().slice(0, 10);
  return r.action === "allow"
    ? `Always allow ${what} from ${r.merchant} up to ${formatUsdc(r.maxAmount)} USDC until ${until}`
    : `Always deny ${what} from ${r.merchant} up to ${formatUsdc(r.maxAmount)} USDC until ${until}`;
}
