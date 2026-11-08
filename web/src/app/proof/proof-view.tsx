import Link from "next/link";
import { MainnetProof } from "./mainnet-proof";

export function ProofView() {
  return <div className="page proof-page">
    <MainnetProof />
    <div className="page-actions-bottom"><Link className="btn btn-primary" href="/connect">Connect to Mainnet</Link><Link className="btn btn-secondary" href="/">Back to overview</Link></div>
  </div>;
}
