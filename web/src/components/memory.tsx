"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Brain, Clock3, ExternalLink, Layers, Search, ShieldCheck } from "lucide-react";
import { useSisih } from "./context";
import { Badge, CopyButton, Empty, Overlay, PageHeading, Panel } from "./ui";
import { money, short } from "@/lib/engine";
import { whatChanged } from "@/lib/changes";
import { api } from "@/lib/live";
import { MemoryStatusChip, WalrusLink } from "./live-bits";

const KINDS = ["All types", "Decision", "Rule learned", "Obligation outcome", "Reserve updated", "Rule revoked", "Session summary", "Merchant note"];

export function WhatChanged({ compact = false }: { compact?: boolean }) {
  const { state } = useSisih();
  const changes = whatChanged(state);
  if (!changes.length) {
    return (
      <div className="inline-empty">
        {state.session <= 1 ? "Sisih doesn't know your agent's habits yet. Your first decision becomes the first memory." : "Nothing new carried over from the last session yet."}
      </div>
    );
  }
  return (
    <table className="data-table changes-table">
      <thead>
        <tr>
          <th>What</th>
          <th>Before</th>
          <th>After</th>
          {!compact && <th>Source</th>}
        </tr>
      </thead>
      <tbody>
        {changes.map((c) => (
          <tr key={c.label}>
            <td>{c.label}</td>
            <td className="muted">{c.before}</td>
            <td>
              <strong>{c.after}</strong>
            </td>
            {!compact && (
              <td>
                <Badge tone="memory">{c.source}</Badge>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function MemoryView() {
  const { state, act, notify, unlocked } = useSisih();
  const query = useSearchParams();
  const [selected, setSelected] = useState<string | null>(query.get("record"));
  const [tab, setTab] = useState("Timeline");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("All types");
  const [session, setSession] = useState("All sessions");
  const live = state.live;
  const items = state.memories.filter(
    (m) => (kind === "All types" || m.kind === kind) && (session === "All sessions" || m.session === Number(session.replace("Session ", ""))) && m.text.toLowerCase().includes(search.toLowerCase()),
  );
  // A writing memory has no blob id yet: never match on null.
  const record = selected ? state.memories.find((m) => m.id === selected || (m.blobId && m.blobId === selected)) : undefined;
  const recall = live?.recall;
  const stored = state.memories.filter((m) => m.status === "stored").length;
  const retry = async (id: string) => {
    try {
      await api(`/api/memories/${id}/retry`, { method: "POST" });
    } catch (e) {
      notify((e as Error).message, true);
    }
  };
  const sessions = [...new Set(state.memories.map((m) => m.session))].sort((a, b) => a - b);
  return (
    <>
      <PageHeading
        title="A workspace that remembers."
        description="Your preferences carry forward. Your spending boundaries never change."
        action={
          <Badge tone="memory">
            <Brain size={13} />
            {stored} memories on Walrus mainnet
          </Badge>
        }
      />
      <div className="memory-boundary">
        <span className="memory-boundary-icon">
          <Brain size={22} />
        </span>
        <div>
          <h3>Memory guides preferences. The vault sets the limits.</h3>
          <p>A remembered approval can skip a review. It can never unlock money reserved for a commitment: the Move vault refuses that.</p>
        </div>
        <ShieldCheck size={23} />
      </div>
      <div className="summary-strip">
        <div>
          <span>Stored on Walrus mainnet</span>
          <strong>
            {stored}
            <small>{state.memories.length - stored ? ` · ${state.memories.length - stored} writing or failed` : "memories"}</small>
          </strong>
        </div>
        <div>
          <span>This session</span>
          <strong>
            {state.memories.filter((m) => m.session === state.session).length}
            <small>new memories</small>
          </strong>
        </div>
        <div>
          <span>Active rules</span>
          <strong>{state.rules.filter((r) => r.active).length}</strong>
        </div>
        <div>
          <span>Namespace · agent</span>
          <strong className="mono small-strong">
            {live?.memory.namespace ?? "—"}
            <small>{live?.health?.memwal.agentId ? short(live.health.memwal.agentId) : ""}</small>
          </strong>
        </div>
        <div>
          <span>Relayer</span>
          <strong className="small-strong">
            <Badge tone={live?.health?.memwal.ok ? "success" : "warning"}>{live?.health?.memwal.ok ? "healthy" : "checking"}</Badge>
          </strong>
        </div>
      </div>
      <Panel title="What changed since last session">
        <WhatChanged />
      </Panel>
      <Panel>
        <div className="request-toolbar">
          <div className="tab-list" aria-label="Memory views">
            {["Timeline", "Active rules", "Last recall"].map((t) => (
              <button key={t} className={tab === t ? "selected" : ""} aria-pressed={tab === t} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>
          <Badge tone="memory">Walrus Memory · mainnet</Badge>
        </div>
        {tab === "Timeline" && (
          <>
            <div className="table-toolbar">
              <div className="search-field">
                <Search size={16} />
                <input type="search" aria-label="Search memory" placeholder="Search decisions, merchants, or rules…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <select aria-label="Filter memory type" value={kind} onChange={(e) => setKind(e.target.value)}>
                {KINDS.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
              <select aria-label="Filter session" value={session} onChange={(e) => setSession(e.target.value)}>
                {["All sessions", ...sessions.map((s) => `Session ${s}`)].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </div>
            {items.length ? (
              <div className="memory-timeline">
                {items.map((m) => (
                  <div className="memory-entry" key={m.id}>
                    <span className="memory-entry-icon">{m.kind === "Rule learned" ? <Brain size={17} /> : m.kind === "Session summary" ? <Layers size={17} /> : <Clock3 size={17} />}</span>
                    <button className="memory-entry-content" onClick={() => setSelected(m.id)}>
                      <span className="memory-entry-meta">
                        <Badge tone={m.kind === "Rule learned" ? "memory" : m.kind === "Rule revoked" ? "warning" : "neutral"}>{m.kind}</Badge>
                        <span>
                          Session {m.session} · {new Date(m.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                      </span>
                      <span className="memory-entry-text">{m.text}</span>
                    </button>
                    <span className="memory-entry-bottom">
                      <MemoryStatusChip status={m.status} createdAtMs={m.createdAtMs} onRetry={unlocked ? () => void retry(m.id) : undefined} />
                      {m.blobId && (
                        <span>
                          blob <WalrusLink blobId={m.blobId} url={m.walrusUrl} />
                        </span>
                      )}
                      <span>
                        used in {m.usedBy.length} {m.usedBy.length === 1 ? "decision" : "decisions"}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title={state.memories.length ? "No matching memories" : "Your first decision starts here."}
                description={state.memories.length ? "Try a different search, type or session." : "Sisih doesn't know your agent's habits yet. Your first decision becomes the first memory."}
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
                    <th>Rule</th>
                    <th>Action</th>
                    <th>Source memory</th>
                    <th>Used</th>
                    <th>Valid through</th>
                    <th>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {state.rules.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.sentence ?? `${r.merchant} up to ${money(r.maxAmount)} USDC`}</strong>
                        <small>{r.origin === "walrus" ? "Rebuilt from Walrus at session start" : "Saved this session"}</small>
                      </td>
                      <td>
                        <Badge tone={r.action === "allow" ? "success" : "danger"}>{r.action === "allow" ? "Allow" : "Deny"}</Badge>
                      </td>
                      <td>{r.walrusUrl ? <WalrusLink blobId={r.walrusUrl.split("/").pop()} url={r.walrusUrl} /> : <button className="text-button" onClick={() => setSelected(r.memoryId)}>Inspect memory</button>}</td>
                      <td>{r.timesUsed ?? 0}×</td>
                      <td>{r.expires}</td>
                      <td>
                        <button
                          className={`switch ${r.active ? "on" : ""}`}
                          role="switch"
                          aria-checked={r.active}
                          aria-label={`Enable ${r.merchant} rule`}
                          disabled={!unlocked}
                          title={r.active ? "Turning this off writes a rule_disabled memory" : "Turning this on writes the rule again"}
                          onClick={() => void act({ type: "toggle-rule", id: r.id })}
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
              description="Approve or deny a request with Remember to create your first merchant rule."
              action={
                <Link href="/agent" className="button button-secondary">
                  Review a request
                  <ArrowRight size={14} />
                </Link>
              }
            />
          ))}
        {tab === "Last recall" &&
          (recall ? (
            <div className="recall-panel">
              <span className="eyebrow">QUERY SENT TO WALRUS MEMORY RECALL</span>
              <h3 className="mono">“{recall.query}”</h3>
              <p className="detail-note">
                {recall.results.length} memories returned in {recall.ms} ms · {new Date(recall.at).toLocaleTimeString("en-US")}
              </p>
              <ol className="recall-results">
                {[...recall.results]
                  .sort((a, b) => a.distance - b.distance)
                  .map((m) => (
                    <li key={m.blobId}>
                      <Badge tone="memory">distance {m.distance.toFixed(2)}</Badge>
                      <span>{m.text.replace(/^\[sisih:v1:[a-z_]+\]\s*/, "").replace(/\s*\{[\s\S]*\}\s*$/, "")}</span>
                      <WalrusLink blobId={m.blobId} />
                    </li>
                  ))}
              </ol>
              {recall.request && (
                <div className="notice notice-memory">
                  <Brain size={18} />
                  <div>
                    <strong>
                      Final decision for {recall.request.merchant} {money(Number(recall.request.amount))} USDC: {recall.request.status.replace("_", " ")}
                    </strong>
                    <p>{recall.request.reasons[0]}</p>
                    <Link href={`/agent?request=${recall.request.id}`} className="text-button">
                      Inspect the decision
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              )}
              <p className="detail-note">Decisions come from the rules cache (rebuilt from Walrus each session). Recall runs in parallel and is attached when it arrives.</p>
            </div>
          ) : (
            <Empty title="Nothing recalled yet" description="Run a task from Demo controls; its recall query and results appear here." />
          ))}
        <div className="table-footer">Every memory is a Walrus blob on mainnet; links open Walruscan</div>
      </Panel>
      <Overlay open={Boolean(record)} onClose={() => setSelected(null)} title="Memory details" description="A memory stored with Walrus Memory on mainnet.">
        {record && (
          <>
            <Badge tone="memory">{record.kind}</Badge>
            <p className="memory-full-text">{record.text}</p>
            <MemoryStatusChip status={record.status} createdAtMs={record.createdAtMs} />
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
                <dt>Time</dt>
                <dd>{new Date(record.timestamp).toLocaleString("en-US")}</dd>
              </div>
              <div>
                <dt>Namespace</dt>
                <dd className="mono">{record.namespace}</dd>
              </div>
              <div>
                <dt>Walrus blob ID</dt>
                <dd className="mono">
                  {record.blobId ? (
                    <>
                      {short(record.blobId)}
                      <CopyButton value={record.blobId} label="Copy blob ID" />
                    </>
                  ) : (
                    "Pending"
                  )}
                </dd>
              </div>
            </dl>
            {record.blobId && (
              <a className="button button-secondary" href={record.walrusUrl ?? `https://walruscan.com/mainnet/blob/${record.blobId}`} target="_blank" rel="noreferrer">
                Open in Walrus <ExternalLink size={13} />
              </a>
            )}
            {record.usedBy.length > 0 && (
              <div className="detail-section">
                <h3>Decisions that used this memory</h3>
                {record.usedBy.map((id) => (
                  <Link key={id} className="detail-list-row" href={`/agent?request=${id}`}>
                    <span className="mono">{id}</span>
                    <ArrowRight size={14} />
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </Overlay>
    </>
  );
}
