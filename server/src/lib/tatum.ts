/**
 * The only path to Sui. Every read and every transaction goes through Tatum's Sui gRPC
 * gateway (Tatum's JSON-RPC route returns 404). See CLAUDE.md rule 1 and rule 2.
 *
 * - Native gRPC over HTTP/2 (@protobuf-ts/grpc-transport). gRPC-web does not work against
 *   Tatum: it answers application/grpc with no status trailers.
 * - One call in flight, at least TATUM_MIN_INTERVAL_MS apart (free plan: 3 req/s).
 * - 429 / UNAVAILABLE are retried with exponential backoff.
 * - Reads right after a write can return NOT_FOUND; verifyTransaction() retries that.
 */
import { ChannelCredentials } from "@grpc/grpc-js";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import type { Keypair } from "@mysten/sui/cryptography";
import { TransactionDataBuilder, type Transaction } from "@mysten/sui/transactions";
import { GrpcTransport } from "@protobuf-ts/grpc-transport";
import type { RpcTransport } from "@protobuf-ts/runtime-rpc";
import { env, suiNetwork, type SuiNetwork } from "./env";

const MIN_INTERVAL_MS = Number(process.env.TATUM_MIN_INTERVAL_MS ?? 400);
const MAX_RETRIES = 5;
const BACKOFF_BASE_MS = 800;

/** Default gas budget for our transactions, in MIST (0.05 SUI). Always set explicitly. */
export const DEFAULT_GAS_BUDGET = 50_000_000n;

export function tatumGrpcHost(network: SuiNetwork = suiNetwork()): string {
  return `sui-${network}-grpc.gateway.tatum.io:443`;
}

