/**
 * Memory text format on Walrus: a readable sentence plus a tagged JSON payload.
 *   [sisih:v1:rule] Always allow search from SearchBox up to 1.50 USDC until 2026-12-05 {"ruleId":"..."}
 * Names only (merchants, obligations); never keys, secrets or third-party addresses.
 */
export const MEMORY_TYPES = [
  "decision",
  "rule",
  "obligation_outcome",
  "reserve_change",
  "merchant_note",
  "rule_disabled",
  "session_summary",
] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

export interface RulePayload {
  ruleId: string;
  merchant: string;
  category: string;
  maxAmount: string; // base units
  action: "allow" | "deny";
  expiresMs: number;
  requestId?: string;
}
export interface RuleDisabledPayload {
  ruleId: string;
}

const TAG = /^\[sisih:v1:([a-z_]+)\] ([\s\S]*?)\s*(\{[\s\S]*\})\s*$/;

/** bigint-safe JSON (amounts as base-unit strings). */
export function toJson(payload: unknown): string {
  return JSON.stringify(payload, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
}

export function serializeMemory(type: MemoryType, sentence: string, payload: object): string {
  const clean = sentence.replace(/\s+/g, " ").trim().replace(/[{}]/g, "");
  return `[sisih:v1:${type}] ${clean} ${toJson(payload)}`;
}

export interface ParsedMemory {
  type: MemoryType;
  sentence: string;
  payload: Record<string, unknown>;
}

export function parseMemory(text: string): ParsedMemory | null {
  const m = TAG.exec(text);
  if (!m) return null;
  const type = m[1] as MemoryType;
  if (!MEMORY_TYPES.includes(type)) return null;
  try {
    const payload = JSON.parse(m[3]!) as Record<string, unknown>;
    return { type, sentence: m[2]!, payload };
  } catch {
    return null;
  }
}
