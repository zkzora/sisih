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
import type { Transaction } from "@mysten/sui/transactions";
import { GrpcTransport } from "@protobuf-ts/grpc-transport";
import type { RpcTransport } from "@protobuf-ts/runtime-rpc";
import { env, suiNetwork, type SuiNetwork } from "./env.js";

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
        const call = unary(method, input, options);
        // A failed call also rejects its headers/status/trailers promises; nobody awaits
        // them on a retried attempt, so mark them handled or Node crashes the process.
        for (const p of [call.headers, call.status, call.trailers]) Promise.resolve(p).catch(() => {});
        try {
          return { call, response: await call.response };
        } catch (err) {
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

/** Set gas price (reference price) and gas budget explicitly on a transaction. */
export async function setGas(tx: Transaction, opts: { budget?: bigint; network?: SuiNetwork } = {}): Promise<void> {
  const { referenceGasPrice } = await suiClient(opts.network).core.getReferenceGasPrice();
  tx.setGasPrice(BigInt(referenceGasPrice));
  tx.setGasBudget(opts.budget ?? DEFAULT_GAS_BUDGET);
}

export interface ExecutedTx {
  digest: string;
  success: boolean;
  error: string | null;
}

/** Sign and submit through Tatum. Gas must already be set (see setGas). */
export async function signAndExecute(tx: Transaction, signer: Keypair, network?: SuiNetwork): Promise<ExecutedTx> {
  const res = await suiClient(network).signAndExecuteTransaction({ transaction: tx, signer });
  const t = res.Transaction ?? res.FailedTransaction;
  return { digest: t.digest, success: t.status.success, error: t.status.success ? null : JSON.stringify(t.status.error) };
}

export interface VerifiedTx {
  digest: string;
  success: boolean;
  checkpoint: string | null;
  timestampMs: number | null;
  events: number;
  attempts: number;
}

/**
 * Read a transaction back through Tatum. Retries NOT_FOUND, because the gateway can
 * route the read to a node that has not seen a just-executed transaction yet.
 */
export async function verifyTransaction(digest: string, opts: { network?: SuiNetwork; tries?: number } = {}): Promise<VerifiedTx> {
  const tries = opts.tries ?? 8;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await suiClient(opts.network).core.getTransaction({ digest, include: { events: true } });
      const t = res.Transaction ?? res.FailedTransaction;
      return {
        digest: t.digest,
        success: t.status.success,
        checkpoint: t.checkpoint,
        timestampMs: t.timestampMs,
        events: t.events.length,
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
