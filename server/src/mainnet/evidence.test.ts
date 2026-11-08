import { describe, expect, it } from "vitest";
import { evaluateTransactionEvidence, type ObservedEvidence, type TransactionExpectation } from "./evidence";

const addr = (c: string) => `0x${c.repeat(64)}`;
const expected: TransactionExpectation = {
  id: "release-1", digest: "digest-that-is-long-enough", expected_success: true, sender: addr("1"), gas_owner: addr("1"), max_gas_budget_mist: "20000000",
  move_calls: [{ package: addr("2"), module: "vault", function: "release_to_agent", type_arguments: [`${addr("3")}::usdc::USDC`] }],
  balance_changes: [{ address: addr("4"), coin_type: `${addr("3")}::usdc::USDC`, amount: "800000" }],
  events: [{ type: `${addr("2")}::vault::ReleasedToAgent`, json_contains: { amount: "800000" } }], created_type_contains: ["::coin::Coin<"],
};
const observed: ObservedEvidence = {
  digest: expected.digest, success: true, error: null, sender: addr("1"), gasOwner: addr("1"), gasBudget: 20_000_000n,
  calls: [{ package: addr("2"), module: "vault", function: "release_to_agent", typeArguments: [`${addr("3")}::usdc::USDC`] }],
  balanceChanges: [{ address: addr("4"), coinType: `${addr("3")}::usdc::USDC`, amount: "800000" }],
  events: [{ type: `${addr("2")}::vault::ReleasedToAgent`, json: { amount: "800000" } }], createdTypes: [`0x2::coin::Coin<${addr("3")}::usdc::USDC>`],
};

describe("exact evidence verification", () => {
  it("accepts the reviewed consequential effects", () => expect(evaluateTransactionEvidence(expected, observed)).toEqual([]));
  it("rejects a valid but unrelated success digest", () => expect(evaluateTransactionEvidence(expected, { ...observed, sender: addr("9"), calls: [] })).toEqual(expect.arrayContaining([expect.stringContaining("sender mismatch"), expect.stringContaining("missing exact call")])));
  it("rejects wrong recipient or amount", () => expect(evaluateTransactionEvidence(expected, { ...observed, balanceChanges: [{ ...observed.balanceChanges[0]!, amount: "799999" }] })).toEqual([expect.stringContaining("missing balance change")]));
  it("requires expected failures to have the reviewed error", () => {
    const failed = { ...expected, expected_success: false, expected_error_contains: "EExceedsFree" };
    expect(evaluateTransactionEvidence(failed, observed)).toEqual(expect.arrayContaining([expect.stringContaining("success mismatch"), expect.stringContaining("failure does not contain")]));
  });
});
