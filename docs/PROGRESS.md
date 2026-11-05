# Progress

## Current phase

Phase 2 done (gate passed 2026-11-05). Next: Phase 3 (agent, demo merchants, x402, demo controls), see docs/BUILD_PLAN.md.

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

### Phase 2: server core (2026-11-05)

Gate:

| Item | Result | Evidence |
| --- | --- | --- |
| Policy engine unit tests pass for the 6 SPEC requests | pass | server/src/policy/engine.test.ts replays session 1 (20.00/16.50/3.50) and session 2 (18.00/16.00/2.00) from SPEC fixtures: auto / held new merchant / held cut 1.20 / auto by rule / auto / held cut 2.70 + "denied before". Server suite 29/29 |
| `GET /api/state` equals the chain, read through Tatum | pass | scripts/gate-state.ts: 20/20 fields equal an independent Tatum getObject (free 3.00, committed 16.50, every obligation, policy). Explorer: https://suiscan.xyz/testnet/object/0xbfb09999511c994267cc79aa4d28de859004a0ff3b91de30155c8ee205fae962 |
| "Approve & remember" writes to Walrus mainnet, writing -> stored on SSE | pass | SearchBox 1.20 held (new merchant) -> approve_and_remember. SSE: memory.writing then memory.stored for the rule (blob pLRApww36bxb5gbirEcHCWjfYEpaKOor5g9hsCgbPvY, job ac57ac1f-a79e-4274-b4ac-0dffaf73323c, 22.5 s) and the decision (blob sM6oQbKKuUWmSgUmVsnOMEgGgRutf9qGYfovec4RtEw, 24.5 s) |
| Restart + new session rebuilds rules from Walrus recall | pass | server stopped, rules_cache wiped, restarted (0 rules), POST /api/sessions -> 1 rule loaded, origin `walrus`, source blob pLRApww3..., recall 2 of 2 namespace memories in 2.9 s. A new SearchBox 1.20 request in session 2 was auto_allowed by rule-0677970a |
| `GET /api/activity` shows vault events with Tatum verification | pass | scripts/gate-activity.ts imported 6 digests via POST /api/tx; 11 rows (deposit, 4 reserves, policy, vault created, publish, release 0.50 verified, release 5.00 failed with EExceedsFree, x402 settle). Each digest cost exactly 2 Tatum calls: 1 GetTransaction + 1 BatchGetObjects |

Measurements:

- Recall latency (Walrus mainnet, recall limit 5): 1769 ms on an empty namespace,
  1436 ms with 2 memories. Session-start rule rebuild (recall limit 100 + listMemories):
  2915 ms. Remember jobs: 22.5 s and 24.5 s to stored.
- Decisions are made before recall returns: the held SearchBox response came back with
  `recall.pending: true`; recall landed later as SSE request.recall.
- Tatum: server boot = 1 call (vault getObject). Recording a transaction = 2 calls.
  The API serves everything else from SQLite and the cached VaultState.

Built (server/src):

- policy/engine.ts (pure decide + shared hardLimit used as the pre-send check),
  composer.ts (rule draft + sentence, max rounded up to 0.50, 30-day expiry),
  suggestions.ts (bill rounded up to 0.50, raised by past bills).
- chain/vault.ts: parseVault, cached readVault, recordTx (GetTransaction effects+events,
  then 1 vault read), operator writes releaseToAgent / payObligation / fundReserves /
  depositIncome (pre-check from cache -> SDK dry-run -> execute -> recordTx; dry-run aborts
  return a readable reason via vaultAbortName and spend no gas). chain/activity.ts maps
  tx_log events to feed rows with explorer links.
- memory/format.ts (`[sisih:v1:<type>] sentence {json}`), memory/memwal.ts (remember as
  tracked background job + retry + waitForPendingMemories, timed recall, loadRules with
  listMemories cross-check, cached health).
- services: state (sessions, rules cache, settings, known merchants), requests (submit,
  owner decisions, rule draft, parallel recall), sessions (start_session), chainEvents
  (obligation_outcome + suggestions, accept via owner digest, reject), insights, payments
  (PaymentExecutor; Phase 2 stub sets payment_status=stub).
