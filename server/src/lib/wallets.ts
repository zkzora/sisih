import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { requireEnv } from "./env";

export type WalletRole = "owner" | "operator" | "agent" | "facilitator";

/** Server-side keypairs from .env (suiprivkey1...). The owner key is for scripts only. */
export function keypair(role: WalletRole): Ed25519Keypair {
  return Ed25519Keypair.fromSecretKey(requireEnv(`${role.toUpperCase()}_PRIVATE_KEY`));
}

export function address(role: WalletRole): string {
  return keypair(role).toSuiAddress();
}
