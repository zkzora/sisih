import { describe, expect, it, vi } from "vitest";
import { parseArgs, toBaseUnits } from "./parse";
import { EXIT, main, type Deps } from "./run";
import { parseGateArgs, runGateRelease, type GateDeps } from "../demo/gate-release";

function deps(env: Record<string, string> = {}, responses: Record<string, unknown> = {}) {
  const calls: { method: string; url: string; body: unknown }[] = [];
  const out: string[] = [];
  const err: string[] = [];
  const fetchSpy = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    calls.push({ method: init?.method ?? "GET", url: u, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const key = Object.keys(responses).find((k) => u.endsWith(k));
    return new Response(JSON.stringify(key ? responses[key] : { ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  });
  const d: Deps = { fetch: fetchSpy as unknown as typeof fetch, env: (n) => env[n], out: (l) => out.push(l), err: (l) => err.push(l) };
  return { d, calls, out, err, fetchSpy };
}

describe("owner CLI parsing", () => {
  it("converts USDC amounts to base units and refuses bad ones", () => {
    expect(toBaseUnits("1.5")).toBe("1500000");
    expect(toBaseUnits("0.80")).toBe("800000");
    expect(toBaseUnits("0")).toBeNull();
    expect(toBaseUnits("-1")).toBeNull();
    expect(toBaseUnits("1.1234567")).toBeNull();
    expect(toBaseUnits("abc")).toBeNull();
  });
  it("finds commands, positionals and flags", () => {
    const p = parseArgs(["approve", "req-1", "--remember", "--max", "1.00"]);
    expect(p).toMatchObject({ kind: "command", args: ["req-1"], flags: { remember: true, max: "1000000" } });
    expect(parseArgs(["--url", "https://x.test", "status", "--json"])).toMatchObject({ kind: "command", url: "https://x.test", json: true });
    expect(parseArgs(["prefs", "add", "allow", "chainscope", "--max=1.00"])).toMatchObject({ kind: "command", args: ["allow", "chainscope"] });
  });
  it.each([
    [["approve"], /Missing <request-id>/],
    [["approve", "a", "b"], /Unexpected argument/],
    [["approve", "a", "--remmber"], /Unknown option --remmber/],
    [["approve", "a", "--max"], /needs a value/],
    [["reserve", "set", "x", "1.00"], /commitment-id/],
    [["reserve", "set", "3", "lots"], /positive USDC amount/],
    [["limits", "set", "--per-request", "2"], /Missing --per-day/],
    [["prefs", "add", "maybe", "chainscope", "--max", "1"], /allow or deny/],
    [["demo", "reset"], /Missing --yes/],
    [["frobnicate"], /Unknown command/],
  ])("%j is a usage error", (argv, msg) => {
    const p = parseArgs(argv);
    expect(p.kind).toBe("usage_error");
    expect((p as { message: string }).message).toMatch(msg);
  });
});

describe("owner CLI side effects", () => {
  it.each([[[]], [["help"]], [["--help"]], [["approve", "--help"]], [["demo", "reset", "-h"]], [["version"]], [["--version"]]])("%j prints help or version and sends nothing", async (argv) => {
    const { d, calls } = deps({ SISIH_OWNER_TOKEN: "owner" });
    expect(await main(argv, d)).toBe(EXIT.ok);
    expect(calls).toEqual([]);
  });
  it.each([[["approve"]], [["demo", "reset"]], [["pause", "now"]], [["limits", "set", "--per-request", "x", "--per-day", "2"]], [["nope"]]])("%j exits 2 and sends nothing", async (argv) => {
    const { d, calls } = deps({ SISIH_OWNER_TOKEN: "owner" });
    expect(await main(argv, d)).toBe(EXIT.usage);
    expect(calls).toEqual([]);
  });
  it("a change without the owner token exits 3 and sends nothing", async () => {
    const { d, calls, err } = deps({});
    expect(await main(["pause"], d)).toBe(EXIT.auth);
    expect(calls).toEqual([]);
    expect(err.join(" ")).toMatch(/SISIH_OWNER_TOKEN/);
  });
  it("never sends the agent credential as owner authority", async () => {
    const { d, calls } = deps({ SISIH_AGENT_TOKEN: "agent-only" });
    expect(await main(["pause"], d)).toBe(EXIT.auth); // the agent credential is not an owner token
    expect(calls).toEqual([]);
  });
  it("read-only commands only GET and need no token", async () => {
    const { d, calls } = deps({}, { "/api/state": { network: "testnet", session: 1, memory: { namespace: "n", stored: 0 }, vault: { total: "1", reserved: "0", free: "1", obligations: [], policy: null } }, "/api/requests": [], "/api/rules": [] });
    expect(await main(["status"], d)).toBe(EXIT.ok);
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });
  it("approve sends exactly one decision for the original request, then hands the demo run back", async () => {
    const request = { id: "req-1", session: 1, merchant: "ChainScope", item: "x", amount: "800000", status: "approved", code: "new_merchant", reasons: [], paymentStatus: "paid", paymentDigests: [] };
    const { d, calls } = deps({ SISIH_OWNER_TOKEN: "owner" }, { "/api/owner/actions": { status: "done", result: { request, ruleId: "rule-1", ruleMemoryId: "mem-1" } } });
    expect(await main(["approve", "req-1", "--remember"], d)).toBe(EXIT.ok);
    const decisions = calls.filter((c) => c.url.endsWith("/api/owner/actions"));
    expect(decisions).toHaveLength(1);
    expect(decisions[0]!.body).toEqual({ action: "decide_request", params: { request_id: "req-1", decision: "approve", remember: true } });
    expect(calls.some((c) => c.url.endsWith("/decision") || c.url.includes("/api/demo/"))).toBe(false); // the shared owner route, not the legacy demo route
    expect(calls.at(-1)!.url).toMatch(/\/api\/owner\/release$/);
  });
  it("maps server refusals to exit codes", async () => {
    const make = (status: number) => ({ d: { ...deps({ SISIH_OWNER_TOKEN: "o" }).d, fetch: (async () => new Response(JSON.stringify({ error: "nope" }), { status })) as unknown as typeof fetch } });
    expect(await main(["pause"], make(401).d)).toBe(EXIT.auth);
    expect(await main(["pause"], make(423).d)).toBe(EXIT.busy);
    expect(await main(["request", "req-x"], make(404).d)).toBe(EXIT.notFound);
    expect(await main(["pause"], make(500).d)).toBe(EXIT.failed);
  });
});

describe("gate-release: help and invalid arguments never reach a transaction", () => {
  const make = () => {
    const release = vi.fn(async () => ({ digest: "d", success: false, error: "MoveAbort 'EExceedsFree'" }));
    const g: GateDeps = { release, verify: async () => ({ success: false }), agentUsdc: async () => 0n, abortName: () => "EExceedsFree", log: () => {} };
    return { g, release };
  };
  it.each([[["--help"]], [["-h"]], [["--bogus"]], [["--amount", "abc"]], [["--amount"]], [["--skip-success", "--amount", "1.20"]], [[]]])("%j sends nothing", async (argv) => {
    const { g, release } = make();
    const code = await runGateRelease(argv, g);
    expect(release).not.toHaveBeenCalled();
    expect(code).toBe(argv[0] === "--help" || argv[0] === "-h" ? 0 : 2);
  });
  it("runs only with --yes", async () => {
    expect(parseGateArgs(["--yes", "--skip-success", "--amount=1.20"])).toEqual({ kind: "run", successRelease: false, refusedAmount: "1.20" });
    const { g, release } = make();
    expect(await runGateRelease(["--yes", "--skip-success", "--amount", "1.20"], g)).toBe(0);
    expect(release).toHaveBeenCalledTimes(1);
  });
});

describe("owner CLI on a local-signing deployment (Mainnet)", () => {
  const intent = {
    id: "oi-0123456789ab",
    kind: "offchain",
    status: "pending",
    summary: "Start the next session",
    action: { action: "start_next_session" },
    call: null,
    target: { network: "mainnet", packageId: "0xpkg", vaultId: "0xvault", vaultSharedVersion: "1", usdcType: "0xusdc::usdc::USDC", ownerAddress: `0x${"1".repeat(64)}` },
    gas_cap_mist: "50000000",
    nonce: "n",
    expires_at: Date.now() + 600_000,
  };
  const signature = { status: "owner_signature_required", intent_id: intent.id, summary: intent.summary, network: "sui:mainnet", expires_at: "later", sign_with: `pnpm sisih sign ${intent.id} --yes` };
  const signer = (address = `0x${"1".repeat(64)}`, network: "mainnet" | "testnet" = "mainnet") => {
    const signed: string[] = [];
    return {
      signed,
      load: async () => ({
        address: () => address,
        config: () => ({ network, packageId: "0xpkg", vaultId: "0xvault", usdcType: "0xusdc::usdc::USDC", agentAddress: null, proof: { roles: { owner: { address: `0x${"1".repeat(64)}` } } } as import("../mainnet/manifest").MainnetManifest }),
        signText: async (t: string) => (signed.push(t), "sig-" + t.length),
        signCall: async () => ({ tx_bytes: "AA==", signature: "sig" }),
      }),
    };
  };

  it("an owner command only creates an intent; nothing is signed or submitted without --yes", async () => {
    const { d, calls, out } = deps({ SISIH_OWNER_TOKEN: "owner" }, { "/api/owner/actions": signature });
    const s = signer();
    expect(await main(["threshold", "set", "0.75"], { ...d, signer: s.load })).toBe(EXIT.ok);
    expect(out.join(" ")).toContain(`pnpm sisih sign ${intent.id} --yes`);
    expect(s.signed).toEqual([]);
    expect(calls.some((c) => c.url.includes("/submit"))).toBe(false);
  });

  it("sign --yes checks the intent, signs locally and submits the signature (never the key)", async () => {
    const { d, calls } = deps({ SISIH_OWNER_TOKEN: "owner" }, { [`/api/owner/intents/${intent.id}`]: intent, "/submit": { status: "executed" } });
    const s = signer();
    expect(await main(["sign", intent.id, "--yes"], { ...d, signer: s.load })).toBe(EXIT.ok);
    expect(s.signed[0]).toContain("Sisih owner authorization");
    expect(s.signed[0]).toContain("network: sui:mainnet");
    const submit = calls.find((c) => c.url.endsWith("/submit"))!;
    expect(Object.keys(submit.body as object)).toEqual(["signature"]);
  });

  it("refuses to sign an intent for another network or another owner, and without a local key", async () => {
    for (const s of [signer(`0x${"1".repeat(64)}`, "testnet"), signer(`0x${"2".repeat(64)}`)]) {
      const { d, calls } = deps({ SISIH_OWNER_TOKEN: "owner" }, { [`/api/owner/intents/${intent.id}`]: intent });
      expect(await main(["sign", intent.id, "--yes"], { ...d, signer: s.load })).toBe(EXIT.failed);
      expect(s.signed).toEqual([]);
      expect(calls.some((c) => c.url.includes("/submit"))).toBe(false);
    }
    const { d } = deps({ SISIH_OWNER_TOKEN: "owner" }, { [`/api/owner/intents/${intent.id}`]: intent });
    expect(await main(["sign", intent.id, "--yes"], { ...d, signer: async () => null })).toBe(EXIT.auth);
  });
});
