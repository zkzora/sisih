# Mainnet execution status

8 November 2026: **the authorized local Mainnet proof is executed and verified**. [Exact receipts and transcripts](evidence/mainnet-20261108/README.md), [authorization](mainnet/EXECUTION_AUTHORIZATION.md). Public Mainnet server not deployed.

Start with [the runbook](mainnet/RUNBOOK.md), [machine manifest](mainnet/MANIFEST.json), [funding checkpoint](mainnet/MANIFEST.md) and [vault decision](mainnet/VAULT_DECISION.md). Old 3.20-USDC / 0.5954-SUI preparation figures are superseded.

Executed: deposit 3.000000 native USDC, reserve 0.800000, two 0.800000 reports, third refused, final revoked permission with 1.400000 USDC in the vault. Gas ceilings: owner 165,000,000 MIST; operator 40,000,000 MIST; agent/facilitator zero. Actual net gas: **83,418,818 MIST**, owner 80,572,988 and operator 2,845,830. Native-USDC x402 settlements had zero budget and zero net gas. Per-transaction computation, storage and rebates are recorded; revoke returned a net storage rebate.

Initial preflight/publish simulation remain historical preparation artifacts. Funding was verified at checkpoint 343006171. All eight actual receipts passed exact Tatum read-back; an unrelated successful Mainnet digest failed. Four Walrus memories were checked by job/blob and full inventory. Codex CLI completed the real model task after Claude Code was quota-blocked before tool use. Owner actions used the CLI/local key; no owner-assistant model run is claimed.

Implemented controls include explicit environment layers, server-only credential allowlist, local owner signatures, durable execution budgets, pre-submission release digests, restart journal for publish/setup, unknown-outcome reconciliation and exact evidence matching. Mainnet scope is deliberately limited by the reviewed proof manifest; expanding owner configuration requires a revised plan.

The local proof uses isolated PGlite and port 8788. A public instance needs separate Mainnet Postgres and authorization. Testnet deployment/database/namespace are unchanged; historical receipts retain their network. Remaining wallet balances: owner 0.015780 USDC + 0.089427012 SUI; operator 0.057154170 SUI; merchant 1.60 USDC. No withdrawal/refund occurred. The two-report allocation is consumed; do not reset budgets or make new purchases without a revised reviewed plan.