function tatumApiKey(network: SuiNetwork): string {
  const key = network === "mainnet" ? env("TATUM_API_KEY_MAINNET") : env("TATUM_API_KEY_TESTNET");
  if (!key) throw new Error(`TATUM_API_KEY_${network.toUpperCase()} is not set`);
  return key;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function isRetryable(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return /429|UNAVAILABLE|RESOURCE_EXHAUSTED/.test(`${e?.code ?? ""} ${e?.message ?? ""}`);
}

/** Live counters for /api/health and the per-transaction call budget. */
export interface TatumStats {
  calls: number;
  failures: number;
  retries: number;
  byMethod: Record<string, number>;
  lastLatencyMs: number | null;
  lastOkAt: number | null;
  lastError: { at: number; code: string; message: string } | null;
}
export const tatumStats: TatumStats = { calls: 0, failures: 0, retries: 0, byMethod: {}, lastLatencyMs: null, lastOkAt: null, lastError: null };

/** Snapshot of per-method counts, for measuring how many calls a code path makes. */
export function tatumCallCounts(): Record<string, number> {
  return { ...tatumStats.byMethod };
}

/** Serialize and space out unary calls, retrying rate-limit errors. */
export function throttleTransport<T extends RpcTransport>(transport: T, minIntervalMs = MIN_INTERVAL_MS): T {
  let gate: Promise<void> = Promise.resolve();
  let lastCallAt = 0;
  const turn = () => {
    const t = gate.then(async () => {
      const wait = lastCallAt + minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      lastCallAt = Date.now();
    });
    gate = t.catch(() => {});
    return t;
  };

  const unary = transport.unary.bind(transport);
  transport.unary = ((method, input, options) => {
    type Call = ReturnType<typeof unary>;
    const run = async (): Promise<{ call: Call; response: unknown }> => {
      for (let attempt = 0; ; attempt++) {
        await turn();
        const started = Date.now();
        tatumStats.calls++;
        tatumStats.byMethod[method.name] = (tatumStats.byMethod[method.name] ?? 0) + 1;
        if (attempt > 0) tatumStats.retries++;
        const call = unary(method, input, options);
        // A failed call also rejects its headers/status/trailers promises; nobody awaits
        // them on a retried attempt, so mark them handled or Node crashes the process.
        for (const p of [call.headers, call.status, call.trailers]) Promise.resolve(p).catch(() => {});
        try {
          const response = await call.response;
          tatumStats.lastLatencyMs = Date.now() - started;
          tatumStats.lastOkAt = Date.now();
          return { call, response };
        } catch (err) {
          const e = err as { code?: string; message?: string };
          tatumStats.failures++;
          tatumStats.lastError = { at: Date.now(), code: String(e?.code ?? "unknown"), message: String(e?.message ?? err).slice(0, 200) };
          if (attempt < MAX_RETRIES && isRetryable(err)) {
            await sleep(BACKOFF_BASE_MS * 2 ** attempt);
            continue;
          }
          throw err;
        }
      }
    };
    const done = run();
    done.catch(() => {}); // the caller observes failures through `response`
    const pick = <K extends keyof Call>(k: K) => {
      const p = done.then(({ call }) => call[k]);
      p.catch(() => {});
      return p;
    };
    const response = done.then((d) => d.response);
    response.catch(() => {}); // callers may await the call itself instead of .response
    // Same shape as protobuf-ts UnaryCall: awaitable, with promise fields.
    const proxy = {
      method,
      requestHeaders: options.meta ?? {},
      request: input,
      headers: pick("headers"),
      response,
      status: pick("status"),
      trailers: pick("trailers"),
      then: (onFulfilled: never, onRejected: never) => done.then(({ call }) => call).then(onFulfilled, onRejected),
    };
    return proxy as unknown as Call;
  }) as T["unary"];
  return transport;
}

const clients = new Map<SuiNetwork, SuiGrpcClient>();

/** Shared Sui client for a network, routed through Tatum. */
export function suiClient(network: SuiNetwork = suiNetwork()): SuiGrpcClient {
  let client = clients.get(network);
  if (!client) {
    const transport = new GrpcTransport({
      host: tatumGrpcHost(network),
      channelCredentials: ChannelCredentials.createSsl(),
      meta: { "x-api-key": tatumApiKey(network) },
    });
    client = new SuiGrpcClient({ network, transport: throttleTransport(transport) });
    clients.set(network, client);
  }
  return client;
}

const GAS_PRICE_TTL_MS = 10 * 60_000;
const gasPriceCache = new Map<SuiNetwork, { price: bigint; at: number }>();

/** Reference gas price, cached for 10 minutes (it changes per epoch, about daily). */
export async function referenceGasPrice(network: SuiNetwork = suiNetwork()): Promise<bigint> {
  const hit = gasPriceCache.get(network);
  if (hit && Date.now() - hit.at < GAS_PRICE_TTL_MS) return hit.price;
  const { referenceGasPrice } = await suiClient(network).core.getReferenceGasPrice();
  const price = BigInt(referenceGasPrice);
  gasPriceCache.set(network, { price, at: Date.now() });
  return price;
}

/** Set gas price (reference price) and gas budget explicitly on a transaction. */
export async function setGas(tx: Transaction, opts: { budget?: bigint; network?: SuiNetwork } = {}): Promise<void> {
  tx.setGasPrice(await referenceGasPrice(opts.network));
  tx.setGasBudget(opts.budget ?? DEFAULT_GAS_BUDGET);
}

export interface ExecutedTx {
  digest: string;
  success: boolean;
  error: string | null;
}

/** A transport failure after submission is not proof of failure; this carries the known digest. */
export class UnknownTransactionOutcomeError extends Error {
  constructor(readonly digest: string, cause: unknown) {
    super(`Transaction ${digest} may have been submitted, but its outcome is unknown: ${(cause as Error).message}`);
    this.name = "UnknownTransactionOutcomeError";
  }
}

export interface PreparedSignedTransaction {
  bytes: Uint8Array;
  signature: string;
  digest: string;
}

/** Resolve and sign once before broadcast, so a timeout always has a stable digest to reconcile. */
export async function prepareSignedTransaction(tx: Transaction, signer: Keypair, network?: SuiNetwork): Promise<PreparedSignedTransaction> {
  const bytes = await tx.build({ client: suiClient(network) });
  const digest = TransactionDataBuilder.getDigestFromBytes(bytes);
  const signed = await signer.signTransaction(bytes);
  return { bytes, signature: signed.signature, digest };
}

export async function executePreparedDetailed(prepared: PreparedSignedTransaction, network?: SuiNetwork): Promise<DetailedTx> {
  let res;
  try {
    res = await suiClient(network).executeTransaction({ transaction: prepared.bytes, signatures: [prepared.signature], include: { effects: true, objectTypes: true } });
  } catch (err) {
    throw new UnknownTransactionOutcomeError(prepared.digest, err);
  }
  const t = res.Transaction ?? res.FailedTransaction;
  const g = t.effects.gasUsed;
  return {
    digest: t.digest,
    success: t.status.success,
    error: t.status.success ? null : JSON.stringify(t.status.error),
    created: t.effects.changedObjects
      .filter((c) => c.idOperation === "Created")
      .map((c) => ({ objectId: c.objectId, type: c.outputState === "PackageWrite" ? "package" : (t.objectTypes[c.objectId] ?? "unknown"), owner: c.outputState === "PackageWrite" ? "package" : (c.outputOwner?.$kind ?? "unknown") })),
    gasUsedMist: BigInt(g.computationCost) + BigInt(g.storageCost) - BigInt(g.storageRebate),
  };
}

/** Sign and submit through Tatum. Gas must already be set (see setGas). */
export async function signAndExecute(tx: Transaction, signer: Keypair, network?: SuiNetwork): Promise<ExecutedTx> {
  const prepared = await prepareSignedTransaction(tx, signer, network);
  let res;
  try {
    res = await suiClient(network).executeTransaction({ transaction: prepared.bytes, signatures: [prepared.signature] });
  } catch (err) {
    throw new UnknownTransactionOutcomeError(prepared.digest, err);
  }
  const t = res.Transaction ?? res.FailedTransaction;
  return { digest: t.digest, success: t.status.success, error: t.status.success ? null : JSON.stringify(t.status.error) };
}

export interface CreatedObject {
  objectId: string;
  type: string;
  /** "package" for a published package, otherwise the owner kind. */
  owner: string;
}

export interface DetailedTx extends ExecutedTx {
  created: CreatedObject[];
  /** computation + storage - rebate, in MIST */
  gasUsedMist: bigint;
}

/** Like signAndExecute, but also returns created objects (with types) and gas used. */
export async function signAndExecuteDetailed(tx: Transaction, signer: Keypair, network?: SuiNetwork, beforeExecute?: (prepared: PreparedSignedTransaction) => Promise<void>): Promise<DetailedTx> {
  const prepared = await prepareSignedTransaction(tx, signer, network);
  await beforeExecute?.(prepared);
  try {
    return await executePreparedDetailed(prepared, network);
  } catch (err) {
    if (err instanceof UnknownTransactionOutcomeError) throw err;
    throw new UnknownTransactionOutcomeError(prepared.digest, err);
  }
}

export interface TxEvent {
  /** Full Move type, e.g. 0xpkg::vault::Deposited */
  type: string;
  sender: string;
  json: Record<string, unknown> | null;
}

export interface VerifiedTx {
  digest: string;
  success: boolean;
  error: string | null;
  checkpoint: string | null;
  timestampMs: number | null;
  events: TxEvent[];
  gasMist: bigint;
  gasBreakdown: { computationMist: string; storageMist: string; storageRebateMist: string; netMist: string };
  /** Output version per changed object (from effects), to wait out read lag on later reads. */
  objectVersions: Record<string, string>;
  created: CreatedObject[];
  attempts: number;
}

/**
 * Read a transaction back through Tatum: ONE GetTransaction with effects + events (the
 * per-transaction budget). Retries NOT_FOUND, because the gateway can route the read to a
 * node that has not seen a just-executed transaction yet.
 */
export async function verifyTransaction(digest: string, opts: { network?: SuiNetwork; tries?: number } = {}): Promise<VerifiedTx> {
  const tries = opts.tries ?? 8;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await suiClient(opts.network).core.getTransaction({ digest, include: { effects: true, events: true, objectTypes: true } });
      const t = res.Transaction ?? res.FailedTransaction;
      const g = t.effects.gasUsed;
      return {
        digest: t.digest,
        success: t.status.success,
        error: t.status.success ? null : JSON.stringify(t.status.error),
        checkpoint: t.checkpoint,
        timestampMs: t.timestampMs,
        events: t.events.map((e) => ({ type: e.eventType, sender: e.sender, json: e.json })),
        gasMist: BigInt(g.computationCost) + BigInt(g.storageCost) - BigInt(g.storageRebate),
        gasBreakdown: { computationMist: String(g.computationCost), storageMist: String(g.storageCost), storageRebateMist: String(g.storageRebate), netMist: (BigInt(g.computationCost) + BigInt(g.storageCost) - BigInt(g.storageRebate)).toString() },
        objectVersions: Object.fromEntries(
          t.effects.changedObjects.filter((c) => c.outputVersion).map((c) => [c.objectId, c.outputVersion as string]),
        ),
        created: t.effects.changedObjects
          .filter((c) => c.idOperation === "Created")
          .map((c) => ({
            objectId: c.objectId,
            type: c.outputState === "PackageWrite" ? "package" : (t.objectTypes[c.objectId] ?? "unknown"),
            owner: c.outputState === "PackageWrite" ? "package" : (c.outputOwner?.$kind ?? "unknown"),
          })),
        attempts: attempt,
      };
    } catch (err) {
      const e = err as { code?: string; message?: string };
      const notFound = /NOT_FOUND|not found/i.test(`${e?.code ?? ""} ${e?.message ?? ""}`);
      if (!notFound || attempt >= tries) throw err;
      await sleep(1500);
    }
  }
}

/**
 * Submit transaction bytes the owner signed locally, through Tatum. The caller has already checked
 * the bytes against the approved intent (owner/tx.ts). Throws on transport errors: a timeout is not
 * proof of failure, so callers record the locally computed digest and reconcile instead of re-signing.
 */
export async function executeSigned(txBytes: Uint8Array, signature: string, network?: SuiNetwork): Promise<ExecutedTx> {
  const res = await suiClient(network).executeTransaction({ transaction: txBytes, signatures: [signature] });
  const t = res.Transaction ?? res.FailedTransaction;
  return { digest: t.digest, success: t.status.success, error: t.status.success ? null : JSON.stringify(t.status.error) };
}
