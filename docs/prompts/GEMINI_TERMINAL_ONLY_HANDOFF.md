# Superseded: use the consolidated Sisih handoff

The active prompt is `C:\Sisih\docs\prompts\GEMINI_SISIH_UNIFIED_HANDOFF.md`. It combines dashboard removal with one role-scoped MCP, client-neutral setup, owner signing and separate Mainnet preparation. The owner-CLI-only and fixed-network instructions below are historical and must not override that prompt.

---

# Earlier prompt: Sisih without a public dashboard

This replaces the earlier dashboard-preservation plan. The user questioned the duplicate interface and chose a clearer terminal-first product. Work in `C:\Sisih`, inspect the current working tree, and continue from it. Implement a complete local result rather than stopping at a plan. Keep unrelated changes and completed fixes intact.

## Product decision

Sisih is an agent spending service with owner controls in the terminal:

- An external agent uses the restricted Sisih MCP tools to discover services, check its budget, request a purchase, read the outcome and release its demo session.
- The owner uses `pnpm sisih` to configure commitments and limits, approve or deny, manage preferences, pause/resume/revoke and inspect evidence.
- The public website introduces the product, helps someone connect their agent, and presents inspectable evidence.

Remove the full dashboard from the public product. Do not preserve it as an optional workspace, hide it behind another menu, or recreate its seven screens under a new name. Its essential operational functions already belong to the CLI. A small read-only proof page serves a different job: verifying a recorded agent task and its receipts.

The user is authorizing this interface change. Existing instructions to preserve an optional dashboard are superseded for this task. Preserve the approved Sisih visual identity and the working backend behavior.

## First inspect

Read the applicable AGENTS.md files and the relevant parts of `C:\Sisih\CLAUDE.md`, `C:\Sisih\docs\SPEC.md`, `C:\Sisih\docs\PROGRESS.md`, `C:\Sisih\README.md`, `C:\Sisih\docs\HANDOFF.md`, `C:\Sisih\docs\RECORDING.md` and `C:\Sisih\docs\evidence\final-run-sisih-hosted-9\README.md`.

Read relevant installed Next.js guides under `C:\Sisih\web\node_modules\next\dist\docs\` before changing Next.js code. Inspect `git status` and the actual diff: frontend work and corrections may already have progressed since the previous prompt. In particular, HomeView, routing, the shell, Connect, demo controls, the recording guide and the MCP catalog may have uncommitted edits. Keep correct work and adapt it to this new direction. Do not reset the working tree.

## Public website: three clear destinations

### `/` — introduce Sisih

Explain the concrete user and failure: an owner funds an agent from money that also covers bills and savings; a simple balance or spending cap does not distinguish promised money from spendable money. Sisih reserves commitments first, permits spending from the free remainder within delegated limits, and remembers owner preferences between sessions. Memory never unlocks committed funds.

Use the approved forest green, lime and ivory palette, logo, DM Sans / Geist Mono typography and component language. Make a polished, concise landing page with two meaningful calls to action: Connect your agent and See the proof. No sidebar, wallet-connect prompt, workspace picker, dashboard navigation, operational balance cards or demo-task dock.

The homepage may include a clearly labeled illustration of the mechanism. It must not invent live activity, balances, connected agents, learning improvements or terminal output. Explain Sui Testnet payments and Walrus Memory Mainnet honestly.

### `/connect` — connect a real external agent

Provide complete copyable Bash and PowerShell instructions that reproduce the recorded restricted Claude Code setup:

1. Fresh agent folder, `.mcp.json`, and `.claude/skills/sisih/SKILL.md` downloaded from the served skill URL.
2. Restricted `SISIH_AGENT_TOKEN` in the agent environment. Unset `SISIH_OWNER_TOKEN` and `DEMO_TOKEN` in that process. The owner token stays in the owner's separate terminal.
3. The verified launch flags: `--setting-sources project --mcp-config .mcp.json --strict-mcp-config --tools Skill,ToolSearch --permission-mode dontAsk`, with `--allowedTools` limited to the five Sisih tools, Skill and ToolSearch.
4. A tested `claude -p` read-only connection check, followed by a paid task, owner approval from `pnpm sisih` if held, continuation of the same request, receipt inspection and `end_demo_session`/lease release.
5. Correct shell quoting, JSON encoding and environment-variable expansion. A repeated purchase retry keeps its idempotency key; a genuinely new purchase uses a new key. Do not encourage all visitors to reuse one constant key in a shared namespace.

Interactive Claude mode was not verified in the preceding handoff. Either verify it explicitly or present the proven `-p` route without calling interactive mode tested.

Preserve a usable private credential bootstrap. Use the existing owner-authorized endpoint through an owner CLI flow or a minimal credential-only form on Connect, whichever fits the current implementation with the least change. It must not require navigating an old dashboard or opening a demo-task dock. Reuse existing authorization; never disclose credentials publicly or put them into URLs, screenshots, logs or source.

Distinguish trying the current shared state from a complete fresh learning demonstration. The current namespace may already allow ChainScope through memory, so an initial visit does not necessarily produce an owner hold. Explain owner-controlled preparation without making every visitor reset shared state.

### `/proof` — inspect a recorded run

Build one concise read-only account of a real terminal run: task -> initial hold -> owner CLI approval and remembered preference -> completed purchase with useful merchant output -> fresh agent session recalls the preference -> reserve or pause blocks further spending.

Prefer `sisih-hosted-9` evidence, with exact request IDs, release/settlement digests, Tatum verification references and Walrus job/blob evidence from the saved artifacts. Clearly separate recorded facts from current server state. Include an informative limitation: demo-owner signing, demo merchants, network, memory writes that required retry, or an agent answer that omitted evidence. Never claim a new live verification unless you performed it.

Show links and supporting excerpts that let a judge follow the run. This page is not a second dashboard: no configuration, approvals, deposit buttons, charts unrelated to the run, wallet connection or scripted task launcher. A small read-only request/receipt detail for a linked request is appropriate.

The existing `/tour` describes `sisih-hosted-6`, not hosted-9. Keep that historical content accurately labeled or redirect to the new proof where appropriate. Do not silently relabel old data as the final terminal run. Preserve the underlying evidence artifacts.

## Remove the dashboard coherently

- Remove public links, navigation and rendered routes for the optional workspace and its seven operational screens. Do not add an Open workspace CTA.
- Remove the sidebar, workspace picker, wallet/deposit controls and browser-based demo-task dock from the public website.
- Find references to `/workspace`, `/#workspace`, `/agent?request=...` and other old dashboard destinations in the frontend, MCP responses, served skill, CLI output, README and current instructions. Replace them with CLI guidance or an appropriate read-only proof destination.
- Preserve useful old links with explicit redirects or read-only receipt views where appropriate. Do not offer approval from a link that now opens a read-only page.
- Inspect `owner_dashboard_url` and related fields in MCP result types/tests. Update current consumers coherently; preserve compatibility where warranted and avoid dangling links. Owner CLI instructions remain primary.
- Decouple the public site from dashboard-specific state/providers where practical. A backend outage should not prevent someone reading the introduction or connection instructions. Do not mount the old dashboard just to support credential bootstrap.
- **Keep the web-hosted backend.** Next.js currently hosts `/api/*`, `/api/mcp`, `/merchants/*`, the Tatum proxy and `/skills/sisih/SKILL.md` for Vercel. Removing dashboard screens must not remove these routes or stop agent/CLI clients working. Do not delete the web application as a shortcut.
- Remove genuinely unused dashboard components/styles only after tracing their imports and shared dependencies. Preserve historical evidence, design assets and unrelated user work.

