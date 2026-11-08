import { Section } from "@/components/site";

const tx = (digest: string) => `https://suiscan.xyz/mainnet/tx/${digest}`;
const receipts = [
  ["Publish", "3VML59yGq63WndkVmTpyp1gqS5mRDty1RrnGSqGfHR8T"],
  ["Create vault", "5ARUwMy8tKxN6imQ8MmsYkqSvnMGpg7xsr52ALMpZAgS"],
  ["Deposit, reserve and policy", "5WoyMkuMtWTMSB71PWfnJxNv8PQuHRfuLt64CtTq6gb5"],
  ["First release", "6C3oTgnJYb2TH1jJiRxLR1DE87GVvY1mmfcsX2goJcms"],
  ["First x402 settlement", "8JyrP75EGse2BSTE4ty7afEPskptMYt6h3bv8hAjAyXB"],
  ["Fresh-session release", "Gm1Rtgd2ty6sJ1gWxx1LSfVqNYnKnSwTkxDchfjECVE3"],
  ["Fresh-session x402 settlement", "8ywcKQZpHDpFsZnBq4yCusuLiibDfWws6nF8FWQTBhS9"],
  ["Owner revokes permission", "3ijG4jsAk9QcV4jvffUAF3RTmwn7np39pc697PJf5LH1"],
] as const;

export function MainnetProof() {
  return <>
    <header className="page-head">
      <p className="eyebrow">Recorded Mainnet proof · 8 November 2026</p>
      <h1>Memory changed the decision. Reserves held.</h1>
      <p className="lead">A real Codex agent bought two live ChainScope reports with native USDC on Sui Mainnet. The owner signed locally. Walrus Memory carried one approval into a fresh session; the next purchase was refused.</p>
      <p className="callout">This is a recorded local Mainnet run through Tatum, at 13:03–13:10 UTC. The hosted interactive demo remains Sui Testnet. No public Mainnet server has been deployed.</p>
    </header>
    <Section id="mainnet-trace" title="One approval, two purchases, one hard refusal">
      <ol className="bullets">
        <li>Deposit 3.00 USDC: 0.80 protected for savings, 2.20 free. Codex requests a 0.80 ChainScope report; unfamiliar merchant request <code>req-d89525e6-87f</code> waits without payment.</li>
        <li>The owner signs approval with remember, capped at 0.80 USDC for seven days. One release and one x402 settlement complete; Codex consumes live balances, commitments and delegated limits from the purchased report.</li>
        <li>A new application session rebuilds one rule from Walrus. A fresh Codex conversation requests <code>req-7dd90263-75e</code>: <code>allow_rule</code> settles another 0.80 report without a second owner review.</li>
        <li>Request <code>req-f37bacb5-c6a</code> is blocked: 0.80 would exceed the 0.60 free balance by 0.20. A separate, unsigned contract simulation returns <code>EExceedsFree</code>; no refusal transaction was broadcast.</li>
        <li>The owner revokes agent permission. Final vault: 1.40 USDC total = 0.80 reserved + 0.60 free. Merchant proceeds: 1.60 USDC. Net gas across all eight transactions: 0.083418818 SUI.</li>
      </ol>
      <p>Stored preference: <a href="https://walruscan.com/mainnet/blob/dAU_UeyCw3_fRAuIEQCFQJuXKE6wnlnIJkkkkmYoJds" target="_blank" rel="noopener noreferrer">rule-dfbf7042 on Walrus Mainnet</a>. Four memories were independently checked by relayer job and full account inventory; the new run does not claim ten memories.</p>
      <p>Source archive: <code>docs/evidence/mainnet-20261108</code>. Exact read-back checked sender, gas owner/budget, asset, amount, recipient, vault events and calls. An unrelated successful Mainnet digest failed the verifier.</p>
      <ul className="bullets">{receipts.map(([label, digest]) => <li key={digest}><a href={tx(digest)} target="_blank" rel="noopener noreferrer">{label}</a> · <code>{digest}</code></li>)}</ul>
      <p className="fine">ChainScope is operated by this project; these payments are project funds, not customer revenue. Claude Code was quota-blocked before any Mainnet tool call. Codex performed the recorded task. Its initial refusal summary confused the default threshold with a remembered rule; a read-only follow-up corrected that distinction and cited the stored rule. Owner actions used the CLI, not a recorded owner-assistant model run. Read-only MCP provenance links were added after payment, then checked without another purchase.</p>
    </Section>
  </>;
}
