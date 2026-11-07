"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  LockKeyhole,
  ShieldCheck,
  CalendarRange,
  Plus,
  Brain,
  Clock3,
  CheckCircle2,
} from "lucide-react";
import { useSisih } from "./context";
import { Badge, Button, CopyButton, Empty, PageHeading, Panel } from "./ui";
import { freeFunds, money, reserved, sessionStats } from "@/lib/engine";
import { RequestDrawer } from "./request-drawer";
import { ActivityTable } from "./activity";
import { VerifiedBadge, Countdown } from "./live-bits";
import { WhatChanged } from "./memory";
export function Overview() {
  const { state, setMoneyModal, act, canOwner, refreshVault, ownerSigner } = useSisih();
  const [requestId, setRequestId] = useState<string | null>(null);
  const held = state.requests.filter((r) => r.status === "held");
  const live = state.live;
  const stats = sessionStats(state);
  const commitments = state.obligations
    .filter((o) => !o.paid)
    .sort((a, b) => a.due.localeCompare(b.due));
  const lastSummary = state.memories.find((m) => m.kind === "Session summary");
  const activeRules = state.rules.filter((r) => r.active).length;
  return (
    <>
      <PageHeading
        eyebrow="Owner workspace"
        title="Your vault, at a glance."
        description="Monitor commitments, review your agent’s requests and inspect the evidence."
        action={
          <><Badge tone={ownerSigner ? "success" : "neutral"}>{ownerSigner ? "Owner controls enabled" : "Read-only view"}</Badge><Link className="button button-primary" href="/connect">Connect your agent <ArrowUpRight size={15} aria-hidden /></Link></>
        }
      />
      <div className="workspace-terminal" aria-label="Owner terminal shortcut"><div><strong>Manage from your terminal</strong><span>Use the same vault and rules from the Sisih CLI. New purchases that need your decision appear below.</span></div><div><code>pnpm sisih status</code><CopyButton value="pnpm sisih status" label="Copy owner status command" /></div></div>
      <section className="balance-card" aria-label="Vault balance" id="workspace">
        <div className="balance-card-heading">
          <span>
            <span className="vault-dot" />
            Personal vault
          </span>
          {live ? (
            <VerifiedBadge readAtMs={live.readAtMs} explorerUrl={live.explorerUrl} objectId={live.vaultId} onRefresh={() => void refreshVault()} error={live.tatum.level === "red"} />
          ) : (
            <Badge>
              <FlaskLabel />
              Loading
            </Badge>
          )}
        </div>
        <div className="balance-grid">
          <div className="balance-section">
            <span className="balance-label">Total in vault</span>
            <strong className="balance-number">
              {money(state.balance)}
              <small>USDC</small>
            </strong>
            <span className="balance-help">All funds in the Sui vault</span>
          </div>
          <div className="balance-section">
            <span className="balance-label">Committed</span>
            <strong className="balance-number">
              {money(reserved(state))}
              <small>USDC</small>
            </strong>
            <span className="balance-help">
              <LockKeyhole size={12} />
              Reserved for {commitments.length} commitments
            </span>
          </div>
          <div
            className={`balance-section available ${freeFunds(state) < 1_000_000 ? "available-low" : ""}`}
          >
            <span className="balance-label">
              Available to your agent
              <ArrowUpRight size={14} />
            </span>
            <strong className="balance-number">
              {money(freeFunds(state))}
              <small>USDC</small>
            </strong>
            <span className="balance-help">Only this amount can be spent</span>
          </div>
        </div>
        <div className="allocation">
          <div
            className="allocation-track"
            role="img"
            aria-label={`${money(reserved(state))} USDC committed and ${money(freeFunds(state))} USDC available, out of ${money(state.balance)} USDC`}
          >
            {commitments
              .filter((o) => o.reserved > 0)
              .map((o, i) => (
                <Link
                  href={`/obligations?record=${o.id}`}
                  key={o.id}
                  title={`${o.name}: ${money(o.reserved)} USDC`}
                  className={`allocation-segment reserve-${i % 4}`}
                  style={{ flex: o.reserved }}
                />
              ))}
            {freeFunds(state) > 0 && (
              <span
                className="allocation-segment allocation-free"
                style={{ flex: freeFunds(state) }}
              />
            )}
            {state.balance === 0 && <span className="allocation-empty" />}
          </div>
          <div className="allocation-legend">
            {commitments.map((o, i) => (
              <Link href={`/obligations?record=${o.id}`} key={o.id}>
                <i className={`reserve-${i % 4}`} />
                {o.name}
                <span>{money(o.reserved)}</span>
              </Link>
            ))}
            <span>
              <i className="allocation-free" />
              Available<span>{money(freeFunds(state))}</span>
            </span>
          </div>
        </div>
      </section>
      {state.obligations.some((o) => !o.paid && o.reserved < o.amount) && (
        <div className="banner banner-danger">
          <ShieldCheck size={18} />
          <span>
            {money(state.obligations.reduce((v, o) => v + Math.max(0, o.amount - o.reserved), 0))} USDC short of funding every commitment.
          </span>
          <Button variant="ghost" onClick={() => setMoneyModal("deposit")} disabled={!canOwner("deposit")}>
            Deposit
          </Button>
        </div>
      )}
      <div className="overview-grid">
        <Panel
          title="Upcoming commitments"
          action={
            <Link className="text-button" href="/obligations">
              View all
              <ArrowUpRight size={13} />
            </Link>
          }
        >
          {commitments.length ? (
            commitments.slice(0, 3).map((o) => (
              <Link
                className="commitment-row"
                key={o.id}
                href={`/obligations?record=${o.id}`}
              >
                <span className="merchant-avatar">
                  <CalendarRange size={17} />
                </span>
                <span className="row-description">
                  <strong>{o.name}</strong>
                  <small>
                    {o.cycle} · {o.type.toLowerCase()} · {o.nextDueMs ? <Countdown toMs={o.nextDueMs} /> : o.due}
                  </small>
                </span>
                <span className="row-amount">
                  {money(o.reserved)} <small>USDC</small>
                  <span className="mini-progress">
                    <span
                      style={{
                        width: `${Math.min(100, (o.reserved / o.amount) * 100)}%`,
                      }}
                    />
                  </span>
                </span>
                <ArrowRight size={14} className="row-arrow" />
              </Link>
            ))
          ) : (
            <Empty
              title="Nothing committed yet"
              description="Set money aside before your agent starts spending."
              action={
                <Link href="/obligations" className="text-button">
                  Add a commitment
                  <Plus size={14} />
                </Link>
              }
            />
          )}
        </Panel>
        <Panel
          title="Needs your decision"
          action={
            <Badge tone={held.length ? "warning" : "success"}>
              {held.length ? `${held.length} on hold` : "All clear"}
            </Badge>
          }
        >
          {held.length ? (
            held.slice(0, 2).map((h) => (
              <div className="held-preview" key={h.id}>
                <div className="held-preview-top">
                  <strong>
                    {h.merchant}
                    <span>DEMO</span>
                  </strong>
                  <b>{money(h.amount)} USDC</b>
                </div>
                <p>{h.live?.reasons[0] ?? h.reason}</p>
                <div className="held-preview-footer">
                  <span>
                    <LockKeyhole size={12} />
                    Reserves stay protected
                  </span>
                  <Button variant="primary" onClick={() => setRequestId(h.id)}>
                    Review request
                    <ArrowUpRight size={13} />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="all-clear">
              <CheckCircle2 size={26} />
              <div>
                <h3>You’re all caught up.</h3>
                <p>
                  Give your connected agent a task. Purchases that need your approval will appear here.
                </p>
              </div>
            </div>
          )}
          <div className="memory-note">
            <Brain size={19} />
            <div>
              <strong>
                {lastSummary
                  ? "Your workspace remembers."
                  : "Your decisions become context."}
              </strong>
              <p>
                {lastSummary
                  ? `${activeRules} active ${activeRules === 1 ? "rule" : "rules"} carried into Session ${state.session}. Your reserve boundaries stay the same.`
                  : "Approve and remember to let similar requests run automatically next time."}
              </p>
              <Link href="/memory">
                {lastSummary ? "See what changed" : "Explore memory"}
                <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </Panel>
      </div>
      <Panel
        title="What changed since last session"
        action={
          <Link className="text-button" href="/memory">
            View in Memory
            <ArrowUpRight size={13} />
          </Link>
        }
      >
        <WhatChanged compact />
      </Panel>
      <div className="mini-stats">
        <div>
          <span>
            <ShieldCheck size={15} />
            Money protected
          </span>
          <strong>
            {money(state.requests.reduce((v, r) => v + r.blockedAmount, 0))}
            <small>USDC kept reserved</small>
          </strong>
        </div>
        <div>
          <span>
            <CheckCircle2 size={15} />
            Automatic decisions
          </span>
          <strong>
            {stats.automatic}
            <small>of {stats.total} requests this session</small>
          </strong>
        </div>
        <div>
          <span>
            <Clock3 size={15} />
            Needs review
          </span>
          <strong>
            {held.length}
            <small>pending requests</small>
          </strong>
        </div>
      </div>
      <Panel
        title="Recent activity"
        action={
          <Link href="/activity" className="text-button">
            View activity
            <ArrowUpRight size={13} />
          </Link>
        }
      >
        <ActivityTable items={state.activities.slice(0, 5)} compact />
      </Panel>
      <div className="quick-actions">
        <Link href="/obligations">
          <Plus size={14} />
          Add a commitment
        </Link>
        <button onClick={() => setMoneyModal("deposit")} disabled={!canOwner("deposit")}>
          <ArrowDownLeft size={14} />
          Deposit
        </button>
        <button
          disabled={!canOwner(state.agentStatus === "active" ? "pause_agent" : "resume_agent") || state.agentStatus === "revoked"}
          onClick={() =>
            void act({
              type: "agent-status",
              status: state.agentStatus === "active" ? "paused" : "active",
            })
          }
        >
          <ShieldCheck size={14} />
          {state.agentStatus === "active" ? "Pause agent" : "Resume agent"}
        </button>
      </div>
      <RequestDrawer id={requestId} onClose={() => setRequestId(null)} />
    </>
  );
}
function FlaskLabel() {
  return <span className="status-dot" />;
}
