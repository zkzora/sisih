"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  Download,
  LockKeyhole,
  ReceiptText,
  Search,
  FlaskConical,
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
import { money, short } from "@/lib/engine";
import type { Activity } from "@/lib/types";
export function ActivityTable({
  items,
  compact = false,
  onSelect,
}: {
  items: Activity[];
  compact?: boolean;
  onSelect?: (id: string) => void;
}) {
  return items.length ? (
    <div className="table-scroll">
      <table className="data-table activity-table">
        <thead>
          <tr>
            <th>Activity</th>
            <th>Amount</th>
            <th>Status</th>
            {!compact && <th>Session</th>}
            <th>Receipt</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id}>
              <td>
                <span className="activity-name">
                  <span className="activity-icon">
                    {t.kind === "Deposit" ? (
                      <ArrowDownLeft size={16} />
                    ) : t.kind === "Reserve funds" ? (
                      <LockKeyhole size={15} />
                    ) : (
                      <ArrowUpRight size={16} />
                    )}
                  </span>
                  <span>
                    <strong>{t.kind}</strong>
                    {!compact && <small>{t.description}</small>}
                  </span>
                </span>
              </td>
              <td className="numeric">
                {t.kind === "Deposit" ? "+" : ""}
                {money(t.amount)} <small>USDC</small>
              </td>
              <td>
                <Badge
                  tone={t.kind === "Reserve funds" ? "neutral" : "success"}
                >
                  {t.kind === "Reserve funds" ? (
                    <LockKeyhole size={11} />
                  ) : (
                    <span className="status-dot" />
                  )}
                  {t.kind === "Reserve funds"
                    ? "Reserved · demo"
                    : "Complete · demo"}
                </Badge>
              </td>
              {!compact && <td>{t.session}</td>}
              <td>
                {onSelect ? (
                  <button
                    className="receipt-link mono"
                    onClick={() => onSelect(t.id)}
                  >
                    {short(t.id)}
                    <ArrowUpRight size={12} />
                  </button>
                ) : (
                  <Link
                    className="receipt-link mono"
                    href={`/activity?record=${t.id}`}
                  >
                    {short(t.id)}
                    <ArrowUpRight size={12} />
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty
      title="No activity yet"
      description="Deposits, reserve changes, and agent payments will appear here."
    />
  );
}
export function ActivityView() {
  const { state, notify } = useSisih();
  const query = useSearchParams();
  const [selected, setSelected] = useState<string | null>(query.get("record"));
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("All activity");
  const record = state.activities.find((a) => a.id === selected);
  const items = state.activities.filter(
    (a) =>
      (kind === "All activity" || a.kind === kind) &&
      `${a.kind} ${a.description} ${a.id}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const download = () => {
    const rows = [
      ["id", "type", "amount_usdc", "description", "session", "mode"],
      ...items.map((a) => [
        a.id,
        a.kind,
        String(a.amount / 1_000_000),
        a.description,
        String(a.session),
        "simulated",
      ]),
    ];
    const csv = rows
      .map((r) => r.map((v) => '"' + v.replaceAll('"', '""') + '"').join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "sisih-demo-activity.csv";
    a.click();
    URL.revokeObjectURL(url);
    notify("Demo activity exported.");
  };
  return (
    <>
      <PageHeading
        title="Every movement, accounted for."
        description="Follow deposits, commitments, and spending from one place."
        action={
          <Button variant="secondary" onClick={download}>
            <Download size={15} />
            Export CSV
          </Button>
        }
      />
      <div className="integration-notice">
        <FlaskConical size={18} />
        <div>
          <strong>Local demo receipts</strong>
          <p>
            These records are simulated. No transaction digest, checkpoint, or
            Tatum verification is claimed.
          </p>
        </div>
        <Badge>Not connected</Badge>
      </div>
      <Panel>
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              aria-label="Search activity"
              type="search"
              placeholder="Search activity or receipt…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter activity type"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {[
              "All activity",
              ...new Set(state.activities.map((a) => a.kind)),
            ].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </div>
        <ActivityTable items={items} onSelect={setSelected} />
        <div className="table-footer">
          {items.length} {items.length === 1 ? "record" : "records"} · All
          amounts in USDC
        </div>
      </Panel>
      <Overlay
        open={Boolean(record)}
        onClose={() => setSelected(null)}
        title={record?.kind || "Receipt"}
        description="A local record of a simulated vault action."
      >
        {record && (
          <>
            <div className="detail-hero">
              <ReceiptText size={24} />
              <strong>
                {money(record.amount)}
                <small>USDC</small>
              </strong>
              <Badge tone="success">Recorded locally</Badge>
            </div>
            <dl className="details-list">
              <div>
                <dt>Description</dt>
                <dd>{record.description}</dd>
              </div>
              <div>
                <dt>Session</dt>
                <dd>{record.session}</dd>
              </div>
              <div>
                <dt>Recorded</dt>
                <dd>{new Date(record.timestamp).toLocaleString("en-US")}</dd>
              </div>
              <div>
                <dt>Receipt ID</dt>
                <dd className="mono">
                  {short(record.id)}
                  <CopyButton value={record.id} label="Copy receipt ID" />
                </dd>
              </div>
              <div>
                <dt>Chain verification</dt>
                <dd>Not connected</dd>
              </div>
            </dl>
            <div className="info-box">
              <FlaskConical size={17} />
              <p>
                Real explorer links and transaction verification will be
                available after the Sui and Tatum adapters are connected.
              </p>
            </div>
            {record.memoryId && (
              <Link
                href={`/memory?record=${record.memoryId}`}
                className="text-button"
              >
                View related memory
                <ArrowRight size={13} />
              </Link>
            )}
            <details className="raw-details">
              <summary>Inspect local receipt JSON</summary>
              <pre>
                {JSON.stringify(
                  { ...record, mode: "demo", onchainVerified: false },
                  null,
                  2,
                )}
              </pre>
            </details>
          </>
        )}
      </Overlay>
    </>
  );
}
