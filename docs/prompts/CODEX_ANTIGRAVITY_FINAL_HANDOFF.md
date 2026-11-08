# Final Codex / Antigravity handoff: Sisih Mainnet, vault reuse, public experience and submission docs

Work in `C:\Sisih` on Windows. Implement and verify the complete milestone below. The user wants to finish Sisih on Sui Mainnet and correct the README and public experience to match the agreed product. Do the work, not another plan-only response.

## Active instructions and scope

This is the latest orchestration prompt. It incorporates the detailed execution requirements in:

`C:\Sisih\docs\prompts\CODEX_ANTIGRAVITY_MAINNET_HANDOFF.md`

Read that file in full and apply it. This prompt adds the required **reuse-versus-custom vault decision**, the **complete README rewrite**, and the final consistency/judging pass. Where a previous prompt required retaining a dashboard, owner-CLI-only access, Claude-only setup, or stopping permanently at Mainnet preparation, the decisions here supersede it. Preserve real financial authorization boundaries and accurate evidence labels.

At preparation the latest commit was `1109d5b` (`Use agent-neutral language across public pages`), following `7d599c7` (public site, role-scoped MCP and Mainnet preparation). One untracked Mainnet handoff prompt existed. Inspect actual HEAD, status, diff and applicable AGENTS.md files before editing; do not assume this snapshot is still current or discard other work.

Read current CLAUDE.md, README.md, SPEC.md, HANDOFF.md, PROGRESS.md, RECORDING.md, MAINNET_READINESS.md, the Mainnet manifest/preflight and actual implementation. Read relevant installed Next.js guides before editing the website. Treat handoff claims as leads to verify, not proof that all code paths work.

The intended final outcome:

- A useful external agent buys a service through Sisih on **Sui Mainnet**, within the owner's delegated authority.
- Actual commitment reserves remain protected by the consequential onchain boundary.
- An owner decision stored in **Walrus Memory Mainnet** changes the next decision in a fresh session, without overriding hard limits.
- **One canonical MCP endpoint** supports separately authorized spending-agent and owner-assistant workflows. The CLI remains a companion and local signer.
- The public website is **Home / Connect / Proof**, with no operational dashboard.
- README and submission materials explain this product and match what actually works and what is deployed.

Do not broaden into a wallet platform, general DeFi router, new chatbot, trading system or a new dashboard. Preserve the working Testnet demo/evidence while building the Mainnet result.

## A. Resolve vault reuse before the first Mainnet publication

The user asked whether an available vault can replace custom code. Investigate this seriously; do not defend Sisih's current Move module merely because it already exists. Also do not rewrite a working system just to claim reuse.

Review current primary sources and actual APIs/source for these bounded candidates:

1. Native Sui Allowances, especially app-bound allowances:
   https://www.docs.sui.io/onchain-finance/allowances
2. OpenZeppelin Sui Spend Vault:
   https://docs.openzeppelin.com/contracts-sui/1.x/spend-vault
3. The existing Sisih vault implementation and its independently exercised behavior.

Payment Kit is a separate optional payment/receipt primitive, not automatically a reserve vault:
https://www.docs.sui.io/onchain-finance/choose-payments-model

Reference requested by the user remains https://github.com/PugarHuda/invoice-chaser and its live site https://invoice-chaser-sigma.vercel.app/ . Reuse the principle of verified actual settlement and visible memory evidence, not its entire feature list. Its shared payment registry is not proof that our commitment logic exists in that registry.

For each serious candidate, check:

- Is the required primitive actually live on Sui Mainnet and usable with the installed SDK/Tatum transport? Verify package/version/address and relevant entry points; do not infer deployed readiness from documentation alone.
- Are we reusing deployed bytecode, importing library source that still needs publication, or creating a fresh owner-specific object? State the distinction and resulting cost.
- Who can withdraw or spend, who controls owner/spender capabilities and upgrades, and what existing audit/version evidence actually covers the used component? Do not call it audited just because it is OpenZeppelin-branded; guide snippets explicitly have their own limitations.
- Can commitment funds remain unavailable to the delegated agent across reserve changes, top-ups, concurrent requests and multiple spend capabilities? A stale offchain allowance equal to yesterday's free balance is not dynamic reserve enforcement.
- Can the same permission bypass the reserve module through a direct primitive call? If additional Move policy is required, establish that all delegated spend paths must pass through it.
- How do per-request caps, daily-window accounting, expiry, pause/revoke, bill payees and owner changes map to the existing Sisih semantics?
- Does reuse reduce the actual remaining integration work and risk? Include migration/adapters, signing and proof cost rather than comparing deployment gas alone.

