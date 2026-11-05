import { describe, expect, it } from "vitest";
import { roundUp } from "../policy/composer";
import { suggestTarget } from "../policy/suggestions";
import { parseMemory, serializeMemory } from "./format";

describe("memory format", () => {
  it("round-trips a rule memory with bigint amounts", () => {
    const text = serializeMemory("rule", "Always allow search from SearchBox up to 1.50 USDC until 2026-12-05", {
      ruleId: "r1",
      merchant: "SearchBox",
      category: "search",
      maxAmount: 1_500_000n,
      action: "allow",
      expiresMs: 1,
    });
    expect(text.startsWith("[sisih:v1:rule] Always allow search")).toBe(true);
    const parsed = parseMemory(text)!;
    expect(parsed.type).toBe("rule");
    expect(parsed.sentence).toBe("Always allow search from SearchBox up to 1.50 USDC until 2026-12-05");
    expect(parsed.payload).toMatchObject({ ruleId: "r1", maxAmount: "1500000", action: "allow" });
  });

  it("strips braces from sentences so the payload stays parseable", () => {
    const parsed = parseMemory(serializeMemory("decision", "weird {text}", { a: 1 }))!;
    expect(parsed.payload).toEqual({ a: 1 });
  });

  it("ignores untagged or unknown memories", () => {
    expect(parseMemory("I'm allergic to peanuts")).toBeNull();
    expect(parseMemory('[sisih:v1:unknown] x {"a":1}')).toBeNull();
    expect(parseMemory("[sisih:v1:rule] no payload")).toBeNull();
  });
});

describe("reserve suggestions", () => {
  it("SPEC: Inference API 6.80 bill on a 6.00 target suggests 7.00", () => {
    const s = suggestTarget("Inference API", 6_000_000n, 6_800_000n)!;
    expect(s.suggestedTarget).toBe(7_000_000n);
    expect(s.shortfall).toBe(800_000n);
    expect(s.reason).toBe("Inference API: raise 6.00 to 7.00 USDC. Last cycle was 0.80 short.");
  });
  it("no suggestion when the reserve covered the bill", () => {
    expect(suggestTarget("Hosting VPS", 5_000_000n, 5_000_000n)).toBeNull();
  });
  it("uses a higher past bill from memory", () => {
    expect(suggestTarget("Inference API", 6_000_000n, 6_800_000n, [7_300_000n])!.suggestedTarget).toBe(7_500_000n);
  });
  it("rounds up to 0.50 steps", () => {
    expect(roundUp(1_200_000n)).toBe(1_500_000n);
    expect(roundUp(3_000_000n)).toBe(3_000_000n);
    expect(roundUp(1n)).toBe(500_000n);
  });
});
