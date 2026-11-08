# Sisih public website

Next.js 16.4.5 hosts Home (`/`), Connect (`/connect`) and read-only Proof (`/proof`), plus the Hono API/MCP and merchant routes from `server/src`. The approved forest/lime/ivory palette, DM Sans and Geist Mono remain in use. There is no operational dashboard.

Current deployment: [sisih-azure.vercel.app](https://sisih-azure.vercel.app), Sui Testnet vault/x402 and Walrus Memory Mainnet. Proof is a recorded historical trace; it remains readable during API downtime. Connect's optional live-state read has loading/error behavior and never approves or purchases.

Agent and owner credentials authenticate to the same `/api/mcp`. Owner CLI/local signing remains at repository root. The served skill is `public/skills/sisih/SKILL.md`. Legacy operational routes redirect to Home/Proof.

From repository root:

```powershell
pnpm install --frozen-lockfile
pnpm --filter @sisih/web test
pnpm --filter @sisih/web typecheck
pnpm --filter @sisih/web build
pnpm --filter @sisih/web start --port 3000
```

Read `AGENTS.md` and relevant installed Next.js guides before edits. API secrets stay server-side; never use `NEXT_PUBLIC_` for them. Root `.env` is the Testnet local default; explicit `SISIH_ENV_FILE` selects isolated Mainnet configuration. Production builds must not execute transactions or memory writes.

Mainnet proof was executed locally with Codex, two native-USDC x402 payments, stored recall and final revoke; see [evidence](../docs/evidence/mainnet-20261108/README.md). The local Proof page includes this recorded run and keeps historical Testnet receipts separate. The hosted interactive demo remains Testnet; this web revision has not been deployed. Use [the runbook](../docs/mainnet/RUNBOOK.md) for scoped server variables and local owner signing. A public Mainnet instance requires separate authorization and Postgres.
