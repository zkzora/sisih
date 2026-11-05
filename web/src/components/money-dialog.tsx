"use client";
import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { useSisih } from "./context";
import { Button, Field, Overlay, Spinner } from "./ui";
import { amountInput, freeFunds, money, parseMoney } from "@/lib/engine";
import { api } from "@/lib/live";
export function MoneyDialog() {
  const { state, act, moneyModal, setMoneyModal, isOwner, walletAddress } = useSisih();
  const [amount, setAmount] = useState("1");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [walletUsdc, setWalletUsdc] = useState<number | null>(null);
  const close = () => {
    setMoneyModal(null);
    setError("");
  };
  const withdraw = moneyModal === "withdraw";
  useEffect(() => {
    if (!moneyModal || !walletAddress) return;
    api<{ usdc: string }>(`/api/wallet/${walletAddress}`)
      .then((w) => setWalletUsdc(Number(w.usdc)))
      .catch(() => setWalletUsdc(null));
  }, [moneyModal, walletAddress]);
  return (
    <Overlay
      open={Boolean(moneyModal)}
      onClose={close}
      title={withdraw ? "Withdraw available funds" : "Deposit into your vault"}
      description={
        withdraw
          ? "Only free funds can leave. Reserves stay locked by the contract."
          : "USDC from your wallet goes into the vault. Commitments are funded first."
      }
      kind="modal"
    >
      <div className="info-box">
        <Wallet size={18} />
        <p>
          {isOwner
            ? `Your wallet signs; Sisih submits through Tatum on Sui ${state.preferences.network}.${walletUsdc !== null && !withdraw ? ` Wallet balance: ${money(walletUsdc)} USDC.` : ""}`
            : "Connect the owner wallet to sign this transaction."}
        </p>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const value = parseMoney(amount);
          if (value === null) {
            setError("Enter a positive amount with up to 6 decimal places.");
            return;
          }
          if (withdraw && value > freeFunds(state)) {
            setError(`Only ${money(freeFunds(state))} USDC is free. Reserves are locked by the contract.`);
            return;
          }
          setSubmitting(true);
          const result = await act({ type: withdraw ? "withdraw" : "deposit", amount: value });
          setSubmitting(false);
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
              : "Your commitments are funded first; the remainder becomes available."
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
              aria-describedby={error ? "vault-amount-error" : "vault-amount-hint"}
            />
            <span>USDC</span>
          </div>
        </Field>
        <div className="quick-amounts">
          {(withdraw ? [freeFunds(state)] : [500_000, 1_000_000, 5_000_000])
            .filter((v) => v > 0)
            .map((v) => (
              <button key={v} type="button" onClick={() => setAmount(amountInput(v))}>
                {withdraw ? "Maximum" : `+${money(v)}`}
              </button>
            ))}
        </div>
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !isOwner}>
            {submitting ? <Spinner label="Signing" /> : withdraw ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}{" "}
            {withdraw ? "Withdraw" : "Deposit"}
          </Button>
        </div>
      </form>
    </Overlay>
  );
}
