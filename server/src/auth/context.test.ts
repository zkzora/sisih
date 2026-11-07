/**
 * Role resolution: authority comes only from a verified credential, collisions fail closed, and
 * Mainnet has no missing-credential bypass and never accepts the shared demo token as owner.
 */
import { afterEach, describe, expect, it } from "vitest";
import { assertEnvIsolation, loadedEnvFiles, ROOT_ENV_FILE } from "../lib/env";
import { credentialConfig, ownerSigningMode, requireCapability, resolveAuth } from "./context";

// These tests describe a Mainnet process with its own configuration; this test process loaded the
// repo-root .env, which the isolation guard (tested below) would correctly refuse for Mainnet.
loadedEnvFiles.splice(0, loadedEnvFiles.length);

const KEYS = ["SUI_NETWORK", "SISIH_AGENT_TOKEN", "DEMO_TOKEN", "SISIH_OWNER_MCP_TOKEN", "VERCEL", "SISIH_OWNER_SIGNING"];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});
function set(vars: Record<string, string | undefined>) {
  for (const k of KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(vars)) if (v !== undefined) process.env[k] = v;
}
const headers = (h: Record<string, string>) => (n: string) => h[n.toLowerCase()] ?? null;
const AGENT = "agent-credential-0123456789";
const OWNER = "owner-credential-0123456789";
const DEMO = "demo-token-shared-0123456789";

describe("configuration isolation", () => {
  it("Mainnet refuses the repo-root .env (the Testnet demo), Testnet accepts it", () => {
    expect(() => assertEnvIsolation("mainnet", [ROOT_ENV_FILE])).toThrow(/SISIH_ENV_FILE/);
    expect(() => assertEnvIsolation("mainnet", [ROOT_ENV_FILE.replace(/\.env$/, ".env.mainnet")])).not.toThrow();
    expect(() => assertEnvIsolation("testnet", [ROOT_ENV_FILE])).not.toThrow();
  });
});

describe("resolveAuth", () => {
  it("maps each credential to its role and nothing else", () => {
    set({ SUI_NETWORK: "testnet", SISIH_AGENT_TOKEN: AGENT, DEMO_TOKEN: OWNER });
    const a = resolveAuth(headers({ authorization: `Bearer ${AGENT}` }));
    const o = resolveAuth(headers({ authorization: `Bearer ${OWNER}` }));
    expect(a.ok && a.ctx.role).toBe("agent");
    expect(o.ok && o.ctx.role).toBe("owner");
    expect(a.ok && [...a.ctx.capabilities].some((c) => c.startsWith("owner."))).toBe(false);
    expect(resolveAuth(headers({ authorization: "Bearer wrong-credential-000000" }))).toMatchObject({ ok: false, status: 401 });
  });

  it("ignores caller-supplied role hints", () => {
    set({ SUI_NETWORK: "testnet", SISIH_AGENT_TOKEN: AGENT, DEMO_TOKEN: OWNER });
    const r = resolveAuth(headers({ authorization: `Bearer ${AGENT}`, "x-sisih-role": "owner", "x-demo-token": OWNER }));
    expect(r.ok && r.ctx.role).toBe("agent");
    // the demo token in its legacy header is not a bearer credential
    expect(resolveAuth(headers({ "x-demo-token": OWNER }))).toMatchObject({ ok: false });
  });

  it("rejects identical agent and owner credentials", () => {
    set({ SUI_NETWORK: "testnet", SISIH_AGENT_TOKEN: AGENT, DEMO_TOKEN: AGENT });
    expect(resolveAuth(headers({ authorization: `Bearer ${AGENT}` }))).toMatchObject({ ok: false, status: 503, code: "credential_config" });
  });

  it("Mainnet: the demo token is never an owner credential, and collisions with it fail closed", () => {
    set({ SUI_NETWORK: "mainnet", SISIH_AGENT_TOKEN: AGENT, DEMO_TOKEN: DEMO });
    expect(resolveAuth(headers({ authorization: `Bearer ${DEMO}` }))).toMatchObject({ ok: false, status: 401 });
    set({ SUI_NETWORK: "mainnet", SISIH_AGENT_TOKEN: AGENT, DEMO_TOKEN: DEMO, SISIH_OWNER_MCP_TOKEN: DEMO });
    expect(credentialConfig("mainnet").error).toMatch(/demo token/);
    set({ SUI_NETWORK: "mainnet", SISIH_AGENT_TOKEN: AGENT, SISIH_OWNER_MCP_TOKEN: OWNER });
    const o = resolveAuth(headers({ authorization: `Bearer ${OWNER}` }));
    expect(o.ok && o.ctx.role).toBe("owner");
    expect(o.ok && o.ctx.ownerSigning).toBe("local_owner");
    expect(o.ok && o.ctx.capabilities.has("demo.control")).toBe(false);
  });

  it("Mainnet fails closed without credentials, even locally (no development bypass)", () => {
    set({ SUI_NETWORK: "mainnet" });
    expect(resolveAuth(headers({}))).toMatchObject({ ok: false, status: 503 });
    set({ SUI_NETWORK: "mainnet", SISIH_OWNER_MCP_TOKEN: OWNER });
    expect(resolveAuth(headers({}))).toMatchObject({ ok: false, status: 401 });
  });

  it("the Testnet local bypass grants the agent role only, never the owner role, and never on Vercel", () => {
    set({ SUI_NETWORK: "testnet" });
    const r = resolveAuth(headers({}));
    expect(r.ok && r.ctx.role).toBe("agent");
    set({ SUI_NETWORK: "testnet", VERCEL: "1" });
    expect(resolveAuth(headers({}))).toMatchObject({ ok: false });
  });

  it("owner signing is local on Mainnet regardless of settings", () => {
    set({ SUI_NETWORK: "mainnet", SISIH_OWNER_SIGNING: "server" });
    expect(ownerSigningMode("mainnet")).toBe("local_owner");
    expect(ownerSigningMode("testnet")).toBe("server_demo");
    process.env.SISIH_OWNER_SIGNING = "local";
    expect(ownerSigningMode("testnet")).toBe("local_owner");
  });

  it("requireCapability rejects an agent context for owner capabilities", () => {
    set({ SUI_NETWORK: "testnet", SISIH_AGENT_TOKEN: AGENT, DEMO_TOKEN: OWNER });
    const a = resolveAuth(headers({ authorization: `Bearer ${AGENT}` }));
    if (!a.ok) throw new Error("expected agent");
    expect(() => requireCapability(a.ctx, "owner.decide")).toThrow(/not authorized/);
  });
});
