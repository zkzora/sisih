"use client";
/**
 * The 12 UI states from docs/SPEC.md ("UI states and sample data"), rendered from fixtures with
 * the real components. The server page permits this view in local development only.
 */
import { useEffect, useState } from "react";
import { AlertCircle, Ban, Bot, Pause, ShieldCheck, Wallet } from "lucide-react";
import { ToastStack } from "@/components/context";
import { MemoryStatusChip, TatumDot, VerifiedBadge, X402Stepper } from "@/components/live-bits";
import { Badge, Button, Empty, Skeleton } from "@/components/ui";


function State({ n, title, where, children }: { n: number; title: string; where: string; children: React.ReactNode }) {
  return (
    <section className="dev-state" id={`state-${n}`}>
      <h2>
        {n}. {title}
      </h2>
      <p>{where}</p>
      {children}
    </section>
  );
}

export default function DevStates() {
  const [now] = useState(() => Date.now());
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 5000);
    return () => clearInterval(t);
  }, []);
  const tatumOk = { level: "green" as const, host: "sui-testnet-grpc.gateway.tatum.io:443", network: "testnet", lastOkAt: now - 12_000, lastLatencyMs: 310, calls: 42, failures: 0, lastError: null };
  const tatumDown = { ...tatumOk, level: "red" as const, lastOkAt: now - 120_000, lastError: { at: now - 5_000, code: "UNAVAILABLE", message: "Received HTTP status code 503" } };
  return (
    <div className="dev-states">
      <div className="page-heading">
        <div>
          <div className="eyebrow">DEV · FIXTURES</div>
          <h1>UI states</h1>
          <p>The 12 states every screen must handle, rendered with the production components.</p>
        </div>
      </div>

      <State n={1} title="Empty, first session" where="Memory, What changed card">
        <Empty title="Your first decision starts here." description="Sisih doesn't know your agent's habits yet. Your first decision becomes the first memory." />
      </State>

      <State n={2} title="Loading" where="All cards and tables">
        <Skeleton />
      </State>

      <State n={3} title="New request arrives" where="Agent feed, sidebar badge">
        <table className="data-table">
          <tbody>
            <tr className="row-new held-table-row" key={tick}>
              <td className="mono">12:04:51</td>
              <td>
                <strong>SearchBox</strong> <span className="demo-word">DEMO</span>
              </td>
              <td>1.20 USDC</td>
              <td>
                <Badge tone="warning">On hold</Badge>
              </td>
            </tr>
          </tbody>
        </table>
        <p className="detail-note">
          Sidebar: <span className="nav-count">1</span>
        </p>
      </State>

      <State n={4} title="Transaction pending" where="Toast, activity row">
        <ToastStack toasts={[{ id: 1, message: "Deposit 1.00 USDC: waiting for Sui confirmation…", pending: true }]} onDismiss={() => {}} />
        <Badge tone="warning">Pending</Badge>
      </State>

      <State n={5} title="Transaction succeeded" where="Toast">
        <ToastStack toasts={[{ id: 2, message: "Deposit 1.00 USDC confirmed and verified via Tatum.", link: { href: "https://suiscan.xyz/testnet/tx/DZuc4Kn48evGF1h1EmY7x76DHFJzwrCNCgLFsaQk5oYT", label: "DZuc4Kn48e…" } }]} onDismiss={() => {}} />
      </State>

      <State n={6} title="Transaction failed" where="Toast, drawer">
        <ToastStack toasts={[{ id: 3, message: "Release to agent failed: EExceedsFree. Amount exceeds free funds; reserves are locked.", error: true, retry: () => {} }]} onDismiss={() => {}} />
        <X402Stepper done={["invoice_received"]} failed />
      </State>

      <State n={7} title="Tatum RPC error" where="Top bar, verification badge">
        <TatumDot tatum={tatumDown} now={now} onRetry={() => {}} />
        <div style={{ marginTop: 10 }}>
          <VerifiedBadge readAtMs={now - 120_000} error onRefresh={() => {}} />
        </div>
        <p className="detail-note">Healthy, for comparison:</p>
        <TatumDot tatum={tatumOk} now={now} />
      </State>

      <State n={8} title="Memory writing or failed" where="Memory card, toast">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <MemoryStatusChip status="writing" createdAtMs={now - 12_000} />
          <MemoryStatusChip status="failed" onRetry={() => {}} />
          <MemoryStatusChip status="stored" />
        </div>
      </State>

      <State n={9} title="Low free funds" where="Top bar meter">
        <div style={{ display: "flex", gap: 20 }}>
          <div className="available-meter low">
            <span className="status-dot" />
            <span>
              0.30 <small>USDC available to agent</small>
            </span>
          </div>
          <div className="available-meter empty">
            <span className="status-dot" />
            <span>
              0.00 <small>USDC available to agent</small>
            </span>
          </div>
        </div>
      </State>

      <State n={10} title="Obligations underfunded" where="Overview, Commitments">
        <div className="banner banner-danger">
          <Wallet size={18} />
          <span>1.20 USDC short of funding every commitment.</span>
          <Button variant="ghost">Deposit</Button>
        </div>
      </State>

      <State n={11} title="Agent paused" where="Global banner, agent card">
        <div className="banner banner-warning">
          <Pause size={16} />
          <span>Agent paused. All requests are denied.</span>
          <Button variant="ghost">Resume agent</Button>
        </div>
      </State>

      <State n={12} title="Agent permission revoked" where="Agent card">
        <section className="agent-card agent-card-revoked">
          <div className="agent-identity">
            <div className="agent-avatar">
              <Bot size={27} strokeWidth={1.5} />
            </div>
            <div>
              <h2>
                Research Agent <Badge tone="warning">Revoked</Badge>
              </h2>
              <p>Permission revoked. New spending requests are blocked.</p>
            </div>
            <div className="agent-actions">
              <Button>
                <ShieldCheck size={15} />
                Grant permission again
              </Button>
              <Button variant="ghost" disabled>
                <Ban size={15} />
                Revoke
              </Button>
            </div>
          </div>
        </section>
        <p className="detail-note">
          <AlertCircle size={12} /> Also shown in the global banner.
        </p>
      </State>
    </div>
  );
}
