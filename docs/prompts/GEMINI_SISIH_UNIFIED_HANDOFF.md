# Gemini implementation handoff: Sisih website, unified MCP and Mainnet preparation

Work in `C:\Sisih`. Implement the work below to a complete, verified local result. Do not stop after producing a plan. Preserve correct existing changes, the working Testnet deployment and all historical evidence.

This is the active consolidated handoff. It supersedes `docs/prompts/GEMINI_DASHBOARD_HANDOFF.md` and `docs/prompts/GEMINI_TERMINAL_ONLY_HANDOFF.md` where they conflict. `docs/MAINNET_READINESS.md` supplies the source-observed Mainnet blockers.

## 1. Product and final decisions

Sisih serves an owner whose agent spends from a wallet that also covers bills and savings. A total wallet balance or generic spending cap does not identify money already promised. Sisih reserves commitments in a Move vault, delegates spending only from the free remainder within hard limits, and recalls owner-approved preferences through Walrus Memory. Memory never overrides reserve protection, caps, expiry, pause or revocation.

The strongest practical alternative is a separately funded agent wallet with static budgets and manual approvals. Sisih's claim must be demonstrated by commitment-aware spending and useful cross-session recall, not by interface count or the mere use of a blockchain.

The user selected these decisions:

1. Remove the operational dashboard from the public product. Do not keep it as an optional workspace or rebuild it under another name.
2. The website has three destinations: **Home, Connect, Proof**.
3. Expose **one canonical Sisih MCP endpoint** with role-scoped agent and owner capabilities. One integration does not mean one shared credential or equal authority.
4. Sisih is not tied to Claude Code or a particular model. Claude Code is the previously verified client, not a required dependency for purchasing.
5. Keep the existing CLI as an alternative owner interface and local signing helper. Do not force every owner to use a second interface for tasks that the owner-authorized MCP flow can complete.
6. Prepare a **separate bounded Sui Mainnet proof**, while retaining the working Sui Testnet demo. Do not replace the public deployment or execute live transactions during this implementation task.

Scope: complete the local website, shared authorization/domain integration, owner MCP workflow, Mainnet signing/configuration support, tests and an executable Mainnet runbook. Final live execution needs a concrete reviewed funding and transaction manifest. Do all independent preparation before asking for that final decision.

## 2. Inspect the real current state first

Read applicable AGENTS.md files and relevant sections of:

- `C:\Sisih\CLAUDE.md`
- `C:\Sisih\README.md`
- `C:\Sisih\docs\SPEC.md`
- `C:\Sisih\docs\PROGRESS.md`
- `C:\Sisih\docs\HANDOFF.md`
- `C:\Sisih\docs\RECORDING.md`
- `C:\Sisih\docs\MAINNET_READINESS.md`
- `C:\Sisih\docs\evidence\final-run-sisih-hosted-9\README.md`
- `C:\Sisih\docs\RESEARCH_KAWAL.md` and `docs/RESEARCH_AGENT_DEMOS.md`

Read relevant installed Next.js guides under `C:\Sisih\web\node_modules\next\dist\docs\` before writing Next.js code. Use the installed versions of Next.js, Sui and MCP SDKs; consult current primary documentation for changed APIs and network details.

Inspect `git status` and the actual diff before editing. There is existing unfinished frontend work and corrections, including HomeView, routing, shell, Connect, styles, recording instructions and MCP catalog text. Another implementation session may have advanced them. Preserve correct work. Do not reset, stash away or revert unrelated changes, delete the repo, recreate the app, or overwrite existing secrets.

Some current project instructions describe an optional dashboard, Claude-only setup, a cancelled Mainnet plan, or agent-only MCP tools. The product decisions in this handoff intentionally supersede those choices for implementation preparation. Update current instructions coherently, while retaining historical descriptions as historical. This does not authorize funding, broadcasts or deployment.

Start with a short source-grounded execution plan, then implement. State the concrete user failure, mechanism, strongest alternative, differentiated claim and acceptance trace without asking for another product-direction approval.

## 3. Public website: Home / Connect / Proof

Use the approved Sisih brand: forest `#164E43`, lime `#D6F36B`, ivory `#F6F7F2`, existing logo, DM Sans and Geist Mono. Reuse design tokens and good existing components. Keep all copy, code comments and documentation in English.