Record a concise comparison and source-linked decision in `docs/mainnet/VAULT_DECISION.md`. Prototype the highest-risk boundary with a small isolated check before selecting an alternative. Do not spend the whole milestone researching unrelated vaults.

**Selection rule:** prefer an available verified primitive when it provides the required enforcement with less custom work. Keep only Sisih-specific commitments/policy logic on top if needed. If neither candidate meets the reserve invariant or a rewrite would create more unresolved integration risk, retain the tested Sisih contract and document why. This is a technical checkpoint, not another request for the user to choose routine implementation details.

Whichever option is selected, preserve or deliberately migrate API/MCP/CLI semantics. Do not silently remove protected commitments, weaken caps, change ownership assumptions, or describe a server-only reserve check as onchain enforcement. A candidate being convenient to deploy does not justify changing the product's central claim.

Complete this decision before estimating a final publication/funding plan; reusing a deployed package changes that plan. Do not publish both alternatives merely to compare gas costs.

## B. Finish and execute the Mainnet path

Follow the incorporated Mainnet handoff for env isolation, local owner signing, role enforcement, exact transaction/manifest validation, recovery and verified evidence. Adapt its references to the selected vault primitive and document any changed semantics explicitly.

The old manifest proposes **3.20 USDC** and **0.5954 SUI** across roles. These are unapproved preparation values and hybrid estimates, not measured current fees or a mandatory amount. Recalculate from the selected implementation and actual network preflight/simulations. Use integer base units and distinguish funding liquidity, per-transaction gas budgets, aggregate authorized spend, actual gas charged and rebates.

Build the complete local implementation, isolated checks, preflight, server env inventory and executable `docs/mainnet/RUNBOOK.md` before asking about a live step. A real external agent can test local MCP; do not block all work on a public origin or hosted database if those are unnecessary for local verification.

For a public Mainnet instance, prepare a separate target while retaining the working Testnet environment. Establish isolated database/namespace, required secret names and deployment configuration. The owner's private key stays local; never upload the full `.env.mainnet`. No dashboard is needed for signing or credential bootstrap.

Present **one concrete live-execution checkpoint** only after implementation and review: chosen primitive, exact target/origin, public funding addresses, merchant recipient, maximum USDC allocation, aggregate/per-role SUI limits and exact operations. The user's goal is Mainnet; do not ask again whether they want Mainnet or a dashboard. Ask only for genuinely missing credentials, funding or approval of the specific financial/deployment plan. Prior approval of that exact plan persists; do not ask repeatedly.

After that plan is explicitly approved and funded, continue through publication/object initialization as needed, deposit/policy, actual external-agent purchase, owner approval/remembering, fresh-session recall, protected-reserve refusal and independent read-back. Execute only approved amounts/targets. Reconcile an unknown outcome before any replacement spend. Preserve a deliberate final permission state and describe remaining funds.

Do not claim completion at `prepared` if Mainnet has not executed. If funding or credentials are missing, finish independent work and report the precise final blocker and ready-to-run command. Never fabricate receipts or silently weaken controls to obtain a successful demo.

Publishing the repository, pushing commits, replacing the current public Testnet site, posting social content/blogs and submitting the hackathon are separate external actions. Prepare their concrete artifacts; execute only when specifically authorized. Include any proposed separate Mainnet deployment target in the live checkpoint.

## C. Website: finish the agreed public experience

Verify existing work before editing. Preserve the approved forest/lime/ivory identity, logo, DM Sans / Geist Mono and good completed design. All product copy is English.

