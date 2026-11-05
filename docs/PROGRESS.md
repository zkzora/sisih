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
- Repo restructured: dashboard in web/ (@sisih/web), brand kit in docs/design/, pnpm
  workspace at the root (web, server). Dependencies pinned to exact versions.
  next.config.ts no longer forces turbopack.root (it broke resolution under pnpm;
  Next.js detects the root from pnpm-lock.yaml). `pnpm test` 12/12, `pnpm typecheck`
  and `pnpm build` pass.
- Plan updates: scripts/recycle.ts moved from Phase 5 to Phase 3 so testnet demo cycles
  reuse funds; Spike C must report whether the x402 library pays from coin objects,
  address balances, or both; the dashboard never polls Tatum (server cache + SSE).

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
- Faucet USDC lands in Sui **address balances** (getBalance: coinBalance 0,
  addressBalance 2000000), so listCoins returns nothing. Build payments and vault
  deposits with `coinWithBalance({ type, balance })` from @mysten/sui/transactions, which
  draws from the address balance; never assume coin objects exist.
- Rate limit is real: coinWithBalance + execute hits 429 without throttling. A wrapper
  on the transport's unary() (one call in flight, >= 400 ms apart, retry 429/UNAVAILABLE
  with backoff) made all three sweep transactions pass. Build lib/tatum.ts the same way.
- Read-after-write lag: GetTransaction right after ExecuteTransaction returned NOT_FOUND
  (Tatum routes to nodes that may lag); a retry 2 s later succeeded. Verification in
  lib/tatum.ts must retry NOT_FOUND a few times before marking a digest failed.
- Consequence: no event-query RPC. Activity is built from digests we record in tx_log,
  each read back with GetTransaction (which returns its events).

## Walrus Memory (mainnet, set up 2026-11-05)

- Relayer https://relayer.memory.walrus.xyz, /config: package
  0xe7c16fbea0560e7057e2bf7422feaa4fb313749fc69c9e9092fac7a33b81d7f5, registry
  0x8bf82c9e09e36b8d1c38298f68b7cb68e7b8762887e7592add9986d5e9cf199f.
- Account owner wallet (user's own, separate from the 4 project wallets):
  0xd89f04e5fd0c4d46c506ee7641d99d47b866517db0308c53706ec1c7deb5ae32.
- MEMWAL_ACCOUNT_ID = 0xc6408ac06d2e4ba3c4df92a47646cc7e4051ebdf20765a7ae63f572d2d8523ba (in .env).
- The account already had one delegate key ("Web App", pubkey 3e7479…4700). The value first
  given as MEMWAL_KEY was that public key, not a private key, so a new delegate key was
  generated locally and registered with a sponsored add_delegate_key, label "Sisih server",
  tx DxQTmMGkm7BTu3pQXDqx5aaAnwHWSLBxLf2oUYCXo8Wf. Its private key is MEMWAL_KEY in .env.
- MEMWAL_AGENT_ID for the submission form (public key of the "Sisih server" key):
  2bd5ef9fe819eb9fc39de0b6d37b341ec8cf9dc091f82bdea74b5560c785e3b3.
- Authenticated listNamespaces works (0 namespaces). No memory written yet (Spike B).
- Transactions on the account need no SUI: the relayer sponsors gas
  (sign personal message -> POST /sponsor -> sign tx -> POST /sponsor/execute).

## Wallets (testnet, generated 2026-11-05)

Private keys are only in .env (gitignored). Balances read through Tatum gRPC on 2026-11-05:

| Role | SUI | USDC |
| --- | --- | --- |
| owner | 1.0000 | 20.00 |
| operator | 0.9954 | 19.99 |
| agent | 0.4977 | 0.01 (Coin object) |
| facilitator | 0.9977 | 0.00 |

USDC sweep to owner (testnet, through Tatum): operator 4f2M4VGZnbHwLBAbA4cPUrZEe5AjqJw1GPPf7d9RbEtE,
agent FnrQ4bRp7F7bRRJMkhQXFcuahzFDKKiSd6rGZzRowGpe, facilitator 6g8tr7bErvyGdZb3bMDGMWHkeDSSDzjtB9rkcHqj1Mud.
Operator funded from the Circle faucet (20.00), then sent the agent 0.01 USDC as a Coin
object (coinWithBalance + transferObjects): tx aHKicFhFqP6r88fkgALZreqfR7Pj8XRyTPY2hCJ58io,
verified through Tatum. Agent coin 0xeb20712f2afc79dd7093ad883b949aea2147108c4dbe3075c236ad5b9a1ba922
(coinBalance 10000, addressBalance 0). Balances now: owner 20.00, operator 19.99, agent 0.01,
facilitator 0.00 USDC.

| Role | Address |
| --- | --- |
| owner | 0x85fe8337bd6329f10d291923b12ca641589eadba04bd5974a34f9bb65ac9ea70 |
| operator | 0xb72b7b13863cd53c3b5b2f021ce86875d15038a9a5620c2257c304c07f49e2de |
| agent | 0x0922682e5841dcf01b2fc25d3b2fda2e7532ab85f022a1a15b4406b49a5359ba |
| facilitator | 0xb9d27e53ee9856dc7e15a57e7c119fadd3ea1b939664591ce0279c5e352079f6 |

## Open issues

- The repo has no root README yet (the dashboard README is web/README.md). Phase 6 writes it.
- Hosting provider for the public demo is not chosen yet (needs a long-running Node
  server for SSE + SQLite, plus the Next.js app).

## Env vars

See CLAUDE.md. .env.example is created in Phase 0.

## Later

- (nothing parked yet)
