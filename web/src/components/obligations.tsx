"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Brain,
  CalendarRange,
  Check,
  LockKeyhole,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { useSisih } from "./context";
import {
  Badge,
  Button,
  Confirm,
  CopyButton,
  Empty,
  Field,
  Overlay,
  PageHeading,
  Panel,
} from "./ui";
import {
  amountInput,
  demoDay,
  freeFunds,
  money,
  parseMoney,
  reserved,
  short,
} from "@/lib/engine";
import type { Obligation } from "@/lib/types";
const defaultObligation = (): Obligation => ({
  id: "new",
  name: "",
  recipient: "0x" + "e".repeat(64),
  amount: 1_000_000,
  reserved: 0,
  cycle: "Monthly",
  type: "Fixed",
  priority: "Essential",
  due: "2026-11-20",
  paid: false,
});
function CommitmentForm({
  value,
  onClose,
}: {
  value: Obligation | null;
  onClose: () => void;
}) {
  const { act, state } = useSisih();
  const [draft, setDraft] = useState<Obligation>(defaultObligation);
  const [amount, setAmount] = useState("1");
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (value) {
      setDraft(value);
      setAmount(amountInput(value.amount));
      setErrors({});
    }
  }, [value]);
  const change = (key: string, v: string) =>
    setDraft((old) => ({ ...old, [key]: v }));
  return (
    <Overlay
      open={Boolean(value)}
      onClose={onClose}
      title={value?.id === "new" ? "Set money aside" : "Edit commitment"}
      description="Reserve demo funds for an onchain obligation. Your agent cannot spend the reserved amount."
      kind="modal"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = parseMoney(amount);
          const next: Record<string, string> = {};
          if (!draft.name.trim()) next.name = "Give this commitment a name.";
          if (parsed === null)
            next.amount = "Use a positive USDC amount with up to 6 decimals.";
          if (!/^0x[a-fA-F0-9]{64}$/.test(draft.recipient))
            next.recipient =
              "Use a 0x address followed by 64 hexadecimal characters.";
          if (draft.due < demoDay(state))
            next.due = "Choose the demo date or a later date.";
          setErrors(next);
          if (Object.keys(next).length) {
            document
              .getElementById(`commitment-${Object.keys(next)[0]}`)
              ?.focus();
            return;
          }
          const result = act({
            type: "save-obligation",
            obligation: { ...draft, amount: parsed! },
          });
          if (result.error) setErrors({ form: result.message });
          else onClose();
        }}
      >
        <Field id="commitment-name" label="Commitment name" error={errors.name}>
          <input
            id="commitment-name"
            value={draft.name}
            autoComplete="off"
            placeholder="e.g. Inference API"
            onChange={(e) => change("name", e.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "commitment-name-error" : undefined}
            maxLength={60}
            required
          />
        </Field>
        <Field
          id="commitment-recipient"
          label="Recipient Sui address"
          error={errors.recipient}
          hint="A demo address is prefilled. No real payment will be sent."
        >
          <input
            className="mono"
            id="commitment-recipient"
            value={draft.recipient}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => change("recipient", e.target.value)}
            aria-invalid={Boolean(errors.recipient)}
            aria-describedby={
              errors.recipient
                ? "commitment-recipient-error"
                : "commitment-recipient-hint"
            }
          />
        </Field>
        <div className="form-grid">
          <Field
            id="commitment-amount"
            label="Amount per cycle (USDC)"
            error={errors.amount}
          >
            <input
              id="commitment-amount"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={Boolean(errors.amount)}
              aria-describedby={
                errors.amount ? "commitment-amount-error" : undefined
              }
            />
          </Field>
          <Field id="commitment-type" label="Amount type">
            <select
              id="commitment-type"
              value={draft.type}
              onChange={(e) => change("type", e.target.value)}
            >
              <option>Fixed</option>
              <option>Usage-based</option>
            </select>
          </Field>
        </div>
        <div className="form-grid">
          <Field id="commitment-cycle" label="Billing cycle">
            <select
              id="commitment-cycle"
              value={draft.cycle}
              onChange={(e) => change("cycle", e.target.value)}
            >
              <option>Monthly</option>
              <option>Weekly</option>
              <option>Once</option>
            </select>
          </Field>
          <Field id="commitment-due" label="Due date" error={errors.due}>
            <input
              id="commitment-due"
              type="date"
              value={draft.due}
              min={demoDay(state)}
              onChange={(e) => change("due", e.target.value)}
              aria-invalid={Boolean(errors.due)}
            />
          </Field>
        </div>
        <Field
          id="commitment-priority"
          label="Priority"
          hint="Essential commitments are funded first when a demo deposit arrives."
        >
          <select
            id="commitment-priority"
            value={draft.priority}
            onChange={(e) => change("priority", e.target.value)}
          >
            <option>Essential</option>
            <option>Important</option>
          </select>
        </Field>
        <div className="notice notice-neutral">
          <LockKeyhole size={17} />
          <p>
            Available to reserve:{" "}
            <strong>
              {money(freeFunds(state) + (value?.reserved || 0))} USDC
            </strong>
            . Any shortfall stays visible until you add funds.
          </p>
        </div>
        {errors.form && <p className="field-error">{errors.form}</p>}
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            <LockKeyhole size={15} />
            {value?.id === "new" ? "Create commitment" : "Save changes"}
          </Button>
        </div>
      </form>
    </Overlay>
  );
}
export function ObligationsView() {
  const { state, act, setMoneyModal } = useSisih();
  const query = useSearchParams();
  const [selected, setSelected] = useState<string | null>(query.get("record"));
  const [edit, setEdit] = useState<Obligation | null>(null);
  const [remove, setRemove] = useState<Obligation | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All commitments");
  const o = state.obligations.find((o) => o.id === selected);
  const items = state.obligations.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "All commitments" ||
        (filter === "Unpaid" && !o.paid) ||
        (filter === "Paid" && o.paid) ||
        (filter === "Underfunded" && !o.paid && o.reserved < o.amount)),
  );
  const shortfall = state.obligations
    .filter((o) => !o.paid)
    .reduce((v, o) => v + Math.max(0, o.amount - o.reserved), 0);
  return (
    <>
      <PageHeading
        title="Give every commitment its space."
        description="Set funds aside before your agent starts spending."
        action={
          <Button onClick={() => setEdit(defaultObligation())}>
            <Plus size={16} />
            New commitment
          </Button>
        }
      />
      <div className="summary-strip">
        <div>
          <span>Committed funds</span>
          <strong>
            {money(reserved(state))}
            <small>USDC</small>
          </strong>
        </div>
        <div>
          <span>Active commitments</span>
          <strong>{state.obligations.filter((o) => !o.paid).length}</strong>
        </div>
        <div>
          <span>Funding gap</span>
          <strong className={shortfall ? "warning-text" : ""}>
            {money(shortfall)}
            <small>USDC</small>
          </strong>
        </div>
      </div>
      {shortfall > 0 && (
        <div className="banner banner-warning">
          <Wallet size={18} />
          <span>
            Add {money(shortfall)} USDC to fully fund your commitments.
          </span>
          <Button variant="ghost" onClick={() => setMoneyModal("deposit")}>
            Add funds
          </Button>
        </div>
      )}
      {state.obligations
        .filter((o) => o.suggestion)
        .map((o) => (
          <div className="suggestion-card" key={o.id}>
            <span className="suggestion-icon">
              <Brain size={20} />
            </span>
            <div>
              <Badge tone="memory">Reserve suggestion</Badge>
              <h3>Give {o.name} a little more room.</h3>
              <p>
                Last cycle needed 6.80 USDC against a 6.00 USDC reserve. Set
                aside {money(o.suggestion!)} USDC for the next one.
              </p>
              <span className="detail-note">
                Based on a simulated billing outcome stored in local memory.
              </span>
            </div>
            <div className="suggestion-actions">
              <Button
                onClick={() =>
                  act({
                    type: "accept-reserve",
                    id: o.id,
                    amount: o.suggestion!,
                  })
                }
              >
                <Check size={14} />
                Accept {money(o.suggestion!)} USDC
              </Button>
              <Button
                variant="ghost"
                onClick={() => act({ type: "dismiss-suggestion", id: o.id })}
              >
                Keep current reserve
              </Button>
            </div>
          </div>
        ))}
      <Panel>
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              type="search"
              aria-label="Search commitments"
              placeholder="Search commitments…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter commitments"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {["All commitments", "Unpaid", "Underfunded", "Paid"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </div>
        {items.length ? (
          <div className="table-scroll">
            <table className="data-table commitments-table">
              <thead>
                <tr>
                  <th>Commitment</th>
                  <th>Amount / cycle</th>
                  <th>Due date</th>
                  <th>Priority</th>
                  <th>Reserved</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <button
                        className="table-name-button"
                        onClick={() => setSelected(o.id)}
                      >
                        <span className="merchant-avatar">
                          <CalendarRange size={17} />
                        </span>
                        <span>
                          <strong>{o.name}</strong>
                          <small>
                            {o.cycle} · {o.type.toLowerCase()}
                          </small>
                        </span>
                      </button>
                    </td>
                    <td className="numeric">
                      {money(o.amount)} <small>USDC</small>
                    </td>
                    <td>
                      {new Date(o.due + "T00:00:00Z").toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric", timeZone: "UTC" },
                      )}
                    </td>
                    <td>
                      <Badge>{o.priority}</Badge>
                    </td>
                    <td>
                      <span className="numeric">
                        {money(o.reserved)} <small>USDC</small>
                      </span>
                      <div className="table-progress">
                        <span
                          style={{
                            width: `${Math.min(100, (o.reserved / o.amount) * 100)}%`,
                          }}
                        />
                      </div>
                    </td>
                    <td>
                      <Badge
                        tone={
                          o.paid || o.reserved >= o.amount
                            ? "success"
                            : "warning"
                        }
                      >
                        {o.paid
                          ? "Paid"
                          : o.reserved >= o.amount
                            ? "Fully funded"
                            : "Underfunded"}
                      </Badge>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`View ${o.name}`}
                        onClick={() => setSelected(o.id)}
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No commitments found"
            description={
              search || filter !== "All commitments"
                ? "Try another search or filter."
                : "Reserve your first commitment to give your money a purpose."
            }
            action={
              <Button
                variant="secondary"
                onClick={() => setEdit(defaultObligation())}
              >
                <Plus size={15} />
                Add commitment
              </Button>
            }
          />
        )}
        <div className="table-footer">
          {items.length} commitments · All balances are simulated
        </div>
      </Panel>
      <CommitmentForm value={edit} onClose={() => setEdit(null)} />
      <Confirm
        open={Boolean(remove)}
        onClose={() => setRemove(null)}
        title="Remove this commitment?"
        description={`Remove ${remove?.name || "this commitment"} and release its reserve to available funds. Earlier demo receipts remain in activity.`}
        label="Remove commitment"
        onConfirm={() => {
          if (remove) {
            act({ type: "delete-obligation", id: remove.id });
            setSelected(null);
          }
        }}
      />
      <Overlay
        open={Boolean(o)}
        onClose={() => setSelected(null)}
        title={o?.name || "Commitment"}
        description="A commitment backed by reserved demo funds."
        footer={
          o && (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setSelected(null);
                  setEdit(o);
                }}
                disabled={o.paid}
              >
                <Pencil size={14} />
                Edit
              </Button>
              <Button
                onClick={() => act({ type: "pay-obligation", id: o.id })}
                disabled={o.paid || o.reserved < o.amount}
              >
                {o.paid ? <Check size={14} /> : <ArrowRight size={14} />}{" "}
                {o.paid ? "Paid" : "Pay with demo funds"}
              </Button>
            </>
          )
        }
      >
        {o && (
          <>
            <div className="detail-hero">
              <LockKeyhole size={25} />
              <strong>
                {money(o.reserved)}
                <small>USDC reserved</small>
              </strong>
              <Badge
                tone={
                  o.paid
                    ? "neutral"
                    : o.reserved >= o.amount
                      ? "success"
                      : "warning"
                }
              >
                {o.paid
                  ? "Paid this cycle"
                  : o.reserved >= o.amount
                    ? "Fully funded"
                    : "Needs more funds"}
              </Badge>
            </div>
            <dl className="details-list">
              <div>
                <dt>Required each cycle</dt>
                <dd>{money(o.amount)} USDC</dd>
              </div>
              <div>
                <dt>Billing</dt>
                <dd>
                  {o.cycle} · {o.type}
                </dd>
              </div>
              <div>
                <dt>Priority</dt>
                <dd>{o.priority}</dd>
              </div>
              <div>
                <dt>Due</dt>
                <dd>{o.due}</dd>
              </div>
              <div>
                <dt>Recipient</dt>
                <dd className="mono">
                  {short(o.recipient)}
                  <CopyButton value={o.recipient} />
                </dd>
              </div>
            </dl>
            <div className="detail-section">
              <h3>Payment history</h3>
              {state.activities.filter(
                (a) => a.obligationId === o.id && a.kind === "Pay obligation",
              ).length ? (
                state.activities
                  .filter(
                    (a) =>
                      a.obligationId === o.id && a.kind === "Pay obligation",
                  )
                  .map((a) => (
                    <div className="detail-list-row" key={a.id}>
                      <span>{a.description}</span>
                      <strong>{money(a.amount)} USDC</strong>
                    </div>
                  ))
              ) : (
                <p className="muted">
                  No payments recorded for this commitment yet.
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              className="danger-text"
              onClick={() => setRemove(o)}
            >
              <Trash2 size={14} />
              Remove commitment
            </Button>
          </>
        )}
      </Overlay>
    </>
  );
}
