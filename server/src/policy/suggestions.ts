/**
 * Reserve suggestions. When a usage bill exceeds its target, suggest a new target: the bill
 * rounded up to the next 0.50 USDC, raised to the largest past bill recalled from memory.
 */
import { formatUsdc } from "../lib/env.js";
import { roundUp } from "./composer.js";

export interface SuggestionDraft {
  suggestedTarget: bigint;
  shortfall: bigint;
  reason: string;
}

export function suggestTarget(name: string, target: bigint, bill: bigint, pastBills: bigint[] = []): SuggestionDraft | null {
  if (bill <= target) return null;
  const highest = [bill, ...pastBills].reduce((a, b) => (b > a ? b : a), bill);
  const suggestedTarget = roundUp(highest);
  const shortfall = bill - target;
  const reason =
    `${name}: raise ${formatUsdc(target)} to ${formatUsdc(suggestedTarget)} USDC. ` +
    `Last cycle was ${formatUsdc(shortfall)} short.` +
    (highest > bill ? ` Past bills reached ${formatUsdc(highest)}.` : "");
  return { suggestedTarget, shortfall, reason };
}
