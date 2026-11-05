/** "What changed since last session": rules learned and reserves changed, from live data. */
import type { DemoState } from "./types";
import { money } from "./engine";

export interface Change {
  label: string;
  before: string;
  after: string;
  source?: string;
}

export function whatChanged(state: DemoState): Change[] {
  if (state.session <= 1) return [];
  const out: Change[] = [];
  for (const r of state.rules.filter((r) => r.active)) {
    out.push({
      label: `${r.merchant} ${r.category.toLowerCase()} up to ${money(r.maxAmount)} USDC`,
      before: r.action === "allow" ? "Held for review" : "Asked each time",
      after: r.action === "allow" ? "Automatic (remembered rule)" : "Denied, or held with your earlier denial",
      source: r.origin === "walrus" ? "Rule rebuilt from Walrus Memory" : "Rule saved this session",
    });
  }
  for (const m of state.memories.filter((m) => m.kind === "Reserve updated" && m.text.includes("approved"))) {
    const match = m.text.match(/^(.*) reserve ([\d.]+) to ([\d.]+) USDC/);
    if (match) out.push({ label: `${match[1]} reserve`, before: `${match[2]} USDC`, after: `${match[3]} USDC`, source: "Reserve change memory" });
  }
  return out;
}