### Home: `/`

Explain the owner, the promised-money failure and how Sisih prevents it. Give a concise concrete example, clearly labeled illustrative if it is not recorded evidence. Main calls to action: **Connect your agent** and **See the proof**.

No sidebar, workspace picker, Open dashboard/workspace link, wallet-connect prompt, deposit control, operational balance cards or scripted task dock. Avoid decorative fake terminal logs, invented customers, live activity, savings claims or success statistics.

Show the network of the actually available environment. Until Mainnet is truly deployed and verified, the working hosted demo is **Sui Testnet · Walrus Memory Mainnet**. Code support and a prepared runbook do not justify a Mainnet-live badge.

### Connect: `/connect`

Lead with **Connect your agent**, not **Agent: Claude Code**. Explain the general connection contract: remote MCP URL, supported transport/protocol behavior, authentication requirements and role-scoped tools. State **Verified setup: Claude Code** for the existing evidence. Other clients are compatible candidates until actually checked; do not claim universal compatibility.

Provide two clearly distinguished connection recipes to the same MCP URL:

- **Spending agent:** restricted delegated credential; discovers services, checks budget, requests purchases, reads outcomes. No owner authority or signing keys in this process.
- **Owner assistant:** owner-authorized connection in a separate session/process; inspects requests, approves/denies, configures commitments/limits/preferences and controls permissions through the same MCP. Explain the local signing step for owner-authorized Mainnet actions.

For Claude Code, retain complete copyable Bash and PowerShell recipes, shell-correct `.mcp.json`, the served skill, environment-variable handling and exact tool restrictions. The recorded spending-agent setup used:

`--setting-sources project --mcp-config .mcp.json --strict-mcp-config --tools Skill,ToolSearch --permission-mode dontAsk`

plus `--allowedTools` for the five agent tools, Skill and ToolSearch. `--allowedTools` by itself did not remove built-in tools. Do not silently widen the spending-agent recipe when adding owner capabilities.

Adapt the owner recipe to the implemented owner tools and signing mechanism. Do not mark newly added owner setup as previously verified. The existing evidence used `claude -p`; interactive mode needs its own check before being called tested.

Include a harmless connection check, a useful purchase task, held-request continuation, receipt inspection and session release. An idempotency key identifies one intended purchase: preserve it for retries, use a new one for a new purchase. Do not have every visitor reuse a global constant key in the shared namespace.

Preserve private credential bootstrap without the old dashboard or demo dock. Prefer an authenticated owner CLI flow; a minimal credential-only Connect form is acceptable if appropriate to existing Testnet auth. Never expose owner or agent credentials in public pages, URLs, screenshots, logs or source. Mainnet owner authentication must not silently inherit a shared demo-token shortcut.

Make setup instructions readable even when the backend is unavailable. Present unavailable connection checks honestly. Do not make every visitor reset shared state, promise the first request will be held when a preference already exists, or imply shared funds are unlimited.

### Proof: `/proof`

Show one concise recorded trace: task -> unknown-merchant hold -> owner decision and remembered preference -> useful paid result with receipts -> a fresh agent session recalls that preference -> reserve or pause still blocks spending.

Use the actual `sisih-hosted-9` evidence and exact request IDs, release/settlement digests, Tatum read-back and Walrus job/blob evidence. It is a **Testnet + Walrus Mainnet recorded run**, not a proof of the new owner MCP or Sui Mainnet implementation. Display new local/isolated checks separately. Add Mainnet proof only after an actual later run.

Distinguish recorded facts from optional current server state. No operational charts, configuration panels, approval buttons, wallet connection or simulated task launcher. A focused read-only request/receipt detail is appropriate. Preserve hosted-6 history accurately if `/tour` remains; do not relabel its data as hosted-9.

### Remove the old dashboard coherently

Remove public operational routes, navigation and components after tracing shared imports. Update old `/workspace`, `/#workspace`, `/agent?request=...` and similar destinations throughout frontend, MCP results, served skill, CLI hints and current docs. Resolve old links deliberately through redirects or read-only receipt detail. Do not leave an approval link pointing to a page that cannot approve. Replace/deprecate `owner_dashboard_url` coherently for consumers and tests; provide owner MCP and CLI continuation guidance.

