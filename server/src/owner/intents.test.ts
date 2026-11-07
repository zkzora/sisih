/**
 * Local owner signing (owner intents). Isolated fixture: in-memory PGlite, real ed25519 keys and
 * real Sui transaction bytes and signatures; the chain edges (vault read, Tatum execute/read-back)
 * are stubbed. A returned signature is not evidence of chain execution, so these tests only claim
 * what Sisih accepts, rejects and records.
 */
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { toBase64 } from "@mysten/sui/utils";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { VaultState } from "../domain/types";

const owner = Ed25519Keypair.generate();
const intruder = Ed25519Keypair.generate();
const PKG = `0x${"a1".repeat(32)}`;
const VAULT = `0x${"b2".repeat(32)}`;
const AGENT = `0x${"c3".repeat(32)}`;
const USDC = `0x${"d4".repeat(32)}::usdc::USDC`;
process.env.DATABASE_URL = "pglite::memory:";
process.env.SUI_NETWORK = "testnet";
process.env.SISIH_OWNER_SIGNING = "local";
process.env.SISIH_PACKAGE_ID = PKG;
process.env.VAULT_ID = VAULT;
process.env.USDC_COIN_TYPE = USDC;
process.env.OWNER_ADDRESS = owner.toSuiAddress();
process.env.AGENT_ADDRESS = AGENT;
process.env.SISIH_AGENT_TOKEN = "agent-secret-0123456789";
process.env.DEMO_TOKEN = "owner-secret-0123456789";

const vault: { state: VaultState } = {
  state: {
    vaultId: VAULT,
    version: 1,
    owner: owner.toSuiAddress(),
    total: 20_000_000n,
    reserved: 16_500_000n,
    free: 3_500_000n,
    obligations: [{ id: 3, name: "Weekly savings", payee: AGENT, target: 4_000_000n, reserve: 4_000_000n, kind: 0, cycleMs: 0n, nextDueMs: 0n, priority: 1, cadenceLabel: "Weekly" } as never],
    policy: null,
    readAtMs: Date.now(),
  },
};
const recorded: string[] = [];
vi.mock("../chain/vault", () => ({
  vaultState: async () => vault.state,
  cachedVault: async () => vault.state,
  vaultSharedVersion: async () => "11",
  recordTx: async (digest: string) => (recorded.push(digest), { digest, status: "verified", events: [] }),
  releaseToAgent: async () => ({ ok: false }),
}));
vi.mock("../services/chainEvents", () => ({ onVaultEvents: async () => {}, listSuggestions: async () => [], acceptSuggestion: async () => ({}), rejectSuggestion: async () => ({}) }));
vi.mock("../memory/memwal", () => ({ remember: async (type: string) => ({ id: `mem-${type}`, status: "writing" }), recall: async () => ({ results: [] }), recallQueryFor: () => "q", namespace: async () => "intents-ns" }));
const tatum = { executed: [] as string[], mode: "ok" as "ok" | "timeout", seen: new Set<string>() };
vi.mock("../lib/tatum", () => ({
  executeSigned: async (bytes: Uint8Array) => {
    const { txDigestFromBytes } = await import("./tx");
    const d = txDigestFromBytes(bytes);
    tatum.executed.push(d);
    if (tatum.mode === "timeout") {
      tatum.seen.add(d); // it actually landed, but the response was lost
      throw new Error("DEADLINE_EXCEEDED");
    }
    return { digest: d, success: true, error: null };
  },
  verifyTransaction: async (digest: string) => {
    if (!tatum.seen.has(digest)) throw new Error("NOT_FOUND");
    return { digest, success: true, error: null, events: [] };
  },
}));

const { initDb } = await import("../db/index");
const { createIntent, getIntent, submitIntent, reconcileIntent, authorizationText } = await import("./intents");
const { normalizeOwnerAction } = await import("./apply");
const { buildOwnerCall } = await import("./tx");
const { performOwnerAction } = await import("./actions");
const { resolveAuth } = await import("../auth/context");

