import { env, isMainnet } from "../lib/env";
import type { Capability } from "../auth/context";

export const mainnetReadOnly = () => isMainnet() && env("MAINNET_READ_ONLY") === "true";
export function readOnlyCapability(capability: Capability): boolean {
  return ["budget.read", "services.read", "purchase.status", "owner.read", "session.end"].includes(capability);
}
export function assertNoPublishedSigners(): void {
  if (!mainnetReadOnly()) return;
  for (const role of ["OWNER", "OPERATOR", "AGENT", "FACILITATOR"]) if (env(`${role}_PRIVATE_KEY`)) throw new Error(`Read-only Mainnet publication must not hold ${role}_PRIVATE_KEY`);
}
