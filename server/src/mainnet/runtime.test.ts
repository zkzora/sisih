/** Mainnet runtime with durable in-memory Postgres; configuration injected, no chain execution. */
import { beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("../lib/env", async (load) => ({ ...await load<typeof import("../lib/env")>(), isMainnet: () => true, suiNetwork: () => "mainnet" }));
process.env.DATABASE_URL = "pglite::memory:";
const { initDb, db, schema } = await import("../db/index");
const { loadMainnetManifest } = await import("./manifest");
const { initializeBudget, budgetSnapshot } = await import("./budget");
const { reservePurchaseBudget, recordReleaseBudget, markReleaseBudgetUnknown, resolveReleaseBudget } = await import("./runtime");
const { assertProofOwnerAction, proofManifest } = await import("./proof-policy");
const { kvSet, kvDelete } = await import("../services/state");
const { namespace } = await import("../memory/memwal");
const m = loadMainnetManifest("docs/mainnet/MANIFEST.json");
for (const [i, role] of ["owner", "operator", "agent", "facilitator"].entries()) {
  const name = role as keyof typeof m.roles;
  m.roles[name].address = `0x${String(i + 1).repeat(64)}`;
  process.env[`${role.toUpperCase()}_ADDRESS`] = m.roles[name].address;
}
const ids = { SISIH_PACKAGE_ID: `0x${"a".repeat(64)}`, VAULT_ID: `0x${"b".repeat(64)}`, OPERATOR_CAP_ID: `0x${"c".repeat(64)}` };
Object.assign(process.env, ids, { MAINNET_PLAN_ID: m.plan_id, USDC_COIN_TYPE: m.asset.coin_type, MERCHANT_CHAINSCOPE_ADDRESS: m.merchant.recipient, PUBLIC_BASE_URL: m.deployment.execution_origin, MAINNET_OPERATOR_TX_GAS_BUDGET_MIST: "20000000", MEMWAL_NAMESPACE_PREFIX: m.deployment.memwal_namespace_prefix });
beforeAll(async () => {
  await initDb();
  await kvSet(`mainnet_manifest:${m.plan_id}`, JSON.stringify(m));
  await kvSet(`mainnet_deployment:${m.plan_id}`, JSON.stringify(ids));
  await initializeBudget(`${m.plan_id}:usdc`, 1_600_000n);
  await initializeBudget(`${m.plan_id}:operator-gas`, 40_000_000n);
});
describe("reviewed Mainnet proof runtime", () => {
  it("accepts exact identities but refuses changed target or recipient", async () => {
    expect((await proofManifest()).plan_id).toBe(m.plan_id);
    process.env.MERCHANT_CHAINSCOPE_ADDRESS = `0x${"d".repeat(64)}`;
    await expect(proofManifest()).rejects.toThrow(/asset or merchant/);
    process.env.MERCHANT_CHAINSCOPE_ADDRESS = m.merchant.recipient;
    await expect(assertProofOwnerAction({ action: "set_threshold", max_amount: "100000000" })).rejects.toThrow(/outside/);
    await expect(assertProofOwnerAction({ action: "set_agent_permission", state: "revoke" })).resolves.toBeUndefined();
  });
  it("refuses a Testnet namespace in the Mainnet database", async () => {
    expect(await namespace()).toBe(m.deployment.memwal_namespace_prefix);
    await kvSet("memwal_namespace", "sisih-hosted-9");
    await expect(namespace()).rejects.toThrow(/differs/);
    await kvDelete("memwal_namespace");
  });
  it("permits a new public origin only with a persisted read-only binding", async () => {
    process.env.PUBLIC_BASE_URL = "https://mainnet.example.test";
    await expect(proofManifest()).rejects.toThrow(/publication binding/);
    await kvSet(`mainnet_public_deployment:${m.plan_id}`, JSON.stringify({ plan_id: m.plan_id, origin: process.env.PUBLIC_BASE_URL, network: "sui:mainnet", read_only: true }));
    await expect(proofManifest()).rejects.toThrow(/publication binding/);
    process.env.MAINNET_READ_ONLY = "true";
    await expect(proofManifest()).resolves.toMatchObject({ plan_id: m.plan_id });
    process.env.PUBLIC_BASE_URL = "https://wrong.example.test";
    await expect(proofManifest()).rejects.toThrow(/publication binding/);
    process.env.PUBLIC_BASE_URL = m.deployment.execution_origin;
    delete process.env.MAINNET_READ_ONLY;
  });
  it("allows two exact purchases, retains unknown funds, reconciles and refuses a third", async () => {
    const first = await reservePurchaseBudget("fixture-1", 800_000n);
    await recordReleaseBudget(first, 800_000n, 2_000_000n, "fixture-release-1");
    const second = await reservePurchaseBudget("fixture-2", 800_000n);
    await markReleaseBudgetUnknown(second, "fixture-release-2");
    expect(await budgetSnapshot(`${m.plan_id}:usdc`)).toMatchObject({ spent: 800_000n, reserved: 800_000n, remaining: 0n });
    await expect(reservePurchaseBudget("fixture-3", 800_000n)).rejects.toThrow(/insufficient/);
    await resolveReleaseBudget("fixture-2", { spent: true, amount: 800_000n, gasMist: 2_000_000n, digest: "fixture-release-2" });
    expect(await budgetSnapshot(`${m.plan_id}:usdc`)).toMatchObject({ spent: 1_600_000n, reserved: 0n, remaining: 0n });
    await expect(reservePurchaseBudget("fixture-1", 800_000n)).rejects.toThrow(/already/);
  });
});
