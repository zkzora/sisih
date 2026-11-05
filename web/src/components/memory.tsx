"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Check,
  Clock3,
  Copy,
  Layers,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useSisih } from "./context";
import {
  Badge,
  Button,
  CopyButton,
  Empty,
  Overlay,
  PageHeading,
  Panel,
} from "./ui";
import { money } from "@/lib/engine";
export function MemoryView() {
  const { state, act } = useSisih();
  const query = useSearchParams();
  const [selected, setSelected] = useState<string | null>(query.get("record"));
  const [tab, setTab] = useState("Timeline");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("All types");
  const items = state.memories.filter(
    (m) =>
      (kind === "All types" || m.kind === kind) &&
      m.text.toLowerCase().includes(search.toLowerCase()),
  );
  const record = state.memories.find((m) => m.id === selected);
  const latest = state.requests.find((r) => r.memoryId);
  return (
    <>
      <PageHeading
        title="A workspace that remembers."
        description="Your preferences carry forward. Your spending boundaries never change."
        action={
          <Badge tone="memory">
            <Brain size={13} />
            {state.memories.length} local memories
          </Badge>
        }
      />
      <div className="memory-boundary">
        <span className="memory-boundary-icon">
          <Brain size={22} />
        </span>
        <div>
          <h3>Memory guides preferences. The vault sets the limits.</h3>
          <p>
            A remembered approval can skip a review. It can never unlock money
            reserved for a commitment.
          </p>
        </div>
        <ShieldCheck size={23} />
      </div>
      <div className="summary-strip">
        <div>
          <span>Remembered events</span>
          <strong>
            {state.memories.length}
            <small>in this browser</small>
          </strong>
        </div>
        <div>
          <span>Active rules</span>
          <strong>{state.rules.filter((r) => r.active).length}</strong>
        </div>
        <div>
          <span>This session</span>
          <strong>
            {state.memories.filter((m) => m.session === state.session).length}
            <small>new memories</small>
          </strong>
        </div>
      </div>
      <Panel>
        <div className="request-toolbar">
          <div className="tab-list" aria-label="Memory views">
            {["Timeline", "Active rules", "Latest recall"].map((t) => (
              <button
                key={t}
                className={tab === t ? "selected" : ""}
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <Badge>Local · Walrus not connected</Badge>
        </div>
        {tab === "Timeline" && (
          <>
            <div className="table-toolbar">
              <div className="search-field">
                <Search size={16} />
                <input
                  type="search"
                  aria-label="Search memory"
                  placeholder="Search decisions, merchants, or rules…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                aria-label="Filter memory type"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                {[
                  "All types",
                  "Decision",
                  "Rule learned",
                  "Obligation outcome",
                  "Reserve updated",
                  "Rule revoked",
                  "Session summary",
                ].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </div>
            {items.length ? (
              <div className="memory-timeline">
                {items.map((m) => (
                  <button
                    className="memory-entry"
                    onClick={() => setSelected(m.id)}
                    key={m.id}
                  >
                    <span className="memory-entry-icon">
                      {m.kind === "Rule learned" ? (
                        <Brain size={17} />
                      ) : m.kind === "Session summary" ? (
                        <Layers size={17} />
                      ) : (
                        <Clock3 size={17} />
                      )}
                    </span>
                    <span className="memory-entry-content">
                      <span className="memory-entry-meta">
                        <Badge
                          tone={
                            m.kind === "Rule learned"
                              ? "memory"
                              : m.kind === "Rule revoked"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {m.kind}
                        </Badge>
                        <span>
                          Session {m.session} ·{" "}
                          {new Date(m.timestamp).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </span>
                      <span className="memory-entry-text">{m.text}</span>
                      <span className="memory-entry-bottom">
                        <span>
                          <Check size={11} />
                          Saved locally
                        </span>
                        <span>
                          Linked to {m.usedBy.length}{" "}
                          {m.usedBy.length === 1 ? "request" : "requests"}
                        </span>
                      </span>
                    </span>
                    <ArrowRight size={15} />
                  </button>
                ))}
              </div>
            ) : (
              <Empty
                title={
                  state.memories.length
                    ? "No matching memories"
                    : "Your first decision starts here."
                }
                description={
                  state.memories.length
                    ? "Try a different search or memory type."
                    : "Sisih has no learned preferences yet. Review a request and choose Approve & remember."
                }
                action={
                  <Link href="/agent" className="button button-secondary">
                    Review requests
                    <ArrowRight size={14} />
                  </Link>
                }
              />
            )}
          </>
        )}
        {tab === "Active rules" &&
          (state.rules.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Merchant & category</th>
                    <th>Action</th>
                    <th>Up to</th>
                    <th>Valid through</th>
                    <th>Rule status</th>
                    <th>Enabled</th>
                  </tr>
                </thead>
                <tbody>
                  {state.rules.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.merchant}</strong>
                        <small>{r.category}</small>
                      </td>
                      <td>
                        <Badge
                          tone={r.action === "allow" ? "success" : "danger"}
                        >
                          {r.action === "allow" ? "Allow" : "Deny"}
                        </Badge>
                      </td>
                      <td>{money(r.maxAmount)} USDC</td>
                      <td>{r.expires}</td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => setSelected(r.memoryId)}
                        >
                          Inspect memory
                          <ArrowRight size={12} />
                        </button>
                      </td>
                      <td>
                        <button
                          className={`switch ${r.active ? "on" : ""}`}
                          role="switch"
                          aria-checked={r.active}
                          aria-label={`Enable ${r.merchant} rule`}
                          onClick={() => act({ type: "toggle-rule", id: r.id })}
                        >
                          <span />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="No remembered rules yet"
              description="Approve or reject a request with Remember to create your first merchant preference."
              action={
                <Link href="/agent" className="button button-secondary">
                  Review a request
                  <ArrowRight size={14} />
                </Link>
              }
            />
          ))}
        {tab === "Latest recall" &&
          (latest ? (
            <div className="recall-panel">
              <span className="eyebrow">LATEST MATCHED PREFERENCE</span>
              <h3>
                “Can {latest.merchant} spend {money(latest.amount)} USDC on{" "}
                {latest.category.toLowerCase()}?”
              </h3>
              <div className="notice notice-memory">
                <Brain size={18} />
                <div>
                  <strong>Matching local rule found</strong>
                  <p>
                    {state.memories.find((m) => m.id === latest.memoryId)?.text}
                  </p>
                </div>
              </div>
              <p className="muted">{latest.reason}</p>
              <Link
                href={`/agent?request=${latest.id}`}
                className="text-button"
              >
                Inspect the decision
                <ArrowRight size={13} />
              </Link>
              <p className="detail-note">
                Deterministic local matching by merchant, category, amount, and
                expiry. This is not a live semantic Walrus recall.
              </p>
            </div>
          ) : (
            <Empty
              title="Nothing recalled yet"
              description="Save a merchant rule, then run the same kind of request again from Demo controls."
            />
          ))}
        <div className="table-footer">
          Local storage · Real Walrus blob links appear after integration
        </div>
      </Panel>
      <Overlay
        open={Boolean(record)}
        onClose={() => setSelected(null)}
        title="Memory details"
        description="An inspectable local event, not a Mainnet Walrus memory."
      >
        {record && (
          <>
            <Badge tone="memory">{record.kind}</Badge>
            <p className="memory-full-text">{record.text}</p>
            <dl className="details-list">
              <div>
                <dt>Record ID</dt>
                <dd className="mono">
                  {record.id}
                  <CopyButton value={record.id} label="Copy memory ID" />
                </dd>
              </div>
              <div>
                <dt>Session</dt>
                <dd>{record.session}</dd>
              </div>
              <div>
                <dt>Storage</dt>
                <dd>This browser · localStorage</dd>
              </div>
              <div>
                <dt>Walrus blob ID</dt>
                <dd>Not available in demo mode</dd>
              </div>
              <div>
                <dt>Linked requests</dt>
                <dd>{record.usedBy.length}</dd>
              </div>
            </dl>
            {record.usedBy.length > 0 && (
              <div className="detail-section">
                <h3>Related requests</h3>
                {record.usedBy.map((id) => (
                  <Link
                    key={id}
                    className="detail-list-row"
                    href={`/agent?request=${id}`}
                  >
                    <span className="mono">{id}</span>
                    <ArrowRight size={14} />
                  </Link>
                ))}
              </div>
            )}
            <details className="raw-details">
              <summary>Inspect memory JSON</summary>
              <pre>{JSON.stringify(record, null, 2)}</pre>
            </details>
          </>
        )}
      </Overlay>
    </>
  );
}