**Do not delete the Next.js app.** It hosts `/api/*`, `/api/mcp`, `/merchants/*`, `/api/sui-rpc` and `/skills/sisih/SKILL.md`. Preserve the working backend routes. Public pages should not depend on mounting the former dashboard providers.

## 4. One MCP with server-enforced roles

Reuse the existing MCP SDK and `/api/mcp`. Keep one domain engine for MCP, CLI and HTTP consumers. Do not create a second financial engine, inconsistent preference store, general-purpose shell tool or arbitrary signer endpoint.

Retain these spending-agent tools and their behavior:

- `get_budget`
- `list_services`
- `request_purchase`
- `get_request_status`
- `end_demo_session` (preserve compatibility if renamed later)

Add owner-scoped capabilities for the useful existing owner workflow: inspect commitments, requests, limits, preferences, suggestions and evidence; approve/deny with optional remembering; add commitments and change reserve targets; set limits/expiry and thresholds; manage preferences; accept/reject suggestions; pause/resume/revoke; advance the application session where meaningful. Use clear typed schemas and domain names. Testnet-only reset/cycle/recycle remain explicitly privileged demo tooling, not Mainnet product tools. Do not expose withdrawals or arbitrary recipients/signing merely to inflate tool coverage.

Implement a shared authenticated context with explicit role, permitted capabilities and the configured vault/environment. Derive authority only from verified credentials/authorization, never from tool arguments, model text, `clientInfo`, client names or a caller-supplied `role` header. Reject ambiguous or colliding role credentials. Do not imply multi-user or multiple independent agents if deployment still has only one configured owner and spending identity.

Filter `tools/list` by authority, and check authority again on every `tools/call`. Hiding tools alone is insufficient. Direct calls to owner tool names with an agent credential must fail before side effects. Missing auth must fail closed on any Mainnet instance, including a local instance; audit local-development bypasses.

Audit legacy HTTP routes, credential-bootstrap routes, transaction import, demo controls and the Tatum proxy as well as MCP. Adding correct MCP auth while a legacy demo-token route can approve or alter Mainnet policy is not an acceptable boundary.

The owner assistant may automate **owner-authorized** work in its separate context. The delegated spending agent cannot approve its own held request, increase its caps, change reserves, resume/regrant itself, obtain an owner credential or escape a refusal by splitting a purchase. Keep natural-language autonomy within the granted role.

Reuse shared locks/rate limits/idempotency. Owner decisions and emergency pause/revoke must work while an agent lease is held; unrelated visitors must not interleave a shared run. Revalidate purchase safety at the consequential execution boundary after approval or concurrent policy changes. A status call never pays. Retrying or reconnecting cannot trigger a second purchase.

## 5. Owner signing and Mainnet preparation

This requires real implementation, not a network-selector change.

### Existing blockers to address

- `server/src/cli/run.ts` sends owner configuration actions to `/api/demo/owner-action`.
- `server/src/demo/owner.ts` intentionally calls `assertTestnet` for demo-owner signing. **Keep that guard.**
- `server/scripts/publish.ts` broadcasts and writes IDs into root `.env`; it must not silently overwrite the working Testnet configuration during Mainnet preparation.
- Demo reset/recycle/simulated-income utilities are not a Mainnet workflow.
- ChainScope labels, report content, instructions and explorer links contain Testnet assumptions.
- `.env.mainnet` already exists from a cancelled plan. Do not overwrite, regenerate, delete, print or upload it. Do not assume it is funded or that the old funding estimate is current.

### Implement a coherent owner signing path

Keep the Mainnet owner's private key local to an owner-controlled signer. Do not upload it to Vercel or pass it into the delegated agent's process. A remote owner bearer credential alone must not activate the Testnet server-owner signer on Mainnet.

Reuse an established local Sui signer/keystore or implement a narrowly scoped local signing helper after inspecting the installed tools. One canonical remote domain MCP may prepare actions while an owner-side helper signs; this is not a requirement for a second domain MCP service. Make the actual owner-assistant journey work with the helper rather than returning unusable unsigned plans and declaring completion. The CLI can provide the same signing path as an alternative.

