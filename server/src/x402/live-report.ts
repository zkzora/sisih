/**
 * ChainScope (demo merchant) sells one live product: a report on the owner's Sisih vault, read
 * from Sui Testnet through Tatum at purchase time. Nothing in it is invented: "observations" are
 * values returned by the chain, "calculated" are arithmetic on those values, and the report says
 * what they do and do not support. If any read fails, no report is produced (the merchant then
 * refuses before settling, so the buyer is not charged for a missing report).
 */
import { readVault } from "../chain/vault";
import { explorerObjectUrl } from "../chain/activity";
import { formatUsdc, suiNetwork } from "../lib/env";
import { referenceGasPrice, suiClient, tatumGrpcHost } from "../lib/tatum";
import { MERCHANTS } from "../merchants/registry";

const pct = (part: bigint, whole: bigint) => (whole > 0n ? Math.round(Number((part * 10_000n) / whole)) / 100 : 0);

export async function liveVaultReport() {
  const t0 = Date.now();
  const { response: info } = await suiClient().ledgerService.getServiceInfo({});
  const vault = await readVault(); // fresh GetObject through Tatum, not the cache
  const gas = await referenceGasPrice();
  const observedAt = info.timestamp ? new Date(Number(info.timestamp.seconds) * 1000 + Math.floor(info.timestamp.nanos / 1e6)).toISOString() : null;
  const p = vault.policy;
  const now = Date.now();
  const windowOpen = p ? now - p.windowStartMs < 86_400_000 : false;
  const spent = p && windowOpen ? p.spentInWindow : 0n;
  const remainingToday = p ? (p.maxPerDay > spent ? p.maxPerDay - spent : 0n) : 0n;
  const spendable = p && !p.paused && p.expiresMs > now ? [vault.free, p.maxPerRequest, remainingToday].reduce((a, b) => (b < a ? b : a)) : 0n;
  const underfunded = vault.obligations.filter((o) => o.reserve < o.target);

  return {
    notice: "Live data: read from Sui Testnet through Tatum when you bought this report. ChainScope is a demo merchant run by the Sisih team. Testnet values, not market data or financial advice.",
    source: {
      network: `sui:${suiNetwork()}`,
      chain_id: info.chainId ?? null,
      rpc: `Tatum Sui gRPC (${tatumGrpcHost()})`,
      checkpoint: info.checkpointHeight !== undefined ? info.checkpointHeight.toString() : null,
      epoch: info.epoch !== undefined ? info.epoch.toString() : null,
      chain_time: observedAt,
      fetched_at: new Date(now).toISOString(),
      fetch_ms: Date.now() - t0,
    },
    observations: {
      vault_object: vault.vaultId,
      vault_contract_version: String(vault.version),
      vault_explorer: explorerObjectUrl(vault.vaultId),
      total_usdc: formatUsdc(vault.total),
      committed_usdc: formatUsdc(vault.reserved),
      free_usdc: formatUsdc(vault.free),
      commitments: vault.obligations.map((o) => ({
        name: o.name,
        target_usdc: formatUsdc(o.target),
        reserved_usdc: formatUsdc(o.reserve),
        cadence: o.cadenceLabel,
        next_due: new Date(o.nextDueMs).toISOString(),
      })),
      agent_permission: p
        ? {
            paused: p.paused,
            max_per_request_usdc: formatUsdc(p.maxPerRequest),
            max_per_day_usdc: formatUsdc(p.maxPerDay),
            spent_in_current_24h_usdc: formatUsdc(spent),
            expires_at: new Date(p.expiresMs).toISOString(),
          }
        : null,
      reference_gas_price_mist: gas.toString(),
    },
    calculated: {
      committed_share_percent: pct(vault.reserved, vault.total),
      free_share_percent: pct(vault.free, vault.total),
      underfunded_commitments: underfunded.map((o) => `${o.name}: ${formatUsdc(o.target - o.reserve)} USDC short`),
      largest_payment_the_agent_can_make_now_usdc: formatUsdc(spendable),
      purchases_affordable_now: MERCHANTS.map((m) => ({ service: m.slug, price_usdc: formatUsdc(m.price), affordable: m.price <= spendable })),
    },
    what_this_supports:
      "How much of the vault is committed, whether each commitment is fully reserved, and the largest payment the agent can make right now (the smallest of free funds, the per-request cap and what is left of the 24-hour cap). It does not say anything about token prices, market conditions or other wallets.",
    limits_of_this_report: [
      "A snapshot at the checkpoint above; balances change with every payment.",
      "Policy decisions (owner preferences, held requests) live in Sisih, not on chain, and are not part of this report.",
    ],
  };
}
