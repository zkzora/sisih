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
- server/ : TypeScript (Hono app). Policy engine, Tatum client, Walrus Memory client,
  agent runner, demo x402 merchants, x402 facilitator, demo controls, stored event feed.
  App state in Postgres through Drizzle (pg-core): node-postgres (pg) against Supabase's
  transaction pooler when hosted, embedded PGlite locally and in tests.
- web/ : Next.js dashboard, wired to the server API and @mysten/dapp-kit (approved layout,
  tokens and copy: do not redesign). It also hosts the server: web/src/app/api/[...path]
  and web/src/app/merchants/[...path] mount the Hono app (web/src/server/hosted-api.ts),
  so the whole stack is one Vercel project on one origin. /api/sui-rpc is the browser's
  only path to Sui. web/AGENTS.md: this Next.js version has breaking changes; read
  web/node_modules/next/dist/docs/ before writing Next.js code.

## Hosting

- Vercel project `sisih` (root web/, region iad1), live at https://sisih-azure.vercel.app.
  Supabase Postgres `sisih-db` (iad1) via the Vercel Marketplace; the integration sets
  POSTGRES_URL (transaction pooler, 6543), which the server uses when DATABASE_URL is unset.
  Never the session pooler (5432): 15 clients max, and suspended functions keep theirs.
- Deploy: `vercel deploy --prod` from the repo root. .vercelignore keeps .env*, server/data/
  and build output out of uploads. Secrets live only in the Vercel project env.
