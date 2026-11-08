import type { Metadata } from "next";
import { ProofView } from "./proof-view";

export const metadata: Metadata = {
  title: "Recorded proof · Sisih",
  description:
    "Recorded Sui Mainnet x402 purchases by a real Codex agent, local owner signing, Walrus memory recall and protected reserves, alongside historical Testnet evidence.",
};

export default function ProofPage() {
  return <ProofView />;
}
