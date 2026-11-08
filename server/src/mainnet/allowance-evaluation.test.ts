/** Isolated SDK check for the highest-risk native Allowance boundary; no network or funds. */
import { describe, expect, it } from "vitest";
import { Transaction } from "@mysten/sui/transactions";

const id = (c: string) => `0x${c.repeat(64)}`;
const coin = `${id("a")}::usdc::USDC`;
const allowance = id("b");
const funder = id("c");

function allowanceIntent(tx: Transaction) {
  return tx.getData().commands.find((command) => command.$kind === "$Intent")?.$Intent;
}

describe("native Sui Allowance SDK boundary", () => {
  it("a direct allowance creates an allowance intent with no app gate", () => {
    const tx = new Transaction();
    tx.balance({ type: coin, balance: 800_000n, allowance: { objectId: allowance, funder } });
    expect(allowanceIntent(tx)?.data).toMatchObject({ objectId: allowance, funder, amount: "800000" });
    expect(allowanceIntent(tx)?.data.appType).toBeUndefined();
  });

  it("an app-bound spend carries both the app type and a required SpendPermit input", () => {
    const tx = new Transaction();
    tx.balance({ type: coin, balance: 800_000n, allowance: { objectId: allowance, funder, app: { type: `${id("d")}::guard::App`, permit: tx.object(id("e")) } } });
    const intent = allowanceIntent(tx)!;
    expect(intent.data).toMatchObject({ appType: `${id("d")}::guard::App`, amount: "800000" });
    expect(intent.inputs).toHaveProperty("permit");
  });

  it("never combines allowance funds with a gas-coin balance fallback", () => {
    const tx = new Transaction();
    expect(() => tx.balance({ type: coin, balance: 1n, allowance, useGasCoin: true } as never)).toThrow(/cannot be combined/);
  });
});
