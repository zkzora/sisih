# Verified local Sui Mainnet proof — 8 November 2026

The authorized plan `sisih-mainnet-proof-20261107-v1` completed against real Sui Mainnet at **13:03–13:10 UTC (20:03–20:10 WIB)**. Two native-USDC x402 purchases delivered useful live ChainScope reports to a real Codex CLI agent. A stored owner preference changed the next application's fresh-conversation decision; reserves still blocked a third purchase. The owner revoked permission. No public Mainnet web server, Git push, blog/social post or submission occurred.

The selected primitive is the existing Sisih custom vault; [reuse decision](../../mainnet/VAULT_DECISION.md). This is exercised code, not a third-party audit claim. ChainScope is project-operated: the 1.60 USDC merchant proceeds are project funds, not external revenue.

## Environment and authority

- Origin/MCP: local `http://127.0.0.1:8788/api/mcp`; isolated PGlite and namespace `sisih-mainnet-proof-20261107`.
- Mainnet chain ID: `4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S`. All Sui operations used Tatum native gRPC; no public-RPC fallback.
- Package: `0xc894db8fba8696dd1a8b246744582a78279410b4523126b82ed68ce8ca40f55d`.
- Vault: `0x24649e0f48c627733cc526faf39b642efd103b75d3651128bc7e56aaa93e32fc`.
- OperatorCap: `0xa26d752f4841e3a320efa7d7b13f611cf93419f6d49f91565a65c5bc4b96b593`, owned by the manifest operator and bound to this vault.
- UpgradeCap: `0x03e8c7678a7be19776ce28f8108ceaf8f5e57d17a079d9ade782b8db5f07f507`, retained by the owner. Owner/cap/type/native asset independently checked.
- Asset: `0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC`, six decimals.
- Owner used Sisih CLI with the local key for exact offchain approval/session intents and onchain revoke. The Mainnet server env excluded the owner private key. No model owner-assistant task is claimed.
- Codex CLI `0.164.0-alpha.11.1` ran in an isolated folder with user configuration ignored, shell tools disabled, read-only sandbox and only the spending MCP credential. Fresh processes/conversations were used for each recorded prompt. No owner/provider/private-key credentials were forwarded. The runner is [run-agent.ts](../../../server/scripts/mainnet/run-agent.ts).
- Claude Code `2.1.201` was attempted first, but returned its weekly quota error before any tool call or purchase. Its failure transcript is preserved as `agent-1.jsonl`.
- Financial approval: [authorization record](../../mainnet/EXECUTION_AUTHORIZATION.md), [original manifest](../../mainnet/MANIFEST.json). The manifest retains its original proposed status; approval and execution are separate subsequent records.

## Observed sequence

1. Funding read-back at checkpoint `343006171`: owner 3.015780 USDC + 0.170000 SUI, operator 0.060000 SUI. Extra funding did not expand authorization. Publish, create and setup deposited exactly 3.00 USDC, reserving 0.80 and leaving 2.20 free.
2. `codex-1.jsonl`: discover/budget/request; unfamiliar merchant `req-d89525e6-87f` returned `awaiting_owner_approval`, no funds moved. Owner intent `oi-3468a2d44e17` approved that same request and remembered up to 0.80 USDC for seven days. `owner-approve.json` records local signing completion.
3. First release and x402 settlement completed once. `codex-1-result.jsonl` consumed the useful live report: checkpoint `343007237`, 2.20 total, 0.80 reserved, 1.40 free, spending caps and expiry. It distinguished the report snapshot from a newer read.
4. The rule reached `stored`, blob `dAU_UeyCw3_fRAuIEQCFQJuXKE6wnlnIJkkkkmYoJds`. Local owner intent `oi-eb5276493508` started session 2; `sessions.json` records one rule rebuilt from Walrus in 2,616 ms. `rules.json` records `origin: walrus`, source blob and active state.
5. `codex-2.jsonl`: a fresh conversation with no earlier transcript requested `req-7dd90263-75e`. `allow_rule` settled a second 0.80 report without another approval. Its live report read checkpoint `343007621`: 1.40 total, 0.80 reserved, 0.60 free, 1.60 spent in the 24-hour window.
6. `codex-3.jsonl`: `req-f37bacb5-c6a` returned `would_cut_reserve`; price 0.80 exceeded 0.60 free by 0.20. No release/settlement or split/alternative purchase occurred. `before-revoke/rules.json` establishes that the remembered preference remained active. `reserve-simulation.json` independently exercised the real operator capability against the deployed contract, returning `EExceedsFree`; `signed: false`, `broadcast: false`.
7. Owner intent `oi-a2fd5efe3f2b` locally signed the final revoke. `final-vault.json` independently read total 1.40, reserved 0.80, free 0.60, policy absent at checkpoint `343008051`.

The MCP originally exposed the decision reason without the matched recalled rule's source link. After payment, the read-only response was improved to include `walrus_recalled_rule`, rule ID and blob. `codex-provenance.jsonl` verifies those links without requesting another purchase. This follow-up also corrected an error in the third agent's natural-language summary: 0.50 USDC is the default threshold, not the remembered ChainScope rule (0.80 USDC). The original transcripts are retained. Neither correction changes the recorded payment/policy outcome.

