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
import { freeFunds, money, spentToday } from "@/lib/engine";
import { RequestDrawer } from "./request-drawer";
export function AgentView() {
  const { state, act } = useSisih();
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
        (filter === "Rejected" && r.status === "rejected")) &&
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
            onClick={() => act({ type: "request", merchant: "SearchBox" })}
          >
            <Plus size={15} />
            Run demo request
          </Button>
        }
      />
      <section className="agent-card">
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
            <p>Search, data, and research · Demo agent</p>
          </div>
          <div className="agent-actions">
            <Button
              variant="secondary"
              disabled={state.agentStatus === "revoked"}
              onClick={() =>
                act({
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
              disabled={state.agentStatus === "revoked"}
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
              Per-request limit
            </span>
            <strong>
              {money(state.preferences.perRequest)} <small>USDC</small>
            </strong>
          </div>
          <div>
            <span>
              <CalendarClock size={14} />
              Daily spending
            </span>
            <strong>
              {money(spentToday(state))}
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
            {["All requests", "On hold", "Automatic", "Rejected"].map((f) => (
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
                  <th>Request</th>
                  <th>Amount</th>
                  <th>Decision</th>
                  <th>Decision context</th>
                  <th>Session</th>
                  <th>
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr
                    key={r.id}
                    className={r.status === "held" ? "held-table-row" : ""}
                  >
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
                    <td className="numeric">
                      {money(r.amount)}
                      <small> USDC</small>
                    </td>
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
                        {r.status === "approved"
                          ? r.automatic
                            ? "Automatic"
                            : "Approved"
                          : r.status === "rejected"
                            ? "Rejected"
                            : "On hold"}
                      </Badge>
                    </td>
                    <td className="request-reason">
                      <span>{r.reason}</span>
                      {r.memoryId && (
                        <Badge tone="memory">
                          <Brain size={10} />
                          Remembered rule
                        </Badge>
                      )}
                    </td>
                    <td>{r.session}</td>
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
                onClick={() => act({ type: "request", merchant: "DataMart" })}
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
          <span>Demo payments only</span>
        </div>
      </Panel>
      <RequestDrawer id={selected} onClose={() => setSelected(null)} />
      <Confirm
        open={revoke}
        onClose={() => setRevoke(false)}
        title="Revoke agent permission?"
        description="New spending requests will be rejected. Existing commitments and remembered preferences remain unchanged."
        label="Revoke permission"
        onConfirm={() => act({ type: "agent-status", status: "revoked" })}
      />
    </>
  );
}
