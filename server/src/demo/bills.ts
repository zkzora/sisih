/**
 * Scripted usage-based bills per demo cycle (USDC). Fixed obligations are always billed their
 * target. Cycle 1 Inference API = 6.80 per docs/SPEC.md.
 */
export const BILLS: Record<string, Record<string, string>> = {
  "1": { "Inference API": "6.80" },
  "2": { "Inference API": "6.40" },
  "3": { "Inference API": "7.20" },
  "4": { "Inference API": "6.90" },
  "5": { "Inference API": "6.60" },
};
