import { describe, expect, it } from "vitest";
import { usdc, vaultAbortName } from "./sisih.js";

describe("vaultAbortName", () => {
  it("reads the quoted constant from the node message", () => {
    const err = JSON.stringify({ $kind: "MoveAbort", message: "MoveAbort in 1st command, 'EExceedsFree': Amount exceeds free funds" });
    expect(vaultAbortName(err)).toBe("EExceedsFree");
  });
  it("decodes the clever-error abort code seen on testnet", () => {
    // tx BQyCnzJuPWTxm5YijiSJkYduCQycqX7ex3XtDrxQiJ1w
    expect(vaultAbortName('{"MoveAbort":{"abortCode":"13836185948054749199"}}')).toBe("EExceedsFree");
  });
  it("returns none for no error", () => expect(vaultAbortName(null)).toBe("none"));
});

describe("usdc", () => {
  it("parses dot decimals into base units", () => {
    expect(usdc("1.50")).toBe(1_500_000n);
    expect(usdc("20")).toBe(20_000_000n);
    expect(usdc("0.000001")).toBe(1n);
  });
  it("rejects more than 6 decimals", () => expect(() => usdc("0.0000001")).toThrow());
});
