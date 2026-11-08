/**
 * The owner's local signing helper (used by `pnpm sisih sign <intent-id> --yes`).
 *
 * It runs on the owner's machine, with the owner's configuration selected by SISIH_ENV_FILE (for
 * Mainnet: .env.mainnet,.env.mainnet.deployment). The owner key (OWNER_PRIVATE_KEY in that local
 * file) never leaves this process, and the server never sees it.
 *
 * Before signing it checks the intent against its OWN config:
 * - network, package, vault, asset and owner address;
 * - expiry;
 * - for permissions, the agent address;
 * - amounts within the same bounds the server uses.
 * It then builds the vault transaction itself, with gas price and budget read through Tatum, capped
 * at the intent's gas cap. It never signs transaction bytes that came from the server.
 */
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { normalizeSuiAddress, toBase64 } from "@mysten/sui/utils";
import { buildOwnerCall, type OwnerCallArgs, type OwnerTxTarget } from "../owner/tx";
import { loadMainnetManifest, type MainnetManifest } from "../mainnet/manifest";

export interface IntentForSigning {
  id: string;
  kind: "onchain" | "offchain";
  status: string;
  summary: string;
  action: Record<string, unknown>;
  call: OwnerCallArgs | null;
  target: OwnerTxTarget;
  gas_cap_mist: string;
  nonce: string;
  expires_at: number;
}

export interface LocalOwnerConfig {
  network: "testnet" | "mainnet";
  packageId: string;
  vaultId: string;
  usdcType: string;
  agentAddress: string | null;
  proof?: MainnetManifest;
}

export interface OwnerSigner {
  address(): string;
  config(): LocalOwnerConfig;
  signText(text: string): Promise<string>;
  /** Build the transaction for this call locally, set gas through Tatum, sign. */
  signCall(target: OwnerTxTarget, call: OwnerCallArgs, gasCapMist: bigint): Promise<{ tx_bytes: string; signature: string }>;
}

const MAX_USDC = 100_000_000n; // same bound as the server (owner/apply.ts)

/** Every mismatch between the intent and the owner's own config, empty when it may be signed. */
export function checkIntent(i: IntentForSigning, signerAddress: string, cfg: LocalOwnerConfig, nowMs = Date.now()): string[] {
  const problems: string[] = [];
  const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  if (i.status !== "pending") problems.push(`intent is ${i.status}, not pending`);
  if (nowMs > i.expires_at) problems.push("intent has expired");
  if (i.target.network !== cfg.network) problems.push(`intent network sui:${i.target.network} differs from local sui:${cfg.network}`);
  if (!eq(i.target.packageId, cfg.packageId)) problems.push("package differs from local SISIH_PACKAGE_ID");
  if (!eq(i.target.vaultId, cfg.vaultId)) problems.push("vault differs from local VAULT_ID");
  if (i.target.usdcType !== cfg.usdcType) problems.push("asset differs from local USDC_COIN_TYPE");
  if (normalizeSuiAddress(i.target.ownerAddress) !== normalizeSuiAddress(signerAddress)) problems.push("intent owner is not this local owner key");
  if (!/^\d+$/.test(i.gas_cap_mist) || BigInt(i.gas_cap_mist) <= 0n || BigInt(i.gas_cap_mist) > 100_000_000n) problems.push("gas cap must be positive and at most 0.1 SUI");
  if (cfg.network === "mainnet") {
    const m = cfg.proof;
    if (!m) problems.push("local reviewed Mainnet manifest is required");
    else {
      if (!eq(signerAddress, m.roles.owner.address)) problems.push("local owner differs from reviewed manifest");
      if (i.kind === "onchain") {
        if (i.action.action !== "set_agent_permission" || i.action.state !== "revoke" || i.call?.call !== "revoke_agent") problems.push("only final revoke is authorized by this Mainnet proof plan");
        if (BigInt(i.gas_cap_mist) > BigInt(m.operations.find((op) => op.id === "revoke-agent")!.gas_budget_mist)) problems.push("gas cap exceeds reviewed revoke budget");
      } else {
        if (!["decide_request", "start_next_session"].includes(String(i.action.action))) problems.push("offchain action is outside the reviewed proof plan");
        if (i.action.max_amount && (!/^\d+$/.test(String(i.action.max_amount)) || BigInt(String(i.action.max_amount)) > BigInt(m.merchant.price_base_units))) problems.push("remembered amount exceeds reviewed purchase");
        if (i.action.days !== undefined && (!Number.isInteger(i.action.days) || Number(i.action.days) < 1 || Number(i.action.days) > 7)) problems.push("preference validity exceeds the reviewed seven days");
      }
    }
  }
  if (i.kind === "onchain") {
    const c = i.call;
    if (!c) problems.push("onchain intent without a call");
    else {
      const amounts = c.call === "set_obligation_target" ? [c.target] : c.call === "add_obligation" ? [c.target] : c.call === "set_agent_policy" ? [c.max_per_request, c.max_per_day] : [];
      for (const a of amounts) if (!/^\d+$/.test(a) || BigInt(a) <= 0n || BigInt(a) > MAX_USDC) problems.push(`amount ${a} outside 0 < amount <= 100 USDC`);
      if (c.call === "set_agent_policy" && cfg.agentAddress && normalizeSuiAddress(c.agent) !== normalizeSuiAddress(cfg.agentAddress)) problems.push("agent address differs from local AGENT_ADDRESS");
      if (c.call === "set_agent_policy" && !cfg.agentAddress) problems.push("set AGENT_ADDRESS locally so the agent being granted spending can be checked");
    }
  }
  return problems;
}

