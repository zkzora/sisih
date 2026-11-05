# Sisih: Build Plan for Claude Code

Nov 5, 2026 · @zora (translated from the original Indonesian plan; product renamed from BillFirst to Sisih)

Seven phases from an empty repo to submission, one ready-to-paste prompt per phase. Target: submit Nov 10, 2026 13:00 UTC (20:00 WIB), 4 hours before the deadline.

## How to use

Run the phases in order, one phase per Claude Code session, and do not move on until that phase's gate passes.

Before Phase 0:

1. Spec in `docs/SPEC.md`. Done.
2. Design in `docs/design/` and the working dashboard in `web/`. Done.
3. `CLAUDE.md` at the repo root. Done.
4. Keys: Tatum API keys for mainnet and testnet plus the dashboard account ID (asked for on the submission form), Walrus Memory account ID and delegate key from memory.walrus.xyz, a Sui owner wallet (browser) and a Sui operator wallet (server), both with testnet SUI.

Rhythm per phase:

1. Open a new Claude Code session and paste the phase prompt.
2. For Phases 1, 2, and 4, ask for a plan first (plan mode), read it, then run.
3. Check the gate yourself. If it passes, commit and tag `phase-N`.
4. Claude Code fills in `docs/PROGRESS.md` at the end of each phase so the next session knows where things stand.

## Timeline

| Day | Phase |
| --- | --- |
| Thu Nov 5, afternoon | Phase 0: setup and 3 spikes |
| Thu Nov 5 evening to Fri Nov 6 midday | Phase 1: Move vault |
| Fri Nov 6 midday to Sat Nov 7 morning | Phase 2: server, policy engine, Tatum, Walrus Memory |
| Sat Nov 7 | Phase 3: agent, demo merchants, x402, demo controls |
| Sat Nov 7 evening to Sun Nov 8 | Phase 4: wire the dashboard, host it |
| Sun Nov 8 12:00 WIB | Checkpoint: cut scope if the Phase 3 gate has not passed |
| Mon Nov 9 | Phase 5: mainnet, 5 sessions, recording |
| Tue Nov 10 | Phase 6: docs and submission (by 20:00 WIB) |

Phase 4 is the longest because every screen and state must be wired. Monday is entirely for mainnet and recording, so Tuesday is only documents.

## Adjustments from past hackathon lessons

These were added on top of the original plan (see the "Submission rules" in CLAUDE.md):

- **Hosted demo by the midpoint.** Phase 4 ends with the server and web deployed to a public URL on testnet; Phase 5 switches that same deployment to mainnet. Judges open a link, not a localhost.
- **Real user conversations.** Talk to 3 to 5 builders who give agents a wallet during the week and log each one in `docs/USER_LOG.md`.
- **No placeholders.** Phase 6 links the real uploaded video, not a placeholder.

## Phase 0: Setup and 3 spikes

Thu Nov 5 afternoon, about 4 hours. Goal: prove the three riskiest pieces work before any features: writes through Tatum, memory on Walrus mainnet, and an x402 payment on Sui.

