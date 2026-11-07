import type { Metadata } from "next";
import { ProofView } from "./proof-view";

export const metadata: Metadata = {
  title: "Recorded proof · Sisih",
  description:
    "The complete verified terminal-first run of Sisih on Sui Testnet and Walrus Memory Mainnet (namespace sisih-hosted-9). Every transaction, receipt, and memory blob.",
};

export default function ProofPage() {
  return <ProofView />;
}
