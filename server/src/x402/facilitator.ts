/**
 * x402 "exact" on Sui via @tentaclepay/sui-x402 (path chosen in Phase 0). The facilitator is
 * the gas owner: it verifies (structure + simulate) and co-signs. Every Sui call goes through
 * our Tatum client via the clientRegistry (otherwise the library dials a public fullnode).
 */
import { fromBase64 } from "@mysten/sui/utils";
import { createSuiClientRegistry, toFacilitatorSuiSigner, type SuiClientRegistry } from "@tentaclepay/sui-x402";
import { ExactSuiScheme as ExactSuiFacilitatorScheme } from "@tentaclepay/sui-x402/exact/facilitator";
import { suiNetwork } from "../lib/env.js";
import { suiClient } from "../lib/tatum.js";
import { keypair } from "../lib/wallets.js";

export type X402Network = "sui:testnet" | "sui:mainnet";

export function x402Network(): X402Network {
  return suiNetwork() === "mainnet" ? "sui:mainnet" : "sui:testnet";
}

let registry: SuiClientRegistry | undefined;
export function tatumRegistry(): SuiClientRegistry {
  if (!registry) {
    registry = createSuiClientRegistry();
    registry.set(x402Network(), suiClient());
  }
  return registry;
}

let facilitator: ExactSuiFacilitatorScheme | undefined;
export function x402Facilitator(): ExactSuiFacilitatorScheme {
  if (!facilitator) {
    const kp = keypair("facilitator");
    facilitator = new ExactSuiFacilitatorScheme(
      toFacilitatorSuiSigner({
        address: kp.toSuiAddress() as `0x${string}`,
        signTransaction: async (b64) => (await kp.signTransaction(fromBase64(b64))).signature,
      }),
      { clientRegistry: tatumRegistry() },
    );
  }
  return facilitator;
}
