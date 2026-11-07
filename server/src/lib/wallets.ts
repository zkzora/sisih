import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { env, requireEnv } from "./env";

export type WalletRole = "owner" | "operator" | "agent" | "facilitator";

/** Server-side keypairs from env (suiprivkey1...). The owner key is for Testnet scripts and the local owner helper only. */
export function keypair(role: WalletRole): Ed25519Keypair {
  return Ed25519Keypair.fromSecretKey(requireEnv(`${role.toUpperCase()}_PRIVATE_KEY`));
}

/**
 * Public address of a role: <ROLE>_ADDRESS when configured, else derived from the role's key.
 * A Mainnet server is configured with OWNER_ADDRESS and never holds OWNER_PRIVATE_KEY.
 */
export function address(role: WalletRole): string {
  const configured = env(`${role.toUpperCase()}_ADDRESS`);
  if (configured) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(configured)) throw new Error(`${role.toUpperCase()}_ADDRESS must be a full Sui address`);
    return configured.toLowerCase();
  }
  return keypair(role).toSuiAddress();
}
