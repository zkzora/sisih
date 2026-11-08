/** Local restart journal for public deployment IDs and known transaction digests. */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, openSync, closeSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fromBase64, toBase64 } from "@mysten/sui/utils";
import type { Keypair } from "@mysten/sui/cryptography";
import { Transaction } from "@mysten/sui/transactions";
import type { SuiNetwork } from "../lib/env";
import { REPO_ROOT } from "../lib/env";
import { executePreparedDetailed, prepareSignedTransaction, verifyTransaction, type DetailedTx, type PreparedSignedTransaction } from "../lib/tatum";

interface JournalOperation {
  digest: string;
  bytes_base64: string;
  signature: string;
  status: "prepared" | "verified" | "failed" | "unknown";
  gas_mist?: string;
  created?: DetailedTx["created"];
  error?: string | null;
}

export interface MainnetJournal {
  plan_id: string;
  operations: Record<string, JournalOperation>;
  ids: Record<string, string>;
}

export function journalPath(planId: string): string {
  return resolve(REPO_ROOT, `.sisih-mainnet/${planId}.json`);
}

/** One local publish/setup process at a time. A crash leaves a lock that can be recovered only once its PID is gone. */
export function acquireJournalLock(planId: string): () => void {
  const path = `${journalPath(planId)}.lock`;
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path)) {
    const previous = JSON.parse(readFileSync(path, "utf8")) as { pid: number };
    let active = true;
    try { process.kill(previous.pid, 0); } catch (err) { if ((err as NodeJS.ErrnoException).code === "ESRCH") active = false; }
    if (active) throw new Error(`Another Mainnet command holds the journal lock (PID ${previous.pid})`);
    unlinkSync(path); // exact stale lock path, journaled transactions are still reconciled by digest
  }
  const fd = openSync(path, "wx", 0o600);
  writeFileSync(fd, JSON.stringify({ pid: process.pid }));
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    closeSync(fd);
    unlinkSync(path);
  };
  process.once("exit", release);
  return release;
}

export function loadJournal(planId: string): MainnetJournal {
  const path = journalPath(planId);
  if (!existsSync(path)) return { plan_id: planId, operations: {}, ids: {} };
  const value = JSON.parse(readFileSync(path, "utf8")) as MainnetJournal;
  if (value.plan_id !== planId) throw new Error(`journal ${path} belongs to ${value.plan_id}`);
  return value;
}

export function saveJournal(journal: MainnetJournal): void {
  const path = journalPath(journal.plan_id);
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(journal, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, path);
}

function preparedFrom(op: JournalOperation): PreparedSignedTransaction {
  return { digest: op.digest, bytes: fromBase64(op.bytes_base64), signature: op.signature };
}

/**
 * Prepare and persist bytes/digest before submission. A prior unknown is only read back; it is
 * never replaced. Passing resubmitKnown re-submits the exact same signed bytes after read-back
 * failed, never a newly built transaction.
 */
export async function journaledTransaction(opts: {
  journal: MainnetJournal;
  operation: string;
  transaction: Transaction;
  signer: Keypair;
  network: SuiNetwork;
  resubmitKnown?: boolean;
  gasAuthorizationMist?: bigint;
}): Promise<DetailedTx> {
  if (opts.gasAuthorizationMist !== undefined) {
    const otherMaximum = Object.entries(opts.journal.operations)
      .filter(([id]) => id !== opts.operation)
      .reduce((total, [, op]) => total + BigInt(Transaction.from(fromBase64(op.bytes_base64)).getData().gasData.budget ?? "0"), 0n);
    const currentMaximum = BigInt(opts.transaction.getData().gasData.budget ?? "0");
    if (otherMaximum + currentMaximum > opts.gasAuthorizationMist) throw new Error("Journal gas attempts exceed the owner's aggregate authorization");
  }
  let entry = opts.journal.operations[opts.operation];
  if (entry?.status === "verified") {
    return { digest: entry.digest, success: true, error: null, gasUsedMist: BigInt(entry.gas_mist ?? "0"), created: entry.created ?? [] };
  }
  if (entry?.status === "failed") throw new Error(`${opts.operation} already failed onchain (${entry.digest}); a new attempt requires a revised approved plan`);
  if (entry) {
    try {
      const v = await verifyTransaction(entry.digest, { network: opts.network, tries: 3 });
      entry.status = v.success ? "verified" : "failed";
      entry.gas_mist = v.gasMist.toString();
      entry.created = v.created;
      entry.error = v.error;
      saveJournal(opts.journal);
      return { digest: v.digest, success: v.success, error: v.error, gasUsedMist: v.gasMist, created: v.created };
    } catch (err) {
      entry.status = "unknown";
      entry.error = (err as Error).message;
      saveJournal(opts.journal);
      if (!opts.resubmitKnown) throw new Error(`${opts.operation} has known digest ${entry.digest} with unknown outcome. Reconcile it before retrying; --resubmit-known only replays these exact signed bytes.`);
    }
  }
  if (!entry) {
    const prepared = await prepareSignedTransaction(opts.transaction, opts.signer, opts.network);
    entry = { digest: prepared.digest, bytes_base64: toBase64(prepared.bytes), signature: prepared.signature, status: "prepared" };
    opts.journal.operations[opts.operation] = entry;
    saveJournal(opts.journal);
  }
  try {
    const result = await executePreparedDetailed(preparedFrom(entry), opts.network);
    entry.status = result.success ? "verified" : "failed";
    entry.gas_mist = result.gasUsedMist.toString();
    entry.created = result.created;
    entry.error = result.error;
    saveJournal(opts.journal);
    return result;
  } catch (err) {
    entry.status = "unknown";
    entry.error = (err as Error).message;
    saveJournal(opts.journal);
    throw err;
  }
}
