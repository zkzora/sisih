# Sisih public website

Next.js 16.4.5 hosts Home (`/`), Connect (`/connect`) and read-only Proof (`/proof`), plus the Hono API/MCP and merchant routes from `server/src`. The approved forest/lime/ivory palette, DM Sans and Geist Mono remain in use. There is no operational dashboard.

Current target: [sisih-azure.vercel.app](https://sisih-azure.vercel.app), Mainnet-only Home/Connect/Proof and authenticated MCP. It reads the actual Mainnet vault through Tatum, with the completed proof in isolated hosted Postgres. Permission remains revoked and spending allocation consumed. There are no deployed wallet signing keys. New purchases, owner writes and merchant settlement are closed. Proof remains readable during API downtime; Connect rejects mismatched network responses rather than relabeling them.

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

Mainnet proof was executed with Codex, two native-USDC x402 payments, stored recall and final revoke; see [evidence](../docs/evidence/mainnet-20261108/README.md). The owner's later Mainnet-only publication request superseded the earlier retained sandbox. Historical deployment checks and original evidence remain unchanged; [publication config](../docs/mainnet/PUBLIC_DEPLOYMENT.json) identifies the new target. The database uses a dedicated schema on the existing managed PostgreSQL instance, with schema-qualified queries rather than pooled search_path. No old tables were copied or overwritten. Developer fixtures return 404 in production.
