import { describe, expect, it } from "vitest";
import { connectionState } from "./connection-state";
describe("actual connection environment", () => {
  it("accepts only the actual Mainnet connection with its observation time", () => {
    expect(connectionState({ network: "mainnet", vault: { free: "600000", readAtMs: 1794017050385 }, session: 2 })).toMatchObject({ network: "mainnet", free: "600000", readAt: "2026-11-07T02:04:10.385Z" });
    expect(connectionState({ network: "mainnet", vault: { free: "600000" }, session: 2 }).network).toBe("mainnet");
  });
  it.each([null, {}, { network: "testnet", vault: { free: "0" }, session: 1 }, { network: "unknown", vault: { free: "0" }, session: 1 }, { network: "mainnet", vault: { free: "-1" }, session: 1 }, { network: "mainnet", vault: { free: "1.2" }, session: 1 }, { network: "mainnet", vault: { free: "0" }, session: 0 }])("refuses mismatched or malformed state: %j", value => {
    expect(() => connectionState(value)).toThrow();
  });
});
