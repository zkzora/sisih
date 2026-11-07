"use client";
import Link from "next/link";
import { useEffect } from "react";
import { ArrowRight, ArrowUpRight, Brain, Check, LockKeyhole, PlugZap, ShieldCheck, Terminal } from "lucide-react";
import { useSisih } from "./context";
import { Badge } from "./ui";
import { freeFunds, money, reserved } from "@/lib/engine";

export function HomeView() {
  const { state, ready, loadError } = useSisih();
  const live = state.live;
  const activeRules = state.rules.filter((rule) => rule.active).length;
  // Preserve links shared before the workspace received its own route.
  useEffect(() => {
    if (window.location.hash === "#workspace") window.location.replace("/workspace");
  }, []);
  const readable = ready && !loadError;
  return (
    <div className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-message">
          <div className="home-eyebrow"><span className="status-dot" /> Spending controls for your AI agent</div>
          <h1 id="home-title">Your money has a purpose.<br /><span>Your agent has a limit.</span></h1>
          <p className="home-lead">Set aside what you owe. Let your agent spend what&apos;s left.</p>
          <p className="home-description">Sisih reserves money for bills and savings before your agent buys a paid service. Your decisions carry into the next session. Your reserves stay protected.</p>
          <div className="home-actions">
            <Link className="button button-primary" href="/connect">Connect your agent <ArrowRight size={16} aria-hidden /></Link>
            <Link className="button button-secondary" href="/tour">Explore a recorded run <ArrowUpRight size={15} aria-hidden /></Link>
          </div>
          <div className="home-terminal-note"><Terminal size={15} aria-hidden /><span>Agent via MCP. Owner via CLI. A workspace when you need it.</span></div>
        </div>
        <section className="home-vault" aria-label="Current shared demo vault">
          <div className="home-vault-head"><span><LockKeyhole size={16} aria-hidden /> Shared demo vault</span><Badge tone="success">Sui Testnet</Badge></div>
          <div className="home-vault-total"><span>Total in vault</span><strong>{readable ? money(state.balance) : "—"}<small>USDC</small></strong></div>
          <div className="home-vault-split">
            <div><LockKeyhole size={15} aria-hidden /><span>Committed</span><strong>{readable ? money(reserved(state)) : "—"}<small>USDC</small></strong><p>Reserved for bills and savings</p></div>
            <div className="home-vault-free"><ArrowUpRight size={16} aria-hidden /><span>Free for your agent</span><strong>{readable ? money(freeFunds(state)) : "—"}<small>USDC</small></strong><p>Subject to your spending limits</p></div>
          </div>
          <div className="home-vault-memory"><Brain size={19} aria-hidden /><div><strong>{readable ? `${live?.memory.stored ?? 0} stored memories` : "Reading the shared workspace"}</strong><p>{loadError ? "Live state is unavailable. You can still explore the recorded run." : ready ? `${activeRules} active ${activeRules === 1 ? "preference" : "preferences"}. Memory never unlocks committed funds.` : "Balances and memory counts come from the demo API."}</p></div></div>
          <div className="home-vault-foot"><span>{readable ? live?.memory.namespace : "Sui Testnet · Walrus Mainnet"}</span><Link href="/workspace">Open workspace <ArrowRight size={14} aria-hidden /></Link></div>
        </section>
      </section>
      <section className="home-workflow" aria-labelledby="home-workflow-title">
        <div className="home-section-heading"><span className="eyebrow">HOW IT WORKS</span><h2 id="home-workflow-title">A useful purchase. A clear boundary.</h2></div>
        <ol>
          <li><span className="home-step-number">01</span><PlugZap size={22} aria-hidden /><h3>Your agent asks</h3><p>Give Claude Code a task. It discovers a service, checks its budget and requests a purchase through Sisih.</p></li>
          <li><span className="home-step-number">02</span><ShieldCheck size={22} aria-hidden /><h3>Your limits decide</h3><p>A purchase can proceed within your limits, wait for your approval, or be blocked to protect committed money.</p></li>
          <li><span className="home-step-number">03</span><Brain size={22} aria-hidden /><h3>Your decision carries forward</h3><p>Approve and remember. The next session recalls your preference from Walrus and applies the same hard limits.</p></li>
        </ol>
      </section>
      <section className="home-evidence" aria-labelledby="home-evidence-title">
        <div><span className="eyebrow">INSPECT THE RESULT</span><h2 id="home-evidence-title">Follow the payment.<br />See what was remembered.</h2><p>The workspace connects requests to settlement receipts, Tatum verification and Walrus memory. The recorded walkthrough is available without credentials.</p><Link className="text-button" href="/tour">Walk through the evidence <ArrowRight size={15} aria-hidden /></Link></div>
        <ul>
          <li><Check size={18} aria-hidden /><div><Link href="/activity">Sui Testnet transactions <ArrowUpRight size={14} aria-hidden /></Link><p>Vault releases and x402 settlement, verified through Tatum.</p></div></li>
          <li><Check size={18} aria-hidden /><div><Link href="/memory">Walrus Memory on Mainnet <ArrowUpRight size={14} aria-hidden /></Link><p>Owner preferences and decisions, with stored-memory evidence.</p></div></li>
          <li><Check size={18} aria-hidden /><div><Link href="/learning">Decisions across sessions <ArrowUpRight size={14} aria-hidden /></Link><p>See when memory helps and when reserve limits still block a purchase.</p></div></li>
        </ul>
      </section>
      <p className="home-demo-note">Shared testnet demo. Testnet USDC has no monetary value. Merchants are run by the Sisih team; ChainScope returns live onchain data and the other services return labeled examples.</p>
    </div>
  );
}
