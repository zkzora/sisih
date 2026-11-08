# Sisih Mainnet proof runbook

This runbook documents plan `sisih-mainnet-proof-20261107-v1`, **already approved and executed locally on 8 November 2026**. [Evidence](../evidence/mainnet-20261108/README.md). Its two-purchase allocation is consumed and permission revoked; do not rerun this scenario. Commands below preserve the exact execution/recovery procedure and assume PowerShell in `C:\Sisih`. A new live run requires its own reviewed authorization. Help, validation, preflight and simulations do not spend; `--execute` may move funds.

## 1. Custody and configuration layers

Never print, copy, upload or edit `.env.mainnet` during this run. It contains local private keys and provider credentials. Create the ignored public runtime layer from the tracked template; public deployment IDs will be written to ignored `.env.mainnet.deployment`. The selected order is intentional: later files may override only public runtime/deployment keys; conflicting secrets or identities fail startup.

```powershell
Copy-Item docs/mainnet/runtime.env.example .env.mainnet.runtime
$env:SISIH_ENV_FILE = '.env.mainnet,.env.mainnet.runtime'
```

Local execution uses explicit isolated PGlite at `server/data/mainnet-proof-20261107`, port 8788, origin `http://127.0.0.1:8788`, and Walrus prefix `sisih-mainnet-proof-20261107`. It never loads the Testnet root `.env` or database.

