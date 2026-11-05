"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  ShieldCheck,
  Brain,
  Ban,
  FlaskConical,
} from "lucide-react";
import { useSisih } from "./context";
import { Badge, Button, Field, Overlay } from "./ui";
import {
  amountInput,
  demoDay,
  freeFunds,
  matchingRule,
  money,
  parseMoney,
  requestConstraint,
} from "@/lib/engine";
export function RequestDrawer({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const { state, act, setMoneyModal } = useSisih();
  const r = state.requests.find((r) => r.id === id);
  const [remember, setRemember] = useState<"approve" | "deny" | null>(null);
  const [max, setMax] = useState("1.5");
  const [expiry, setExpiry] = useState("2026-12-05");
  const [error, setError] = useState("");
  useEffect(() => {
    setRemember(null);
    setError("");
    setMax(r ? amountInput(Math.max(r.amount, 1_500_000)) : "1.5");
    setExpiry(state.preferences.expires);
  }, [id]);
  if (!r) return null;
  const constraint = requestConstraint(state, r);
  const relevant = state.memories.filter((m) => m.merchant === r.merchant);
  const rule = matchingRule(state, r);
  const done = r.status !== "held";
  const decide = (decision: "approve" | "deny", save = false) => {
    const value = parseMoney(max);
    if (save && (value === null || expiry < demoDay(state))) {
      setError(
        "Use a positive amount and an expiry on or after the demo date.",
      );
      return;
    }
    const result = act({
      type: "decide",
      requestId: r.id,
      decision,
      remember: save ? { maxAmount: value!, expires: expiry } : undefined,
    });
    if (!result.error) {
      setRemember(null);
      setError("");
    } else setError(result.message);
  };
  return (
    <Overlay
      open={Boolean(id)}
      onClose={onClose}
      title={r.merchant}
      description={`${r.item} · Research Agent · Session ${r.session}`}
      footer={
        done ? (
          <Button className="full-width" variant="secondary" onClick={onClose}>
            Done
          </Button>
        ) : remember ? (
          <>
            <Button variant="secondary" onClick={() => setRemember(null)}>
              Back
            </Button>
            <Button
              variant={remember === "deny" ? "danger" : "primary"}
              onClick={() => decide(remember, true)}
              disabled={remember === "approve" && Boolean(constraint)}
            >
              Save rule & {remember === "approve" ? "approve" : "reject"}
            </Button>
          </>
        ) : (
          <div className="decision-actions">
            <Button
              onClick={() => decide("approve")}
              disabled={Boolean(constraint)}
            >
              <Check size={15} />
              Approve once
            </Button>
            <Button
              variant="secondary"
              onClick={() => setRemember("approve")}
              disabled={Boolean(constraint)}
            >
              <Brain size={15} />
              Approve & remember
            </Button>
            <Button variant="secondary" onClick={() => decide("deny")}>
              <Ban size={15} />
              Reject
            </Button>
            <Button variant="ghost" onClick={() => setRemember("deny")}>
              Reject & remember
            </Button>
          </div>
        )
      }
    >
      <div className="request-amount">
        <span className="eyebrow">REQUESTED PAYMENT</span>
        <strong>
          {money(r.amount)}
          <small>USDC</small>
        </strong>
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
            <CheckCircle2 size={12} />
          ) : r.status === "rejected" ? (
            <Ban size={12} />
          ) : (
            <Clock3 size={12} />
          )}{" "}
          {r.status === "approved"
            ? r.automatic
              ? "Automatically approved"
              : "Approved by you"
            : r.status === "rejected"
              ? "Rejected"
              : "Awaiting your decision"}
        </Badge>
      </div>
      <div
        className={`notice ${constraint && !done ? "notice-warning" : "notice-neutral"}`}
      >
        <ShieldCheck size={19} />
        <div>
          <strong>
            {done
              ? "Decision recorded"
              : constraint
                ? "A vault boundary applies"
                : "Why this needs your review"}
          </strong>
          <p>{!done && constraint ? constraint : r.reason}</p>
        </div>
      </div>
      {!done && constraint && (
        <Button variant="secondary" onClick={() => setMoneyModal("deposit")}>
          Add demo funds
        </Button>
      )}
      <div className="detail-section">
        <h3>Available funds</h3>
        <div className="funds-simulation">
          <div>
            <span>{done ? "Available now" : "Before payment"}</span>
            <b>{money(freeFunds(state))}</b>
          </div>
          <ArrowRight size={18} />
          <div>
            <span>{done ? "Payment resolved" : "Projected after payment"}</span>
            <b className={freeFunds(state) < r.amount ? "danger-text" : ""}>
              {done ? "—" : money(freeFunds(state) - r.amount)}
            </b>
          </div>
        </div>
        <p className="detail-note">
          <LockKeyhole size={13} />
          Committed funds cannot be released to the agent.
        </p>
      </div>
      <div className="detail-section">
        <h3>Payment context</h3>
        <dl className="details-list">
          <div>
            <dt>Task</dt>
            <dd>Research Sui market activity</dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>{r.category}</dd>
          </div>
          <div>
            <dt>Merchant</dt>
            <dd>
              {r.merchant} <Badge>Demo</Badge>
            </dd>
          </div>
          <div>
            <dt>Request ID</dt>
            <dd className="mono">{r.id}</dd>
          </div>
        </dl>
      </div>
      {remember && (
        <div className="rule-composer">
          <h3>
            <Brain size={16} />
            Remember this decision
          </h3>
          <p>
            Apply this preference to future requests. Vault limits always take
            priority.
          </p>
          <Field label="Maximum amount (USDC)" id="rule-amount" error={error}>
            <input
              id="rule-amount"
              inputMode="decimal"
              autoComplete="off"
              value={max}
              onChange={(e) => setMax(e.target.value)}
              aria-invalid={Boolean(error)}
            />
          </Field>
          <Field label="Valid through" id="rule-expiry">
            <input
              type="date"
              id="rule-expiry"
              min={demoDay(state)}
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
            />
          </Field>
          <div className="rule-preview">
            {remember === "approve" ? "Allow" : "Deny"}{" "}
            {r.category.toLowerCase()} from <strong>{r.merchant}</strong> up to{" "}
            <strong>{max || "0"} USDC</strong>.
          </div>
        </div>
      )}
      <div className="detail-section">
        <h3>
          <Brain size={16} />
          Related memory <span className="muted">({relevant.length})</span>
        </h3>
        {relevant.length ? (
          <div className="recalled-list">
            {relevant.slice(0, 4).map((m) => (
              <div key={m.id}>
                <Badge tone="memory">{m.kind}</Badge>
                <p>{m.text}</p>
                <Link className="text-button" href={`/memory?record=${m.id}`}>
                  Inspect local memory
                  <ArrowRight size={12} />
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="inline-empty">
            No earlier memory for this merchant. Your decision can become its
            first rule.
          </div>
        )}
        {rule && (
          <p className="detail-note">
            Active rule: {rule.action === "allow" ? "allow" : "deny"} up to{" "}
            {money(rule.maxAmount)} USDC.
          </p>
        )}
      </div>
      {r.status === "approved" && (
        <div className="detail-section">
          <h3>Demo payment receipt</h3>
          <div className="payment-steps">
            {[
              "Merchant quote received",
              "Available-funds policy passed",
              "Demo payment completed",
              "Receipt saved in this browser",
            ].map((label, i) => (
              <div key={label}>
                <span>
                  <Check size={12} />
                </span>
                <p>
                  <small>0{i + 1}</small>
                  {label}
                </p>
              </div>
            ))}
          </div>
          <div className="info-box">
            <FlaskConical size={17} />
            <p>
              Simulated flow. No x402 settlement, Sui transaction, or Tatum
              verification has occurred.
            </p>
          </div>
          <Link
            className="text-button"
            href={`/activity?record=${r.transactionId}`}
          >
            View demo receipt
            <ArrowRight size={13} />
          </Link>
        </div>
      )}
    </Overlay>
  );
}
