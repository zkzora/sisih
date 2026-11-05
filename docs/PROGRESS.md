# Progress

## Current phase

Phase 0 done (gate passed 2026-11-05). Next: Phase 1 (Move vault), see docs/BUILD_PLAN.md.

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

### Phase 0: setup and 3 spikes (2026-11-05)

Gate:

| Item | Result | Evidence |
| --- | --- | --- |
| Workspace build, sui move build | pass | `pnpm build`, `pnpm typecheck` (web + server), `pnpm test` (web 12/12, server 3/3), `sui move build` in contracts/sisih |
| Spike A: tx submitted and read back through Tatum | pass | operator SUI self-transfer 4Ed9Ppsxqw1UPMwxXXdijxU9y9eXafpFaNV4BTdxMY5A, checkpoint 403066573, read back on attempt 2 |
| Spike B: memory stored on Walrus mainnet and recalled | pass | job 1d002dfe-2e7b-41db-a67b-c0cdd3281d61, blob LbofEH99Akbm3-H-yDlMapCQRP5cMENcd94JvDkBidU, namespace sisih-spike, recall distance 0.60 |
| Spike C: 0.01 USDC x402 settles on testnet, digest verified | pass | from agent Coin object: 8G4cQRFVnv4KyMgnjSiVB9NYs9o7QpWfRuZkvMRXFVCv (checkpoint 403067497); from agent address balance: EUwUqwZJpQPrVXph7b8uvC58PcqNoXtn7rkrbqUJ2Tsr (checkpoint 403067648) |
| PROGRESS records x402 path, memwal fields, Tatum issues | pass | sections below |

Built:

- contracts/sisih: empty Move package (`sui move new sisih`), builds.
- server/ (@sisih/server): Hono, tsx, vitest, drizzle-orm, better-sqlite3 (native build
  approved in pnpm-workspace.yaml allowBuilds; protobufjs postinstall denied).
- server/src/lib/tatum.ts: the only Sui path. SuiGrpcClient over native gRPC to Tatum,
  throttleTransport (one call in flight, >= 400 ms, retry 429/UNAVAILABLE/RESOURCE_EXHAUSTED
  with backoff, unit tested), setGas (reference gas price + explicit budget), signAndExecute,
  verifyTransaction (retries NOT_FOUND). server/src/lib/env.ts loads the root .env.
- server/scripts: spike-tatum.ts, spike-memwal.ts, spike-x402.ts, fund-agent.ts
  (testnet plumbing: operator -> agent as `coin` or `address` balance).
- web/: added @mysten/dapp-kit 1.1.17, @tanstack/react-query 5.104.5, @mysten/sui 2.39.0
  (not wired yet; Phase 4). Dashboard untouched otherwise.
- Demo merchant keypairs generated into .env (DataMart, SearchBox, ReportLab). Private
  keys exist only so recycle.ts (Phase 3) can sweep funds back.

x402 path: **the package path works**, no custom flow needed.

- @tentaclepay/sui-x402 2.1.12 + @x402/core 2.12.0 (x402 V2: headers PAYMENT-REQUIRED,
  PAYMENT-SIGNATURE, PAYMENT-RESPONSE; network id `sui:testnet`).
- Pass our Tatum SuiGrpcClient via `createSuiClientRegistry().set("sui:testnet", client)`
  as `clientRegistry` to both the client and facilitator schemes; otherwise the library
  uses fullnode.testnet.sui.io directly.
- Client builds `0x2::balance::send_funds<USDC>(tx.balance({ useGasCoin: false }), payTo)`,
  signs it as sender; the facilitator is gas owner, verifies (structure + simulate),
  co-signs and executes.
- **Coin objects vs address balances: both.** Paid once from a Coin object and once from
  an address balance; both settled. The merchant always receives into its **address
  balance** (coinBalance stays 0), so recycle.ts must sweep with coinWithBalance.
- Testnet USDC is "gasless" in the library (TESTNET_GASLESS_TOKEN_RULES minAmount 0):
  gas price and budget 0, no gas payment. The facilitator's SUI did not change.
  On mainnet USDC is gasless only from 0.01 USDC (minAmount 10000); below that the
  facilitator pays gas. Check again in Phase 5.
- Library bug: `settle()` returns `success: true` with an empty `transaction` when
  verify fails. Only accept a payment with a non-empty digest that verifyTransaction confirms.

Walrus Memory fields (what the UI can show):

- remember() -> `{ job_id, status: "running" }`.
- getRememberStatus(job_id) -> `{ job_id, status: pending|running|uploaded|done|failed|not_found, owner, namespace, blob_id?, error? }`.
- waitForRememberJob(job_id) -> `{ id, job_id, blob_id, owner, namespace }` (took 21.4 s).
- recall({ query, limit, namespace }) -> `{ results: [{ blob_id, text, distance, created_at }], total }`.
- Persist per memory in SQLite: job_id, status, blob_id, namespace, created_at. Show in UI:
  type chip, text, status (Writing = pending/running/uploaded, Stored = done, Failed),
  shortened blob_id, namespace, created_at, recall distance in the Last recall tab.
  owner is the MemWal account owner wallet; no need to show it.
