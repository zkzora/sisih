import { beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "pglite::memory:";
const { initDb } = await import("../db/index");
const { budgetSnapshot, getOperation, initializeBudget, markUnknown, recordSpent, reserveOperation, resolveUnknownSpent } = await import("./budget");

beforeAll(() => initDb());

describe("durable execution budgets", () => {
  it("atomically refuses concurrent reservations over the authorization", async () => {
    const key = "plan-a:operator-gas";
    await initializeBudget(key, 100n);
    const outcomes = await Promise.allSettled([reserveOperation("a-1", key, 60n), reserveOperation("a-2", key, 60n)]);
    expect(outcomes.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((x) => x.status === "rejected")).toHaveLength(1);
    expect((await budgetSnapshot(key))?.reserved).toBe(60n);
  });

  it("is idempotent for the same operation and rejects changed terms", async () => {
    const key = "plan-b:usdc";
    await initializeBudget(key, 1_600_000n);
    await reserveOperation("purchase-1", key, 800_000n);
    expect((await reserveOperation("purchase-1", key, 800_000n)).status).toBe("reserved");
    await expect(reserveOperation("purchase-1", key, 700_000n)).rejects.toThrow(/different terms/);
    await recordSpent("purchase-1", 800_000n, "digest-1");
    expect(await budgetSnapshot(key)).toMatchObject({ reserved: 0n, spent: 800_000n, remaining: 800_000n });
  });

  it("keeps unknown outcomes reserved until explicit reconciliation", async () => {
    const key = "plan-c:facilitator-gas";
    await initializeBudget(key, 50n);
    await reserveOperation("settle-1", key, 40n);
    await markUnknown("settle-1", "known-digest");
    expect(await getOperation("settle-1")).toMatchObject({ status: "unknown", digest: "known-digest" });
    expect((await budgetSnapshot(key))?.reserved).toBe(40n);
    await resolveUnknownSpent("settle-1", 12n, "known-digest");
    expect(await budgetSnapshot(key)).toMatchObject({ reserved: 0n, spent: 12n, remaining: 38n });
  });
});
