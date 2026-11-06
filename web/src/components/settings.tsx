"use client";
import { useEffect, useState } from "react";
import { ConnectButton } from "@mysten/dapp-kit";
import { Ban, Bot, Check, Download, ExternalLink, Globe2, LockKeyhole, Moon, Pause, Play, ShieldCheck, Sun, Wallet } from "lucide-react";
import { DEMO_OWNER_LABEL, useSisih } from "./context";
import { Badge, Button, Confirm, CopyButton, Field, PageHeading, Panel, Spinner } from "./ui";
import { amountInput, freeFunds, money, parseMoney, short } from "@/lib/engine";
import { TatumDot, useNow } from "./live-bits";

export function SettingsView() {
  const { state, act, setMoneyModal, notify, isOwner, ownerSigner, canOwner, walletAddress, refreshVault } = useSisih();
  const now = useNow(5000);
  const live = state.live;
  const [perRequest, setPerRequest] = useState(amountInput(state.preferences.perRequest));
  const [perDay, setPerDay] = useState(amountInput(state.preferences.perDay));
  const [threshold, setThreshold] = useState(amountInput(state.preferences.defaultThreshold));
  const [expiry, setExpiry] = useState(state.preferences.expires);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<"revoke" | "emergency" | null>(null);
  const [ack, setAck] = useState(false);
  // Follow the chain when it changes (another tab, a reset).
  useEffect(() => {
    setPerRequest(amountInput(state.preferences.perRequest));
    setPerDay(amountInput(state.preferences.perDay));
    setThreshold(amountInput(state.preferences.defaultThreshold));
    setExpiry(state.preferences.expires);
  }, [state.preferences.perRequest, state.preferences.perDay, state.preferences.defaultThreshold, state.preferences.expires]);

  const exportData = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), network: live?.network, vaultId: live?.vaultId, obligations: state.obligations, requests: state.requests.map(({ live: _l, ...r }) => r), rules: state.rules, memories: state.memories, activity: state.activities }, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "sisih-workspace.json";
    a.click();
    URL.revokeObjectURL(url);
    notify("Workspace exported.");
  };
  const vaultUrl = live ? `https://suiscan.xyz/${live.network}/object/${live.vaultId}` : undefined;
  const ownerUrl = live ? `https://suiscan.xyz/${live.network}/account/${live.owner}` : undefined;
  return (
    <>
      <PageHeading title="Your vault. Your boundaries." description="Manage spending permissions and the preferences your agent follows." />
      <div className="settings-layout">
        <div className="settings-main">
          <Panel title="Wallet & funds" action={<Badge tone={isOwner ? "success" : ownerSigner === "demo" ? "warning" : "neutral"}>{isOwner ? "Owner connected" : ownerSigner === "demo" ? DEMO_OWNER_LABEL : walletAddress ? "Not the owner" : "Read-only"}</Badge>}>
            <div className="settings-wallet">
              <span className="wallet-icon">
                <Wallet size={21} />
              </span>
              <div>
                <strong>Personal vault</strong>
                {live && (
                  <span className="mono">
                    <a href={vaultUrl} target="_blank" rel="noreferrer">
                      {short(live.vaultId)} <ExternalLink size={11} />
                    </a>
                    <CopyButton value={live.vaultId} label="Copy vault id" />
                  </span>
                )}
                {live && (
                  <small className="mono">
                    owner{" "}
                    <a href={ownerUrl} target="_blank" rel="noreferrer">
                      {short(live.owner)}
                    </a>
                  </small>
                )}
              </div>
              <ConnectButton connectText="Connect owner wallet" />
            </div>
            <div className="settings-balance">
              <span>
                Available to withdraw
                <strong>{money(freeFunds(state))} USDC</strong>
              </span>
              <div>
                <Button variant="secondary" onClick={() => setMoneyModal("deposit")} disabled={!canOwner("deposit")}>
                  Deposit
                </Button>
                <Button variant="secondary" onClick={() => setMoneyModal("withdraw")} disabled={!isOwner}>
                  Withdraw free funds
                </Button>
              </div>
            </div>
            {ownerSigner === "demo" ? (
              <p className="detail-note">No owner wallet is connected, so deposits, reserve suggestions, pause and resume are signed on the server by the {DEMO_OWNER_LABEL}. Connect the owner wallet to sign them yourself. Never on mainnet.</p>
            ) : (
              !isOwner && <p className="detail-note">Owner actions are signed by the owner wallet. Anyone can view this workspace read-only.</p>
            )}
          </Panel>
          <Panel title="Spending policy" action={<Badge><LockKeyhole size={11} /> Hard limits on chain</Badge>}>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const a = parseMoney(perRequest),
                  b = parseMoney(perDay),
                  c = parseMoney(threshold);
                if (a === null || b === null || c === null) {
                  setError("Enter positive USDC amounts with up to 6 decimal places.");
                  return;
                }
                if (a > b) {
                  setError("The per-request limit cannot exceed the daily limit.");
                  return;
                }
                setSaving(true);
                const result = await act({ type: "settings", preferences: { ...state.preferences, perRequest: a, perDay: b, defaultThreshold: c, expires: expiry } });
                setSaving(false);
                setError(result.error ? result.message : "");
              }}
            >
              <div className="form-grid">
                <Field id="settings-request" label="Maximum per request (USDC)" hint="Enforced by the Move vault.">
                  <input id="settings-request" inputMode="decimal" autoComplete="off" value={perRequest} onChange={(e) => setPerRequest(e.target.value)} />
                </Field>
                <Field id="settings-day" label="Maximum per day (USDC)" hint={live?.policy ? `${money(Number(live.policy.spentInWindow))} used in the current 24 h window.` : undefined}>
                  <input id="settings-day" inputMode="decimal" autoComplete="off" value={perDay} onChange={(e) => setPerDay(e.target.value)} />
                </Field>
              </div>
              <div className="form-grid">
                <Field id="settings-threshold" label="Automatic small-payment threshold" hint="Requests without a rule at or below this amount proceed if every vault limit passes.">
                  <input id="settings-threshold" inputMode="decimal" autoComplete="off" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
                </Field>
                <Field id="settings-expiry" label="Agent permission valid through" hint="Enforced by the Move vault.">
                  <input id="settings-expiry" type="date" min={new Date().toISOString().slice(0, 10)} value={expiry} onChange={(e) => setExpiry(e.target.value)} />
                </Field>
              </div>
              <Field id="settings-action" label="New merchants and new categories">
                <select id="settings-action" value="hold" disabled>
                  <option value="hold">Hold for review until you remember a rule</option>
                </select>
              </Field>
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
              <div className="form-actions">
                <Button type="submit" disabled={saving}>
                  {saving ? <Spinner label="Saving" /> : <Check size={15} />}
                  Save policy
                </Button>
              </div>
              <p className="detail-note">Changing a hard limit signs set_agent_policy with the owner wallet. The threshold is stored by the Sisih server.</p>
            </form>
          </Panel>
          <Panel title="Agent permission">
            <div className={`permission-row ${state.agentStatus === "revoked" ? "permission-revoked" : ""}`}>
              <span className="merchant-avatar">
                <Bot size={19} />
              </span>
              <div>
                <strong>Research Agent</strong>
                <p className="mono">{live?.policy ? short(live.policy.agent) : "no permission"}</p>
                <p>
                  {state.agentStatus === "active"
                    ? "Requests can proceed within your policy."
                    : state.agentStatus === "paused"
                      ? "Agent paused. All requests are denied."
                      : "Permission revoked. Grant permission again to resume."}
                </p>
              </div>
              <Badge tone={state.agentStatus === "active" ? "success" : state.agentStatus === "paused" ? "warning" : "neutral"}>{state.agentStatus}</Badge>
            </div>
            <div className="settings-actions">
              {state.agentStatus === "revoked" ? (
                <Button onClick={() => void act({ type: "agent-status", status: "active" })} disabled={!isOwner}>
                  <ShieldCheck size={15} />
                  Grant permission again
                </Button>
              ) : (
                <>
                  <Button variant="secondary" disabled={!canOwner(state.agentStatus === "active" ? "pause_agent" : "resume_agent")} onClick={() => void act({ type: "agent-status", status: state.agentStatus === "active" ? "paused" : "active" })}>
                    {state.agentStatus === "active" ? <Pause size={14} /> : <Play size={14} />} {state.agentStatus === "active" ? "Pause" : "Resume"}
                  </Button>
                  <Button variant="ghost" className="danger-text" disabled={!isOwner} onClick={() => setConfirm("revoke")}>
                    <Ban size={14} />
                    Revoke permission
                  </Button>
                </>
              )}
            </div>
          </Panel>
          <Panel title="Workspace data">
            <p className="muted">Export the current balances, commitments, requests, rules, memories and receipts as JSON.</p>
            <Button variant="secondary" onClick={exportData}>
              <Download size={15} />
              Export workspace
            </Button>
          </Panel>
          <Panel title="Emergency withdrawal" className="danger-panel">
            <p>Withdraw every reserve and all free funds to the owner wallet and remove every commitment. The agent keeps its permission but has nothing to spend.</p>
            <label className="checkbox-label">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />I understand this releases all reserved funds.
            </label>
            <Button variant="danger" disabled={!ack || !isOwner} onClick={() => setConfirm("emergency")}>
              Withdraw everything
            </Button>
          </Panel>
        </div>
        <div className="settings-aside">
          <Panel title="Appearance">
            <div className="theme-options">
              <button className={state.preferences.theme === "light" ? "selected" : ""} aria-pressed={state.preferences.theme === "light"} onClick={() => void act({ type: "settings", preferences: { ...state.preferences, theme: "light" } })}>
                <Sun size={19} />
                Light
              </button>
              <button className={state.preferences.theme === "dark" ? "selected" : ""} aria-pressed={state.preferences.theme === "dark"} onClick={() => void act({ type: "settings", preferences: { ...state.preferences, theme: "dark" } })}>
                <Moon size={19} />
                Dark
              </button>
            </div>
          </Panel>
          <Panel title="Integration status">
            <div className="integration-list">
              <div>
                <span>
                  <Globe2 size={15} />
                  <strong>Tatum Sui RPC</strong>
                </span>
                <TatumDot tatum={live?.tatum} now={now} onRetry={() => void refreshVault()} />
                <small className="mono">{live?.tatum.host ?? "—"} · API key held server-side</small>
              </div>
              <div>
                <span>
                  <Globe2 size={15} />
                  <strong>Walrus Memory</strong>
                </span>
                <Badge tone={live?.health?.memwal.ok ? "success" : "warning"}>{live?.health?.memwal.ok ? "Mainnet · healthy" : "Checking"}</Badge>
                <small className="mono">
                  namespace {live?.memory.namespace ?? "—"} · agent {live?.health?.memwal.agentId ? short(live.health.memwal.agentId) : "—"}
                </small>
              </div>
              <div>
                <span>
                  <Globe2 size={15} />
                  <strong>x402 facilitator</strong>
                </span>
                <Badge tone="success">{live?.health?.payments.executor === "x402" ? "Settling on Sui" : "Stub"}</Badge>
                <small>Exact scheme on Sui {live?.network}; gas sponsored by the Sisih facilitator</small>
              </div>
              <div>
                <span>
                  <Globe2 size={15} />
                  <strong>Sui vault</strong>
                </span>
                <Badge tone="success">Live on {live?.network}</Badge>
                <small className="mono">{live ? short(live.vaultId) : "—"}</small>
              </div>
            </div>
          </Panel>
          <Panel title="Demo disclosure">
            <label className="settings-toggle">
              <span>
                Show demo banner
                <small>DataMart, SearchBox and ReportLab are demo merchants run by the Sisih team.</small>
              </span>
              <button className={`switch ${state.preferences.demoBanner ? "on" : ""}`} role="switch" aria-checked={state.preferences.demoBanner} aria-label="Show demo disclosure banner" onClick={() => void act({ type: "settings", preferences: { ...state.preferences, demoBanner: !state.preferences.demoBanner } })}>
                <span />
              </button>
            </label>
          </Panel>
        </div>
      </div>
      <Confirm
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm === "revoke" ? "Revoke agent permission?" : "Withdraw everything?"}
        description={
          confirm === "revoke"
            ? "The vault will refuse every release to the agent. Commitments and memories stay. This signs revoke_agent."
            : "Every reserve and all free funds go to the owner wallet, and every commitment is removed. This signs emergency_withdraw_all."
        }
        label={confirm === "revoke" ? "Revoke permission" : "Withdraw everything"}
        onConfirm={() => {
          if (confirm === "revoke") void act({ type: "agent-status", status: "revoked" });
          else {
            void act({ type: "emergency-withdraw" });
            setAck(false);
          }
        }}
      />
    </>
  );
}
