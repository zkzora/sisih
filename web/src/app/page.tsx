import Link from "next/link";
import { ArrowRight, Brain, LockKeyhole, PlugZap, ShieldCheck } from "lucide-react";
import { NETWORK_LABEL } from "@/components/site";

export default function Home() {
  return (
    <div className="page">
      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">Spending controls for an AI agent that pays for services</p>
        <h1 id="hero-title">
          Your money has a purpose.
          <br />
          <span>Your agent has a limit.</span>
        </h1>
        <p className="lead">
          You let an agent buy data and APIs from the same wallet that pays your bills and savings. A balance or a daily cap does not know which money is already
          promised. Sisih does: it reserves your commitments first, lets the agent spend only what is left, and remembers your decisions for the next session.
        </p>
        <div className="actions">
          <Link className="btn btn-primary" href="/connect">
            Connect your agent <ArrowRight size={16} aria-hidden />
          </Link>
          <Link className="btn btn-secondary" href="/proof">
            See the proof
          </Link>
        </div>
        <p className="network-line">
          Hosted demo: <strong>{NETWORK_LABEL}</strong>
        </p>
      </section>

      <section className="example" aria-labelledby="example-title">
        <div className="example-head">
          <h2 id="example-title">The failure Sisih prevents</h2>
          <span className="tag">Illustrative example</span>
        </div>
        <div className="example-grid">
          <div className="example-col">
            <h3>A spending cap alone</h3>
            <p>
              Your wallet holds 20.00 USDC. 16.50 is due this week for inference, hosting and savings. Your agent has a 5.00 daily cap, has already spent 1.70, and asks
              for a 3.00 report.
            </p>
            <p className="verdict verdict-bad">The cap allows it. Your bills are now 1.20 short.</p>
          </div>
          <div className="example-col">
            <h3>With Sisih</h3>
            <p>The 16.50 is reserved in the vault before the agent can spend. Only 1.80 is free, so the 3.00 report would cut into a reserve.</p>
            <p className="verdict verdict-good">Refused by the contract. No preference or approval can unlock reserved money.</p>
          </div>
        </div>
        <p className="fine">
          This example is illustrative. The recorded run on the <Link href="/proof">Proof</Link> page shows the same boundary with real Testnet transactions.
        </p>
      </section>

      <section className="steps" aria-labelledby="steps-title">
        <h2 id="steps-title">How it works</h2>
        <ol>
          <li>
            <PlugZap size={22} aria-hidden />
            <h3>Your agent asks</h3>
            <p>Over one MCP endpoint, the spending agent checks its budget, picks a service and requests one purchase for its task.</p>
          </li>
          <li>
            <LockKeyhole size={22} aria-hidden />
            <h3>Hard rules decide first</h3>
            <p>The Move vault on Sui holds your reserves, per-request and daily caps, expiry, pause and revoke. The agent is paid only from free funds.</p>
          </li>
          <li>
            <ShieldCheck size={22} aria-hidden />
            <h3>You decide the new cases</h3>
            <p>Unfamiliar purchases wait for you. You answer from your own owner session or your terminal; the agent can never approve itself.</p>
          </li>
          <li>
            <Brain size={22} aria-hidden />
            <h3>Your decision carries forward</h3>
            <p>Approve and remember: the preference is stored in Walrus Memory and recalled next session. It only chooses among payments the vault already allows.</p>
          </li>
        </ol>
      </section>

      <section className="alt" aria-labelledby="alt-title">
        <h2 id="alt-title">Why not a separate agent wallet?</h2>
        <p>
          A separately funded wallet with a static budget is the strongest simple alternative, and it works if you keep refilling it by hand. Sisih&apos;s claim is
          narrower: the agent spends from the money you already hold, the amount it can reach changes with your actual commitments, and the approvals you give once are
          not asked again next session. The <Link href="/proof">recorded run</Link> shows both.
        </p>
      </section>
    </div>
  );
}
