# Sisih repository instructions

Sisih lets an external agent buy registered services only from funds not reserved for the owner's commitments. The consequential boundary is `contracts/sisih/sources/vault.move`; Walrus preferences may change review decisions but never unlock reserves.

## Current product

- Public pages are Home (`/`), Connect (`/connect`) and read-only Proof (`/proof`). There is no operational dashboard.
- One `/api/mcp` supports separate spending-agent and owner-assistant credentials. Role comes only from the credential.
- `pnpm sisih` is the owner companion and local Mainnet signer. The server never receives `OWNER_PRIVATE_KEY` on Mainnet.
- Codex CLI completed the Mainnet MCP task; Claude Code completed the historical Testnet task. Antigravity and a model owner-assistant session remain unverified.
- Hosted Testnet is `https://sisih-azure.vercel.app`; historical evidence under `docs/evidence/final-run-sisih-hosted-9` is immutable.
- Mainnet proof executed on 8 November: two 0.80-USDC x402 purchases, Walrus recall, reserve refusal and final revoke. Evidence: `docs/evidence/mainnet-20261108`. No public Mainnet server is deployed.

## Non-negotiable boundaries

1. Every Sui read, resolution, simulation, submission and read-back uses `server/src/lib/tatum.ts`; no public-RPC fallback.
2. Mainnet uses `SISIH_ENV_FILE`. Never load the root Testnet `.env` for Mainnet or print/rewrite/upload `.env.mainnet`.
3. Mainnet public IDs go to `.env.mainnet.deployment`; runtime public values go to `.env.mainnet.runtime`; both are ignored. Template: `docs/mainnet/runtime.env.example`.
4. Live commands require the exact manifest, `--execute` and its acknowledgement. Defaults and `--help` never sign or broadcast.
5. Transactions are prepared and journaled before submission. Reconcile unknown outcomes by known digest before retrying; never build a replacement spend.
6. Persistent database budgets and request idempotency enforce authorization; a funding figure in a document does not.
7. Invoice price, recipient, asset and category come from the merchant registry, never model input.
8. Release and settlement are distinct. Never say “nothing moved” after a release or claim paid without verified settlement.
9. Walrus accepted/writing is not stored. Evidence needs the final job result and blob ID.
10. Demo reset/recycle/server-owner signing remains Testnet-only.

## Mainnet source of truth

- `docs/mainnet/VAULT_DECISION.md` — retain the tested Sisih vault for this bounded proof.
- `docs/mainnet/MANIFEST.json` / `.md` — exact proposal `sisih-mainnet-proof-20261107-v1`.
- `docs/mainnet/RUNBOOK.md` — executable workflow and recovery.
- `docs/mainnet/preflight.json` — historical preparation preflight; `preflight-funded.json` records funding, and `docs/evidence/mainnet-20261108` records final state.

The owner authorized and funded the exact plan; see `docs/mainnet/EXECUTION_AUTHORIZATION.md`. Deposit 3.00 USDC, merchant outflow 1.60 USDC, final vault 1.40 USDC, permission revoked. Net gas 0.083418818 SUI. Do not rerun purchases or expand the exhausted outflow budget. The immutable JSON manifest retains its original proposed status; the separate authorization and receipts establish execution.

Do not publish the package, fund wallets, deploy Vercel, push Git, submit a form, or publish blog/social content without explicit authorization for that external action.

## Development

Use pnpm 11.28.6 and Node 24. Read `web/AGENTS.md` and relevant installed Next.js 16.4.5 guides before web changes.

```powershell
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
sui move test --path contracts/sisih
pnpm --filter @sisih/web build
```

Key areas: Move invariant `contracts/sisih/sources/vault.move`; policy/payment `server/src/policy/engine.ts` and `server/src/services/payments.ts`; role MCP `server/src/mcp/`; owner signing `server/src/owner/` and `server/src/cli/signer.ts`; Mainnet guards `server/src/mainnet/` and `server/scripts/mainnet/`; public site `web/src/app`.

Preserve user changes and historical evidence. Use integer base units and distinguish funding, transaction gas limits, actual computation/storage/rebate and net charge.
