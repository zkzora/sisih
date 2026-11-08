# Sisih product and financial specification

Current specification, 8 November 2026. Earlier dashboard specifications are retained in Git history and historical evidence, not active product requirements.

## User, failure and mechanism

An owner delegates paid data/API tasks while holding money promised to bills or savings in the same USDC pool. A static cap can permit a useful purchase that leaves those commitments short. Sisih segregates reserves in a Sui Move vault and releases only current free funds. Owner preferences stored in Walrus Memory govern review decisions within that hard boundary.

A separately funded agent wallet is the strongest simpler alternative. Sisih's differentiated claim is a spending boundary that changes atomically with current commitments, plus inspectable preference persistence. Demand and performance against a competent static-policy baseline remain assumptions to validate with owners.

## Interfaces

- Public Home, Connect and Proof. No operational dashboard, browser approval/configuration or task launcher. Legacy operational URLs redirect intentionally.
- One canonical `/api/mcp`, Streamable HTTP POST. Agent and owner tools use distinct server-validated bearer credentials. Names, role headers and hidden tool calls confer no authority.
- Agent: budget, services, one purchase with stable idempotency key, request status and session release. It cannot decide or configure its own authority.
- Owner: inspect requests/evidence, approve/deny/remember, configure preferences/commitments/limits, control permission, start next session. Mainnet actions return intents and need a local owner signature.
- CLI: `pnpm sisih`, companion to owner MCP and independent local signer. No secret is embedded in a public snippet or URL.

## Financial boundary

`Vault<T>` holds free and obligation-specific reserve balances. Owner-only actions create/change/remove commitments, change policy or withdraw. The operator holds the vault-specific `OperatorCap`; it can fund reserves, pay obligations only to their stored payees, and release to the configured agent. `release_to_agent` checks current policy, per-request cap, rolling daily window, expiry and pause, then requires `amount <= free`. Concurrent transactions mutate the same shared vault; they cannot spend an old cached free balance twice.

Owner emergency withdrawal is deliberately outside agent protection. The package UpgradeCap stays with its owner. There is no third-party audit claim. [Primitive reuse decision](mainnet/VAULT_DECISION.md): retain the exercised custom vault for this proof; native app-bound Allowances require additional reserve state/policy, and Spend Vault budgets do not segregate promises.

## Request and payment behavior

1. Fetch registered merchant invoice; validate asset, amount, recipient and category against registry.
2. Read cached/onchain vault state and recall context. Hard limits take priority over preferences.
3. Return auto-allow, auto-deny or hold. A hard refusal cannot be approved through memory.
4. Atomically claim one request for payment. Reserve its durable USDC/gas authorization before signing.
5. Prepare and persist the release digest; release exactly the invoice amount from free to the agent.
6. Pay with that released coin, settle through x402 and read back the chain outcome via Tatum.
7. Deliver the report and receipts only as settled after verification; accepted/writing memory remains visibly pending.

The same idempotency key means the same intended purchase. A fresh purchase needs a new key. Status reads never pay. Release and settlement are separate; errors preserve released-not-sent, merchant-refused, release-unknown or settlement-unknown state. Unknown budgets remain reserved until reconciliation. No automatic replacement payment is permitted.

## Memory and learning

Walrus Memory Mainnet stores decisions, rules, rule disables, bill outcomes, reserve changes and session summaries. Session start rebuilds preferences from recall; database rows are a cache. A stored rule carries job/blob provenance. Recall top-k is not an inventory count.

The historical five-session review counts were 2, 1, 1, 2, 2. A recalled preference removed a specific repeated approval; later reserve changes caused holds. This establishes decision persistence and hard-rule precedence, not monotonic improvement.

## Networks, execution and acceptance

Public runtime is Mainnet-only: actual Mainnet vault reads through Tatum, the completed Codex payment run, four stored Walrus memories, recalled preference and reserve refusal. It is signer-free/read-only, with revoked permission and consumed allocation. New spending requires a new plan. Earlier networks exist only in historical repository archives; original receipts are never relabeled. Owner MCP has protocol coverage; an owner-assistant model run and Antigravity remain unverified.

Mainnet proof: [verified evidence](evidence/mainnet-20261108/README.md), [manifest](mainnet/MANIFEST.json), [runbook](mainnet/RUNBOOK.md). Executed after exact approval and verified funding in isolated local state/namespace. Actual outcomes satisfy useful purchase, stored owner preference, fresh-session changed decision, reserve refusal, final revoked policy, exact receipt checks and final balances. Preserve historical Testnet evidence. The JSON manifest remains the original immutable specification; later authorization and execution status are separate records.

The bounded proof permitted only reviewed purchases, session transitions and revoke. The owner later authorized replacing the public legacy runtime with Mainnet. Publication uses a dedicated Postgres schema on the existing instance, copied completed state/budgets, an explicit read-only public-origin binding and no signers. The original local financial manifest is unchanged. There is no new spending authorization.