Validate the network, vault, package, transaction targets, type/asset, sender, recipient, amounts and gas caps at the signing boundary. Do not sign arbitrary transaction bytes solely because a remote response supplied them. For offchain owner changes/approval, use verified owner authorization bound to the action, relevant parameters, request/vault, network, nonce and expiry, with replay protection. An owner token should not be advertised as a cryptographic wallet signature. Ensure the configured owner matches actual vault ownership.

For onchain effects, verify inclusion and expected effects through Tatum before advancing state. Reconcile signatures, submitted digests and uncertain outcomes durably. An HTTP timeout is not proof that a transaction failed and does not justify re-signing a new spend.

Keep existing Testnet server-signed behavior accurately labeled for regression compatibility. The new Mainnet path is owner-controlled signing. Document the trust model of operator, agent and facilitator keys separately; never claim the whole system is noncustodial merely because the owner key stays local.

### Isolate configurations and make the proof executable

Prepare separate Testnet/Mainnet configuration, database/state, deployment target and memory namespace. Missing Mainnet IDs/asset/auth should fail closed, not fall back to Testnet values. Derive environment-aware receipt links, API responses, CLI output, merchant report labels and network identifiers from validated config. Retain historical evidence links unchanged.

Every Sui read, simulation and broadcast must go through the existing Tatum integration. Preserve its throttling and retry controls; do not introduce another RPC provider as a shortcut. Check current official Circle/Sui documentation for the native USDC type and metadata. No live price conversion is required to define a funding cap in SUI and USDC.

Prepare explicit, separate commands for read-only preflight, build/simulation, publication, vault initialization, funding/deposit, policy setup, one proof run and evidence verification. Commands named help/check/prepare/estimate must never broadcast. Live commands must require an explicit execution flag and validated network/manifest; prevent accidental use of the current root `.env`. Include publication/create-vault effects and output location in the manifest.

Define a small proof scenario using the implemented prices and measured costs: an unfamiliar service is held; the owner approves and remembers; the agent consumes the paid result; a fresh session recalls it; a later purchase is refused because free funds are below the price despite the allow preference. Use project-operated merchant labeling. No need to recreate all five historical sessions, simulated income or scheduled bill cycles on Mainnet.

For expected failure, simulation/preflight may be preferable to spending gas on an aborted transaction; label which evidence was simulated and which was broadcast. Never invent a Mainnet digest or imply simulation is a live rejection.

Generate a reviewable funding/transaction manifest after independent preparation: network, target origin, public role addresses, asset, recipients, vault/deployment operations, maximum USDC allocation, per-purchase/day limits, measured gas estimate, explicit aggregate SUI gas cap, expected receipts and remaining funds. Do not request funding based on the old cancelled estimate or invent a present gas quote. If simulation needs unfunded/unpublished objects, report the estimation limit and finish everything else possible.

Do not execute publication, funding, transfers, purchases, bill payments, resets or Mainnet memory writes in this task. Do not change Vercel env, deploy, push, make the repo public, publish the blog/social posts or submit the form. Ask for concrete live execution authorization only once the implementation and manifest are reviewable. Do not block website, tests or signing implementation on this final live step.

## 6. Payment correctness and useful evidence

Trace the existing path before changing it: invoice -> policy -> vault release -> x402 settlement -> delivered merchant result -> Tatum verification -> Walrus memory.

Keep exact asset/recipient/amount attribution, hard rules and request continuation. Price, recipient, category and service URL come from the registry/invoice validation, not model suggestions. Merchant output is untrusted external data, not instructions.

Account for release and settlement separately. ChainScope may fail before merchant settlement after vault funds have already been released. Correct blanket statements such as `failed means nothing was paid` when the actual state can be released, pending, unknown or unsettled. Persist recovery information and do not automatically release again after a lost response. State what happens to released but unsettled funds and which party can recover them; test the implemented behavior. Do not hide this behind a generic retry button.

Walrus `remember` is asynchronous. Job accepted, writing, failed and stored are different states. Cross-session recall needs actual stored preference evidence. Verify stored count through jobs/listing, not top-k semantic recall. Preserve background-job recovery rather than depending on one function staying alive.

Current official requirements reviewed on 2026-11-07: Walrus Memory Mainnet, at least 10 memories, relevant Tatum usage, published blog, working demo and public repo. The Agent Payments bonus says x402 or MPP settled on Sui without specifying Mainnet/Testnet. Mainnet preparation is a product choice, not a claim of organizer approval or guaranteed eligibility. Recheck official sources if discussing changed rules.

