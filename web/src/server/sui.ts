/**
 * Server-side Sui access for the web app (Next.js Node runtime only). Every call goes through
 * Tatum's Sui gRPC gateway with the key from the server env; the browser never sees it.
 * Mirrors server/src/lib/tatum.ts: native gRPC (gRPC-web does not work against Tatum), one
 * call in flight, >= 400 ms apart, retry on 429 / UNAVAILABLE.
 */
import "server-only";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ChannelCredentials } from "@grpc/grpc-js";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { GrpcTransport } from "@protobuf-ts/grpc-transport";
import type { RpcTransport } from "@protobuf-ts/runtime-rpc";

// Local dev: fall back to the repo-root .env (Vercel provides real env vars).
if (!process.env.TATUM_API_KEY_TESTNET && !process.env.TATUM_API_KEY_MAINNET) {
  const root = resolve(process.cwd(), "../.env");
  if (existsSync(root)) process.loadEnvFile(root);
}

export type Network = "testnet" | "mainnet";

export function network(): Network {
  return process.env.SUI_NETWORK === "mainnet" ? "mainnet" : "testnet";
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function throttle<T extends RpcTransport>(transport: T, gapMs = 400): T {
  let gate: Promise<void> = Promise.resolve();
  let last = 0;
  const turn = () => {
    const t = gate.then(async () => {
      const wait = last + gapMs - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
    });
    gate = t.catch(() => {});
    return t;
  };
  const unary = transport.unary.bind(transport);
  transport.unary = ((method, input, options) => {
    type Call = ReturnType<typeof unary>;
    const run = async (): Promise<Call> => {
      for (let attempt = 0; ; attempt++) {
        await turn();
        const call = unary(method, input, options);
        for (const p of [call.headers, call.status, call.trailers]) Promise.resolve(p).catch(() => {});
        try {
          await call.response;
          return call;
        } catch (err) {
          const e = err as { code?: string; message?: string };
          if (attempt < 5 && /429|UNAVAILABLE|RESOURCE_EXHAUSTED/.test(`${e?.code} ${e?.message}`)) {
            await sleep(800 * 2 ** attempt);
            continue;
          }
          throw err;
        }
      }
    };
    const done = run();
    done.catch(() => {});
    const pick = <K extends keyof Call>(k: K) => {
      const p = done.then((c) => c[k]);
      p.catch(() => {});
      return p;
    };
    const response = done.then((c) => c.response);
    response.catch(() => {});
    return {
      method,
      requestHeaders: options.meta ?? {},
      request: input,
      headers: pick("headers"),
      response,
      status: pick("status"),
      trailers: pick("trailers"),
      then: (f: never, r: never) => done.then(f, r),
    } as unknown as Call;
  }) as T["unary"];
  return transport;
}

let client: SuiGrpcClient | undefined;

export function tatum(): SuiGrpcClient {
  if (!client) {
    const net = network();
    const key = net === "mainnet" ? requireEnv("TATUM_API_KEY_MAINNET") : requireEnv("TATUM_API_KEY_TESTNET");
    const transport = new GrpcTransport({
      host: `sui-${net}-grpc.gateway.tatum.io:443`,
      channelCredentials: ChannelCredentials.createSsl(),
      meta: { "x-api-key": key },
    });
    client = new SuiGrpcClient({ network: net, transport: throttle(transport) });
  }
  return client;
}
