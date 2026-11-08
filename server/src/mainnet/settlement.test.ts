import { describe, expect, it } from "vitest";
import { assertSettlementEffects } from "./settlement";
const id = (n: string) => `0x${n.repeat(64)}`;
const expected = { agent: id("1"), facilitator: id("2"), recipient: id("3"), asset: `${id("4")}::usdc::USDC`, amount: 800_000n };
const good = { success: true, sender: expected.agent, gasOwner: expected.facilitator, gasBudget: 0n, balances: [{ address: expected.agent, coinType: expected.asset, amount: "-800000" }, { address: expected.recipient, coinType: expected.asset, amount: "800000" }] };
describe("Mainnet settlement effects", () => {
  it("accepts the exact reviewed payment", () => expect(() => assertSettlementEffects(good, expected)).not.toThrow());
  it("rejects unrelated success, wrong recipient and wrong amount", () => {
    expect(() => assertSettlementEffects({ ...good, balances: [] }, expected)).toThrow(/mismatch/);
    expect(() => assertSettlementEffects(good, { ...expected, recipient: id("5") })).toThrow(/mismatch/);
    expect(() => assertSettlementEffects(good, { ...expected, amount: 799_999n })).toThrow(/mismatch/);
  });
  it("rejects unapproved gas or an additional transfer", () => {
    expect(() => assertSettlementEffects({ ...good, gasBudget: 1n }, expected)).toThrow(/gasless/);
    expect(() => assertSettlementEffects({ ...good, balances: [...good.balances, { address: id("6"), coinType: expected.asset, amount: "1" }] }, expected)).toThrow(/unexpected/);
  });
});
