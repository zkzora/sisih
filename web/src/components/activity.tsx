"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ArrowRight, Download, LockKeyhole, ReceiptText, Search, ShieldCheck, ExternalLink, Brain } from "lucide-react";
import { DEMO_OWNER_LABEL, useSisih } from "./context";
import { Badge, Button, CopyButton, Empty, Overlay, PageHeading, Panel, Spinner } from "./ui";
import { money, short } from "@/lib/engine";
import { api, type LiveTx } from "@/lib/live";
import type { Activity } from "@/lib/types";
import { ExplorerLink, VerificationBadge } from "./live-bits";

const icon = (kind: Activity["kind"]) =>
  kind === "Deposit" ? <ArrowDownLeft size={16} /> : kind === "Reserve funds" || kind === "Update reserve" ? <LockKeyhole size={15} /> : kind === "Agent permission" || kind === "Vault created" ? <ShieldCheck size={15} /> : <ArrowUpRight size={16} />;

export function ActivityTable({ items, compact = false, onSelect }: { items: Activity[]; compact?: boolean; onSelect?: (id: string) => void }) {
  const { state } = useSisih();
  const network = state.live?.network;
  return items.length ? (
    <div className="table-scroll">
      <table className="data-table activity-table">
        <thead>
          <tr>
            {!compact && <th>Time</th>}
            <th>Activity</th>
            <th>Amount</th>
            {!compact && <th>From → to</th>}
            <th>Digest</th>
            <th>Tatum verification</th>
            {!compact && <th>Memory</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id}>
              {!compact && (
                <td className="mono">
                  {new Date(t.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </td>
              )}
              <td>
                <button className="activity-name table-name-button" onClick={() => onSelect?.(t.id)}>
                  <span className="activity-icon">{icon(t.kind)}</span>
                  <span>
                    <strong>{t.kind}</strong>
                    {compact && <small>{t.description}</small>}
                  </span>
                </button>
              </td>
              <td className="numeric">{t.amount ? <>{t.kind === "Deposit" ? "+" : ""}{money(t.amount)} <small>USDC</small></> : <span className="muted">—</span>}</td>
              {!compact && <td className="request-reason">{t.description}</td>}
              <td>
                <ExplorerLink digest={t.digest} network={network} />
              </td>
              <td>
                <VerificationBadge v={t.verification} reason={t.failureReason} />
              </td>
              {!compact && (
                <td>
                  {t.memoryId ? (
                    <Link className="text-button" href={`/memory?record=${t.memoryId}`}>
                      <Brain size={12} /> memory
                    </Link>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty title="No activity yet" description="Deposits, reserves, payments and agent releases appear here once Tatum has verified them." />
  );
}

export function ActivityView() {
  const { state, notify } = useSisih();
  const query = useSearchParams();
  const [selected, setSelected] = useState<string | null>(query.get("record"));
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("All activity");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tx, setTx] = useState<LiveTx | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const record = selected ? state.activities.find((a) => a.id === selected || (a.digest && a.digest === selected)) : undefined;
  useEffect(() => {
    setTx(null);
    setTxError(null);
    if (!record?.digest) return;
    api<LiveTx>(`/api/tx/${record.digest}`).then(setTx).catch((e) => setTxError((e as Error).message));
  }, [record?.digest]);
  const items = state.activities.filter((a) => {
    const day = a.timestamp.slice(0, 10);
    return (kind === "All activity" || a.kind === kind) && (!from || day >= from) && (!to || day <= to) && `${a.kind} ${a.description} ${a.digest}`.toLowerCase().includes(search.toLowerCase());
  });
  const download = () => {
    const rows = [["time", "type", "amount_usdc", "from", "to", "digest", "verification", "explorer"], ...items.map((a) => [a.timestamp, a.kind, String(a.amount / 1_000_000), a.from ?? "", a.to ?? "", a.digest ?? "", a.verification ?? "", a.explorerUrl ?? ""])];
    const csv = rows.map((r) => r.map((v) => '"' + v.replaceAll('"', '""') + '"').join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "sisih-activity.csv";
    a.click();
    URL.revokeObjectURL(url);
    notify("Activity exported.");
  };
  const verified = state.activities.filter((a) => a.verification === "verified").length;
  return (
    <>
      <PageHeading
        title="Every movement, accounted for."
        description="Every vault and agent transaction, verified through Tatum Sui RPC."
        action={
          <Button variant="secondary" onClick={download}>
            <Download size={15} />
            Export CSV
          </Button>
        }
      />
      <div className="integration-notice">
        <ShieldCheck size={18} />
        <div>
          <strong>Verified via Tatum Sui RPC</strong>
          <p>Each digest was read back through Tatum (effects and events) before it appears here. Tatum does not offer event queries, so Sisih records the digests it sends and the ones your wallet signs.</p>
        </div>
        <Badge tone="success">
          {verified} of {state.activities.length} verified
        </Badge>
      </div>
      <Panel>
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input aria-label="Search activity" type="search" placeholder="Search activity or digest…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select aria-label="Filter activity type" value={kind} onChange={(e) => setKind(e.target.value)}>
            {["All activity", ...new Set(state.activities.map((a) => a.kind))].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
          <input type="date" aria-label="From date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" aria-label="To date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <ActivityTable items={items} onSelect={setSelected} />
        <div className="table-footer">
          {items.length} {items.length === 1 ? "record" : "records"} · Sui {state.preferences.network} · explorer links open Suiscan
        </div>
      </Panel>
      <Overlay open={Boolean(record)} onClose={() => setSelected(null)} title={record?.kind || "Transaction"} description="A Sui transaction read back through Tatum.">
        {record && (
          <>
            <div className="detail-hero">
              <ReceiptText size={24} />
              <strong>
                {money(record.amount)}
                <small>USDC</small>
              </strong>
              <VerificationBadge v={record.verification} reason={record.failureReason} />
            </div>
            <dl className="details-list">
              <div>
                <dt>From → to</dt>
                <dd>{record.description}</dd>
              </div>
              <div>
                <dt>Digest</dt>
                <dd className="mono">
                  {record.digest ? short(record.digest) : "—"}
                  {record.digest && <CopyButton value={record.digest} label="Copy digest" />}
                </dd>
              </div>
              <div>
                <dt>Checkpoint</dt>
                <dd className="mono">{tx?.checkpoint ?? record.checkpoint ?? "—"}</dd>
              </div>
              <div>
                <dt>Confirmed</dt>
                <dd>{tx?.timestampMs ? new Date(tx.timestampMs).toLocaleString("en-US") : new Date(record.timestamp).toLocaleString("en-US")}</dd>
              </div>
              <div>
                <dt>Gas</dt>
                <dd>{tx?.gasMist ? `${(Number(tx.gasMist) / 1e9).toFixed(6)} SUI` : "—"}</dd>
              </div>
              <div>
                <dt>Recorded by</dt>
                <dd>{tx?.source === "owner" ? "Owner wallet (posted by the browser)" : tx?.source === "demo_owner" ? DEMO_OWNER_LABEL : tx?.source === "import" ? "Imported digest" : "Sisih server"}</dd>
              </div>
            </dl>
            {record.explorerUrl && (
              <a className="button button-secondary" href={record.explorerUrl} target="_blank" rel="noreferrer">
                Open in Suiscan <ExternalLink size={13} />
              </a>
            )}
            <div className="detail-section">
              <h3>Events emitted</h3>
              {tx ? (
                tx.events.length ? (
                  tx.events.map((e, i) => (
                    <div className="detail-list-row" key={i}>
                      <span className="mono">{e.type.split("::").slice(-2).join("::")}</span>
                    </div>
                  ))
                ) : (
                  <p className="muted">No Move events (for example an x402 settlement or a failed call).</p>
                )
              ) : txError ? (
                <p className="field-error">{txError}</p>
              ) : (
                <Spinner label="Loading" />
              )}
            </div>
            {record.memoryId && (
              <Link href={`/memory?record=${record.memoryId}`} className="text-button">
                View related memory
                <ArrowRight size={13} />
              </Link>
            )}
            {tx && (
              <details className="raw-details">
                <summary>Raw response from Tatum (as recorded)</summary>
                <pre>{JSON.stringify(tx, null, 2)}</pre>
              </details>
            )}
          </>
        )}
      </Overlay>
    </>
  );
}
