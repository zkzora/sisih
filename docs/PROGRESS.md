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

## Open issues

- Keys still needed before the Phase 0 spikes: Tatum testnet + mainnet API keys,
  Walrus Memory account ID + delegate key, owner/operator/agent/facilitator wallets with
  testnet SUI, testnet USDC for the agent.
- Hosting provider for the public demo is not chosen yet (needs a long-running Node
  server for SSE + SQLite, plus the Next.js app).

## Env vars

See CLAUDE.md. .env.example is created in Phase 0.

## Later

- (nothing parked yet)
