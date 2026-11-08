import Link from "next/link";
import { ArrowRight, Brain, Coins, Cpu, LockKeyhole, PlugZap, ShieldCheck, Terminal, Zap } from "lucide-react";

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
          <Link className="btn btn-primary" href="/proof#mainnet-trace">
            See the Mainnet proof <ArrowRight size={16} aria-hidden />
          </Link>
          <Link className="btn btn-secondary" href="/connect">
            Connect your agent
          </Link>
        </div>
        <p className="network-line">
          Verified on <strong>Sui Mainnet · Walrus Memory Mainnet</strong>. Two x402 purchases, one recalled approval, reserves protected.
        </p>
      </section>

      <section className="features" aria-labelledby="features-title">
        <div className="features-head">
          <p className="eyebrow">CAPABILITIES</p>
          <h2 id="features-title">What Sisih can do</h2>
          <p className="lead">
            Concrete guardrails combining Sui Move smart contracts with Walrus Memory so your AI agent pays for what it needs without risking your reserved funds.
          </p>
        </div>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <Coins size={22} aria-hidden />
            </div>
            <h3>Onchain Commitment Reserves</h3>
            <p>
              Ring-fences funds for hosting, inference bills, and savings directly in a Move contract on Sui. Hard contract invariants prevent any agent or prompt from touching committed funds.
            </p>
            <span className="feature-tag">Sui Move Contract</span>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <Zap size={22} aria-hidden />
            </div>
            <h3>Autonomous x402 Micropayments</h3>
            <p>
              Allows your AI agent to pay for on-demand data feeds and API services via x402 invoices in real time, settled onchain on Sui and verified through Tatum.
            </p>
            <span className="feature-tag">x402 Protocol</span>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <Brain size={22} aria-hidden />
            </div>
            <h3>Cross-Session Memory</h3>
            <p>
              Stores owner approvals and merchant preferences in Walrus Memory. In the verified run, one recalled preference allowed the next purchase without another review.
            </p>
            <span className="feature-tag">Walrus Mainnet</span>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <ShieldCheck size={22} aria-hidden />
            </div>
            <h3>Hard Spending Caps</h3>
            <p>
              Enforces strict per-request limits, 24-hour daily caps, and permission expiration. Even with a remembered preference, hard limits cannot be bypassed.
            </p>
            <span className="feature-tag">Policy Engine</span>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <Cpu size={22} aria-hidden />
            </div>
            <h3>Separate Agent and Owner Roles</h3>
            <p>
              Connect an external MCP client with a restricted token. The model receives no wallet key; a scoped server signer executes permitted payments. Codex and Claude Code have recorded runs.
            </p>
            <span className="feature-tag">Model Context Protocol</span>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <Terminal size={22} aria-hidden />
            </div>
            <h3>Terminal & Assistant Control</h3>
            <p>
              Review purchases and control permission through the companion CLI or owner MCP. Mainnet owner actions require a local signature. The recorded proof ends with permission revoked.
            </p>
            <span className="feature-tag">Owner Companion</span>
          </div>
        </div>
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
              You start with 20.00 USDC. 16.50 is due this week for inference, hosting and savings. Your agent has a 5.00 daily cap, has already spent 1.70, and asks
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
          This example is illustrative. <Link href="/proof">Proof</Link> records real Mainnet purchases and a labeled reserve-refusal simulation.
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
          narrower: the agent spends from the money you already hold, and the amount it can reach changes with your actual commitments. A remembered preference can
          remove a repeated review when the purchase still fits every hard limit. The <Link href="/proof">recorded run</Link> shows one such decision.
        </p>
      </section>
    </div>
  );
}
