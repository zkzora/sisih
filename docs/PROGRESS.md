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
  `mainnet` (sui-node 1.82.4). It answers gRPC-web over plain HTTP/1.1 fetch as well as
  native HTTP/2 gRPC, so SuiGrpcClient with a fetch transport should work in Node and
  behind the Next.js proxy.
- Consequence: no event-query RPC. Activity is built from digests we record in tx_log,
  each read back with GetTransaction (which returns its events).

## Wallets (testnet, generated 2026-11-05)

Private keys are only in .env (gitignored).

| Role | Address |
| --- | --- |
| owner | 0x85fe8337bd6329f10d291923b12ca641589eadba04bd5974a34f9bb65ac9ea70 |
| operator | 0xb72b7b13863cd53c3b5b2f021ce86875d15038a9a5620c2257c304c07f49e2de |
| agent | 0x0922682e5841dcf01b2fc25d3b2fda2e7532ab85f022a1a15b4406b49a5359ba |
| facilitator | 0xb9d27e53ee9856dc7e15a57e7c119fadd3ea1b939664591ce0279c5e352079f6 |

## Open issues

- Fund the 4 wallets with testnet SUI (the scripted faucet is disabled: "CI compatibility
  is disabled", use https://faucet.sui.io in a browser) and the agent and owner with
  testnet USDC from https://faucet.circle.com.
- Walrus Memory account ID + delegate key from memory.walrus.xyz still needed.
- Hosting provider for the public demo is not chosen yet (needs a long-running Node
  server for SSE + SQLite, plus the Next.js app).

## Env vars

See CLAUDE.md. .env.example is created in Phase 0.

## Later

- (nothing parked yet)
