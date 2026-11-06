# Sisih dashboard (web/)

The Next.js dashboard for Sisih, and the host of the Sisih server: `src/app/api/[...path]` and
`src/app/merchants/[...path]` mount the Hono app from `server/src` (see `src/server/hosted-api.ts`),
so the dashboard, the API and the demo x402 merchants run as one Vercel project on one origin.
Built from the approved Sisih design (forest green, lime, ivory, DM Sans, the Sisih wordmark).

Live: https://sisih-azure.vercel.app

## Networks

| Part | Network |
| --- | --- |
| Move vault (reserves, per-request and daily caps, permission expiry), agent releases, bill payments | Sui Testnet |
| x402 settlement with the demo merchants | Sui Testnet |
| Every Sui read and write | Tatum Sui Testnet gRPC gateway, server side (`/api/sui-rpc` for the browser) |
| Walrus Memory (decisions, rules, outcomes, session summaries) | Walrus Mainnet, relayer https://relayer.memory.walrus.xyz |

The UI shows this as "Sui Testnet · Walrus Memory Mainnet". Memory is written by the server with its
own delegate key; no wallet network switch is needed.

## Run locally

From the repo root (pnpm workspace, root `.env` from `.env.example`):

```sh
pnpm install
pnpm --filter @sisih/web build
cd web && npx next start --port 3000
```

Open http://127.0.0.1:3000. Locally the server stores app state in embedded PGlite
(`DATABASE_URL=pglite:./server/data/pglite`); the hosted app uses Supabase Postgres.

## How a visitor uses it

- Without the demo token everything is read-only: balances, commitments, requests, memories,
  Learning impact and onchain activity, all live.
- With the demo token, the **Demo controls** dock runs the three demo merchant tasks, advances a
  billing cycle (simulated income, demo payees), starts a new session (rules rebuilt from Walrus
  recall) and resets the demo. One visitor runs the demo at a time; **Lock demo controls** hands it
  back.
- Owner actions are signed by the connected owner wallet. On testnet, with the token and no wallet,
  deposits, reserve suggestions, pause and resume are signed on the server and labeled
  "Demo owner (server-signed, testnet)".

## Checks

```sh
pnpm test
pnpm typecheck
pnpm build
```

The web suite covers the adapter from API data to the screens. The server suite (policy engine,
guard, event feed, memory format, Tatum client) lives in `server/`.

Brand assets are in `docs/design/`. Applied tokens are in `src/app/tokens.css`; public logo assets
are in `public/brand/`.