- db: drizzle schema + startup DDL; DATABASE_URL default file:./server/data/sisih.db.
- api/app.ts: every endpoint in the build plan plus POST /api/requests, POST /api/tx,
  GET /api/requests/:id/rule-draft, POST /api/state/refresh, POST /api/memories/:id/retry,
  GET /api/sessions; SSE at /api/events with Last-Event-ID replay and 15 s pings.
- Scripts: gate-state.ts, gate-activity.ts. Walrus links use https://walruscan.com/mainnet/blob/<blobId>.

Live state after the gate: session 2, 1 rule (SearchBox <= 1.50) in namespace sisih-demo-1,
4 memories stored, 2 requests (both with payment_status=stub: no funds moved).

### Phase 1: Move vault (2026-11-05)

Gate:

| Item | Result | Evidence |
| --- | --- | --- |
| `sui move test` passes, incl. agent cannot touch reserves | pass | 46/46, no warnings (contracts/sisih/tests/vault_tests.move) |
| Package and vault published on testnet through Tatum, IDs in .env | pass | publish E1yi2YGwQKvptBFmpJ6JXgJzChKfnwFeZB7YnomnXSax (checkpoint 403085774); create_vault BPpnht7M5SKmzETvfYH11FhqkBCUsQqVxe7oZPEZPuDL (checkpoint 403085788) |
| Seed: total 20.00, committed 16.50, free 3.50, read through Tatum | pass | seed 6CGR8T7aEwX8kRQz39XpyV7dEh8rCqjTpNjaqQmW9tma (checkpoint 403085839, 6 events); show-vault.ts printed 20.00 / 16.50 / 3.50 |
| release_to_agent 0.50 succeeds | pass | BdvJPeHs5a9W9fHALBwHNVxtNbiSz4kxbhpmMCefWTPs; agent USDC 0.00 -> 0.50, vault free 3.50 -> 3.00 |
| release_to_agent 5.00 fails (exceeds free funds) | pass | BQyCnzJuPWTxm5YijiSJkYduCQycqX7ex3XtDrxQiJ1w executed and failed on-chain (checkpoint 403086321) with MoveAbort EExceedsFree; reserves still 16.50 |

Deployed (testnet):

| Item | ID |
| --- | --- |
| Package (SISIH_PACKAGE_ID) | 0x37a5513a911110d00b9c795390d1af5b04a3873e6df4856b54ede7e74ba886e9 |
| Vault<USDC> (VAULT_ID, shared) | 0xbfb09999511c994267cc79aa4d28de859004a0ff3b91de30155c8ee205fae962 |
| OperatorCap (OPERATOR_CAP_ID, held by operator) | 0xd6c6f6fa29a22c63ae566ee30ecccc160bb81809146d441a2c2605744723b5db |
| UpgradeCap (UPGRADE_CAP_ID, held by owner) | in .env |

Demo payees (keys in .env as PAYEE_*_PRIVATE_KEY, demo plumbing for recycle.ts):
Inference API 0x15492a0729e0de31320da8222c253f271d5c8f7e1e8b849aa264618f0e03d5d9,
Hosting VPS 0x02b29ca85082502220a83acba4f281a35abf139d556a294522fc34e29c9c4907,
Weekly savings 0xff7f2256fd0bb2fc3787eafa8e3890702cd264af2a1546010333953d4e06c2c5,
Domain renewal 0xa0ae37a8edb10656b3a8e9db4d4749c7e1fe5f4b2b273b8a0aad22703f59c5d9.
All four obligations first due 2026-11-05T09:07:29Z (one demo cycle after seeding);
agent policy 5.00 / request, 10.00 / day, expires 2026-12-05.

Contract (approved struct list, plus `name` in ObligationPaid and ObligationRemoved):
- contracts/sisih/sources/vault.move. Every mutating entry point checks `version`;
  release_to_agent splits only from `free` and never borrows `obligations`.