/** Describe what will be signed, in plain lines. */
export function describeIntent(i: IntentForSigning): string[] {
  const lines = [`${i.id} · ${i.summary}`, `  network sui:${i.target.network} · vault ${i.target.vaultId}`, `  kind ${i.kind} · expires ${new Date(i.expires_at).toISOString()}`];
  if (i.call) lines.push(`  vault call ${i.target.packageId.slice(0, 10)}…::vault::${i.call.call} ${JSON.stringify(i.call)}`, `  gas cap ${(Number(i.gas_cap_mist) / 1e9).toFixed(3)} SUI`);
  return lines;
}

/** The real signer: owner key from the local env, gas through Tatum. Loaded lazily by scripts/sisih.ts. */
export async function localOwnerSigner(env: (n: string) => string | undefined): Promise<OwnerSigner | null> {
  const secret = env("OWNER_PRIVATE_KEY");
  if (!secret) return null;
  const kp = Ed25519Keypair.fromSecretKey(secret);
  const network = (env("SUI_NETWORK") ?? "testnet") as "testnet" | "mainnet";
  const proof = network === "mainnet" ? loadMainnetManifest("docs/mainnet/MANIFEST.json") : undefined;
  const agent = env("AGENT_ADDRESS") ?? (env("AGENT_PRIVATE_KEY") ? Ed25519Keypair.fromSecretKey(env("AGENT_PRIVATE_KEY")!).toSuiAddress() : null);
  return {
    address: () => kp.toSuiAddress(),
    config: () => ({ network, packageId: env("SISIH_PACKAGE_ID") ?? "", vaultId: env("VAULT_ID") ?? "", usdcType: env("USDC_COIN_TYPE") ?? "", agentAddress: agent, proof }),
    signText: async (text) => (await kp.signPersonalMessage(new TextEncoder().encode(text))).signature,
    async signCall(target, call, gasCapMist) {
      const { referenceGasPrice, suiClient } = await import("../lib/tatum");
      const tx = buildOwnerCall(target, call);
      tx.setSender(kp.toSuiAddress());
      tx.setGasPrice(await referenceGasPrice(network));
      tx.setGasBudget(gasCapMist);
      const bytes = await tx.build({ client: suiClient(network) }); // gas coins resolved through Tatum
      return { tx_bytes: toBase64(bytes), signature: (await kp.signTransaction(bytes)).signature };
    },
  };
}