/** What the owner's local helper does for an onchain intent: build from the intent, sign. */
async function signLocally(i: Awaited<ReturnType<typeof getIntent>>, signer = owner, tamper?: (call: any) => any, budget = 10_000_000) {
  const call = tamper ? tamper(structuredClone(i.call)) : i.call;
  const tx = buildOwnerCall(i.target, call);
  tx.setSender(signer.toSuiAddress());
  tx.setGasPrice(1000);
  tx.setGasBudget(budget);
  tx.setGasPayment([{ objectId: `0x${"e5".repeat(32)}`, version: "4", digest: "11111111111111111111111111111111" }]);
  const bytes = await tx.build();
  return { tx_bytes: toBase64(bytes), signature: (await signer.signTransaction(bytes)).signature };
}
const offchainSig = async (i: Awaited<ReturnType<typeof getIntent>>, signer = owner, text = authorizationText(i)) =>
  (await signer.signPersonalMessage(new TextEncoder().encode(text))).signature;

beforeAll(async () => {
  await initDb();
});
beforeEach(() => {
  tatum.mode = "ok";
  tatum.executed = [];
  recorded.length = 0;
});

describe("owner intents: nothing happens until the owner signs", () => {
  it("an owner MCP/CLI action on a local-signing deployment returns an intent, not an effect", async () => {
    const auth = resolveAuth((n) => (n === "authorization" ? "Bearer owner-secret-0123456789" : null));
    if (!auth.ok) throw new Error("owner auth");
    expect(auth.ctx.ownerSigning).toBe("local_owner");
    const r = (await performOwnerAction(auth.ctx, "set_agent_permission", { state: "pause" })) as Record<string, string>;
    expect(r.status).toBe("owner_signature_required");
    expect(r.sign_with).toBe(`pnpm sisih sign ${r.intent_id} --yes`);
    expect(tatum.executed).toEqual([]);
  });

  it("executes a correctly signed onchain intent once, verified through Tatum", async () => {
    const i = await createIntent(normalizeOwnerAction("set_limits", { per_request_usdc: "2.00", per_day_usdc: "6.00", days: 30 }));
    expect(i.call).toMatchObject({ call: "set_agent_policy", agent: AGENT, max_per_request: "2000000", max_per_day: "6000000" });
    const signed = await signLocally(i);
    const done = await submitIntent(i.id, signed);
    expect(done.status).toBe("executed");
    expect(recorded).toEqual([done.digest]);
    // replay of the same signed bytes: refused, nothing executed again
    await expect(submitIntent(i.id, signed)).rejects.toMatchObject({ code: "intent_used" });
    expect(tatum.executed.length).toBe(1);
  });

  it.each([
    ["a changed amount", (c: any) => ({ ...c, max_per_day: "50000000" })],
    ["a different agent (recipient of the permission)", (c: any) => ({ ...c, agent: `0x${"ff".repeat(32)}` })],
    ["a different function", () => ({ call: "revoke_agent" })],
  ])("rejects bytes with %s before executing", async (_label, tamper) => {
    const i = await createIntent(normalizeOwnerAction("set_limits", { per_request_usdc: "2.00", per_day_usdc: "6.00" }));
    await expect(submitIntent(i.id, await signLocally(i, owner, tamper))).rejects.toMatchObject({ code: "intent_mismatch" });
    expect(tatum.executed).toEqual([]);
    expect((await getIntent(i.id)).status).toBe("pending");
  });

  it("rejects the wrong package, vault or asset", async () => {
    const i = await createIntent(normalizeOwnerAction("set_agent_permission", { state: "pause" }));
    for (const target of [{ ...i.target, packageId: `0x${"09".repeat(32)}` }, { ...i.target, vaultId: `0x${"08".repeat(32)}` }, { ...i.target, usdcType: `0x${"07".repeat(32)}::fake::USDC` }]) {
      const tx = buildOwnerCall(target, i.call!);
      tx.setSender(owner.toSuiAddress());
      tx.setGasPrice(1000);
      tx.setGasBudget(1_000_000);
      tx.setGasPayment([{ objectId: `0x${"e5".repeat(32)}`, version: "4", digest: "11111111111111111111111111111111" }]);
      const bytes = await tx.build();
      await expect(submitIntent(i.id, { tx_bytes: toBase64(bytes), signature: (await owner.signTransaction(bytes)).signature })).rejects.toMatchObject({ code: "intent_mismatch" });
    }
    expect(tatum.executed).toEqual([]);
  });

  it("rejects a signer who is not the vault owner, and a gas budget above the cap", async () => {
    const i = await createIntent(normalizeOwnerAction("set_agent_permission", { state: "pause" }));
    await expect(submitIntent(i.id, await signLocally(i, intruder))).rejects.toMatchObject({ code: "intent_mismatch" }); // sender check
    // owner-built bytes with an intruder's signature
    const good = await signLocally(i);
    const forged = await signLocally(i, owner);
    const intruderSig = (await intruder.signTransaction(Uint8Array.from(Buffer.from(forged.tx_bytes, "base64")))).signature;
    await expect(submitIntent(i.id, { tx_bytes: good.tx_bytes, signature: intruderSig })).rejects.toMatchObject({ code: "bad_signature" });
    await expect(submitIntent(i.id, await signLocally(i, owner, undefined, 900_000_000))).rejects.toMatchObject({ code: "intent_mismatch" });
    expect(tatum.executed).toEqual([]);
  });

  it("a lost response is recorded as unknown with its digest, reconciled through Tatum, never re-signed", async () => {
    const i = await createIntent(normalizeOwnerAction("set_agent_permission", { state: "resume" }));
    tatum.mode = "timeout";
    const u = await submitIntent(i.id, await signLocally(i));
    expect(u.status).toBe("unknown");
    expect(u.digest).toBe(tatum.executed[0]);
    // a second signed submission for the same intent is refused
    tatum.mode = "ok";
    await expect(submitIntent(i.id, await signLocally(i))).rejects.toMatchObject({ code: "intent_used" });
    const r = await reconcileIntent(i.id);
    expect(r.status).toBe("executed");
    expect(tatum.executed.length).toBe(1);
  });

  it("offchain intents: owner personal-message signature bound to action, nonce and network", async () => {
    const i = await createIntent(normalizeOwnerAction("set_threshold", { max_usdc: "0.75" }));
    // a signature over different parameters is rejected
    const altered = authorizationText({ ...i, action: { action: "set_threshold", max_amount: "50000000" } });
    await expect(submitIntent(i.id, { signature: await offchainSig(i, owner, altered) })).rejects.toMatchObject({ code: "bad_signature" });
    await expect(submitIntent(i.id, { signature: await offchainSig(i, intruder) })).rejects.toMatchObject({ code: "bad_signature" });
    const done = await submitIntent(i.id, { signature: await offchainSig(i) });
    expect(done.status).toBe("executed");
    expect(done.result).toEqual({ defaultThreshold: "750000" });
    await expect(submitIntent(i.id, { signature: await offchainSig(i) })).rejects.toMatchObject({ code: "intent_used" });
  });

  it("rejects expired intents and intents for another network", async () => {
    const old = await createIntent(normalizeOwnerAction("set_threshold", { max_usdc: "0.60" }), Date.now() - 20 * 60_000);
    await expect(submitIntent(old.id, { signature: await offchainSig(old) })).rejects.toMatchObject({ code: "intent_expired" });
    const i = await createIntent(normalizeOwnerAction("set_threshold", { max_usdc: "0.60" }));
    const { loadedEnvFiles } = await import("../lib/env");
    const files = loadedEnvFiles.splice(0, loadedEnvFiles.length);
    process.env.SUI_NETWORK = "mainnet";
    try {
      await expect(submitIntent(i.id, { signature: await offchainSig(i) })).rejects.toMatchObject({ code: "wrong_network" });
    } finally {
      process.env.SUI_NETWORK = "testnet";
      loadedEnvFiles.push(...files);
    }
  });

  it("the CLI signer's authorization text is byte-identical to what the server verifies", async () => {
    const { authorizationTextFor } = await import("../cli/run");
    const i = await createIntent(normalizeOwnerAction("decide_request", { request_id: "req-abc", decision: "deny", remember: true, max_usdc: "1.00", days: 7 }));
    expect(authorizationTextFor(i as never)).toBe(authorizationText(i));
  });

  it("refuses to create intents when the configured owner is not the vault's onchain owner", async () => {
    const real = vault.state.owner;
    vault.state = { ...vault.state, owner: intruder.toSuiAddress() };
    try {
      await expect(createIntent(normalizeOwnerAction("set_agent_permission", { state: "pause" }))).rejects.toMatchObject({ code: "owner_mismatch" });
    } finally {
      vault.state = { ...vault.state, owner: real };
    }
  });
});