## 7. Historical proof and recording corrections

Check existing fixes and keep them:

- ChainScope returns live onchain data through Tatum; other merchants return labeled fixed examples. All remain project-operated demo merchants.
- In the recorded Testnet sequence, after `demo cycle`, the owner accepted the Inference reserve suggestion from 6.00 to 7.00 before the next session. Omitting it changes free funds and can defeat the planned block.
- Use actual current IDs. Before a reserve-block demonstration, verify free funds are below the selected price; a historical savings target is not universally correct.
- Wait for actual bill due time. Edited video timings do not prove a two-minute cycle has elapsed.
- Preserve evidence before any future owner-authorized reset. The previous state of 1.60 free was an observation, not permanent public-demo capacity.
- Do not rewrite hosted-9 as an owner-MCP or Mainnet run. Its owner used CLI, its agent used Claude Code, and its payments used Sui Testnet.

## 8. Verification and completion criteria

Run relevant existing tests, typecheck, web/server builds and Move tests for changed contract behavior. Do not change Move code merely to add a network label. Add meaningful checks for the consequential new boundaries rather than tests that only mirror copy or count tool names.

Required checks, in isolated local/Testnet fixtures without live writes:

1. Same MCP URL: agent sees/calls its permitted tools; owner sees/calls useful owner tools. Direct agent calls to owner tools fail with zero signing/payment/configuration effects. Credential absence, collision, wrong role, expired/replayed owner authorization and cross-environment calls are rejected.
2. A real MCP client invocation carries out a representative owner action through the shared engine. A wire-level SDK integration check proves transport, not compatibility with every AI app. Test a second independent client if available; label exactly what was exercised. Retain the existing verified Claude Code recipe separately.
3. Owner signing checks inspect actual transaction/authorization contents. Negative cases include wrong owner, changed parameters/recipient/amount, wrong vault/network/package and replay. A newly returned signature is not evidence of chain execution.
4. Successful purchase and useful result, held purchase -> authorized decision -> same request continuation, repeated key, concurrent calls, changed reserve before execution, settlement failure, lost response and restart/unknown-outcome recovery. Test that ambiguous execution never leads to a duplicate release/charge.
5. Mainnet guards reject demo reset/recycle/server-owner signing, including legacy routes and local no-token bypasses. Preflight/help/simulation do not broadcast or rewrite Testnet config.
6. CLI and hosted backend routes still work after dashboard removal. Obsolete UI URLs and returned links resolve deliberately. Home and connection instructions remain readable when API data is unavailable.
7. Inspect finished Home, Connect and Proof at 375, 768, 1280 and 1440 px in an actual browser. Check keyboard navigation, focus, copy controls, errors/loading and retained theme modes. Save real screenshots. No operational dashboard or task dock remains reachable through public navigation.

Use fixture/mocked boundaries for local verification and clearly label them. Do not run live Testnet purchases, memory writes or resets merely to manufacture a green completion report. If a later external-agent or funded Mainnet run is not performed, say so; do not fabricate evidence or silently substitute old receipts.

Update current README, CLAUDE, SPEC, HANDOFF, PROGRESS, recording guidance, served skill, env examples and connection docs to the implemented behavior. Preserve historical evidence and exact network labels. Scan new tracked content for secrets without printing secret values. Do not add dependencies unless needed; if needed, use official maintained packages and keep the lockfile consistent.

Final report must include:

- What changed and which journeys now work: spending agent, owner assistant/CLI and judge.
- Files changed and the owner signing/authentication model actually implemented.
- Tests/builds/browser checks actually run, screenshot paths and meaningful failures/limits.
- Exact client verification status; no blanket all-agent support claim.
- Mainnet status as **prepared / not deployed / not funded / not executed**, unless independently true evidence already exists and is explicitly identified.
- The runnable preflight and later live-run commands, funding/transaction manifest location and only the remaining live decisions requiring user input.
- Clear distinction between local changes and the unchanged deployed Testnet demo.

Do not stop halfway because Mainnet funding is unavailable. Complete the site, unified MCP, signing path, isolated configuration, local verification and runbook first. If a material dependency prevents one part, finish independent work and report the precise blocker without claiming success for it.
