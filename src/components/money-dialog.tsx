"use client";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, FlaskConical } from "lucide-react";
import { useSisih } from "./context";
import { Button, Field, Overlay } from "./ui";
import { amountInput, freeFunds, money, parseMoney } from "@/lib/engine";
export function MoneyDialog() {
  const { state, act, moneyModal, setMoneyModal } = useSisih();
  const [amount, setAmount] = useState("10");
  const [error, setError] = useState("");
  const close = () => {
    setMoneyModal(null);
    setError("");
  };
  const withdraw = moneyModal === "withdraw";
  return (
    <Overlay
      open={Boolean(moneyModal)}
      onClose={close}
      title={withdraw ? "Withdraw available funds" : "Deposit into your vault"}
      description="Demo balances only. This action does not access a wallet or move real money."
      kind="modal"
    >
      <div className="info-box">
        <FlaskConical size={18} />
        <p>
          This workspace uses simulated USDC. Real wallet and onchain
          integrations are not connected.
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = parseMoney(amount);
          if (value === null) {
            setError("Enter a positive amount with up to 6 decimal places.");
            return;
          }
          const result = act({
            type: withdraw ? "withdraw" : "deposit",
            amount: value,
          });
          if (result.error) setError(result.message);
          else close();
        }}
      >
        <Field
          id="vault-amount"
          label="Amount (USDC)"
          error={error}
          hint={
            withdraw
              ? `Available to withdraw: ${money(freeFunds(state))} USDC`
              : "Your obligations are funded first; the remainder becomes available."
          }
        >
          <div className="amount-input">
            <input
              id="vault-amount"
              autoFocus
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={
                error ? "vault-amount-error" : "vault-amount-hint"
              }
            />
            <span>USDC</span>
          </div>
        </Field>
        <div className="quick-amounts">
          {(withdraw ? [freeFunds(state)] : [5_000_000, 10_000_000, 20_000_000])
            .filter((v) => v > 0)
            .map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(amountInput(v))}
              >
                {withdraw ? "Maximum" : `+${money(v)}`}
              </button>
            ))}
        </div>
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit">
            {withdraw ? (
              <ArrowUpRight size={16} />
            ) : (
              <ArrowDownLeft size={16} />
            )}{" "}
            {withdraw ? "Withdraw demo funds" : "Add demo funds"}
          </Button>
        </div>
      </form>
    </Overlay>
  );
}
