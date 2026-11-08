import { randomUUID } from "node:crypto";
import { existsSync, unlinkSync } from "node:fs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction, TransactionDataBuilder } from "@mysten/sui/transactions";
import { afterAll, describe, expect, it, vi } from "vitest";

const edge = vi.hoisted(() => ({ mode: "timeout" as "ok" | "timeout", prepared: 0, submitted: 0, landed: false }));
vi.mock("../lib/tatum", () => ({
  prepareSignedTransaction: async (tx: Transaction, signer: Ed25519Keypair) => {
    edge.prepared++;
    const bytes = await tx.build();
    return { bytes, digest: TransactionDataBuilder.getDigestFromBytes(bytes), signature: (await signer.signTransaction(bytes)).signature };
  },
  executePreparedDetailed: async (prepared: { digest: string }) => {
    edge.submitted++;
    edge.landed = true;
    if (edge.mode === "timeout") throw new Error("response lost after submission");
    return { digest: prepared.digest, success: true, error: null, created: [], gasUsedMist: 10n };
  },
  verifyTransaction: async (digest: string) => {
    if (!edge.landed) throw new Error("not visible");
    return { digest, success: true, error: null, created: [], gasMist: 10n };
  },
}));
const { acquireJournalLock, journaledTransaction, journalPath, loadJournal } = await import("./journal");
const plan = `sisih-mainnet-proof-fixture-${randomUUID()}`;
const signer = Ed25519Keypair.generate();
function transaction() {
  const tx = new Transaction();
  tx.setSender(signer.toSuiAddress());
  tx.setGasBudget(1_000_000n);
  tx.setGasPrice(100n);
  tx.setGasPayment([{ objectId: `0x${"1".repeat(64)}`, version: "1", digest: "11111111111111111111111111111111" }]);
  tx.transferObjects([tx.gas], signer.toSuiAddress());
  return tx;
}
afterAll(() => { for (const path of [journalPath(plan), `${journalPath(plan)}.lock`]) if (existsSync(path)) unlinkSync(path); });

describe("publication restart journal (stubbed chain, real signed bytes)", () => {
  it("retains the digest after response loss and reconciles a restarted process without resubmitting", async () => {
    const journal = loadJournal(plan);
    await expect(journaledTransaction({ journal, operation: "publish", transaction: transaction(), signer, network: "mainnet" })).rejects.toThrow(/response lost/);
    const restarted = loadJournal(plan);
    expect(restarted.operations.publish?.status).toBe("unknown");
    const result = await journaledTransaction({ journal: restarted, operation: "publish", transaction: transaction(), signer, network: "mainnet" });
    expect(result.success).toBe(true);
    expect(edge.prepared).toBe(1);
    expect(edge.submitted).toBe(1);
    expect(loadJournal(plan).operations.publish?.status).toBe("verified");
  });
  it("refuses simultaneous commands on the same plan", () => {
    const release = acquireJournalLock(plan);
    expect(() => acquireJournalLock(plan)).toThrow(/Another Mainnet command/);
    release();
    acquireJournalLock(plan)();
  });
  it("counts existing attempts before authorizing another transaction", async () => {
    await expect(journaledTransaction({ journal: loadJournal(plan), operation: "create", transaction: transaction(), signer, network: "mainnet", gasAuthorizationMist: 1_500_000n })).rejects.toThrow(/aggregate authorization/);
    expect(edge.submitted).toBe(1);
  });
});