The owner key remains local. A public Mainnet server must receive only this allowlist (names only; values go through the deployment's secret UI/CLI, never Git):

- Public: `SUI_NETWORK=mainnet`, `USDC_COIN_TYPE`, `SISIH_PACKAGE_ID`, `VAULT_ID`, `OPERATOR_CAP_ID`, `OWNER_ADDRESS`, `MERCHANT_CHAINSCOPE_ADDRESS`, `PUBLIC_BASE_URL`, `WEB_ORIGIN`, `MAINNET_PLAN_ID`, `MAINNET_OPERATOR_TX_GAS_BUDGET_MIST`, `MEMWAL_ACCOUNT_ID`, `MEMWAL_NAMESPACE_PREFIX`.
- Scoped server secrets: `TATUM_API_KEY_MAINNET`, `OPERATOR_PRIVATE_KEY`, `AGENT_PRIVATE_KEY`, `FACILITATOR_PRIVATE_KEY`, `SISIH_AGENT_TOKEN`, `SISIH_OWNER_MCP_TOKEN` (distinct values), `MEMWAL_KEY`. `SISIH_OWNER_TOKEN` is the CLI's local alias for the server owner credential.
- Isolated state: `DATABASE_URL` or `POSTGRES_URL` for a separate Mainnet Postgres database.
- Never upload: `OWNER_PRIVATE_KEY`, the full `.env.mainnet`, Testnet IDs/tokens, demo reset/recycle payee or merchant private keys.

The local owner signer selects all three local layers after publication:

```powershell
$env:SISIH_ENV_FILE = '.env.mainnet,.env.mainnet.runtime,.env.mainnet.deployment'
$env:SISIH_URL = 'http://127.0.0.1:8788'
$env:SISIH_OWNER_TOKEN = '<SISIH_OWNER_MCP_TOKEN from ignored .env.mainnet.server>'
pnpm sisih intent <intent-id>
pnpm sisih sign <intent-id> --yes
```

`pnpm sisih sign` independently rebuilds/checks the exact package, vault, asset, sender, recipient/commitment payee, amounts, expiry and gas limit before the local key signs. The spending agent receives only `SISIH_AGENT_TOKEN` and cannot call owner tools.

## 2. Build and non-spending verification

```powershell
pnpm install --frozen-lockfile
pnpm --filter @sisih/server typecheck
pnpm --filter @sisih/server test
pnpm --filter @sisih/web typecheck
pnpm --filter @sisih/web build
sui move test --path contracts/sisih
```

The installed Sui CLI is sufficient to build the selected custom package. It is below the current native-Allowances CLI prerequisite, which is one reason the alternative was not selected for this proof; see `VAULT_DECISION.md`.

Read-only live preflight and Mainnet publish simulation:

```powershell
$env:SISIH_ENV_FILE = '.env.mainnet,.env.mainnet.runtime'
pnpm --filter @sisih/server exec tsx scripts/mainnet/preflight.ts --estimate --write docs/mainnet/preflight.json
pnpm --filter @sisih/server exec tsx scripts/mainnet/preflight-memory.ts --write docs/mainnet/memory-preflight.json
pnpm --filter @sisih/server exec tsx scripts/publish.ts --manifest docs/mainnet/MANIFEST.json
pnpm --filter @sisih/server exec tsx scripts/mainnet/setup.ts --manifest docs/mainnet/MANIFEST.json
pnpm --filter @sisih/server exec tsx scripts/mainnet/init-budget.ts --manifest docs/mainnet/MANIFEST.json
```

Historical pre-funding expectation: all roles zero and deployment IDs absent. Current deployment IDs exist and balances reflect the completed proof. Do not use initial preflight as current state. Plan commands say nothing was signed or broadcast.

## 3. Exact approved funding

Fund only after approval, from a source and transfer separately authorized by the owner:

- Owner `0xebd63d9b61f6a9a4f2e46954adb70c66c42e98f127a84a30071c336d63b98990`: exactly 3,000,000 native-USDC base units and at most 165,000,000 MIST.
- Operator `0x3728736836d2ffc9380cd7f1d4c17afc2838a74967e552344e6345bdf7de0fcc`: at most 40,000,000 MIST.
- Agent and facilitator: no pre-funding in this plan.

Run preflight again and compare onchain balances. Do not proceed on a wrong asset, wrong address, excess/insufficient authorization or changed chain ID.

## 4. Interruption model

`.sisih-mainnet/sisih-mainnet-proof-20261107-v1.json` is an ignored local journal. Each live script resolves and signs once, persists exact bytes/signature/digest before submission, then records effects and public IDs. `.env.mainnet.deployment` is updated immediately after publication, before vault creation.

- A rerun reuses a verified journal entry and cannot republish/redeposit.
- A transport timeout leaves status `unknown` with a known digest. Stop. The next run reads that digest through Tatum before doing anything else.
- `--resubmit-known` may replay only the exact journaled bytes after read-back failed. It never builds a replacement transaction. Use it only after independent chain/read-provider checks.
- If a vault is non-empty but no setup journal exists, setup refuses. Reconcile rather than deleting state or forcing another deposit.
- Runtime payment keys are persisted before release. An unknown release or settlement is never automatically retried. Use the read-only reconciliation command below.

## 5. Live publication and setup — requires approval

```powershell
$plan = 'sisih-mainnet-proof-20261107-v1'
$env:SISIH_ENV_FILE = '.env.mainnet,.env.mainnet.runtime'
pnpm --filter @sisih/server exec tsx scripts/publish.ts --execute --manifest docs/mainnet/MANIFEST.json --out .env.mainnet.deployment --acknowledge $plan

$env:SISIH_ENV_FILE = '.env.mainnet,.env.mainnet.runtime,.env.mainnet.deployment'
pnpm --filter @sisih/server exec tsx scripts/mainnet/verify-deployment.ts --stage empty
pnpm --filter @sisih/server exec tsx scripts/mainnet/setup.ts --execute --manifest docs/mainnet/MANIFEST.json --acknowledge $plan
pnpm --filter @sisih/server exec tsx scripts/mainnet/verify-deployment.ts --stage setup
pnpm --filter @sisih/server exec tsx scripts/mainnet/init-budget.ts --execute --manifest docs/mainnet/MANIFEST.json --acknowledge $plan
pnpm --filter @sisih/server exec tsx scripts/mainnet/server-env.ts --write
```

After each command, read package/vault/cap ownership, transaction status and balances through Tatum. Setup must read back 3,000,000 total, 800,000 reserved and 2,200,000 free before starting the app.

## 6. Start the isolated app and connect roles

```powershell
$env:SISIH_ENV_FILE = '.env.mainnet.server'
pnpm --filter @sisih/server dev
```

The canonical MCP endpoint is `http://127.0.0.1:8788/api/mcp`. The env generator excludes `OWNER_PRIVATE_KEY` and preserves two distinct random tokens. Configure the external spending agent with only its bearer token. In the separate owner terminal select `.env.mainnet,.env.mainnet.runtime,.env.mainnet.deployment,.env.mainnet.server`; that is local signer configuration, never server startup configuration. Do not place tokens in URLs, screenshots, transcripts or the public repository.

Harmless agent check: list services and inspect budget/status. A new ChainScope request must return `awaiting_owner_approval`. Record the request ID. The owner then runs:

```powershell
pnpm sisih request <request-id>
pnpm sisih approve <request-id> --remember --max 0.80 --days 7
# The server returns an intent; inspect and sign the exact intent locally:
pnpm sisih intent <intent-id>
pnpm sisih sign <intent-id> --yes
```

Poll the same request; do not create a replacement. It must expose one release receipt, one verified settlement receipt and the useful live ChainScope report. Wait until the rule memory is `stored` with a Walrus blob ID, not merely `writing` or accepted.

Start the next application session through the owner interface, release the shared agent lease, and start a fresh external-agent conversation with no prior transcript. The second request must cite the recalled rule provenance and settle once. A third request must be refused while the rule remains active because only 600,000 base units are free.

The completed run used `run-agent.ts --client codex` with sanitized transcript output and fresh processes. Configure `SISIH_CODEX_EXE` from `(Get-Command codex).Source` and select `.env.mainnet.server` for the runner; no owner key/token is forwarded. It disables shell tools and ignores user config, with MCP HTTP `bearer_token_env_var` and an allowlist of the five spending tools. See [official Codex configuration](https://learn.chatgpt.com/docs/config-file/config-reference). This proof's two purchases are already spent; use its saved transcripts rather than invoking the purchase prompts again. Default Claude Code was quota-blocked before tool use.

```powershell
pnpm sisih session next
pnpm sisih intent <session-intent-id>
pnpm sisih sign <session-intent-id> --yes
pnpm sisih release
```

For the labeled contract simulation, use the actual operator capability with the 800,000 amount and a fresh request ID. Run this before revoke:

```powershell
pnpm --filter @sisih/server exec tsx scripts/mainnet/simulate-reserve.ts --write docs/evidence/mainnet-<date>/reserve-simulation.json
```

This does not sign or broadcast. It requires the reviewed post-purchase balances and fails verification unless the abort is `EExceedsFree`.

Finally revoke the permission and sign the exact owner intent locally:

```powershell
pnpm sisih revoke
pnpm sisih intent <intent-id>
pnpm sisih sign <intent-id> --yes
pnpm --filter @sisih/server exec tsx scripts/mainnet/verify-deployment.ts --stage final
```

Final state must be revoked, 600,000 free, 800,000 reserved, 1,400,000 total.

## 7. Unknown payment reconciliation

```powershell
$env:SISIH_ENV_FILE = '.env.mainnet,.env.mainnet.runtime,.env.mainnet.deployment'
pnpm --filter @sisih/server exec tsx scripts/mainnet/reconcile-payment.ts <request-id>
```

This reads Tatum and the isolated database only. A known release digest is classified as failed or as released-not-sent and the persistent budget is resolved accordingly. A lost merchant response becomes paid only when a verified settlement row and the merchant's durable result both exist. Otherwise it remains unknown and blocks replacement spending.

## 8. Evidence and shutdown

Create `docs/evidence/mainnet-<date>/evidence.json` only from the real run, using the exact schema enforced by `server/src/mainnet/evidence.ts`. Include package/vault/asset, request IDs, owner interface used, live output, Walrus job/blob statuses, before/after balances, gross computation/storage/rebate/net gas per role and final permission state. Never copy credentials or the ignored journal.

```powershell
pnpm --filter @sisih/server exec tsx scripts/mainnet/verify-evidence.ts --spec docs/evidence/mainnet-<date>/evidence.json --write docs/evidence/mainnet-<date>/verified.json
pnpm sisih evidence
pnpm sisih evidence memories
```

The verifier checks expected success/failure, sender, gas owner/budget, exact Move calls, asset/recipient/amount balance changes, events and created types. A valid unrelated digest must fail. A simulated refusal is listed separately with `broadcast: false`.

Stop the local process, release the shared agent lease and retain the revoked permission. Do not withdraw the remaining vault funds or merchant proceeds unless separately authorized. Public Vercel deployment, replacing the Testnet site, Git push, hackathon submission and social publishing are separate actions.

Observed recovery: the immediate post-publication create build hit a lagging Tatum node before signing; a journaled rerun reused the verified publication and created once. Setup succeeded but its first state read was stale; a separate `verify-deployment --stage setup` confirmed the deposit without a new setup transaction. Treat such a read failure as a reconciliation condition, never a reason to delete the journal or republish/redeposit.
