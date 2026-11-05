# Progress

## Current phase

Prep done. Next: Phase 0 (setup and 3 spikes), see docs/BUILD_PLAN.md.

## Done

### Prep (2026-11-05)

- Dashboard approved: Next.js app with all 7 screens, demo dock, and a local engine
  (web/src/lib/engine.ts, 12 vitest tests passing, typecheck clean). It is a local
  simulation; no chain, Tatum, Walrus or x402 connection yet.
- Spec translated to English in docs/SPEC.md; build plan in docs/BUILD_PLAN.md.
- CLAUDE.md written for Sisih.

## Decisions

- Product name is **Sisih** (spec was drafted as BillFirst). Move module `sisih::vault`,
  package dir `contracts/sisih`, memory tag `[sisih:v1:<type>]`, env `SISIH_PACKAGE_ID`.
- Everything in English (international hackathon).
- The existing dashboard lives in web/ and gets wired to the API in Phase 4 instead of
  being rebuilt from mockups.
- Added to the plan: hosted public deployment at the end of Phase 4; user conversation
  log in docs/USER_LOG.md; no placeholder links in the README.

## Tatum findings (2026-11-05)

- Testnet and mainnet API keys are in .env and accepted (response header
  `x-ttm-plan: free;ratelimit=3;strategy=shared`).
- JSON-RPC at https://sui-{testnet,mainnet}.gateway.tatum.io returns 404 on every path,
  with or without a key. Sui deprecated JSON-RPC.
- gRPC at https://sui-{testnet,mainnet}-grpc.gateway.tatum.io works:
  `sui.rpc.v2.LedgerService/GetServiceInfo` returned chain `testnet` (sui-node 1.83.1) and
  `mainnet` (sui-node 1.82.4).
- Working client (verified): @mysten/sui 2.39.0 `SuiGrpcClient` with
  `transport: new GrpcTransport({ host: "sui-testnet-grpc.gateway.tatum.io:443",
  channelCredentials: ChannelCredentials.createSsl(), meta: { "x-api-key": key } })`
  from @protobuf-ts/grpc-transport + @grpc/grpc-js. getChainIdentifier and getBalance work.
- The default gRPC-web fetch transport fails ("unexpected response content type:
  application/grpc", then "missing status"): Tatum replies with native gRPC framing and no
  trailers over HTTP/1.1. So the browser cannot talk gRPC-web to Tatum directly; the
  Next.js /api/sui-rpc route must call Tatum server side with the native transport.
- Consequence: no event-query RPC. Activity is built from digests we record in tx_log,
  each read back with GetTransaction (which returns its events).

## Wallets (testnet, generated 2026-11-05)

Private keys are only in .env (gitignored). Balances read through Tatum gRPC on 2026-11-05:

| Role | SUI | USDC |
| --- | --- | --- |
| owner | 1.0000 | 2.00 |
| operator | 1.0000 | 2.00 |
| agent | 0.5000 | 2.00 |
| facilitator | 1.0000 | 2.00 |

| Role | Address |
| --- | --- |
| owner | 0x85fe8337bd6329f10d291923b12ca641589eadba04bd5974a34f9bb65ac9ea70 |
| operator | 0xb72b7b13863cd53c3b5b2f021ce86875d15038a9a5620c2257c304c07f49e2de |
| agent | 0x0922682e5841dcf01b2fc25d3b2fda2e7532ab85f022a1a15b4406b49a5359ba |
| facilitator | 0xb9d27e53ee9856dc7e15a57e7c119fadd3ea1b939664591ce0279c5e352079f6 |

## Open issues

- Owner needs at least 20.00 testnet USDC for seed-vault.ts (has 2.00; all 4 wallets hold
  8.00 total). Use https://faucet.circle.com for the owner address, or sweep the others
  to the owner in Phase 1.
- Walrus Memory: delegate key is in .env as MEMWAL_KEY (public key / MEMWAL_AGENT_ID
  9bd012e3a1c0e9eff2deb03910a6190e10a7c1e38a1ca03413290b9ccccc2ecf). Relayer health is
  ok. MEMWAL_ACCOUNT_ID (the account object ID from memory.walrus.xyz, not a wallet
  address) is still missing; authenticated calls return 401 without it.
- web/ move blocked while a next dev server runs from the repo root.
- Hosting provider for the public demo is not chosen yet (needs a long-running Node
  server for SSE + SQLite, plus the Next.js app).

## Env vars

See CLAUDE.md. .env.example is created in Phase 0.

## Later

- (nothing parked yet)
