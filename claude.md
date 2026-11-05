# Sisih

Your AI agent can only spend money you haven't promised.

Hackathon entry for Tatum x Walrus "Total Recall", Consumer Finance track.
Also targeting Best Use of Agent Payments (x402 settled on Sui) and Best Walrus Memory.
Deadline: 2026-11-10 17:00 UTC. Internal target: submit 2026-11-10 13:00 UTC.

Product spec: docs/SPEC.md (originally drafted as "BillFirst"; the product is Sisih)
Build plan: docs/BUILD_PLAN.md (phase prompts and gates)
Dashboard design: docs/design/ (brand kit) and web/ (working dashboard)
Progress log: docs/PROGRESS.md

## Core idea

- Hard rules live in the Move vault on Sui: obligation reserves, per-request cap,
  daily cap, permission expiry. The agent is only ever paid from the free pool.
- Soft rules live in Walrus Memory: trusted merchants, auto-approved categories,
  per-merchant thresholds. Memory can never unlock reserved funds.
- Tatum Sui RPC is how we read and prove every onchain state and transaction.

## Repo layout

- contracts/sisih : Move package, module sisih::vault
- server/ : Node + TypeScript (Hono). Policy engine, Tatum client, Walrus Memory
  client, agent runner, demo x402 merchants, x402 facilitator, demo controls,
  SSE event feed. SQLite + Drizzle for app state.
- web/ : Next.js dashboard. Already built and approved as a local simulation
  (state in web/src/lib/engine.ts + localStorage via web/src/components/context.tsx).
  Phase 4 replaces that local engine with the server API and @mysten/dapp-kit;
  keep the existing layout, tokens and copy. Do not redesign.
  web/AGENTS.md: this Next.js version has breaking changes; read
  web/node_modules/next/dist/docs/ before writing Next.js code.
- docs/ : SPEC.md, BUILD_PLAN.md, design/, PROGRESS.md, USER_LOG.md, BLOG.md

## Naming

- Product: Sisih. Never "BillFirst" in code, UI, or docs.
- Code and contract say "obligation"; the UI says "Commitments".
- Agent display name: "Research Agent".
- Memory tag prefix: [sisih:v1:<type>]. Demo namespaces: sisih-demo-<n>, final: sisih-final.

## Non-negotiable rules

1. Every Sui call, reads and transaction submission, goes through Tatum's Sui gRPC
   gateway: https://sui-testnet-grpc.gateway.tatum.io or
   https://sui-mainnet-grpc.gateway.tatum.io, API key in the x-api-key header.
   Tatum's JSON-RPC route (sui-*.gateway.tatum.io) returns 404 as of 2026-11-05 because Sui
   deprecated JSON-RPC; do not use it. The gateway accepts gRPC-web over plain fetch
   (verified), so use SuiGrpcClient from @mysten/sui with a fetch transport that adds the
   header. One chokepoint: server/src/lib/tatum.ts.
   The browser reaches Sui only through the web proxy route /api/sui-rpc,
   which forwards to Tatum. Never expose the Tatum key to the browser.
   No other RPC provider anywhere. Free plan: 3 requests/second, so throttle.
2. Set gas price and gas budget explicitly. Throttle and retry Tatum calls.
3. Walrus Memory is always mainnet: SDK @mysten-incubation/memwal,
   relayer https://relayer.memory.walrus.xyz, one namespace per owner.
   Never write secrets, keys, or raw addresses of third parties into memory.
4. remember() is an async job. Track it as writing until waitForRememberJob
   resolves, then persist whatever identifiers it returns in SQLite for the UI.
5. USDC amounts are bigint base units (6 decimals) everywhere. Format only in the UI.
6. Demo merchants are labeled "demo" in code, API responses, and UI.
7. Network is config only: SUI_NETWORK=testnet|mainnet. Package IDs, object IDs,
   and coin types come from env, never hardcoded.
8. No secrets in git. Keep .env.example complete and current.
9. Everything is in English: UI copy, code comments, commit messages, docs.
   This is an international hackathon. Dot decimals ("20.00 USDC").

## Submission rules (from past hackathon lessons)

- The hosted demo runs on the real network and a judge can open it with no setup.
  Hosting of the real stack (server + web) is planned by the midpoint, not on the last day.
- Every claim in README, blog and video links to evidence: tx digests, explorer links,
  Walrus memory IDs, video timestamps. README, blog and SPEC must not contradict each other.
- No placeholder text ships: no "TBD", "Pending", "Planned", "not measured",
  "link placeholder". Produce a real (even small) result or cut the section.
  Never invent numbers; Learning impact uses only real requests, memories and events.
- Log conversations with real target users in docs/USER_LOG.md
  (date, role, what they said, what changed).
- The repo is public before submission, and the README reaches the demo and video in one click.
- About 48 h before the deadline, run the hackathon-readiness audit.

## Working rules

- Start every session by reading docs/SPEC.md and docs/PROGRESS.md.
- Work only on the current phase. Park anything else under "Later" in PROGRESS.md.
- Before using an SDK (memwal, x402 for Sui, dapp-kit), read its README and type
  definitions in node_modules. Do not guess APIs.
- End of phase: run all tests, update docs/PROGRESS.md (done, decisions,
  open issues, new env vars), propose a commit message.
- Boring code wins: small typed modules, no premature abstractions.
- Package manager: pnpm workspace (root pnpm-workspace.yaml). Pin exact dependency
  versions; never "latest".

## Env vars

SUI_NETWORK, TATUM_API_KEY_TESTNET, TATUM_API_KEY_MAINNET,
SISIH_PACKAGE_ID, VAULT_ID, USDC_COIN_TYPE,
OWNER_PRIVATE_KEY (scripts only), OPERATOR_PRIVATE_KEY, AGENT_PRIVATE_KEY,
FACILITATOR_PRIVATE_KEY,
MERCHANT_DATAMART_ADDRESS, MERCHANT_SEARCHBOX_ADDRESS, MERCHANT_REPORTLAB_ADDRESS,
MEMWAL_KEY, MEMWAL_ACCOUNT_ID, MEMWAL_NAMESPACE, DEMO_CYCLE_MS, DATABASE_URL
