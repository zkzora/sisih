import type { Metadata } from "next";
import { ConnectView } from "./connect-view";

export const metadata: Metadata = { title: "Connect your agent · Sisih" };

export default function ConnectPage() {
  return <ConnectView />;
}
