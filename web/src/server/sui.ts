/**
 * Server-side Sui access for the web app (Next.js Node runtime only). The server package is
 * mounted in this app, so the /api/sui-rpc proxy uses the same chokepoint:
 * server/src/lib/tatum.ts (native gRPC to Tatum, one call in flight, >= 400 ms apart, retry on
 * 429 / UNAVAILABLE). One throttle per instance; the browser never sees the key.
 */
import "server-only";
import "./root-env";
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { suiClient } from "../../../server/src/lib/tatum";

export type Network = "testnet" | "mainnet";

export function network(): Network {
  return process.env.SUI_NETWORK === "mainnet" ? "mainnet" : "testnet";
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export function tatum(): SuiGrpcClient {
  return suiClient(network());
}
