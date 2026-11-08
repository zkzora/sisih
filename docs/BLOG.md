# Giving an agent the part of a wallet that is actually free

Draft, unpublished. Verified demonstration: Sui Mainnet x402 payments and Walrus Memory Mainnet, 8 November 2026. Public Home/Connect/Proof and MCP are Mainnet-only; the completed run is published read-only without signing keys.

A builder gives an agent 20 USDC for data and APIs. The same balance also covers hosting, inference and savings. A daily spending cap can approve a useful report while leaving the next bill short: it knows the amount spent, but not what the balance has already promised.

Sisih makes those promises explicit. A Move vault on Sui separates each commitment's reserve from its free pool. The operator may release only free funds to the configured agent, within per-request and daily limits, expiry and pause/revoke controls. Preferences recalled from Walrus decide which permitted purchases need review. The contract still decides whether funds can leave.

The simpler alternative is a separately prepaid agent wallet. That works when a fixed allocation models the owner's risk. Sisih is aimed at an owner whose commitments change and who wants the same live asset pool to respect those changes. We have demonstrated that mechanism; we have not yet established demand across a customer population.

## The Mainnet task

A real Codex CLI agent connected to the isolated local MCP with only the spending credential. The owner deposited 3.00 native USDC and reserved 0.80 for savings. The first 0.80-USDC ChainScope purchase waited for approval. The owner signed that exact decision locally and remembered a seven-day preference capped at 0.80. x402 settlement completed and the agent used the purchased live vault report.

A new application session rebuilt one rule from Walrus. A fresh Codex conversation bought the second report with `allow_rule`, without another owner approval. Only 0.60 free then remained, so the third 0.80 request was blocked despite the active rule. An unsigned simulation against the real operator capability independently returned `EExceedsFree`. The owner revoked permission; 1.40 USDC remained, including the protected 0.80 reserve.

All eight receipts passed exact Tatum read-back, and an unrelated successful Mainnet digest failed the verifier. Four Walrus jobs/blobs matched the relayer and full inventory. Net gas was 0.083418818 SUI; merchant proceeds were 1.60 USDC. [Receipts, transcripts and limitations](evidence/mainnet-20261108/README.md). Claude Code had hit its weekly quota before tool use, so Codex completed the task. A read-only follow-up checked improved source links and corrected the agent's initial confusion between the default threshold and the merchant rule. No extra purchase was made for that check.

## Earlier Testnet task

In the recorded `sisih-hosted-9` run on 7 November 2026, a real Claude Code process had only Sisih's five spending tools. It could inspect the budget, discover services, request a purchase, read its own result and release the shared session. It had no owner credential or shell access.

It requested a 0.80-USDC ChainScope report to assess the owner's vault. ChainScope is a project-operated merchant that reads live Sui state through Tatum. As an unfamiliar purchase, request `req-637fe5e4-e5a` waited for the owner. The owner approved that exact request from `pnpm sisih` and remembered an allow preference. The vault release and x402 settlement were verified through Tatum; the agent resumed the same request and answered from live checkpoint data.

After the application started its next session, a fresh model conversation made a new request. Walrus recall rebuilt the owner preference, so `req-e2e8e0e4-b03` settled without a second manual approval. Later the owner increased a savings reserve until only 0.60 remained free. The same 0.80 report was blocked with the preference still active. A direct operator release failed onchain with `EExceedsFree`.

The historical repository evidence directory preserves those original transcripts, receipts and 13 checked memory jobs/blobs. Payment links keep their original network. The public [Proof](https://sisih-azure.vercel.app/proof) now focuses on the newer Mainnet run; historical records are archived rather than relabeled.

## What Tatum does

All Sui operations use one throttled Tatum native-gRPC client: identity and balances, vault/object reads, transaction resolution and simulation, submission and subsequent read-back. A transaction digest returned by a merchant is only a lead until its chain status and expected effects are verified. Current Mainnet tooling additionally matches sender, gas owner/budget, package/function/type, asset/recipient/amount, vault events and created types. An unrelated successful transaction fails the check.

Release and merchant settlement are separate transactions. If the vault releases funds but a merchant cannot deliver its live report, the money may still be at the agent. If a response is lost after sending, the outcome may be unknown. Sisih persists those states, keeps unknown budget reservations and refuses a replacement release until read-back. The merchant stores a verified result so a lost delivery can be recovered without charging again.

## What Walrus remembers

Walrus Memory Mainnet stores owner decisions, explicit preferences, rule disables, bill outcomes, reserve changes and session summaries. A write is asynchronous: accepted, writing and stored are distinct. The interface reports a blob only after the job confirms it. New application sessions rebuild preferences from recall; Postgres is their working cache.

The historical five-session experiment produced manual-review counts of **2, 1, 1, 2, 2**. The remembered SearchBox preference removed one repeated approval, but later reserve increases caused more holds. This demonstrates a changed future decision and preserved financial constraints. It does not demonstrate steadily fewer reviews or superiority over every static-policy baseline. The historical namespace contained 35 independently checked memories; the Testnet terminal run contained 13. The new Mainnet namespace contains four verified memories and does not claim ten.

## Interfaces and next proof

The public product is Home, Connect and Proof. One MCP URL uses separate credentials for the spending agent and owner assistant. The CLI is a companion and local owner signer. Historical Testnet owner actions used an explicitly labeled server demo key; Mainnet owner actions require the owner's local signature.

We reviewed native Sui Allowances and OpenZeppelin Spend Vault before selecting the existing exercised Sisih vault for the bounded Mainnet proof. App-bound allowances remain a promising future building block, but dynamic commitment segregation still needs application policy. The selected code has test evidence, not a third-party audit claim.

Mainnet publication, two real 0.80-USDC purchases, stored preference recall and final revocation were executed under the approved fixed manifest. The merchants remain ours, so payments are project funds returning to project addresses, not customer revenue. Further validation needs real owners, independent merchants and a measured comparison against a competent static policy. Public deployment, this blog and any submission still require separate authorization.