- Serverless rules: every query and every piece of follow-up work runs inside the request or
  through background() (lib/background.ts), which hosted-api drains with after(). Nothing
  fire-and-forget: a suspended function pins a pooler backend mid-query. maxDuration is 300 s
  on /api/* and /merchants/* (x402 settle, reset, memory jobs), 120 s on /api/sui-rpc.
  State that several instances share (locks, rate limits) lives in Postgres, never in memory.
- Local: `pnpm --filter @sisih/web build` then `next start` in web/ (loads the root .env,
  DATABASE_URL=pglite:./server/data/pglite). One process per PGlite directory.
- docs/ : SPEC.md, BUILD_PLAN.md, design/, PROGRESS.md, USER_LOG.md, BLOG.md

## Naming

- Product: Sisih. Never "BillFirst" in code, UI, or docs.
- Code and contract say "obligation"; the UI says "Commitments".
- Agent display name: "Research Agent".
- Memory tag prefix: [sisih:v1:<type>]. Demo namespaces: <MEMWAL_NAMESPACE_PREFIX>-<n>, one
  prefix per deployment (sisih-hosted on Vercel, sisih-local locally), final: sisih-final.

## Non-negotiable rules

1. Every Sui call, reads and transaction submission, goes through Tatum's Sui gRPC
   gateway: https://sui-testnet-grpc.gateway.tatum.io or
   https://sui-mainnet-grpc.gateway.tatum.io, API key in the x-api-key header.
   Tatum's JSON-RPC route (sui-*.gateway.tatum.io) returns 404 as of 2026-11-05 because Sui
   deprecated JSON-RPC; do not use it. Use native gRPC over HTTP/2:
   SuiGrpcClient from @mysten/sui with transport = new GrpcTransport (from
   @protobuf-ts/grpc-transport + @grpc/grpc-js) { host: "sui-<net>-grpc.gateway.tatum.io:443",
   channelCredentials: ChannelCredentials.createSsl(), meta: { "x-api-key": key } }.
   Verified 2026-11-05. The gRPC-web fetch transport does NOT work: Tatum answers with
   application/grpc and no status trailers. One chokepoint: server/src/lib/tatum.ts.
   The browser reaches Sui only through the web proxy route /api/sui-rpc (server side),
   which forwards to Tatum. Never expose the Tatum key to the browser.
   No other RPC provider anywhere. Free plan: 3 requests/second, so throttle.
2. Set gas price and gas budget explicitly. lib/tatum.ts throttles every call (one in
   flight, at least 400 ms apart) and retries 429/UNAVAILABLE with backoff; without it the
   free plan (3 req/s) fails on ordinary transactions.
   The dashboard never polls Tatum. The server caches vault state, refreshes it on vault
   events and after our own transactions, and stores every change as an event in Postgres.
   The dashboard polls our own GET /api/events?after=<id> (1.5 s visible, 10 s hidden); no SSE
   on serverless. Browser reads come from the server's cache, not from Tatum.
   USDC may sit in address balances instead of coin objects: build payments and deposits
   with coinWithBalance, never assume coin objects exist.
3. Walrus Memory is always mainnet: SDK @mysten-incubation/memwal,
   relayer https://relayer.memory.walrus.xyz, one namespace per owner.
   Never write secrets, keys, or raw addresses of third parties into memory.
4. remember() is an async job. Store the row as "writing" and save the job_id the moment the
   relayer accepts it, then persist blob_id and status in Postgres for the UI. No memory may
   depend on one function staying alive: the poll (housekeeping) checks stale rows once per
   pass (getRememberStatus) and resubmits rows that never got a job_id (lease memjob:<id>).
10. Public visitors are read-only. Every mutating call needs DEMO_TOKEN (judges get it in the
   submission form, never in the README or any public doc) and passes shared rate limits, the
   demo-run lease (one visitor at a time) and, for fund-moving routes, the action mutex
   (server/src/api/guard.ts). On Vercel a missing DEMO_TOKEN locks every mutation.
11. Owner actions: a connected owner wallet signs through /api/sui-rpc. On testnet only, with
   the demo token and no wallet, deposit / accept reserve suggestion / pause / resume are
   signed on the server by "Demo owner (server-signed, testnet)" and that label is shown in the
   UI and recorded as tx source demo_owner. Never on mainnet (assertTestnet).
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
- Testnet funds: rebalance testnet USDC and SUI between the 4 project wallets whenever
  one runs short, without asking (the user approved this on 2026-11-05). The operator holds
  the spare USDC. Keep the owner at 20.00 USDC before seed-vault.ts. Log every transfer
  digest in PROGRESS.md. Mainnet transfers always need the user's go-ahead.
- Package manager: pnpm workspace (root pnpm-workspace.yaml). Pin exact dependency
  versions; never "latest".

## Env vars

SUI_NETWORK, TATUM_API_KEY_TESTNET, TATUM_API_KEY_MAINNET,
SISIH_PACKAGE_ID, VAULT_ID, OPERATOR_CAP_ID, UPGRADE_CAP_ID, USDC_COIN_TYPE,
OWNER_PRIVATE_KEY (scripts only), OPERATOR_PRIVATE_KEY, AGENT_PRIVATE_KEY,
FACILITATOR_PRIVATE_KEY,
MERCHANT_DATAMART_ADDRESS, MERCHANT_SEARCHBOX_ADDRESS, MERCHANT_REPORTLAB_ADDRESS,
MERCHANT_DATAMART_PRIVATE_KEY, MERCHANT_SEARCHBOX_PRIVATE_KEY, MERCHANT_REPORTLAB_PRIVATE_KEY,
PAYEE_INFERENCE_PRIVATE_KEY, PAYEE_HOSTING_PRIVATE_KEY, PAYEE_SAVINGS_PRIVATE_KEY,
PAYEE_DOMAIN_PRIVATE_KEY (demo plumbing so recycle.ts can sweep funds back),
MEMWAL_KEY, MEMWAL_ACCOUNT_ID, MEMWAL_NAMESPACE, MEMWAL_NAMESPACE_PREFIX, DEMO_CYCLE_MS,
DEMO_TOKEN, WEB_ORIGIN, DATABASE_URL (local pglite:..., or a Postgres URL; on Vercel leave it
unset and the Supabase integration's POSTGRES_URL is used), NEXT_PUBLIC_SUI_NETWORK,
NEXT_PUBLIC_DEV_STATES
