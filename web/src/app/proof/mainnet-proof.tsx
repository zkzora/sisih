import Link from "next/link";
import { CopyButton, Section } from "@/components/site";

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
const ruleUrl = "https://walruscan.com/mainnet/blob/dAU_UeyCw3_fRAuIEQCFQJuXKE6wnlnIJkkkkmYoJds";
const decisionUrl = "https://walruscan.com/mainnet/blob/TnwJqTlovSbUz5852akt4BIpHJElg2-i4CF3048d42M";

export function MainnetProof() {
  return <>
    <header className="page-head">
      <p className="eyebrow">Verified Sui Mainnet run · 8 November 2026</p>
      <h1>Memory changed the decision. Reserves held.</h1>
      <p className="lead">A real Codex agent bought two live ChainScope reports with native USDC. One locally signed owner approval carried into a fresh session through Walrus Memory. A third purchase was refused.</p>
      <p className="fine">Recorded 13:03–13:10 UTC on Sui Mainnet. This run is complete and permission is revoked. <Link href="/connect">Connect</Link> reads the same Mainnet vault and recorded requests; new spending is closed.</p>
    </header>
    <dl className="proof-summary" aria-label="Verified Mainnet result">
      <div><dt>Two x402 purchases</dt><dd>1.60 <span>USDC paid</span></dd></div>
      <div><dt>Protected throughout</dt><dd>0.80 <span>USDC reserved</span></dd></div>
      <div><dt>Final vault balance</dt><dd>1.40 <span>USDC · agent revoked</span></dd></div>
    </dl>
    <Section id="mainnet-trace" title="One approval, two purchases, one hard refusal">
      <div className="trace">
        <article className="step-card">
          <p className="eyebrow">01 · Agent requests</p><h3>A useful report, held for review</h3>
          <p>The owner deposits 3.00 USDC: 0.80 for savings, 2.20 free. Codex discovers ChainScope and requests a live report on balances, commitments and spending limits.</p>
          <p>Request <code>req-d89525e6-87f</code> waits because the merchant is unfamiliar. No payment occurs.</p>
        </article>
        <article className="step-card">
          <p className="eyebrow">02 · Owner decides</p><h3>Approve once and remember the preference</h3>
          <p>The owner signs locally: allow this exact 0.80-USDC purchase and remember ChainScope up to 0.80 for seven days. The vault releases free funds; x402 settles the invoice. Codex uses the delivered live report.</p>
          <p><a href={tx(receipts[3][1])}>Release receipt</a>{" · "}<a href={tx(receipts[4][1])}>x402 settlement</a>{" · "}<a href={ruleUrl}>Stored Walrus preference</a></p>
        </article>
        <article className="step-card">
          <p className="eyebrow">03 · Fresh session</p><h3>The recalled rule changes the next decision</h3>
          <p>A new application session rebuilds one rule from Walrus. A fresh Codex conversation requests <code>req-7dd90263-75e</code>; <code>allow_rule</code> settles the second 0.80 report without another owner approval.</p>
          <p>The purchased report returns live checkpoint 343007621: 1.40 total, 0.80 reserved and 0.60 free, plus active spending limits.</p>
          <p><a href={tx(receipts[5][1])}>Release receipt</a>{" · "}<a href={tx(receipts[6][1])}>x402 settlement</a>{" · "}<a href={decisionUrl}>Stored decision</a></p>
        </article>
        <article className="step-card">
          <p className="eyebrow">04 · Contract boundary</p><h3>The remembered preference cannot spend savings</h3>
          <p>Request <code>req-f37bacb5-c6a</code> costs 0.80 USDC, but only 0.60 is free. It is refused with <code>would_cut_reserve</code> while the preference remains active. Nothing is paid.</p>
          <p>An independent unsigned simulation using the real operator capability returns <code>EExceedsFree</code>. This refusal was simulated; no failed transaction was broadcast.</p>
        </article>
        <article className="step-card">
          <p className="eyebrow">05 · Owner closes the run</p><h3>Permission revoked, reserve intact</h3>
          <p>The owner revokes spending permission. Independent Tatum read-back confirms 1.40 USDC remains: 0.80 reserved + 0.60 free. Merchant proceeds are 1.60 USDC. Net gas across all eight transactions is 0.083418818 SUI.</p>
          <p><a href={tx(receipts[7][1])}>Owner revoke receipt</a></p>
        </article>
      </div>
    </Section>
    <Section id="memory-proof" title="Memory with inspectable provenance">
      <p>Four Mainnet memories in this run reached stored status: the preference, two decisions and a session summary. Each relayer job matched its blob, and all four appeared in the full account inventory.</p>
      <p><a href={ruleUrl}>Inspect the remembered rule</a>{" · "}<a href={decisionUrl}>Inspect the fresh-session decision</a></p>
      <p className="fine">This run has four stored memories. Earlier project runs independently verified additional Mainnet memories; their original networks and provenance remain in the repository archive.</p>
    </Section>
    <details className="disclosure" id="mainnet-technical">
      <summary>All eight receipts and verification details</summary>
      <p>Every receipt was read independently through Tatum, matching sender, gas owner/budget, asset, amount, merchant recipient, vault events and function calls. An unrelated successful Mainnet digest failed the same verifier.</p>
      <ul className="receipt-list">{receipts.map(([label, digest]) => <li key={digest}><a href={tx(digest)}>{label}</a><code>{digest}</code><CopyButton value={digest} label={`Copy ${label} digest`} /></li>)}</ul>
      <p>Source archive: <code>docs/evidence/mainnet-20261108</code>. The archive includes actual tool calls, useful merchant output, exact gas breakdowns, memory jobs/blobs, the unsigned reserve simulation and verifier negative control.</p>
      <p>The read-only MCP response was improved after payment to include the recalled rule&apos;s source link. A follow-up verified provenance without another purchase and corrected the agent&apos;s initial confusion between the 0.50 default threshold and the 0.80 merchant preference. Original transcripts are retained.</p>
    </details>
    <Section id="mainnet-limits" title="What this proof establishes">
      <p>One stored approval changed a later decision; hard reserve limits still prevailed. ChainScope is operated by this project, so these are project payments, not customer revenue. The vault is custom Move code with test evidence; no third-party audit is claimed.</p>
      <p className="fine">Codex CLI completed this Mainnet task. Owner actions used the CLI with a local key. Owner-assistant model behavior and Antigravity have not been recorded. This experiment does not establish broad demand or superiority to every static spending policy.</p>
    </Section>
  </>;
}
