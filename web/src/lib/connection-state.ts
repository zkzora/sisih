/** Treat unknown/malformed API responses as unavailable, never silently as Testnet. */
export function connectionState(value: unknown) {
  const s = value as { network?: unknown; vault?: { free?: unknown; readAtMs?: unknown }; session?: unknown } | null;
  if (!s || s.network !== "mainnet" || typeof s.vault?.free !== "string" || !/^\d+$/.test(s.vault.free) || !Number.isSafeInteger(s.session) || Number(s.session) < 1) throw new Error("Unrecognized Mainnet connection state");
  return { network: s.network, free: s.vault.free, session: Number(s.session), readAt: typeof s.vault.readAtMs === "number" && Number.isFinite(s.vault.readAtMs) && s.vault.readAtMs > 0 ? new Date(s.vault.readAtMs).toISOString() : null };
}
