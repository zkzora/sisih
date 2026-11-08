import { describe, expect, it, vi } from "vitest";
const config = vi.hoisted(() => ({} as Record<string, string>));
vi.mock("../lib/env", () => ({ env: (key: string) => config[key], isMainnet: () => true }));
const { assertNoPublishedSigners, readOnlyCapability } = await import("./publication");
describe("signer-free Mainnet publication", () => {
  it("fails closed if any wallet signing key is present", () => {
    config.MAINNET_READ_ONLY = "true";
    expect(() => assertNoPublishedSigners()).not.toThrow();
    for (const role of ["OWNER", "OPERATOR", "AGENT", "FACILITATOR"]) {
      config[`${role}_PRIVATE_KEY`] = "fixture-key";
      expect(() => assertNoPublishedSigners()).toThrow(`${role}_PRIVATE_KEY`);
      delete config[`${role}_PRIVATE_KEY`];
    }
  });
  it("retains status reads but blocks spending, configuration and owner signing paths", () => {
    for (const cap of ["budget.read", "services.read", "purchase.status", "owner.read", "session.end"] as const) expect(readOnlyCapability(cap)).toBe(true);
    for (const cap of ["purchase.request", "owner.decide", "owner.configure", "owner.permission", "owner.session", "demo.control"] as const) expect(readOnlyCapability(cap)).toBe(false);
  });
});
