"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CheckCircle2, Clock3, LockKeyhole, ShieldCheck, Brain, Ban, LoaderCircle } from "lucide-react";
import { useSisih } from "./context";
import { Badge, Button, Field, Overlay, Spinner } from "./ui";
import { amountInput, freeFunds, money, parseMoney } from "@/lib/engine";
import { X402Stepper } from "./live-bits";

const STEP = 500_000;
const roundUp = (v: number) => Math.max(STEP, Math.ceil(v / STEP) * STEP);
const in30Days = () => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

export function RequestDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { state, act, setMoneyModal, x402Steps, unlocked, unlock, busy } = useSisih();
  const r = state.requests.find((r) => r.id === id);
  const [remember, setRemember] = useState<"approve" | "deny" | null>(null);
  const [max, setMax] = useState("1.5");
  const [expiry, setExpiry] = useState(in30Days());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    setRemember(null);
    setError("");
    setNote("");
    setMax(r ? amountInput(roundUp(r.amount)) : "1.5");
    setExpiry(in30Days());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!r) return null;
  const live = r.live;
  const done = r.status !== "held";
  // The contract is the boundary: approval is impossible when the request would need reserves.
  const short = r.amount - freeFunds(state);
  const constraint = !done && (live?.allowDisabled || short > 0) ? `Would use ${money(Math.max(short, Number(live?.cutsReserveBy ?? 0)))} USDC of committed funds. Reserves are locked by the contract.` : null;
  const recall = live?.recall;
  const recalled = [...(recall?.results ?? [])].sort((a, b) => a.distance - b.distance);
  const rules = state.rules.filter((x) => live?.matchedRuleIds.includes(x.id));
  const steps = x402Steps[r.id] ?? [];
  const paidSteps = live?.paymentStatus === "paid" ? ["invoice_received", "funds_released", "payment_sent", "settle_verified"] : steps;
  const what = r.category.toLowerCase();
  const preview = `Always ${remember === "deny" ? "deny" : "allow"} ${what} from ${r.merchant} up to ${max || "0"} USDC until ${expiry}`;

  const decide = async (decision: "approve" | "deny", save = false) => {
    const value = parseMoney(max);
    if (save && (value === null || expiry < new Date().toISOString().slice(0, 10))) {
      setError("Use a positive amount and an expiry today or later.");
      return;
    }
    setSubmitting(true);
    const result = await act({ type: "decide", requestId: r.id, decision, remember: save ? { maxAmount: value!, expires: expiry } : undefined });
    setSubmitting(false);
    if (!result.error) {
      setRemember(null);
      setError("");
    } else setError(result.message);
  };

  const locked = !unlocked;
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
        ) : locked ? (
          <DrawerUnlock unlock={unlock} />
        ) : remember ? (
          <>
            <Button variant="secondary" onClick={() => setRemember(null)}>
              Back
            </Button>
            <Button variant={remember === "deny" ? "danger" : "primary"} onClick={() => void decide(remember, true)} disabled={submitting || (remember === "approve" && Boolean(constraint))}>
              {submitting ? <Spinner label="Saving" /> : `Save to memory & ${remember === "approve" ? "approve" : "deny"}`}
            </Button>
          </>
        ) : (
          <div className="decision-actions">
            <Button onClick={() => void decide("approve")} disabled={Boolean(constraint) || submitting} title={constraint ? "Reserves are locked by the contract" : undefined}>
              <Check size={15} />
              Approve once
            </Button>
            <Button variant="secondary" onClick={() => setRemember("approve")} disabled={Boolean(constraint) || submitting}>
              <Brain size={15} />
              Approve & remember
            </Button>
            <Button variant="secondary" onClick={() => void decide("deny")} disabled={submitting}>
              <Ban size={15} />
              Deny
            </Button>
            <Button variant="ghost" onClick={() => setRemember("deny")} disabled={submitting}>
              Deny & remember
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
        <Badge tone={r.status === "approved" || r.status === "paying" ? "success" : r.status === "rejected" ? "danger" : "warning"}>
          {r.status === "approved" ? <CheckCircle2 size={12} /> : r.status === "paying" ? <LoaderCircle size={12} className="spin" /> : r.status === "rejected" ? <Ban size={12} /> : <Clock3 size={12} />}{" "}
          {r.status === "approved" || r.status === "paying"
            ? r.automatic
              ? "Automatically approved"
              : "Approved by you"
            : r.status === "rejected"
              ? r.automatic
                ? "Automatically denied"
                : "Denied"
              : "Awaiting your decision"}
        </Badge>
      </div>
      <div className={`notice ${constraint ? "notice-warning" : "notice-neutral"}`}>
        <ShieldCheck size={19} />
        <div>
          <strong>{done ? "Decision recorded" : constraint ? "Reserves are locked by the contract" : "Why this needs your review"}</strong>
          {(live?.reasons ?? [r.reason]).map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
        </div>
      </div>
      {constraint && (
        <div className="notice notice-neutral">
          <LockKeyhole size={17} />
          <p>
            Approving is disabled: the vault would have to cut a reserve, and the Move contract refuses that. Deny it, or deposit first and then approve.
          </p>
          <Button variant="secondary" onClick={() => setMoneyModal("deposit")}>
            Deposit
          </Button>
        </div>
      )}
      <div className="detail-section">
        <h3>Balance simulation</h3>
        <div className="funds-simulation">
          <div>
            <span>Free before</span>
            <b>{money(Number(live?.simulation.freeBefore ?? freeFunds(state)))}</b>
          </div>
          <ArrowRight size={18} />
          <div>
            <span>Free after</span>
            <b className={constraint ? "danger-text" : ""}>{money(Number(live?.simulation.freeAfter ?? 0))}</b>
          </div>
        </div>
        {live?.simulation.affected.length ? (
          <p className="detail-note danger-text">
            <LockKeyhole size={13} />
            Would cut: {live.simulation.affected.map((a) => `${a.name} ${money(Number(a.amount))} USDC`).join(", ")}
          </p>
        ) : (
          <p className="detail-note">
            <LockKeyhole size={13} />
            Committed funds cannot be released to the agent.
          </p>
        )}
      </div>
      <div className="detail-section">
        <h3>Payment context</h3>
        <dl className="details-list">
          <div>
            <dt>Task</dt>
            <dd>{live?.taskContext ?? "Research task"}</dd>
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
            <dt>Decision basis</dt>
            <dd>
              {rules.length ? rules.map((x) => <Badge key={x.id} tone="memory">Rule · {x.merchant} ≤ {money(x.maxAmount)}</Badge>) : <Badge>{live?.code?.replaceAll("_", " ") ?? "—"}</Badge>}
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
          <Field label="In your words (optional)" id="rule-note" hint="The structured rule below is what Sisih stores and applies.">
            <input id="rule-note" value={note} placeholder={`${what} from ${r.merchant} under ${max} is always ${remember === "approve" ? "fine" : "a no"}`} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="form-grid">
            <Field label="Merchant" id="rule-merchant">
              <input id="rule-merchant" value={r.merchant} readOnly />
            </Field>
            <Field label="Category" id="rule-category">
              <input id="rule-category" value={r.category} readOnly />
            </Field>
          </div>
          <div className="form-grid">
            <Field label="Up to (USDC)" id="rule-amount" error={error}>
              <input id="rule-amount" inputMode="decimal" autoComplete="off" value={max} onChange={(e) => setMax(e.target.value)} aria-invalid={Boolean(error)} />
            </Field>
            <Field label="Valid until" id="rule-expiry">
              <input type="date" id="rule-expiry" min={new Date().toISOString().slice(0, 10)} value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </Field>
          </div>
          <div className="rule-preview">
            {preview}. <span className="muted">Saved to Walrus Memory; vault limits always take priority.</span>
          </div>
        </div>
      )}
      <div className="detail-section">
        <h3>
          <Brain size={16} />
          Recall from Walrus Memory <span className="muted">({recalled.length})</span>
        </h3>
        {recall?.query && <p className="detail-note mono">query: {recall.query}{recall.ms ? ` · ${recall.ms} ms` : ""}</p>}
        {recall?.pending ? (
          <div className="inline-empty">
            <Spinner label="Recalling similar memories… (the decision did not wait for this)" />
          </div>
        ) : recalled.length ? (
          <div className="recalled-list">
            {recalled.slice(0, 5).map((m) => (
              <div key={m.blobId}>
                <Badge tone="memory">distance {m.distance.toFixed(2)}</Badge>
                <p>{m.text.replace(/^\[sisih:v1:[a-z_]+\]\s*/, "").replace(/\s*\{[\s\S]*\}\s*$/, "")}</p>
                <Link className="text-button" href={`/memory?record=${m.memoryId ?? m.blobId}`}>
                  Inspect memory
                  <ArrowRight size={12} />
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="inline-empty">{recall?.error ? `Recall failed: ${recall.error}` : "No earlier memory for this merchant. Your decision can become its first rule."}</div>
        )}
      </div>
      {(r.status === "approved" || r.status === "paying" || steps.length > 0) && (
        <div className="detail-section">
          <h3>x402 payment on Sui</h3>
          <X402Stepper done={paidSteps} failed={live?.paymentStatus === "failed" || steps.includes("failed")} digests={live?.paymentDigests} network={state.live?.network} />
          {live?.paymentStatus === "failed" && <p className="field-error">Payment failed. Released funds stay with the agent until the next recycle.</p>}
          {r.transactionId && (
            <Link className="text-button" href={`/activity?record=${r.transactionId}`}>
              View in onchain activity
              <ArrowRight size={13} />
            </Link>
          )}
        </div>
      )}
      {busy === "decide" && <Spinner label="Recording decision" />}
    </Overlay>
  );
}

/**
 * Owners often arrive from an agent's link straight into this drawer. The drawer is modal, so the
 * dock behind it cannot be reached: offer the same demo-token unlock right here.
 */
function DrawerUnlock({ unlock }: { unlock: (token: string) => Promise<boolean> }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="drawer-unlock"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!token.trim()) return;
        setBusy(true);
        await unlock(token);
        setBusy(false);
        setToken("");
      }}
    >
      <p className="muted">Demo controls are locked. Enter the demo token to decide this request.</p>
      <div className="drawer-unlock-row">
        <input type="password" aria-label="Demo token" placeholder="Demo token" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
        <Button type="submit" disabled={busy || !token.trim()}>
          {busy ? <Spinner label="Checking" /> : "Unlock"}
        </Button>
      </div>
    </form>
  );
}