Before starting: fund the operator, agent, and facilitator wallets with testnet SUI, and get testnet USDC for the agent wallet from the [Circle faucet](https://faucet.circle.com/).

```text
Phase 0: scaffold the repo and run three spikes. Read CLAUDE.md and docs/SPEC.md first.
Do not build product features yet.

1. Scaffold a pnpm workspace:
   - contracts/sisih: empty Move package (sui move new sisih)
   - server/: Hono + TypeScript + tsx + vitest + drizzle + better-sqlite3
   - web/: already exists (Next.js App Router + Tailwind). Add @mysten/dapp-kit and
     @tanstack/react-query; keep the app working.
   - root: .env.example with every var in CLAUDE.md, .gitignore, docs/PROGRESS.md

2. server/src/lib/tatum.ts: the only Sui RPC chokepoint.
   - URL from SUI_NETWORK: https://sui-testnet.gateway.tatum.io or https://sui-mainnet.gateway.tatum.io
   - x-api-key header from TATUM_API_KEY_TESTNET / TATUM_API_KEY_MAINNET
   - throttle requests, retry with backoff on 429 and 5xx
   - expose a Sui client built on this transport (check the installed @mysten/sui version
     for how to pass custom headers to its HTTP transport)
   - always set gas price and gas budget explicitly when building transactions

3. Spike A, scripts/spike-tatum.ts (testnet), all through Tatum:
   latest checkpoint, USDC balance of the agent address, then sign and submit a tiny SUI
   self-transfer with OPERATOR_PRIVATE_KEY and read it back with sui_getTransactionBlock.
   Print the digest.

4. Spike B, scripts/spike-memwal.ts (Walrus Memory mainnet):
   MemWal.create({ key: MEMWAL_KEY, accountId: MEMWAL_ACCOUNT_ID,
   serverUrl: "https://relayer.memory.walrus.xyz", namespace: MEMWAL_NAMESPACE }),
   health(), remember one test memory, waitForRememberJob(job.job_id), then recall({ query }).
   Log every field returned by remember, the finished job, and recall, and record in
   PROGRESS.md which identifiers we can show in the UI.

5. Spike C, scripts/spike-x402.ts (Sui testnet, USDC):
   Install @tentaclepay/sui-x402 and read its README and types first.
   Run a local merchant route that answers 402 for 0.01 USDC, a facilitator built with the
   package, and a client paying from AGENT_PRIVATE_KEY. All Sui calls go through Tatum.
   Print the settlement digest and verify it through Tatum.
   If the package cannot settle USDC on Sui testnet within about 2 hours, stop and build a
   minimal custom x402 "exact" flow instead: 402 JSON payment requirements -> client builds
   and signs a USDC transfer -> X-PAYMENT header carries base64 tx bytes and signature ->
   facilitator dry-runs, checks recipient, amount and coin type, executes through Tatum ->
   X-PAYMENT-RESPONSE returns the digest. Record which path we took in PROGRESS.md.

USDC coin types:
- testnet 0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC
- mainnet 0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC
```

Gate:

- [ ] Workspace build passes, `sui move build` passes
- [ ] Spike A: transaction digest submitted and read back through Tatum
- [ ] Spike B: 1 memory stored on Walrus mainnet and returned by recall
- [ ] Spike C: 0.01 USDC x402 payment settles on Sui testnet, digest verified
- [ ] PROGRESS.md records the x402 path, memwal result fields, and Tatum issues

## Phase 1: Move vault contract

Thu evening to Fri Nov 6 midday. Result: a contract that by construction cannot pay the agent from reserves, tested and published on testnet through Tatum. To reuse the Moby vault pattern, append its repo path to the end of the prompt.

```text
Phase 1: the Move vault. Read CLAUDE.md, docs/SPEC.md (sections on how it works and
obligations) and docs/PROGRESS.md. Start in plan mode and show me the module layout first.

Module sisih::vault, generic over the coin type T (we use USDC, never hardcode it).

Objects
- Vault<phantom T> (shared): owner: address, free: Balance<T>,
  obligations: VecMap<u64, Obligation<T>> (max 16), next_obligation_id,
  agent_policy: Option<AgentPolicy>.
- Obligation<T> (store): name: String, payee: address, target: u64, kind: u8
  (0 fixed, 1 usage-based), cycle_ms: u64 (0 = one-time), next_due_ms: u64,
  priority: u8 (0 must, 1 important), cadence_label: String (display only,
  e.g. Monthly), reserve: Balance<T>. Sui upgrades cannot change struct layouts, so get
  every field right before publishing.
- AgentPolicy (store, copy, drop): agent: address, max_per_request, max_per_day,
  spent_in_window, window_start_ms, expires_ms, paused: bool.
- OperatorCap (key, store): vault_id: ID. Held by the server operator address.

Functions (owner = ctx.sender() == vault.owner)
- create_vault<T>(operator: address): share the vault, transfer OperatorCap to operator.
- deposit<T>(coin): anyone.
- withdraw_free<T>(amount): owner, free pool only.
- emergency_withdraw_all<T>(): owner, drains free and every reserve to owner,
  removes all obligations.
- add_obligation<T>(...): owner. Reserve min(target, free). Underfunded is allowed.
- set_obligation_target<T>(id, new_target): owner. Move the difference between free and
  reserve (partial if free is short).
- remove_obligation<T>(id): owner, reserve goes back to free.
- fund_reserves<T>(): owner or OperatorCap. Top up underfunded reserves from free,
  priority 0 first, then by id.
- pay_obligation<T>(id, bill_amount, clock): owner or OperatorCap.
  Only when now >= next_due_ms. Pays only to the stored payee.
  Fixed kind: bill_amount must equal target. Usage kind: bill_amount <= 3 * target.
  Take from reserve first, cover any shortfall from free, record any uncovered rest.
  Advance next_due_ms by cycle_ms, or remove the obligation if one-time.
- set_agent_policy<T>(agent, max_per_request, max_per_day, expires_ms): owner.
- pause_agent<T>(), resume_agent<T>(), revoke_agent<T>(): owner.
- release_to_agent<T>(cap: &OperatorCap, amount, request_id: vector<u8>, clock):
  checks cap matches vault, policy exists, not paused, not expired,
  amount <= max_per_request, rolling 24h window <= max_per_day, amount <= free.
  Splits ONLY from free and transfers the coin to policy.agent.
  It must be impossible for this function to touch any reserve.
- Read helpers: free_value, reserved_total, obligation fields.

Events for every state change: VaultCreated, Deposited, Withdrawn, ObligationAdded,
ObligationTargetChanged, ObligationRemoved, ReservesFunded, ObligationPaid
(id, bill, from_reserve, from_free, uncovered), ReleasedToAgent (request_id, amount,
free_after), AgentPolicySet, AgentPaused, AgentResumed, AgentRevoked, EmergencyWithdrawn.

Tests with test_scenario and a test Clock:
- release_to_agent never exceeds free, even with large reserves
- release aborts when paused, expired, revoked, over per-request, over daily window
- non-owner cannot withdraw, add, change, remove, or set policy
- pay_obligation: only to payee, only when due, shortfall from free, event values correct,
  one-time obligation removed, recurring one advances
- fund_reserves respects priority
- remove_obligation and emergency_withdraw_all return funds correctly

Scripts in server/scripts (all through Tatum):
- publish.ts: build with --dump-bytecode-as-base64, publish via the Tatum client,
  call create_vault<USDC>, write SISIH_PACKAGE_ID and VAULT_ID to .env.
- seed-vault.ts: uses OWNER_PRIVATE_KEY (scripts only, in .env.example).
  Deposit 20 USDC, add the 4 sample obligations from docs/SPEC.md (Inference API 6.00
  usage monthly must, Hosting VPS 5.00 fixed monthly must, Weekly savings 4.00 fixed weekly
  important, Domain renewal 1.50 fixed one-time important) with generated demo payee
  addresses, set agent policy (5 USDC per request, 10 per day, expires in 30 days).
  Recurring obligations use cycle_ms = DEMO_CYCLE_MS (env, default 120000) so one demo
  cycle lasts 2 minutes; the human cadence lives in cadence_label. First due time = now
  plus one demo cycle.
```

Gate:

- [ ] `sui move test` passes, including the test that the agent cannot touch reserves
- [ ] Package and vault published on testnet through Tatum, IDs recorded in .env
- [ ] Seed: balance 20.00, committed 16.50, free 3.50, read through Tatum
- [ ] `release_to_agent` 0.50 succeeds, 5.00 fails because it exceeds free funds

## Phase 2: Server, policy engine, Tatum, Walrus Memory

Fri Nov 6 midday to Sat Nov 7 morning. Result: a complete API used by every dashboard screen, with rules genuinely rebuilt from Walrus every new session. One design decision: the rule composer does not use an LLM. Structured fields are prefilled from the request and the sentence is generated from those fields. Faster, and it cannot go wrong during the demo.

```text
Phase 2: server core. Read CLAUDE.md, docs/SPEC.md, docs/PROGRESS.md. Plan mode first.
Payment execution is a stub interface in this phase; Phase 3 implements it with x402.

1. chain/vault.ts (through lib/tatum.ts only)
   - readVault(): parse the Vault object into VaultState (total, free, reserved per
     obligation, target, status funded/underfunded, agent policy)
   - listActivity(): query package events, map to activity rows
     (Deposit, Reserve, Pay obligation, Release to agent, x402 settle, Change reserve,
     Withdraw), each with digest and verification status from sui_getTransactionBlock
   - operator writes with OPERATOR_PRIVATE_KEY + OperatorCap: release_to_agent,
     pay_obligation, fund_reserves, deposit (simulated income)

2. memory/memwal.ts
   - typed memories: decision, rule, obligation_outcome, reserve_change, merchant_note,
     rule_disabled, session_summary
   - serialize each as a readable sentence plus a tagged JSON payload, e.g.
     "[sisih:v1:rule] Always allow search from SearchBox up to 1.50 USDC {json}"
   - remember() queues a job; track writing -> stored | failed; retry button support
   - recallForRequest(request): recall with merchant, category, amount, task context
   - loadRules(): recall all rule and rule_disabled memories for this namespace, parse
     payloads, apply disables. This is the source of truth for rules at session start.
     SQLite only caches it.

3. policy/engine.ts: a pure function, fully unit tested.
   Input: request, VaultState, rules, recalled memories, defaults (auto-allow up to 0.50).
   Order:
   1) agent paused, revoked, or expired -> auto_deny
   2) over hard per-request cap or remaining daily window -> auto_deny
   3) amount > free -> hold, reason "would cut reserve by X", allowDisabled = true
   4) matching deny rule -> auto_deny
   5) matching allow rule (merchant, category, max amount) -> auto_allow
   6) amount <= default threshold -> auto_allow
   7) merchant never seen -> hold "new merchant"
   8) otherwise -> hold "above learned rules"
   Output: action, reasons[], cutsReserveBy, matchedRuleIds[], memoryRefs[],
   balance simulation (free before/after, affected obligation).
   Tests must reproduce the 6 sample requests in docs/SPEC.md exactly.
   (web/src/lib/engine.ts already implements this logic for the local simulation;
   reuse its tested rules where they match this order.)

4. Owner decisions on held requests: approve_once, approve_and_remember(rule),
   deny, deny_and_remember(rule). Approve calls the payment stub. Every decision writes a
   decision memory; *_and_remember also writes a rule memory.
   Rule composer: prefill merchant, category, max amount (request amount rounded up to
   0.50), action, expiry from the request; generate the sentence from those fields.

5. Reserve suggestions: when ObligationPaid shows bill > target, write an
   obligation_outcome memory and create a suggestion (new target = bill rounded up to the
   next 0.50, informed by recalled past outcomes). The owner signs set_obligation_target
   in the browser; the web app posts the digest; the server verifies it through Tatum and
   writes a reserve_change memory.

6. Sessions: start_session writes a session_summary memory for the previous session
   (requests, holds, auto decisions, new rules), reloads rules from Walrus, bumps the number.

7. SQLite (drizzle): sessions, requests, decisions, rules_cache, memories (type, text,
   payload, job id, status, identifiers, used_in_decisions), suggestions, tx_log.

8. HTTP API (Hono) + SSE, shaped for the 7 dashboard screens in docs/SPEC.md:
   GET /api/state, /api/obligations, /api/obligations/:id, /api/requests,
   /api/requests/:id, POST /api/requests/:id/decision, GET /api/rules,
   PATCH /api/rules/:id, GET /api/memories, /api/memories/:id, /api/recall/last,
   /api/insights (per-session metrics for the 5 charts), /api/activity, /api/tx/:digest,
   POST /api/suggestions/:id/accept|reject, POST /api/sessions, GET /api/health
   (Tatum status and latency, memwal health), GET /api/events (SSE: request.*, tx.*,
   memory.*, state.changed).
```

Gate:

- [ ] Policy engine unit tests pass for the 6 sample requests in SPEC
- [ ] `GET /api/state` matches the explorer numbers, read through Tatum
- [ ] "Approve & remember" writes a memory to Walrus mainnet; writing -> stored shows on SSE
- [ ] Restart the server, start a new session: rules are rebuilt from Walrus recall
- [ ] `GET /api/activity` shows vault events with Tatum verification status

## Phase 3: Agent, demo merchants, x402, demo controls

Sat Nov 7. Result: the full demo flow runs from the terminal with no UI: the agent asks to pay, Sisih decides, funds are released from the vault, x402 settles on Sui. Important: the contract refuses to pay an obligation before it is due, so in the demo vault one cycle is 2 minutes. The UI still shows the "Monthly" label with a demo-cycle note.

```text
Phase 3: agent, demo merchants, x402 end to end, demo controls.
Read CLAUDE.md, docs/SPEC.md (demo flow and sample data), docs/PROGRESS.md
(which x402 path Phase 0 chose). Replace the Phase 2 payment stub.

1. Demo merchants on the server, labeled demo everywhere, each answering 402 first:
   - /merchants/datamart/token-history   0.50 USDC, category data
   - /merchants/searchbox/premium-search 1.20 USDC, category search
   - /merchants/reportlab/onchain-report 3.00 USDC, category research
   Category comes from the server's merchant registry, never from the agent.
   After payment, return a small JSON payload marked demo.

2. Facilitator: reuse the Phase 0 path (package or custom), settling through Tatum.

3. Agent runner (AGENT_PRIVATE_KEY):
   call merchant -> receive 402 -> submit a payment request to the policy engine with
   merchant, item, amount, task context ->
   auto_allow: operator calls release_to_agent(amount, request_id), agent pays x402 with
   exactly that coin, merchant returns the resource;
   hold: wait for the owner decision over SSE, then continue the same way on approval;
   auto_deny: log and stop.
   Emit the 4 x402 steps over SSE: invoice_received, funds_released, payment_sent,
   settle_verified (digest read back through Tatum). Keep the agent topped up with a
   little SUI for gas from the operator if it runs low.

4. Demo controls API:
   - POST /api/demo/run-task { scenario: cheap_data | new_merchant_search | expensive_report }
   - POST /api/demo/advance-cycle: deposit simulated income (17.00 USDC, labeled
     simulated), pay every due obligation (usage bills scripted per cycle in
     server/demo/bills.json, cycle 1 Inference API = 6.80), then fund_reserves.
     If nothing is due yet, return the seconds until the next due time.
   - POST /api/demo/new-session
   - POST /api/demo/reset (testnet only): emergency_withdraw_all, re-seed the vault,
     clear SQLite, switch to a fresh namespace sisih-demo-<n> so a recording starts
     with zero memories.
   - GET /api/demo/clock: cycle number, session number, seconds to next due.

5. Demo cycles: recurring obligations use DEMO_CYCLE_MS (default 120000) as cycle_ms,
   with a cadence label (Monthly, Weekly) kept for display. Both already exist from
   Phase 1. Do not change the Obligation struct: Sui upgrades cannot change
   struct layouts.

6. scripts/demo-run.ts: run the whole recorded flow from docs/SPEC.md headless
   (session 1 three requests with scripted owner decisions, advance cycle, accept the
   reserve suggestion, new session, session 2 three requests) and print a summary.
```

Gate:

- [ ] `demo-run.ts` passes end to end on testnet with no intervention
- [ ] Every x402 settlement has a Tatum-verified digest, and the 4 steps appear on SSE
- [ ] Advance cycle: Inference API is 0.80 short, a 7.00 suggestion appears
- [ ] Session 2: SearchBox 1.20 is auto-approved because of the rule from Walrus
- [ ] Demo reset produces a clean vault and a new memory namespace

## Phase 4: Wire the dashboard and host it

Sat Nov 7 evening to Sun Nov 8. The approved dashboard already exists in `web/` as a local simulation in English. This phase replaces its local engine with the Phase 2 and 3 APIs and deploys the whole stack to a public URL.

```text
Phase 4: wire the dashboard. The working dashboard is in web/ (local simulation over
web/src/lib/engine.ts and localStorage); brand files are in docs/design/.
Read CLAUDE.md, docs/SPEC.md (screens 1 to 7, UI states, feature checklist),
docs/PROGRESS.md and web/AGENTS.md. Plan mode first: map every existing component to its
API endpoint and SSE event, and list anything the API is missing before writing UI code.

1. Keep the existing layout, tokens, colors, type and copy. Do not redesign.
2. All UI copy stays English. Dot decimals, e.g. "20.00 USDC".
3. Data: TanStack Query for REST, one SSE connection in a provider that patches or
   invalidates queries on request.*, tx.*, memory.*, state.changed. Remove the
   localStorage state and the "simulation" disclaimers that no longer apply.
4. Owner wallet with @mysten/dapp-kit. All browser RPC goes through the Next.js route
   /api/sui-rpc, which forwards to Tatum with the key on the server side.
   Owner-signed actions: deposit, withdraw free, emergency withdraw (two-step confirm),
   add, edit and remove obligation, accept reserve suggestion (set_obligation_target),
   set agent policy, pause, resume, revoke. After each signed tx, post the digest to the
   server so it verifies through Tatum and writes memory where the spec says so.
5. Every screen: Overview, Commitments, Agent & requests, Memory, Learning impact,
   Onchain activity, Settings. Plus the global top bar, demo banner, right drawer,
   toasts, and the demo dock wired to /api/demo/*.
6. Implement all 12 UI states from the spec. Add a dev-only page /dev/states that renders
   each state with fixtures so I can check them quickly.
7. Charts with Recharts, styled to the design. Every chart shows its source caption.
8. Explorer links for digests and object IDs by network, Walrus links for memories using
   the identifiers recorded in PROGRESS.md.
9. Target 1440x900. Nothing may break at 1280 wide.
10. Deploy server and web to a public host on testnet (no setup for a judge: open the URL,
    the demo dock works). Keep secrets in the host's env, never in the client bundle.
11. Finish by walking the spec's feature checklist and reporting each item done or missing.
```

Gate:

- [ ] Every feature checklist item in SPEC is done
- [ ] The full demo flow runs from the UI alone, no terminal
- [ ] Owner transactions from the browser wallet go through the Tatum proxy, digests verified
- [ ] All 12 UI states visible at `/dev/states`
- [ ] All UI copy in English
- [ ] Public URL serves the live testnet stack

## Phase 5: Mainnet, 5 sessions, recording

Mon Nov 9. Switch to Sui mainnet, run 5 sessions with real data, then record. Budget is about 25 USDC plus a little SUI for gas, because the demo payees and merchants are your own addresses and the funds are recycled.

The recording is split in two so the "first session with no memory" story stays intact:

1. Part A, live: Session 1 and Session 2 following the spec's demo flow (through the "What changed" card).
2. Run Sessions 3 to 5 off camera via script.
3. Part B, live: the Memory, Learning impact, and Onchain activity screens with 5 sessions of data.
4. Join A and B with a title card "After 3 more sessions".

```text
Phase 5: mainnet and recording prep. Read CLAUDE.md and docs/PROGRESS.md.

1. Switch to SUI_NETWORK=mainnet. Publish the package and create the vault through the
   Tatum mainnet gateway with the mainnet USDC coin type. Seed with seed-vault.ts.
   Confirm every read and write goes through Tatum mainnet. Point the hosted deployment
   at mainnet.
2. scripts/recycle.ts: sweep USDC from the demo payee and merchant addresses back to
   the operator before each advance-cycle, so simulated income reuses the same funds.
   Label it as demo plumbing in code and README.
3. Fresh memory namespace for the final run (sisih-final). Never fake data: every
   number in Learning impact must come from real requests, memories and events.
4. demo-run.ts --sessions 3-5: scripted owner decisions that are realistic (some new
   approvals, occasional denials) so the trend is real, not tuned.
5. Full click-through of the recorded flow on mainnet. Fix every bug, console error,
   missing loading or error state, and slow call you find. Log fixes in PROGRESS.md.
6. Write docs/RECORDING.md: browser at 1440x900 and 100% zoom, demo banner on, dock
   visible, the exact click order for part A and part B, and reset steps if a take fails.
```

Gate:

- [ ] Package and vault on mainnet, all RPC through Tatum mainnet
- [ ] At least 10 memories in the final namespace on Walrus mainnet (realistically about 30)
- [ ] 5 sessions complete, Learning impact charts filled with real data
- [ ] Video parts A and B recorded, about 3 minutes total
- [ ] No console errors throughout the demo flow

## Phase 6: Docs and submission

Tue Nov 10, submit by 13:00 UTC (20:00 WIB) at the latest. Claude Code writes the README and the blog draft; you publish and fill in the form.

```text
Phase 6: submission docs. Read CLAUDE.md, every file in docs/, and the code.

1. README.md:
   - one-liner and the problem in three sentences
   - hosted demo link and demo video link at the very top
   - how it works, with a mermaid diagram of the payment flow from docs/SPEC.md
   - Tatum: every RPC method we call and the file that calls it
   - Walrus Memory: memory types, how rules are rebuilt from recall each session,
     how memory changes decisions (session 1 vs session 2 example)
   - x402 on Sui: flow, which library or custom path, sample settlement digests
   - Move vault: functions and the guarantee that the agent can never touch reserves
   - mainnet package ID, vault ID, explorer links, memory count
   - run locally from a fresh clone, env vars, scripts
   - honest limitations: demo merchants, simulated income, recycled funds,
     2-minute demo cycles
2. docs/BLOG.md, 800 to 1200 words: the problem, what Sisih does, how it uses Tatum,
   how it uses Walrus Memory, how it learned over time with real numbers pulled from
   /api/insights and the memory count, what's next. Plain words, no marketing jargon.
3. Repo hygiene: scan git history for secrets, .env.example complete, MIT LICENSE,
   tests green, fresh-clone instructions verified.
4. docs/SUBMISSION.md: every form field with its value, secrets excluded.
5. Run the hackathon-readiness audit and fix every blocker.
```

Gate:

- [ ] Repo public, README complete, fresh clone works per the instructions
- [ ] Blog published at a public link
- [ ] Demo video uploaded and linked
- [ ] Post on X or LinkedIn tagging @Tatum_io and @WalrusFoundation (optional, may add points)
- [ ] Form submitted: Tatum dashboard account ID, MEMWAL_AGENT_ID (public key in the Memory Delegate keys dashboard), repo, demo, blog

## If running late

Checkpoint Sun Nov 8 12:00 WIB: if the Phase 3 gate has not passed, cut items 1 to 4 immediately, no discussion.

Cut order, top item first:

1. Settings becomes read-only, except the Pause agent button
2. Learning impact goes from 5 charts to 3: manual reviews, money protected, obligations on time
3. The Last recall tab merges into the request drawer
4. Emergency withdraw exists only in the contract, with no UI
5. Vault and x402 stay on testnet. Walrus Memory stays on mainnet because it is required. Say so honestly in the README

Never cut: the contract that protects reserves, memory that changes decisions across sessions, Tatum verification of every transaction, and the end-to-end demo. Those four are what gets judged.

## Sources

- [Total Recall hackathon](https://recall-tatum-walrus.vercel.app/)
- [Walrus Memory quick start](https://docs.wal.app/walrus-memory/getting-started/quick-start)
- [Walrus Memory overview](https://docs.wal.app/walrus-memory)
- [Tatum Sui gateway usage example from a previous hackathon](https://github.com/Eienel/Sigil)
- [Tatum: Sui on the RPC Gateway](https://docs.tatum.io/changelog/sui-blockchain-integration-rpc-mainnet-testnet-devnet)
- [Sui docs: stablecoins and the USDC coin type](https://docs.sui.io/guides/developer/stablecoins)
- [@tentaclepay/sui-x402](https://www.pkgstats.com/pkg:@tentaclepay/sui-x402)
