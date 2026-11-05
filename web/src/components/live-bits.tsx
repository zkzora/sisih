"use client";
/** Small live-status pieces shared by the screens and /dev/states. */
import { Check, CircleDashed, ExternalLink, LoaderCircle, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { TatumStatus } from "@/lib/live";
import { Badge } from "./ui";

/** Re-render every `ms` (for countdowns and elapsed timers). */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export function ago(ms: number | null | undefined, now: number): string {
  if (!ms) return "never";
  const s = Math.max(0, Math.round((now - ms) / 1000));
  return s < 5 ? "just now" : `${formatDuration(s)} ago`;
}

/** "in 1m 20s" until a due time, then "due now". */
export function Countdown({ toMs }: { toMs: number }) {
  const now = useNow();
  const left = (toMs - now) / 1000;
  return (
    <span className="countdown" title={new Date(toMs).toLocaleString("en-US")}>
      {left > 0 ? `in ${formatDuration(left)}` : "due now"}
    </span>
  );
}

/** Walrus write status. "Writing" counts up so a ~25 s save reads as progress, not a hang. */
export function MemoryStatusChip({ status, createdAtMs, onRetry }: { status?: "writing" | "stored" | "failed"; createdAtMs?: number; onRetry?: () => void }) {
  const now = useNow();
  if (status === "writing") {
    const elapsed = createdAtMs ? (now - createdAtMs) / 1000 : 0;
    const pct = Math.min(95, (elapsed / 25) * 100);
    return (
      <span className="memory-chip memory-chip-writing" role="status" aria-label={`Writing to Walrus, ${Math.round(elapsed)} seconds`}>
        <LoaderCircle size={12} className="spin" aria-hidden />
        Writing to Walrus · {Math.round(elapsed)}s
        <span className="memory-chip-bar" aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </span>
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="memory-chip memory-chip-failed">
        <X size={12} aria-hidden /> Failed
        {onRetry && (
          <button className="text-button" onClick={onRetry}>
            <RotateCcw size={11} /> Retry
          </button>
        )}
      </span>
    );
  }
  if (status === "stored") {
    return (
      <span className="memory-chip memory-chip-stored">
        <Check size={12} aria-hidden /> Stored on Walrus mainnet
      </span>
    );
  }
  return null;
}

export function TatumDot({ tatum, now, onRetry }: { tatum?: TatumStatus | null; now: number; onRetry?: () => void }) {
  const level = tatum?.level ?? "yellow";
  const detail =
    level === "red"
      ? `error · last data ${ago(tatum?.lastOkAt, now)}`
      : `checked ${ago(tatum?.lastOkAt, now)}${tatum?.lastLatencyMs ? ` · ${tatum.lastLatencyMs} ms` : ""}`;
  return (
    <span className={`tatum-status tatum-${level}`} title={`Tatum RPC ${detail}${tatum?.lastError ? ` · ${tatum.lastError.message}` : ""}`}>
      <span className="status-dot" />
      Tatum RPC<span className="tatum-detail"> · {detail}</span>
      {level === "red" && onRetry && (
        <button className="text-button" onClick={onRetry}>
          Retry
        </button>
      )}
    </span>
  );
}

export function VerifiedBadge({ readAtMs, explorerUrl, objectId, onRefresh, error }: { readAtMs: number; explorerUrl?: string; objectId?: string; onRefresh?: () => void; error?: boolean }) {
  const now = useNow(5000);
  return (
    <span className={`verified-badge ${error ? "verified-badge-error" : ""}`}>
      <span className="status-dot" />
      {error ? `Tatum unavailable · last data ${ago(readAtMs, now)}` : `Verified via Tatum Sui RPC · ${ago(readAtMs, now)}`}
      {objectId && explorerUrl && (
        <a href={explorerUrl} target="_blank" rel="noreferrer" className="mono">
          {objectId.slice(0, 6)}…{objectId.slice(-4)} <ExternalLink size={11} />
        </a>
      )}
      {onRefresh && (
        <button className="text-button" onClick={onRefresh}>
          {error ? "Retry" : "Refresh"}
        </button>
      )}
    </span>
  );
}

export const X402_STEPS = [
  { key: "invoice_received", label: "402 invoice received" },
  { key: "funds_released", label: "Funds released from vault" },
  { key: "payment_sent", label: "Payment sent" },
  { key: "settle_verified", label: "Settlement verified via Tatum" },
] as const;

/** The 4 x402 steps for one request. `done` = steps seen live or implied by a paid request. */
export function X402Stepper({ done, failed, digests, network = "testnet" }: { done: string[]; failed?: boolean; digests?: { step: string; digest: string }[]; network?: string }) {
  const firstOpen = X402_STEPS.findIndex((s) => !done.includes(s.key));
  return (
    <ol className="x402-steps" aria-label="x402 payment progress">
      {X402_STEPS.map((s, i) => {
        const isDone = done.includes(s.key);
        const active = !isDone && i === firstOpen && !failed;
        const digest = s.key === "funds_released" ? digests?.find((d) => d.step === "release")?.digest : s.key === "settle_verified" ? digests?.find((d) => d.step === "x402_settle")?.digest : undefined;
        return (
          <li key={s.key} className={isDone ? "done" : active ? "active" : failed && i === firstOpen ? "failed" : ""}>
            {isDone ? <Check size={13} /> : active ? <LoaderCircle size={13} className="spin" /> : failed && i === firstOpen ? <X size={13} /> : <CircleDashed size={13} />}
            <span>{s.label}</span>
            {digest && (
              <a href={`https://suiscan.xyz/${network}/tx/${digest}`} target="_blank" rel="noreferrer" className="mono">
                {digest.slice(0, 8)}… <ExternalLink size={10} />
              </a>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function ExplorerLink({ digest, network = "testnet" }: { digest?: string; network?: string }) {
  if (!digest) return <span className="muted">—</span>;
  return (
    <a className="mono explorer-link" href={`https://suiscan.xyz/${network}/tx/${digest}`} target="_blank" rel="noreferrer">
      {digest.slice(0, 8)}…{digest.slice(-4)} <ExternalLink size={11} />
    </a>
  );
}

export function WalrusLink({ blobId, url }: { blobId?: string | null; url?: string | null }) {
  if (!blobId) return <span className="muted">pending</span>;
  return (
    <a className="mono explorer-link" href={url ?? `https://walruscan.com/mainnet/blob/${blobId}`} target="_blank" rel="noreferrer">
      {blobId.slice(0, 8)}… <ExternalLink size={11} />
    </a>
  );
}

export function VerificationBadge({ v, reason }: { v?: string; reason?: string | null }) {
  if (v === "verified") return <Badge tone="success">Verified</Badge>;
  if (v === "failed") return <Badge tone="danger">Failed{reason ? ` · ${reason}` : ""}</Badge>;
  if (v === "error") return <Badge tone="danger">Unreadable</Badge>;
  return (
    <Badge tone="warning">
      <LoaderCircle size={11} className="spin" /> Pending
    </Badge>
  );
}
