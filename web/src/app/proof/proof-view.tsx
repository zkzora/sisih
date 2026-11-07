"use client";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, ShieldAlert, Terminal, Lock, ExternalLink, Bot, User, Cpu } from "lucide-react";
import { CopyButton, Section } from "@/components/site";
import {
  RUN,
  TRACE,
  MEMORY_VERIFICATION,
  LIMITATIONS,
  HISTORY,
  LOCAL_CHECKS,
  suiscanTx,
  walruscanBlob,
  type Step,
} from "@/lib/proof-data";

function WhoIcon({ who }: { who: Step["who"] }) {
  if (who === "agent") return <Bot size={16} aria-label="Agent" />;
  if (who === "owner") return <User size={16} aria-label="Owner" />;
  return <Cpu size={16} aria-label="Smart Contract" />;
}

export function ProofView() {
  return (
    <div className="page proof-page">
      <header className="page-head">
        <p className="eyebrow">Evidence &amp; Verification</p>
        <h1>Recorded proof: terminal-first run</h1>
        <p className="lead">
          Every value, digest, job ID and blob ID on this page comes from the verified terminal run of{" "}
          <strong>{RUN.date}</strong> in Walrus namespace <code>{RUN.namespace}</code> ({RUN.window}).
        </p>
      </header>

      <Section id="run-metadata" title="Run environment">
        <dl className="facts">
          <div>
            <dt>Namespace</dt>
            <dd>
              <code>{RUN.namespace}</code>
            </dd>
          </div>
          <div>
            <dt>Networks</dt>
            <dd>{RUN.networks}</dd>
          </div>
          <div>
            <dt>Agent</dt>
            <dd>{RUN.agent}</dd>
          </div>
          <div>
            <dt>Owner</dt>
            <dd>{RUN.owner}</dd>
          </div>
          <div>
            <dt>Evidence archive</dt>
            <dd>
              <code>{RUN.evidencePath}</code>
            </dd>
          </div>
        </dl>
      </Section>

      <Section
        id="trace"
        eyebrow="Chronological execution"
        title="The recorded run step by step"
        intro={
          <p>
            The agent (Claude Code) requests services over MCP. The owner sets limits, reviews held requests and approves them with <code>pnpm sisih</code>.
            Hard Move vault limits on Sui Testnet always prevail over remembered preferences on Walrus Mainnet.
          </p>
        }
      >
        <div className="trace">
          {TRACE.map((step, idx) => (
            <article key={step.id} className={`step-card step-${step.who}`} id={`step-${step.id}`}>
              <div className="step-header">
                <span className="step-number">{String(idx + 1).padStart(2, "0")}</span>
                <span className={`who-badge who-${step.who}`}>
                  <WhoIcon who={step.who} />
                  <span>{step.who.toUpperCase()}</span>
                </span>
                <h3>{step.title}</h3>
                {step.requestId && (
                  <span className="step-req">
                    <code>{step.requestId}</code>
                    <CopyButton value={step.requestId} label={`Copy ${step.requestId}`} />
                  </span>
                )}
              </div>

              <p className="step-body">{step.happened}</p>

              {step.outcome && (
                <div className="outcome-row">
                  <span className="outcome-label">Outcome:</span>
                  <span className="outcome-badge">{step.outcome}</span>
                </div>
              )}

              {step.receipts && step.receipts.length > 0 && (
                <div className="step-subblock">
                  <h4>Onchain transactions (Sui Testnet)</h4>
                  <ul className="receipts-list">
                    {step.receipts.map((r) => (
                      <li key={r.digest}>
                        <span className="receipt-name">{r.label}:</span>
                        <a href={suiscanTx(r.digest)} target="_blank" rel="noopener noreferrer" className="receipt-link">
                          <code>{r.digest.slice(0, 10)}…{r.digest.slice(-6)}</code>
                          <ExternalLink size={12} aria-hidden />
                        </a>
                        <span className={`receipt-tag receipt-${r.outcome.includes("aborted") ? "aborted" : "ok"}`}>
                          {r.outcome}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {step.memories && step.memories.length > 0 && (
                <div className="step-subblock">
                  <h4>Walrus Memory on Mainnet</h4>
                  <ul className="memories-list">
                    {step.memories.map((m) => (
                      <li key={m.job}>
                        <span className="memory-kind">{m.type.toUpperCase()}:</span>
                        <span className="memory-job" title={`Job ID: ${m.job}`}>
                          job <code>{m.job.slice(0, 8)}…</code>
                        </span>
                        <a href={walruscanBlob(m.blob)} target="_blank" rel="noopener noreferrer" className="blob-link">
                          blob <code>{m.blob.slice(0, 8)}…</code>
                          <ExternalLink size={12} aria-hidden />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          ))}
        </div>
      </Section>

      <Section id="verification" eyebrow="Walrus relayer verification" title="Memory storage verification">
        <div className="card verification-card">
          <div className="verification-stat">
            <span className="stat-num">{MEMORY_VERIFICATION.stored} / {MEMORY_VERIFICATION.checked}</span>
            <span className="stat-label">Memories stored and verified per job</span>
          </div>
          <p>{MEMORY_VERIFICATION.method}</p>
          <p className="muted">{MEMORY_VERIFICATION.retry}</p>
          <p className="fine">
            Full relayer verification log: <code>{MEMORY_VERIFICATION.file}</code>
          </p>
        </div>
      </Section>

      <Section id="local-checks" eyebrow="Automated regression tests" title="Boundaries verified locally">
        <p>In addition to the recorded live run, these security boundaries are enforced and verified by unit/integration tests:</p>
        <ul className="checks-list">
          {LOCAL_CHECKS.map((c, i) => (
            <li key={i}>
              <CheckCircle2 size={16} aria-hidden />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="limitations" eyebrow="Transparency" title="Recorded limitations">
        <ul className="limitations-list">
          {LIMITATIONS.map((lim, i) => (
            <li key={i}>
              <ShieldAlert size={16} aria-hidden />
              <span>{lim}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="history" eyebrow="Prior milestones" title="Earlier recorded runs">
        <div className="history-grid">
          {HISTORY.map((h) => (
            <div key={h.namespace} className="history-card">
              <div className="history-head">
                <strong>{h.namespace}</strong>
                <span>{h.date}</span>
              </div>
              <p>{h.what}</p>
              <code>{h.path}</code>
            </div>
          ))}
        </div>
      </Section>

      <div className="page-actions-bottom">
        <Link className="btn btn-primary" href="/connect">
          Connect your agent
        </Link>
        <Link className="btn btn-secondary" href="/">
          Back to overview
        </Link>
      </div>
    </div>
  );
}
