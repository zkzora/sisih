/**
 * Mainnet refuses the Testnet shortcuts before any side effect: legacy demo-token routes (owner
 * actions, decisions, rules, settings, transaction import, demo controls, the browser signing
 * proxy), server-side owner signing, reset, recycle, simulated income, and config writes into the
 * Testnet .env or the protected .env.mainnet. Pure checks; nothing here touches a network.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "pglite::memory:";
const { demoAccess } = await import("./guard");
const { loadedEnvFiles } = await import("../lib/env");
const { assertTestnet } = await import("../demo/recycle");
const { demoOwnerAction, seedVault, emergencyWithdrawAll } = await import("../demo/owner");
const { resetDemo, advanceCycle } = await import("../demo/controls");
const { recycle } = await import("../demo/recycle");
const { upsertEnv, ROOT_ENV_PATH } = await import("../lib/env-file");

const saved = { net: process.env.SUI_NETWORK, demo: process.env.DEMO_TOKEN, files: [...loadedEnvFiles] };
beforeEach(() => {
  loadedEnvFiles.splice(0, loadedEnvFiles.length); // a Mainnet process with its own config
  process.env.SUI_NETWORK = "mainnet";
  process.env.DEMO_TOKEN = "demo-token-0123456789";
});
afterEach(() => {
  process.env.SUI_NETWORK = saved.net;
  process.env.DEMO_TOKEN = saved.demo;
  loadedEnvFiles.splice(0, loadedEnvFiles.length, ...saved.files);
});

const req = (path: string, method = "POST") => ({ method, path, header: (n: string) => (n === "x-demo-token" ? "demo-token-0123456789" : null) });

describe("Mainnet: legacy demo-token routes are refused, even with the correct demo token", () => {
  it.each([
    "/api/demo/owner-action",
    "/api/demo/reset",
    "/api/demo/advance-cycle",
    "/api/demo/run-task",
    "/api/demo/agent-credential",
    "/api/demo/new-session",
    "/api/requests/req-1/decision",
    "/api/rules",
    "/api/settings",
    "/api/tx",
    "/api/suggestions/sug-1/accept",
    "/api/memories/mem-1/retry",
    "/api/sui-rpc",
  ])("%s", async (path) => {
    expect(await demoAccess(req(path))).toMatchObject({ status: 403, body: { code: "mainnet_route_disabled" } });
  });

  it("reads stay public; MCP and owner routes go to their own credential checks", async () => {
    expect(await demoAccess(req("/api/state", "GET"))).toBeNull();
    expect(await demoAccess(req("/api/mcp"))).toBeNull();
    expect(await demoAccess(req("/api/owner/actions"))).toBeNull();
  });
});

describe("Mainnet: demo plumbing and server-held owner signing refuse to run", () => {
  it("assertTestnet", () => expect(() => assertTestnet("x")).toThrow(/testnet-only/));
  it.each([
    ["demo owner signing", () => demoOwnerAction("pause_agent", {})],
    ["seed", () => seedVault()],
    ["emergency withdraw", () => emergencyWithdrawAll()],
    ["reset", () => resetDemo()],
    ["billing cycle (simulated income)", () => advanceCycle()],
    ["recycle", () => recycle({ log: () => {} })],
  ])("%s", async (_label, fn) => {
    await expect((async () => fn())()).rejects.toThrow(/testnet-only/);
  });
});

describe("configuration writes", () => {
  it("never writes Mainnet values into the repo-root .env, and never rewrites .env.mainnet", () => {
    expect(() => upsertEnv({ VAULT_ID: "0x1" }, ROOT_ENV_PATH)).toThrow(/repo-root .env/);
    const dir = mkdtempSync(join(tmpdir(), "sisih-env-"));
    const protectedFile = join(dir, ".env.mainnet");
    writeFileSync(protectedFile, "SUI_NETWORK=mainnet\n");
    expect(() => upsertEnv({ VAULT_ID: "0x1" }, protectedFile)).toThrow(/protected/);
    const deployment = join(dir, ".env.mainnet.deployment");
    writeFileSync(deployment, "");
    upsertEnv({ SISIH_TEST_VAR: "1" }, deployment);
    delete process.env.SISIH_TEST_VAR;
  });
});