- **Home:** specific user, promised-money failure, reserve-first mechanism, real differentiation, Connect and Proof calls to action. No dashboard/sidebar/workspace navigation, browser approval/configuration panels or scripted task launcher.
- **Connect:** client-neutral MCP connection contract; separate spending-agent and owner credentials to the same domain endpoint; exact currently supported recipes and local owner signing. Claude Code is a verified example only to the extent actually tested. Verify Codex/Antigravity or another client before labeling it tested. A protocol SDK smoke test is not a real model-agent task.
- **Proof:** a concise auditable task trace, receipts, useful output, memory provenance, changed next decision and a reserve refusal. It is read-only and not a renamed dashboard. Separate recorded evidence from fresh verification/current state.

Keep legacy URLs intentional, API/MCP/merchant/skill routes functional, private credential bootstrap usable without the dashboard, and owner continuation links accurate. No leaked tokens in URLs, copied public snippets or screenshots.

Until the new Mainnet run and deployment are real, keep Testnet labels accurate. After verification, show the exact Mainnet instance and proof, and retain old Testnet evidence as historical. Do not change `/testnet/` to `/mainnet/` on old receipt links. A local Mainnet run does not prove the hosted Testnet origin has migrated.

Verify actual local pages at 375, 768, 1280 and 1440 px, keyboard/focus/copy behavior, loading/errors and retained theme modes. Save genuine screenshots. API downtime should not prevent reading Home, setup instructions or recorded proof.

## D. Rewrite the root README for this product and its actual final state

Rewrite it as a coherent introduction and usable setup guide, not a chronological changelog, collection of previous handoffs, inflated tool catalog or feature dump. Preserve useful detail through linked technical docs. Make these points easy to find:

1. **Opening:** Sisih name, concise tagline, a two-sentence concrete problem/mechanism, then verified demo, Proof, Connect, video and repo links as available. Do not add fake video/blog URLs or badges.
2. **Who it serves and why:** an owner financing agent API/data purchases from money also promised to bills/savings. Compare a separate prepaid agent wallet/static cap honestly. Explain when Sisih helps and what remains an assumption about demand.
3. **One actual example:** initial funds/commitments/free, unfamiliar merchant hold, owner approval remembered, next-session purchase changes, reserve still wins. Use one coherent real run and its network. Clearly label illustrative values if the Mainnet scenario is not yet executed.
4. **How to try it:** a short read-only judge path first, then exact external-agent connection/harmless check/purchase/owner continuation/result commands. Explain required credentials, shared capacity/busy behavior and which actions move real funds. Do not force judges to clone the repo simply to understand the proof.
5. **Interfaces:** one MCP with server-enforced agent and owner roles; CLI companion/local signer; public Home/Connect/Proof. Explain who signs and who may approve/change policy. No required operational dashboard, Claude-only agent or implication that the spending agent can approve itself.
6. **Mechanism and integrations:** small accurate Mermaid diagram matching actual request order; hard onchain reserve/caps/expiry/permission rules versus owner-controlled Walrus preferences. Identify the selected reused primitive/custom module and its actual responsibilities. Explain Tatum's read/build/simulation/submission/verification paths and x402 settlement/delivery. Link exact current source files rather than inventing line numbers.
7. **Network table:** vault/asset/x402/Tatum for each available environment; Walrus Memory Mainnet; deployed vs local/prepared state. Clearly identify the primary demonstrated run and separate historical Testnet evidence.
8. **Inspectable evidence:** exact request IDs, package/vault, release and settlement digests, amount/recipient/asset verification, Walrus jobs/blobs, fresh-session behavior and what was refused. State fixture/mock, simulation, scripted MCP and actual model-agent results distinctly. Unknown/unavailable is not verified.
9. **Trust and limitations:** owner local key; deployment-held operator/agent/facilitator keys as applicable; self-operated merchants; no broad audited/production-ready/noncustodial claim without evidence; release-versus-settlement gap and recovery; shared demo isolation/capacity and dependencies.
10. **Learning evidence:** the old five-session manual-review counts were **2, 1, 1, 2, 2**, not a monotonic improvement. Reserve changes caused later holds despite an active remembered preference. Remove unqualified claims such as `the next session needs fewer manual reviews` unless tied to a demonstrated request/run. Persistence alone is not proven improvement over a competent static-policy baseline; state what the experiment establishes and what it does not.
11. **Developer setup:** current installed prerequisites, package manager, `.env.example`, local isolated setup, tests/typecheck/build/Move commands and links to Mainnet runbook. Verify help/setup commands do not silently spend or depend on developer-local secrets. Keep private keys out of shell history examples; use placeholders/local config.
12. **Submission context:** Consumer Finance Apps entry, meaningful Tatum/Walrus use, claimed bonuses within the official wording and honest verification limits. No claim that Mainnet is mandatory or guarantees a prize.

