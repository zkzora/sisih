# Sisih mainnet readiness

Prepared 2026-11-07. This is a proposed bounded mainnet proof, not a record of deployment or permission to spend an unspecified amount. No keys, environment variables, hosted deployment or chain state were changed for this review.

## Proposed outcome

Keep the proven Sui Testnet deployment and its evidence available. Prepare a separate Sui Mainnet environment for one real external-agent purchase, remembered owner approval, cross-session recall and a reserve-boundary refusal. Walrus Memory remains on Mainnet with a separate proof namespace.

Mainnet adds evidence of execution with real assets. It does not establish demand, production security, independent merchant adoption or a judging advantage. The published event requirements explicitly require Walrus Memory Mainnet; they do not explicitly require Sui Mainnet transactions. Agent Payments bonus wording says x402 or MPP settled on Sui without specifying the network.

Sources reviewed: https://recall-tatum-walrus.vercel.app/ and https://thewalrussessions.wal.app/tatum-total-recall .

## Source-observed blockers

1. Owner CLI mutations such as reserve and limits call `/api/demo/owner-action` (`server/src/cli/run.ts`). That path uses `demoOwnerAction` with `assertTestnet` (`server/src/demo/owner.ts`). Changing `SUI_NETWORK` alone therefore breaks essential owner operations. Preserve this guard.
2. Mainnet requires an owner signing path appropriate to the terminal-first product. Implement local owner signing or an explicitly reviewed owner-controlled signer, independent of the delegated spending agent. Do not upload the owner's private key as a shortcut or treat a shared demo token as sufficient owner authorization.
3. `server/scripts/publish.ts` submits transactions and writes deployed IDs to the root `.env`. It is not a harmless readiness check. Prepare environment-specific output and explicit transaction manifests before using it for Mainnet; preserve the working Testnet configuration.
4. `.env.mainnet` already exists and was retained from a cancelled migration. The generator refuses to overwrite it. Do not regenerate, overwrite, print or upload its secrets. Its presence does not prove balances or deployment readiness.
5. Demo reset and recycling paths are Testnet plumbing. Do not remove their network guards. A Mainnet proof must not depend on public reset, simulated-income funding or collecting merchant proceeds through a judge-accessible route.
6. ChainScope registry labels, CLI explorer links and connection copy contain Testnet-specific text. Mainnet results must identify the actual environment and asset; historical Testnet evidence remains labeled Testnet.
7. The current MCP has only delegated-agent tools. The proposed single MCP with agent and owner roles is not implemented. If owner tools are added, enforce authority server-side for every invocation, including direct calls to undisclosed tools. Do not give the spending agent owner credentials.

## Preparation before funding or broadcasting

- Preserve existing uncommitted work; inspect concurrent frontend changes before editing.
- Select an isolated Mainnet deployment origin, database and memory namespace. Prevent fallback to Testnet IDs or shared proof state. Keep private keys out of the public frontend and public evidence.
- Verify the native USDC coin type from current official issuer/network documentation and read its metadata through Tatum. Verify the network independently before signing.
- Define a transaction manifest: sender role, operation, network, recipient, coin type, amount, gas budget and expected resulting objects. Include package publication and vault creation.
- Read balances only through Tatum, then simulate/estimate transactions as supported. Compute a concrete gas and USDC funding requirement; do not reuse the cancelled funding estimate as a current quote.
- Agree on a maximum total USDC allocation, gas budget in SUI, allowed recipients and delegated purchase limits before live spending. Gas budgets are caps, not estimates of actual charges.
- Complete owner signing, configuration isolation, payment recovery and authorization checks before the first funded purchase.

## Meaningful verification

- An agent credential cannot approve itself, change reserves or limits, grant owner authority, reset the environment or obtain signer secrets, even by direct API/MCP calls.
- An owner-authorized change is signed by the intended owner and read back from the intended Mainnet vault.
- The useful purchase settles once, with exact asset/recipient/amount attribution and usable merchant output. A lost response, restart or repeated idempotency key cannot create another payment.
- A failed merchant call distinguishes vault release from merchant settlement. Do not claim no money moved when a release already happened. Define reconciliation for released but unsettled funds and uncertain broadcast outcomes.
- A fresh agent session retrieves the stored preference and changes the next decision. Record Walrus job/blob evidence; do not infer stored status from a successful job submission.
- The reserve-boundary case refuses spending despite the recalled preference. Prefer simulation or a controlled preflight for expected failure; any broadcast negative test must be included in the gas budget.
- Preserve Testnet operation, evidence links and network guards as regression checks. Clearly label the Mainnet merchant as project-operated if it remains our own service.

## Cut line and evidence

If owner signing, uncertainty recovery or configuration isolation is incomplete, keep the hackathon demo on Testnet. A partly working Mainnet migration is not a stronger submission.

After a bounded Mainnet run, save the exact revision, network and object IDs, request IDs, release and settlement receipts, gas actually charged, merchant output, memory evidence and limitations. Treat old Testnet and new Mainnet runs as separate evidence. Record any returned funds explicitly rather than counting them as independent external revenue.

Implementation preparation and review can proceed without funding. Live deployment, spending and any change to the current public deployment require concrete amounts and targets; none were executed in this review.