## Actual receipts and gas

All amounts below are integer MIST. Net = computation + storage − rebate. Gross execution funding and per-transaction gas budgets differ from net charges. Storage rebates can make one transaction's net negative. The approved gas ceiling was 205,000,000 MIST; no cap was increased.

| Operation / receipt | Computation | Storage | Rebate | Net |
| --- | ---: | ---: | ---: | ---: |
| [Publish](https://suiscan.xyz/mainnet/tx/3VML59yGq63WndkVmTpyp1gqS5mRDty1RrnGSqGfHR8T) | 100000 | 75582000 | 0 | 75682000 |
| [Create vault](https://suiscan.xyz/mainnet/tx/5ARUwMy8tKxN6imQ8MmsYkqSvnMGpg7xsr52ALMpZAgS) | 100000 | 3845600 | 0 | 3945600 |
| [Setup](https://suiscan.xyz/mainnet/tx/5WoyMkuMtWTMSB71PWfnJxNv8PQuHRfuLt64CtTq6gb5) | 100000 | 3587200 | 2287371 | 1399829 |
| [Release 1](https://suiscan.xyz/mainnet/tx/6C3oTgnJYb2TH1jJiRxLR1DE87GVvY1mmfcsX2goJcms) | 100000 | 6467600 | 5144685 | 1422915 |
| [x402 settle 1](https://suiscan.xyz/mainnet/tx/8JyrP75EGse2BSTE4ty7afEPskptMYt6h3bv8hAjAyXB) | 1322268 | 0 | 1322268 | 0 |
| [Release 2](https://suiscan.xyz/mainnet/tx/Gm1Rtgd2ty6sJ1gWxx1LSfVqNYnKnSwTkxDchfjECVE3) | 100000 | 6467600 | 5144685 | 1422915 |
| [x402 settle 2](https://suiscan.xyz/mainnet/tx/8ywcKQZpHDpFsZnBq4yCusuLiibDfWws6nF8FWQTBhS9) | 1322268 | 0 | 1322268 | 0 |
| [Revoke](https://suiscan.xyz/mainnet/tx/3ijG4jsAk9QcV4jvffUAF3RTmwn7np39pc697PJf5LH1) | 100000 | 3032400 | 3586841 | -454441 |

**Aggregate net: 83,418,818 MIST = 0.083418818 SUI.** Owner net: 80,572,988 MIST. Operator net: 2,845,830 MIST. Agent/facilitator: zero net SUI; each native-USDC x402 transaction had gas budget zero and exact merchant credit +800,000 / agent debit −800,000 base units. No additional fee transfer, refusal broadcast, bill payment or withdrawal occurred.

Final money: vault 1.40 USDC, merchant 1.60 USDC, owner wallet 0.015780 USDC + 0.089427012 SUI, operator wallet 0.057154170 SUI, agent/facilitator zero. The owner still controls the vault, including emergency withdrawal; retrieving funds or merchant proceeds requires a separate authorized transaction. Gas already charged cannot be retrieved. `runtime-ledger.json` verifies exactly 1,600,000 base units consumed and no unknown/reserved operations. Runtime gas accounting floors a net rebate at zero; this independent receipt table retains its actual negative net.

## Evidence checks and limits

- `evidence.json` contains exact expectations bound to the reviewed manifest, recipient, request IDs, asset, package/vault and gas ceilings. `verified.json` independently read all eight transactions through Tatum: every check passed.
- `negative-control-spec.json` substitutes the actual successful publication digest for a release expectation. `negative-control.json` records the expected verifier exit 1 for wrong sender/gas owner/budget/call/transfer/event. A successful unrelated receipt cannot stand in for payment proof.
- `verify-memories.txt`: **4 of 4** jobs done with matching blobs; full unfiltered account inventory also found all four. Types: rule, two decisions and session summary. This new namespace does not itself meet a ten-memory claim. Historical `sisih-hosted-9` retains its independent 13-memory evidence.
- `transactions.json`, `balances.json`, `state.json`, `requests.json`, `rules.json`, `sessions.json`, `memories.json`, `context.json` and `before-revoke/` preserve public raw observations. `source-identities.json` identifies the dirty working revision and hashes consequential source; no owner signatures, serialized signing payloads or secrets are copied from the local journal.
- Initial publication succeeded, but the immediate create-vault build hit Tatum read lag (`Object not found`) before signing. The journaled rerun reused the verified publication and created once. Setup succeeded, but its immediate state read was stale; a separate read verified 3.00/0.80/2.20 without another deposit. No failed chain transaction or duplicate spend resulted.
- Source base is `1109d5b` plus uncommitted changes; Move source SHA-256 is the exact manifest hash. Local Proof/README now include Mainnet evidence. Existing Vercel remains the previous Testnet deployment. Public deployment, Git push/visibility, video/blog/social publishing and submission remain separate, unexecuted actions.
- Stored recall changed this specific decision; it does not prove market demand, monotonic review improvement or superiority to every competent static policy. A model can still summarize evidence incorrectly; receipts and source-linked records are the verification boundary.

The isolated Mainnet server was stopped after verification and the shared agent lease released. Permission remains revoked. Further purchases require a new reviewed plan; do not recycle this proof's authorization.
