"use client";
import { useState } from "react";
import {
  Ban,
  Bot,
  Check,
  Download,
  FlaskConical,
  Globe2,
  LockKeyhole,
  Moon,
  Pause,
  Play,
  ShieldCheck,
  Sun,
  Wallet,
} from "lucide-react";
import { useSisih } from "./context";
import {
  Badge,
  Button,
  Confirm,
  CopyButton,
  Field,
  PageHeading,
  Panel,
} from "./ui";
import {
  address,
  amountInput,
  demoDay,
  freeFunds,
  money,
  parseMoney,
} from "@/lib/engine";
export function SettingsView() {
  const { state, act, setMoneyModal, notify } = useSisih();
  const [perRequest, setPerRequest] = useState(
    amountInput(state.preferences.perRequest),
  );
  const [perDay, setPerDay] = useState(amountInput(state.preferences.perDay));
  const [threshold, setThreshold] = useState(
    amountInput(state.preferences.defaultThreshold),
  );
  const [expiry, setExpiry] = useState(state.preferences.expires);
  const [action, setAction] = useState(state.preferences.defaultAction);
  const [network, setNetwork] = useState(state.preferences.network);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<"revoke" | "emergency" | null>(null);
  const [ack, setAck] = useState(false);
  const exportData = () => {
    const url = URL.createObjectURL(
      new Blob(
        [JSON.stringify({ ...state, exportMode: "local-demo" }, null, 2)],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "sisih-workspace.json";
    a.click();
    URL.revokeObjectURL(url);
    notify("Local demo workspace exported.");
  };
  return (
    <>
      <PageHeading
        title="Your vault. Your boundaries."
        description="Manage spending permissions and the preferences your agent follows."
      />
      <div className="settings-layout">
        <div className="settings-main">
          <Panel
            title="Wallet & funds"
            action={
              <Badge>
                {state.walletConnected ? "Demo connected" : "Demo mode"}
              </Badge>
            }
          >
            <div className="settings-wallet">
              <span className="wallet-icon">
                <Wallet size={21} />
              </span>
              <div>
                <strong>Personal vault</strong>
                <span className="mono">
                  {address.slice(0, 18)}…{address.slice(-6)}
                  <CopyButton value={address} />
                </span>
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  act({ type: "wallet", connected: !state.walletConnected })
                }
              >
                {state.walletConnected
                  ? "Disconnect demo"
                  : "Connect demo wallet"}
              </Button>
            </div>
            <div className="settings-balance">
              <span>
                Available to withdraw
                <strong>{money(freeFunds(state))} USDC</strong>
              </span>
              <div>
                <Button
                  variant="secondary"
                  onClick={() => setMoneyModal("deposit")}
                >
                  Deposit
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setMoneyModal("withdraw")}
                >
                  Withdraw available
                </Button>
              </div>
            </div>
          </Panel>
          <Panel
            title="Spending policy"
            action={
              <Badge>
                <LockKeyhole size={11} />
                Demo limits
              </Badge>
            }
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const a = parseMoney(perRequest),
                  b = parseMoney(perDay),
                  c = parseMoney(threshold);
                if (a === null || b === null || c === null) {
                  setError(
                    "Enter positive USDC amounts with up to 6 decimal places.",
                  );
                  return;
                }
                const result = act({
                  type: "settings",
                  preferences: {
                    ...state.preferences,
                    perRequest: a,
                    perDay: b,
                    defaultThreshold: c,
                    expires: expiry,
                    defaultAction: action,
                    network,
                  },
                });
                setError(result.error ? result.message : "");
              }}
            >
              <div className="form-grid">
                <Field id="settings-request" label="Maximum per request (USDC)">
                  <input
                    id="settings-request"
                    inputMode="decimal"
                    autoComplete="off"
                    value={perRequest}
                    onChange={(e) => setPerRequest(e.target.value)}
                  />
                </Field>
                <Field id="settings-day" label="Maximum per day (USDC)">
                  <input
                    id="settings-day"
                    inputMode="decimal"
                    autoComplete="off"
                    value={perDay}
                    onChange={(e) => setPerDay(e.target.value)}
                  />
                </Field>
              </div>
              <div className="form-grid">
                <Field
                  id="settings-threshold"
                  label="Automatic small-payment threshold"
                  hint="Payments at or below this threshold may proceed if every vault limit passes."
                >
                  <input
                    id="settings-threshold"
                    inputMode="decimal"
                    autoComplete="off"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                  />
                </Field>
                <Field
                  id="settings-expiry"
                  label="Agent permission valid through"
                >
                  <input
                    id="settings-expiry"
                    type="date"
                    min={demoDay(state)}
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                  />
                </Field>
              </div>
              <Field
                id="settings-action"
                label="Other requests from new merchants"
              >
                <select
                  id="settings-action"
                  value={action}
                  onChange={(e) =>
                    setAction(e.target.value as "hold" | "allow")
                  }
                >
                  <option value="hold">Hold for review</option>
                  <option value="allow">Allow within all hard limits</option>
                </select>
              </Field>
              <Field
                id="settings-network"
                label="Demo network label"
                hint="Changes the demo label only. It does not connect to either network."
              >
                <select
                  id="settings-network"
                  value={network}
                  onChange={(e) =>
                    setNetwork(e.target.value as "Testnet" | "Mainnet")
                  }
                >
                  <option>Testnet</option>
                  <option>Mainnet</option>
                </select>
              </Field>
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
              <div className="form-actions">
                <Button type="submit">
                  <Check size={15} />
                  Save policy
                </Button>
              </div>
            </form>
          </Panel>
          <Panel title="Agent permission">
            <div className="permission-row">
              <span className="merchant-avatar">
                <Bot size={19} />
              </span>
              <div>
                <strong>Research Agent</strong>
                <p>
                  {state.agentStatus === "active"
                    ? "Requests can proceed within your policy."
                    : state.agentStatus === "paused"
                      ? "All new spending is paused."
                      : "Permission revoked. Grant access to resume the demo."}
                </p>
              </div>
              <Badge
                tone={state.agentStatus === "active" ? "success" : "warning"}
              >
                {state.agentStatus}
              </Badge>
            </div>
            <div className="settings-actions">
              {state.agentStatus === "revoked" ? (
                <Button
                  onClick={() =>
                    act({ type: "agent-status", status: "active" })
                  }
                >
                  <ShieldCheck size={15} />
                  Grant demo permission
                </Button>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      act({
                        type: "agent-status",
                        status:
                          state.agentStatus === "active" ? "paused" : "active",
                      })
                    }
                  >
                    {state.agentStatus === "active" ? (
                      <Pause size={14} />
                    ) : (
                      <Play size={14} />
                    )}{" "}
                    {state.agentStatus === "active" ? "Pause" : "Resume"}
                  </Button>
                  <Button
                    variant="ghost"
                    className="danger-text"
                    onClick={() => setConfirm("revoke")}
                  >
                    <Ban size={14} />
                    Revoke permission
                  </Button>
                </>
              )}
            </div>
          </Panel>
          <Panel title="Workspace data">
            <p className="muted">
              Your demo data is stored in this browser. Export a copy of
              balances, rules, memories, and receipts.
            </p>
            <Button variant="secondary" onClick={exportData}>
              <Download size={15} />
              Export workspace
            </Button>
          </Panel>
          <Panel title="Emergency withdrawal" className="danger-panel">
            <p>
              Release every demo reserve, withdraw the full demo balance, and
              pause the agent. Commitments will become underfunded.
            </p>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
              />
              I understand this releases all reserved demo funds.
            </label>
            <Button
              variant="danger"
              disabled={!ack}
              onClick={() => setConfirm("emergency")}
            >
              Withdraw all demo funds
            </Button>
          </Panel>
        </div>
        <div className="settings-aside">
          <Panel title="Appearance">
            <div className="theme-options">
              <button
                className={
                  state.preferences.theme === "light" ? "selected" : ""
                }
                aria-pressed={state.preferences.theme === "light"}
                onClick={() =>
                  act({
                    type: "settings",
                    preferences: { ...state.preferences, theme: "light" },
                  })
                }
              >
                <Sun size={19} />
                Light
              </button>
              <button
                className={state.preferences.theme === "dark" ? "selected" : ""}
                aria-pressed={state.preferences.theme === "dark"}
                onClick={() =>
                  act({
                    type: "settings",
                    preferences: { ...state.preferences, theme: "dark" },
                  })
                }
              >
                <Moon size={19} />
                Dark
              </button>
            </div>
          </Panel>
          <Panel title="Integration status">
            <div className="integration-list">
              {[
                { name: "Sui vault", detail: "Move contract not deployed" },
                { name: "Tatum RPC", detail: "No gateway connected" },
                { name: "Walrus Memory", detail: "Local memory only" },
                { name: "x402 payments", detail: "Simulated merchant flows" },
              ].map((i) => (
                <div key={i.name}>
                  <span>
                    <Globe2 size={15} />
                    <strong>{i.name}</strong>
                  </span>
                  <Badge>Not connected</Badge>
                  <small>{i.detail}</small>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Demo disclosure">
            <label className="settings-toggle">
              <span>
                Show demo banner
                <small>
                  The mode label in the header always remains visible.
                </small>
              </span>
              <button
                className={`switch ${state.preferences.demoBanner ? "on" : ""}`}
                role="switch"
                aria-checked={state.preferences.demoBanner}
                aria-label="Show demo disclosure banner"
                onClick={() =>
                  act({
                    type: "settings",
                    preferences: {
                      ...state.preferences,
                      demoBanner: !state.preferences.demoBanner,
                    },
                  })
                }
              >
                <span />
              </button>
            </label>
          </Panel>
          <div className="info-box">
            <FlaskConical size={18} />
            <p>
              This build is a functional frontend demo. A browser policy cannot
              protect real funds; production enforcement requires the Sui vault
              contract and connected adapters.
            </p>
          </div>
        </div>
      </div>
      <Confirm
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={
          confirm === "revoke"
            ? "Revoke agent permission?"
            : "Release all demo reserves?"
        }
        description={
          confirm === "revoke"
            ? "New payments will be blocked. Your commitments and memories remain saved."
            : "All reserved demo money becomes withdrawable, the vault balance becomes zero, and the agent is paused. This affects demo funds only."
        }
        label={
          confirm === "revoke" ? "Revoke permission" : "Withdraw all & pause"
        }
        onConfirm={() => {
          if (confirm === "revoke")
            act({ type: "agent-status", status: "revoked" });
          else {
            act({ type: "emergency-withdraw" });
            setAck(false);
          }
        }}
      />
    </>
  );
}
