import type { Metadata } from "next";
import { ConnectView } from "./connect-view";

export const metadata: Metadata = { title: "Connect to Mainnet · Sisih", description: "Connect an external agent to Sisih's actual Sui Mainnet vault, inspect verified x402 purchases and Walrus preferences. Completed proof, revoked permission, read-only publication." };

export default function ConnectPage() {
  return <ConnectView />;
}
