"use client";
import { ArrowRight, Brain, ChartNoAxesCombined, CheckCircle2, Download, ShieldCheck, ListChecks } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useSisih } from "./context";
import { Badge, Button, Empty, PageHeading, Panel } from "./ui";
import { categories, money } from "@/lib/engine";

const SOURCE = "From Walrus memories + Sui events via Tatum";
const C = { primary: "var(--primary)", reserved: "var(--reserved)", available: "var(--available)", danger: "var(--danger)", memory: "var(--memory)", grid: "var(--border)", text: "var(--muted-foreground)" };
const axis = { stroke: C.text, fontSize: 12, tickLine: false, axisLine: false } as const;
const tooltipStyle = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }, labelStyle: { color: "var(--foreground)" } };

function ChartBox({ children, label }: { children: React.ReactElement; label: string }) {
  return (
    <div className="recharts-box" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height={200}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export function LearningView() {
  const { state, act, notify, unlocked } = useSisih();
  const insights = state.live?.insights;
  const sessions = (insights?.sessions ?? []).filter((s) => s.requests > 0 || s.obligationsOnTime + s.obligationsUnderfunded > 0);
  const cards = insights?.cards;
  const rows = sessions.map((s) => ({
    name: `S${s.session}`,
    manual: s.manualReviews,
    falseHolds: s.falseHolds,
    protected: Number(s.moneyProtectedCumulative) / 1e6,
    onTime: s.obligationsOnTime,
    underfunded: s.obligationsUnderfunded,
  }));
  const spend = categories.map((c) => ({
    name: c,
    usdc: sessions.reduce((v, s) => v + Number(s.spendByCategory[c.toLowerCase()] ?? 0), 0) / 1e6,
  }));
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ source: SOURCE, insights }, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "sisih-learning.json";
    a.click();
    URL.revokeObjectURL(url);
    notify("Learning report exported. Every figure comes from real requests, memories and vault events.");
  };
  return (
    <>
      <PageHeading
        title="See what experience changes."
        description="Less repeated review. The same spending boundaries."
        action={
          <Button variant="secondary" onClick={download}>
            <Download size={15} />
            Export report
          </Button>
        }
      />
      <div className="metrics-grid metrics-grid-4">
        <Panel>
          <span className="metric-label">
            <Brain size={15} />
            Memories stored
          </span>
          <strong className="metric-value">{cards?.memoriesStored ?? 0}</strong>
          <small className="muted">On Walrus mainnet{cards?.memoriesWriting ? ` · ${cards.memoriesWriting} writing` : ""}</small>
        </Panel>
        <Panel>
          <span className="metric-label">
            <ListChecks size={15} />
            Active rules
          </span>
          <strong className="metric-value">{cards?.activeRules ?? 0}</strong>
          <small className="muted">Rebuilt from Walrus each session</small>
        </Panel>
        <Panel>
          <span className="metric-label">
            <CheckCircle2 size={15} />
            Automatic decisions
          </span>
          <strong className="metric-value">
            {cards?.automaticPctLastSession ?? 0}
            <small>%</small>
          </strong>
          <small className="muted">In the last session with requests</small>
        </Panel>
        <Panel>
          <span className="metric-label">
            <ShieldCheck size={15} />
            Money protected
          </span>
          <strong className="metric-value">
            {money(Number(cards?.moneyProtectedTotal ?? 0))}
            <small>USDC</small>
          </strong>
          <small className="muted">Committed funds requests would have used</small>
        </Panel>
      </div>
      <div className="learning-explanation">
        <Badge tone="memory">Data from {sessions.length} demo {sessions.length === 1 ? "session" : "sessions"}</Badge>
        <p>Every figure comes from real agent requests, Walrus memories and Tatum-verified vault events in this workspace. Nothing is seeded or estimated.</p>
      </div>
      {rows.length ? (
        <div className="charts-grid">
          <Panel title="Requests needing manual review" action={<Badge>{rows.length} sessions</Badge>}>
            <ChartBox label={rows.map((r) => `${r.name}: ${r.manual} manual reviews`).join(", ")}>
              <LineChart data={rows} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="name" {...axis} />
                <YAxis allowDecimals={false} {...axis} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="manual" name="Manual reviews" stroke={C.primary} strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ChartBox>
            <p className="chart-caption">{SOURCE}. Requests held for the owner, per session.</p>
          </Panel>
          <Panel title="False holds (held, then approved)">
            <ChartBox label={rows.map((r) => `${r.name}: ${r.falseHolds}`).join(", ")}>
              <BarChart data={rows} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="name" {...axis} />
                <YAxis allowDecimals={false} {...axis} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="falseHolds" name="Held, then approved" fill={C.memory} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartBox>
            <p className="chart-caption">{SOURCE}. Legitimate requests that still needed a click.</p>
          </Panel>
          <Panel title="Money protected (cumulative)">
            <ChartBox label={rows.map((r) => `${r.name}: ${r.protected.toFixed(2)} USDC`).join(", ")}>
              <LineChart data={rows} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="name" {...axis} />
                <YAxis {...axis} tickFormatter={(v: number) => v.toFixed(1)} />
                <Tooltip {...tooltipStyle} formatter={(v) => `${Number(v).toFixed(2)} USDC`} />
                <Line type="stepAfter" dataKey="protected" name="Protected" stroke={C.reserved} strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ChartBox>
            <p className="chart-caption">{SOURCE}. USDC of committed funds that requests would have cut, kept reserved.</p>
          </Panel>
          <Panel title="Obligations paid on time">
            <ChartBox label={rows.map((r) => `${r.name}: ${r.onTime} on time, ${r.underfunded} underfunded`).join(", ")}>
              <BarChart data={rows} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="name" {...axis} />
                <YAxis allowDecimals={false} {...axis} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="onTime" name="Covered by reserve" stackId="a" fill={C.primary} />
                <Bar dataKey="underfunded" name="Reserve short" stackId="a" fill={C.danger} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartBox>
            <p className="chart-caption">{SOURCE}. ObligationPaid events: a bill is short when its reserve did not cover it.</p>
          </Panel>
        </div>
      ) : (
        <Panel>
          <Empty
            title="Your first session is still in progress."
            description="Run a few tasks, remember a preference and start the next session. Real measurements appear here."
            action={
              <Button onClick={() => void act({ type: "new-session" })} disabled={!unlocked}>
                Complete Session {state.session}
                <ArrowRight size={15} />
              </Button>
            }
          />
        </Panel>
      )}
      <Panel title="Agent spend by category" action={<Badge>All sessions</Badge>}>
        <ChartBox label={spend.map((s) => `${s.name}: ${s.usdc.toFixed(2)} USDC`).join(", ")}>
          <BarChart data={spend} layout="vertical" margin={{ top: 4, right: 24, left: 16, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} horizontal={false} />
            <XAxis type="number" {...axis} tickFormatter={(v: number) => v.toFixed(2)} />
            <YAxis type="category" dataKey="name" {...axis} width={80} />
            <Tooltip {...tooltipStyle} formatter={(v) => `${Number(v).toFixed(2)} USDC`} />
            <Bar dataKey="usdc" name="Spent" fill={C.available} stroke={C.primary} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartBox>
        <p className="chart-caption">{SOURCE}. Where free money went (approved and paid requests).</p>
      </Panel>
      <div className="notice notice-neutral">
        <ChartNoAxesCombined size={19} />
        <p>Fewer approval prompts are useful only when legitimate payments still succeed and commitments stay protected. Both are measured here, from this workspace only.</p>
      </div>
    </>
  );
}