- Writes take ~20 s, so the "Writing" chip state is real and must be designed for.

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
- No event queries: Tatum rejects `LedgerService/ListEvents` with PERMISSION_DENIED
  "gRPC method not allowed" (verified 2026-11-05; a burst first showed up as 429).
  Activity is built from digests we record in tx_log, each read back with GetTransaction
  (include events). PERMISSION_DENIED is not retried.
- A failed gRPC call also rejects its headers/status/trailers promises; the throttle
  wrapper marks them handled, otherwise Node exits on an unhandled rejection before the
  NOT_FOUND retry runs. Covered by server/src/lib/tatum.test.ts.

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
- Authenticated listNamespaces works. Spike B wrote 1 memory to namespace sisih-spike; the demo namespace sisih-demo-1 is still empty.
- Transactions on the account need no SUI: the relayer sponsors gas
  (sign personal message -> POST /sponsor -> sign tx -> POST /sponsor/execute).

## Wallets (testnet, generated 2026-11-05)

Private keys are only in .env (gitignored). Balances read through Tatum gRPC on 2026-11-05:

| Role | SUI | USDC |
| --- | --- | --- |
| owner | 1.0000 | 20.00 |
| operator | 0.9897 | 19.98 |
| agent | 0.4977 | 0.00 |
| facilitator | 0.9977 | 0.00 |
| DataMart (demo) | 0 | 0.02 (address balance, from Spike C) |

USDC sweep to owner (testnet, through Tatum): operator 4f2M4VGZnbHwLBAbA4cPUrZEe5AjqJw1GPPf7d9RbEtE,
agent FnrQ4bRp7F7bRRJMkhQXFcuahzFDKKiSd6rGZzRowGpe, facilitator 6g8tr7bErvyGdZb3bMDGMWHkeDSSDzjtB9rkcHqj1Mud.
Operator funded from the Circle faucet (20.00), then sent the agent 0.01 USDC as a Coin
object (coinWithBalance + transferObjects): tx aHKicFhFqP6r88fkgALZreqfR7Pj8XRyTPY2hCJ58io,
verified through Tatum. Agent coin 0xeb20712f2afc79dd7093ad883b949aea2147108c4dbe3075c236ad5b9a1ba922
(coinBalance 10000, addressBalance 0). Balances now: owner 20.00, operator 19.99, agent 0.01,
facilitator 0.00 USDC.
Phase 0: operator -> agent 0.01 into the agent's address balance
(Aff8dr5wAT85dpDj2qbiy77srUmGhBahLS77aB9geo9g) for the second Spike C run.

| Role | Address |
| --- | --- |
| owner | 0x85fe8337bd6329f10d291923b12ca641589eadba04bd5974a34f9bb65ac9ea70 |
| operator | 0xb72b7b13863cd53c3b5b2f021ce86875d15038a9a5620c2257c304c07f49e2de |
| agent | 0x0922682e5841dcf01b2fc25d3b2fda2e7532ab85f022a1a15b4406b49a5359ba |
| facilitator | 0xb9d27e53ee9856dc7e15a57e7c119fadd3ea1b939664591ce0279c5e352079f6 |
| DataMart (demo) | 0xc121cd758d3437bd426a77f6b83d88c39c38c67de719a8d686b69bb49d960065 |
| SearchBox (demo) | 0xfa2c4aa7f28b0eaef1185c25b3351a4b87a134d10178692083682bdf3b85b808 |
| ReportLab (demo) | 0x5fbfeab33761c7094a42325ee3373ab8f171a3b8e90576779aa1006ff75614a1 |

## Open issues

- pnpm 11 enforces a minimum release age. @tanstack/react-query 5.106.0 (1 day old) was
  rejected; the lockfile was pinned to 5.104.5 (2026-10-19) instead of adding an
  exclusion. Re-check this if pnpm complains about lockfile entries.
- The repo has no root README yet (the dashboard README is web/README.md). Phase 6 writes it.
- Hosting provider for the public demo is not chosen yet (needs a long-running Node
  server for SSE + SQLite, plus the Next.js app).

## Env vars

See CLAUDE.md and .env.example. New in Phase 0:
- MERCHANT_DATAMART_PRIVATE_KEY, MERCHANT_SEARCHBOX_PRIVATE_KEY, MERCHANT_REPORTLAB_PRIVATE_KEY
  (demo plumbing for recycle.ts).
- Optional: TATUM_MIN_INTERVAL_MS (default 400), SPIKE_MEMWAL_NAMESPACE (default sisih-spike).

## Later

- (nothing parked yet)