- Vault pays payees, agent and owner as Coin objects. Errors have stable codes
  (#[error(code = N)]), mapped in server/src/chain/sisih.ts (VAULT_ERRORS, vaultAbortName).
- Recurring obligations skip missed cycles on late payment; one-time ones are removed
  after payment and the event keeps their name.

Scripts (server/scripts): publish.ts (refuses to republish without --force), seed-vault.ts,
show-vault.ts (`--raw` dumps the Vault JSON), gate-release.ts (`--skip-success` runs only
the failing case). Gas: publish 0.0766 SUI, create_vault 0.0048 SUI.

Findings for Phase 2+:
- The SDK simulates every transaction while building it and **throws** on a Move abort
  (`SimulationError: Transaction resolution failed: MoveAbort ... 'EExceedsFree'`), so a
  doomed transaction never reaches the chain. That is the right default for the server:
  catch SimulationError, map it with vaultAbortName, and report it as a refusal without
  spending gas. Only build fully resolved transactions (explicit object refs + gas payment)
  when on-chain failure evidence is wanted, as gate-release.ts does.
- Faucet SUI also sits in address balances (the operator has no SUI coin object big enough
  for gas). Gas from an address balance works with `setGasPayment([])` plus a
  `ValidDuring` expiration (chain id + current epoch); the normal build path handles this
  automatically.
- Clever-error abort codes: 0xT_CCC_LLLL_IIII, code in bits 48-59, line in bits 16-31.
  Testnet sample 13836185948054749199 = code 4 (EExceedsFree), line 464. Unit tested.
- Vault JSON from gRPC getObject: `free` and `reserve` are Balance JSON, obligations are
  `obligations.contents[{ key, value }]`, agent_policy is an Option. See show-vault.ts.

## Notes for Phase 3 (recorded in Phase 2)

- Reset must sweep the agent to 0 USDC (it holds 0.50 from the Phase 1 gate release).
- The agent must pay with the exact coin from release_to_agent. The x402 client builds
  `tx.balance({ useGasCoin: false })`, which may draw from any coin or the address balance;
  either keep the agent at 0 between payments or build send_funds from that exact coin.
- Replace stubPaymentExecutor (services/payments.ts) via setPaymentExecutor: releaseToAgent
  -> x402 pay -> recordTx of both digests (request_id links them) -> payment_status paid/failed.
- Call onVaultEvents(rec) after payObligation so the 6.80 Inference bill creates the 7.00
  suggestion (it already runs for digests posted to POST /api/tx).
- The server must run with only one process per DATABASE_URL.

## Notes for Phase 2 (recorded at the start of Phase 1)

- The activity feed is built from our own tx_log of digests plus the events of each
  transaction, read through Tatum with gRPC `GetTransaction` + `include: { events: true }`
  (`ListEvents` is blocked). Every owner-signed transaction from the browser must post its
  digest to the server, or it never appears in the feed.
- Rules created in a session apply immediately from the local cache. `start_session` waits
  for all pending remember jobs (about 21 s each) to finish before it reloads rules from
  Walrus recall, so a rule written seconds earlier is not lost.
- Payees and merchants may hold funds as coin objects or address balances. Always read
  `getBalance().balance` (coins + address balance) and sweep with `coinWithBalance`.
- The vault pays payees, the agent and the owner as Coin objects (testable with
  test_scenario); x402 merchants receive into address balances.

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
| owner | 0.9181 | 0.00 (20.00 deposited into the vault) |
| operator | 0.9864 | 19.98 |
| agent | 0.4977 | 0.50 (from the gate release) |
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
New in Phase 1: OPERATOR_CAP_ID, UPGRADE_CAP_ID (written by publish.ts);
PAYEE_INFERENCE_PRIVATE_KEY, PAYEE_HOSTING_PRIVATE_KEY, PAYEE_SAVINGS_PRIVATE_KEY,
PAYEE_DOMAIN_PRIVATE_KEY (written by seed-vault.ts).
New in Phase 2 (optional): PORT (default 8787), HOST (default 127.0.0.1).

## Later

- (nothing parked yet)
