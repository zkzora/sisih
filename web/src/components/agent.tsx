"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  Ban,
  Bot,
  Brain,
  CalendarClock,
  Check,
  ChevronRight,
  Clock3,
  Pause,
  Play,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useSisih } from "./context";
import { Badge, Button, Confirm, Empty, PageHeading, Panel } from "./ui";
import { freeFunds, money, short } from "@/lib/engine";
import { RequestDrawer } from "./request-drawer";
import { ExplorerLink } from "./live-bits";
export function AgentView() {
  const { state, act, unlocked, isOwner, canOwner, newRequestIds, x402Steps } = useSisih();
  const policy = state.live?.policy;
  const spent = policy ? (Date.now() >= policy.windowStartMs + 86_400_000 ? 0 : Number(policy.spentInWindow)) : 0;
  const query = useSearchParams();
  const [selected, setSelected] = useState<string | null>(query.get("request"));
  const [filter, setFilter] = useState("All requests");
  const [category, setCategory] = useState("All categories");
  const [search, setSearch] = useState("");
  const [revoke, setRevoke] = useState(false);
  const held = state.requests.filter((r) => r.status === "held").length;
  const items = state.requests.filter(
    (r) =>
      (filter === "All requests" ||
        (filter === "On hold" && r.status === "held") ||
        (filter === "Automatic" && r.automatic) ||
        (filter === "Denied" && r.status === "rejected")) &&
      (category === "All categories" || r.category === category) &&
      `${r.merchant} ${r.item}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title="Give your agent room. Keep control."
        description="Every request stays within your uncommitted funds and your rules."
        action={
          <Button
            disabled={!unlocked}
            title={unlocked ? undefined : "Unlock demo controls first"}
            onClick={() => void act({ type: "request", merchant: "SearchBox" })}
          >
            <Plus size={15} />
            Run demo request
          </Button>
        }
      />
      <section className={`agent-card ${state.agentStatus === "revoked" ? "agent-card-revoked" : ""}`}>
        <div className="agent-identity">
          <div className="agent-avatar">
            <Bot size={27} strokeWidth={1.5} />
          </div>
          <div>
            <h2>
              Research Agent
              <Badge
                tone={state.agentStatus === "active" ? "success" : "warning"}
              >
                <span className="status-dot" />
                {state.agentStatus === "active"
                  ? "Active"
                  : state.agentStatus === "paused"
                    ? "Paused"
                    : "Revoked"}
              </Badge>
            </h2>
            <p>
              Search, data, and research · pays demo merchants over x402 ·{" "}
              <span className="mono">{policy ? short(policy.agent) : "no permission"}</span>
            </p>
          </div>
          <div className="agent-actions">
            {state.agentStatus === "revoked" && (
              <Button disabled={!isOwner} onClick={() => void act({ type: "agent-status", status: "active" })}>
                <ShieldCheck size={15} />
                Grant permission again
              </Button>
            )}
            <Button
              variant="secondary"
              disabled={state.agentStatus === "revoked" || !canOwner(state.agentStatus === "active" ? "pause_agent" : "resume_agent")}
              title={canOwner(state.agentStatus === "active" ? "pause_agent" : "resume_agent") ? undefined : "Connect the owner wallet, or unlock the demo dock, to sign"}
              onClick={() =>
                void act({
                  type: "agent-status",
                  status: state.agentStatus === "active" ? "paused" : "active",
                })
              }
            >
              {state.agentStatus === "active" ? (
                <Pause size={15} />
              ) : (
                <Play size={15} />
              )}{" "}
              {state.agentStatus === "active" ? "Pause agent" : "Resume agent"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setRevoke(true)}
              disabled={state.agentStatus === "revoked" || !isOwner}
            >
              <Ban size={15} />
              Revoke
            </Button>
          </div>
        </div>
        <div className="agent-limits">
          <div>
            <span>
              <ShieldCheck size={14} />
              Per-request limit (on chain)
            </span>
            <strong>
              {money(state.preferences.perRequest)} <small>USDC</small>
            </strong>
          </div>
          <div>
            <span>
              <CalendarClock size={14} />
              Spent in the 24 h window
            </span>
            <strong>
              {money(spent)}
              <small> / {money(state.preferences.perDay)} USDC</small>
            </strong>
          </div>
          <div>
            <span>
              <Clock3 size={14} />
              Permission expires
            </span>
            <strong className="expiry-value">
              {state.preferences.expires}
            </strong>
          </div>
          <div>
            <span>
              <Brain size={14} />
              Active preferences
            </span>
            <strong>
              {state.rules.filter((r) => r.active).length}
              <small>remembered rules</small>
            </strong>
          </div>
        </div>
      </section>
      <Panel>
        <div className="request-toolbar">
          <div className="tab-list" aria-label="Request filters">
            {["All requests", "On hold", "Automatic", "Denied"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={filter === f ? "selected" : ""}
                aria-pressed={filter === f}
              >
                {f}
                {f === "On hold" && held > 0 && <span>{held}</span>}
              </button>
            ))}
          </div>
          <select
            aria-label="Filter request category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {["All categories", "Data", "Search", "Inference", "Research"].map(
              (c) => (
                <option key={c}>{c}</option>
              ),
            )}
          </select>
        </div>
        <div className="search-field request-search">
          <Search size={15} />
          <input
            type="search"
            aria-label="Search requests"
            placeholder="Search merchants or requests…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {items.length ? (
          <div className="table-scroll">
            <table className="data-table requests-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Request</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Task</th>
                  <th>Decision</th>
                  <th>Reason · basis</th>
                  <th>x402 settle</th>
                  <th>
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr
                    key={r.id}
                    className={`${r.status === "held" ? "held-table-row" : ""} ${newRequestIds.has(r.id) ? "row-new" : ""}`}
                  >
                    <td className="mono">
                      {new Date(r.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      <small> · S{r.session}</small>
                    </td>
                    <td>
                      <button
                        className="table-name-button"
                        onClick={() => setSelected(r.id)}
                      >
                        <span
                          className={`merchant-avatar ${r.merchant === "SearchBox" ? "merchant-search" : r.merchant === "ReportLab" ? "merchant-report" : ""}`}
                        >
                          {r.merchant.slice(0, 2)}
                        </span>
                        <span>
                          <strong>
                            {r.merchant}
                            <span className="demo-word">DEMO</span>
                          </strong>
                          <small>{r.item}</small>
                        </span>
                      </button>
                    </td>
                    <td>{r.category}</td>
                    <td className="numeric">
                      {money(r.amount)}
                      <small> USDC</small>
                    </td>
                    <td className="request-task">{r.live?.taskContext?.replace(/^Research SUI token price: /, "") ?? "—"}</td>
                    <td>
                      <Badge
                        tone={
                          r.status === "approved"
                            ? "success"
                            : r.status === "rejected"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {r.status === "approved" ? (
                          <Check size={11} />
                        ) : r.status === "rejected" ? (
                          <Ban size={11} />
                        ) : (
                          <Clock3 size={11} />
                        )}{" "}
                        {r.status === "approved" || r.status === "paying"
                          ? r.automatic
                            ? "Auto-approved"
                            : "Approved manually"
                          : r.status === "rejected"
                            ? r.automatic
                              ? "Auto-denied"
                              : "Denied"
                            : "On hold"}
                      </Badge>
                    </td>
                    <td className="request-reason">
                      <span>{r.live?.reasons[0] ?? r.reason}</span>
                      {r.live?.matchedRuleIds.length ? (
                        <Badge tone="memory">
                          <Brain size={10} />
                          Rule from memory
                        </Badge>
                      ) : r.live?.code === "default_threshold" ? (
                        <Badge>Default threshold</Badge>
                      ) : r.live?.code === "would_cut_reserve" ? (
                        <Badge tone="danger">Reserve lock</Badge>
                      ) : null}
                    </td>
                    <td>
                      {r.transactionId ? (
                        <ExplorerLink digest={r.transactionId} network={state.live?.network} />
                      ) : r.status === "paying" || (x402Steps[r.id]?.length && r.live?.paymentStatus !== "paid") ? (
                        <Badge tone="warning">Paying…</Badge>
                      ) : r.live?.paymentStatus === "failed" ? (
                        <Badge tone="danger">Failed</Badge>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Review ${r.merchant} request ${r.id}`}
                        onClick={() => setSelected(r.id)}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No requests here"
            description="Try another filter, or run a task from Demo controls."
            action={
              <Button
                variant="secondary"
                disabled={!unlocked}
                onClick={() => void act({ type: "request", merchant: "DataMart" })}
              >
                <Play size={14} />
                Run a small data request
              </Button>
            }
          />
        )}
        <div className="table-footer">
          <span>
            {items.length} requests · {money(freeFunds(state))} USDC currently
            available
          </span>
          <span>Real x402 settlements on Sui {state.preferences.network} · demo merchants</span>
        </div>
      </Panel>
      <RequestDrawer id={selected} onClose={() => setSelected(null)} />
      <Confirm
        open={revoke}
        onClose={() => setRevoke(false)}
        title="Revoke agent permission?"
        description="The vault will refuse every release to the agent. Commitments and remembered rules stay. This signs revoke_agent with the owner wallet."
        label="Revoke permission"
        onConfirm={() => void act({ type: "agent-status", status: "revoked" })}
      />
    </>
  );
}