## Finish the known readiness corrections

Check whether these have already been fixed, and retain correct fixes:

- `list_services` metadata must distinguish ChainScope's live Sui Testnet report from the other merchants' fixed examples. All merchants are demo services run by Sisih.
- Recording sequence: after `demo cycle`, inspect suggestions, accept the current Inference suggestion (the recorded run changed 6.00 to 7.00), then start the next session. Omitting that acceptance changes the free balance and may make the intended reserve-block demonstration succeed instead.
- Use IDs from the actual run. Before demonstrating a block, verify free funds are below ChainScope's 0.80 price. The recorded savings target 5.50 is not universally correct after other changes.
- Wait until bills are due. A reset begins a two-minute demo cycle; edited video timestamps do not guarantee operations finish at those times.
- Preserve evidence before resets and distinguish pending, failed and stored memories. Verify counts through jobs/listing, not top-k recall.
- Explain shared-demo availability and owner preflight using CLI status, limits, preferences, available funds and lease state. The last inspected 1.60 free only supported two new 0.80 purchases under otherwise allowing conditions; it is not a permanent readiness promise.

Update current documentation and project instructions to the final interface decision: agent MCP, owner CLI, public Home/Connect/Proof. Keep historical descriptions explicitly historical rather than rewriting old evidence.

## Preserve the implemented mechanism

Keep the Move vault, commitment reserves, caps, permission expiry, owner/agent authority separation, policy engine, x402 execution, idempotency, request continuation, Tatum integration, Walrus learning and shared lease protections. Removing a dashboard must not make the agent approve itself or broaden its authority.

Networks remain Sui Testnet for the vault and payments through Tatum, and Walrus Memory Mainnet. Keep demo services and server-signed testnet owner operations accurately labeled. This task does not authorize live resets/payments, pushing, production deployment, repository-publicity changes, publication or submission.

## Verification and deliverable

Run the appropriate existing tests, `pnpm typecheck` and `pnpm --filter @sisih/web build`. Check API/MCP discovery and CLI read-only behavior still work with the website restructured. Add meaningful regression checks for changed routing, links or contracts between consumers; do not manufacture tests for copy strings.

Inspect the actual finished local website at 375, 768, 1280 and 1440 px, including keyboard navigation, copy buttons, loading/error states and the existing dark theme if retained. Use isolated/read-only data for UI validation. Verify the public site has no dashboard navigation or operational task launcher, and that obsolete links resolve intentionally. Save real screenshots of Home, Connect and Proof.

Report files changed, the resulting agent/owner/judge journeys, checks actually run, screenshots and remaining limitations. Update PROGRESS and the handoff. Finish with a concrete local result ready for review and recording; clearly distinguish it from what is deployed.