Scale the README for scanning: strong opening, short useful sections, one architecture diagram, a compact network/evidence table and links to deeper docs. Do not duplicate every CLI command/tool schema or bury the first useful action under setup theory. Use normal Markdown links and shell-correct PowerShell/Bash commands. Render/check Mermaid and verify links support the actual claims; an explorer HTTP 200 alone is insufficient transaction verification.

## E. Align all current docs and judging artifacts

Update current CLAUDE.md, SPEC.md, HANDOFF.md, PROGRESS.md, web README, served skill, Connect instructions, BLOG.md, SUBMISSION.md, RECORDING.md and SOCIAL.md wherever the implemented behavior changes. Historical evidence directories stay intact and explicitly historical. Rewrite stale instructions rather than stacking contradictory caveats.

- Blog explains what it does, meaningful Tatum/Walrus use and the observed learning loop, including limitations. It must match the final README and proof.
- Submission distinguishes mandatory requirements from bonuses; use actual URLs and verified environment. Judge credentials belong only in a private channel/form, never the public repo.
- Recording gives a feasible coherent 2–3 minute story: problem -> actual agent task -> owner decision -> fresh-session memory -> hard reserve refusal -> receipts. Label any cut to scripted/simulated/historical material. Do not make edited video timestamps imply real transaction latency.
- Do not reuse the old five-session reset/demo-cycle script on Mainnet or send real bill payments just to recreate Testnet visuals. Use the new bounded scenario.
- If the new Mainnet run has fewer than 10 memories, state its real count and preserve the valid existing Walrus inventory evidence. Check official rules/required identity fields before claiming compliance; do not manufacture meaningless writes to inflate a count.
- Social drafts stay drafts and report only established facts. No publishing or messaging others in this task without explicit authorization.

## F. Verification, evidence and completion

Use the detailed Mainnet handoff's financial checks: direct unauthorized calls, wrong owner/network/asset/recipient/parameters, replay/expiry, concurrent release, duplicate setup/purchase, restart/lost-response/unknown settlement and evidence-verifier negative controls. Add a legitimate success control so a system refusing everything cannot pass.

For a selected reused primitive, include at least one test/simulation exercising its actual relevant boundary, not only a mock shaped like our desired API. Verify that the spending capability cannot bypass reserve checks through another entry point. Do not install/run untrusted reference repo scripts.

Run appropriate existing tests, typecheck and builds; run Move tests where applicable. Inspect browser results. Check new tracked content/history as appropriate for secrets without printing secret values. Verify fresh-clone developer instructions in an isolated temporary copy without copying real env secrets or replacing the user's working tree.

Save source-linked vault decision, final manifest/runbook, real screenshots and a new Mainnet evidence directory only when a real run exists. Record revision, network/origin, object IDs, signer/interface used, actual amounts/gas/balances, live output, receipts, memory job/blob statuses and important failures/limitations. Keep local code, deployed artifact and evidence revision distinguishable.

Final report should be concise and concrete:

- Chosen vault approach and the evidence-based reason.
- What now works for agent, owner and judge; actual verified client(s).
- Local versus deployed status, Mainnet versus Testnet, and the exact verified live run if executed.
- Tests/browser/fresh-clone checks actually run and material limitations.
- README, runbook, manifest and evidence paths; exact final external action if genuinely blocked.
- Actual money moved and gas charged if execution was authorized, including remaining funds and final permission state.

Do not report the milestone complete merely because the docs say Mainnet-ready. Work until the authorized outcome is finished or the only remaining work genuinely requires funding, credentials or approval of the concrete live plan. Finish independent implementation and docs first; do not repeatedly ask the user to restate the accepted product direction.
