"use client";
import {
  ArrowRight,
  Brain,
  ChartNoAxesCombined,
  CheckCircle2,
  Download,
  ShieldCheck,
} from "lucide-react";
import { useSisih } from "./context";
import { Badge, Button, Empty, PageHeading, Panel } from "./ui";
import { categories, money, sessionStats } from "@/lib/engine";
function Chart({
  values,
  unit = "requests",
  line = false,
}: {
  values: { label: string; value: number }[];
  unit?: string;
  line?: boolean;
}) {
  const max = Math.max(1, ...values.map((v) => v.value));
  if (line) {
    const points = values.map((v, i) => ({
      x: values.length === 1 ? 300 : 40 + (i * 520) / (values.length - 1),
      y: 130 - (v.value / max) * 100,
      ...v,
    }));
    return (
      <svg
        className="line-chart"
        viewBox="0 0 600 185"
        role="img"
        aria-label={values
          .map((v) => `${v.label}: ${v.value} ${unit}`)
          .join(", ")}
      >
        <line x1="30" y1="130" x2="570" y2="130" className="chart-grid" />
        <line x1="30" y1="80" x2="570" y2="80" className="chart-grid" />
        {points.length > 1 && (
          <polyline
            points={points.map((p) => `${p.x},${p.y}`).join(" ")}
            className="chart-line"
          />
        )}
        {points.map((p) => (
          <g key={p.label}>
            <circle cx={p.x} cy={p.y} r="5" className="chart-point" />
            <text
              x={p.x}
              y={p.y - 14}
              textAnchor="middle"
              className="chart-label"
            >
              {p.value}
            </text>
            <text x={p.x} y="162" textAnchor="middle" className="chart-axis">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    );
  }
  return (
    <div
      className="bar-chart"
      role="img"
      aria-label={values
        .map((v) => `${v.label}: ${v.value} ${unit}`)
        .join(", ")}
    >
      {values.map((v) => (
        <div className="bar-column" key={v.label}>
          <span>{v.value}</span>
          <div className="bar-track">
            <i style={{ height: `${(v.value / max) * 100}%` }} />
          </div>
          <small>{v.label}</small>
        </div>
      ))}
    </div>
  );
}
export function LearningView() {
  const { state, act, notify } = useSisih();
  const history = state.sessions;
  const current = sessionStats(state);
  const total = state.requests.length;
  const automatic = state.requests.filter((r) => r.automatic).length;
  let blocked = 0;
  const cumulative = history.map((s) => {
    blocked += s.blocked;
    return {
      label: `S${s.session}`,
      value: Number((blocked / 1_000_000).toFixed(2)),
    };
  });
  const download = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { mode: "local-demo", sessions: history, currentSession: current },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "sisih-demo-learning.json";
    a.click();
    URL.revokeObjectURL(url);
    notify(
      "Learning report exported. All figures are from your demo sessions.",
    );
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
      <div className="metrics-grid">
        <Panel>
          <span className="metric-label">
            <Brain size={15} />
            Local memories
          </span>
          <strong className="metric-value">{state.memories.length}</strong>
          <small className="muted">Decisions and outcomes retained</small>
        </Panel>
        <Panel>
          <span className="metric-label">
            <CheckCircle2 size={15} />
            Automatic decisions
          </span>
          <strong className="metric-value">
            {total ? Math.round((automatic / total) * 100) : 0}
            <small>%</small>
          </strong>
          <small className="muted">
            {automatic} of {total} demo requests
          </small>
        </Panel>
        <Panel>
          <span className="metric-label">
            <ShieldCheck size={15} />
            Attempted overspend blocked
          </span>
          <strong className="metric-value">
            {money(state.requests.reduce((v, r) => v + r.blockedAmount, 0))}
            <small>USDC</small>
          </strong>
          <small className="muted">Sum of reserve shortfalls prevented</small>
        </Panel>
      </div>
      <div className="learning-explanation">
        <Badge tone="memory">Measured demo activity</Badge>
        <p>
          Charts use completed sessions from this browser. No seeded performance
          history or Mainnet results are included. Repeated blocked requests are
          counted individually.
        </p>
      </div>
      {history.length ? (
        <>
          <div className="charts-grid">
            <Panel
              title="Requests requiring review"
              action={<Badge>{history.length} sessions</Badge>}
            >
              <Chart
                values={history.map((s) => ({
                  label: `S${s.session}`,
                  value: s.manual,
                }))}
                line
              />
              <p className="chart-caption">
                Requests routed to owner review, including unresolved holds.
              </p>
            </Panel>
            <Panel title="Approved after review">
              <Chart
                values={history.map((s) => ({
                  label: `S${s.session}`,
                  value: s.falseHolds,
                }))}
              />
              <p className="chart-caption">
                Owner approvals after an initial hold. This does not prove the
                original hold was incorrect.
              </p>
            </Panel>
            <Panel title="Attempted overspend blocked">
              <Chart values={cumulative} line unit="USDC" />
              <p className="chart-caption">
                Cumulative difference between blocked payment amounts and
                available funds.
              </p>
            </Panel>
            <Panel title="Commitment funding">
              <div className="funding-chart">
                {history.map((s) => (
                  <div key={s.session}>
                    <span>Session {s.session}</span>
                    <div className="funding-bar">
                      <i className="funded" style={{ flex: s.funded }} />
                      <i
                        className="underfunded"
                        style={{ flex: s.underfunded }}
                      />
                    </div>
                    <strong>
                      {s.funded}
                      <small> / {s.funded + s.underfunded}</small>
                    </strong>
                  </div>
                ))}
              </div>
              <div className="chart-key">
                <span>
                  <i className="funded" />
                  Funded or paid
                </span>
                <span>
                  <i className="underfunded" />
                  Underfunded
                </span>
              </div>
              <p className="chart-caption">
                Funding status at the close of each demo session.
              </p>
            </Panel>
          </div>
        </>
      ) : (
        <Panel>
          <Empty
            title="Your first session is still in progress."
            description="Review a request, remember a preference, and start the next session. Your real demo measurements will appear here."
            action={
              <Button onClick={() => act({ type: "new-session" })}>
                Complete Session {state.session}
                <ArrowRight size={15} />
              </Button>
            }
          />
        </Panel>
      )}
      <Panel
        title="Where your agent spends"
        action={<Badge>All demo sessions</Badge>}
      >
        <div className="category-chart">
          {categories.map((c, i) => {
            const spend = state.requests
              .filter((r) => r.status === "approved" && r.category === c)
              .reduce((v, r) => v + r.amount, 0);
            const max = Math.max(
              1,
              ...categories.map((k) =>
                state.requests
                  .filter((r) => r.status === "approved" && r.category === k)
                  .reduce((v, r) => v + r.amount, 0),
              ),
            );
            return (
              <div key={c}>
                <span>{c}</span>
                <div className="category-track">
                  <i
                    className={`reserve-${i}`}
                    style={{ width: `${(spend / max) * 100}%` }}
                  />
                </div>
                <strong>
                  {money(spend)} <small>USDC</small>
                </strong>
              </div>
            );
          })}
        </div>
      </Panel>
      <div className="notice notice-neutral">
        <ChartNoAxesCombined size={19} />
        <p>
          Fewer approval prompts are useful only when legitimate payments still
          succeed and commitments remain protected. This demo records both
          outcomes; it does not establish production effectiveness.
        </p>
      </div>
    </>
  );
}
