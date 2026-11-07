# Superseded: use the consolidated Sisih handoff

The user changed the product decision: remove the full dashboard from the public product. The earlier instructions below to preserve an optional owner workspace are superseded.

Read `C:\Sisih\docs\prompts\GEMINI_SISIH_UNIFIED_HANDOFF.md` and implement that prompt instead. Preserve current work and completed fixes. Public destinations are Home, Connect and Proof; one role-scoped MCP serves agent and owner workflows, the CLI remains an alternative, and Mainnet preparation is isolated from the working Testnet deployment.

The text below is retained only as historical context, not the active implementation instruction.

---

# Earlier plan: finish the Sisih dashboard and judging flow

You are working in `C:\Sisih`. Finish the frontend changes described below, verify them, and leave a concrete, reviewable result. Implement the work; do not stop at a plan or request another design approval. The user has authorized the dashboard cleanup and wants Gemini to carry it out.

## Product and accepted direction

Sisih protects the money an owner has already committed to bills and savings. An external agent can purchase services only from the free remainder, within the owner's limits. The owner's approval preferences are stored in Walrus Memory and recalled in later sessions. Memory cannot override the vault's hard limits.

The primary workflow already works:

- External agent: Claude Code using Sisih's restricted MCP tools.
- Owner: `pnpm sisih` for configuration, approval, pause/resume and evidence.
- Website: a clear introduction, connection instructions, recorded evidence, and an optional owner workspace.

The dashboard remains useful for inspecting funds, commitments, requests, memories and receipts. Give it that role clearly. The homepage should help a first-time visitor understand the product and choose a useful next action.

Network decisions are final: Sui Testnet for the vault and x402, through Tatum; Walrus Memory on Mainnet. Merchants are demo services owned by the Sisih team. ChainScope returns live Sui Testnet data through Tatum; DataMart, SearchBox and ReportLab return fixed example content.

## Read the existing project before editing

Read the applicable AGENTS.md files and the relevant sections of:

- `C:\Sisih\CLAUDE.md`
- `C:\Sisih\docs\SPEC.md`
- `C:\Sisih\docs\PROGRESS.md`
- `C:\Sisih\README.md`
- `C:\Sisih\docs\HANDOFF.md`
- `C:\Sisih\docs\RECORDING.md`
- `C:\Sisih\docs\evidence\final-run-sisih-hosted-9\README.md`
- The approved design assets under `C:\Sisih\docs\design\` and tokens in `C:\Sisih\web\src\app\tokens.css`.

This Next.js installation carries version-specific instructions. Read the relevant installed guides under `C:\Sisih\web\node_modules\next\dist\docs\` before changing Next.js code. Use the existing React/Next.js, TypeScript, CSS tokens and components.

## Important: there is an unfinished local draft

Start with `git status` and inspect the diff. Codex began this change, then the user asked to hand implementation to Gemini. These files are intentionally uncommitted:

- `C:\Sisih\web\src\app\page.tsx`: homepage now selects the new `home` view.
- `C:\Sisih\web\src\app\[section]\page.tsx`: `/workspace` maps to the existing overview.
- `C:\Sisih\web\src\lib\types.ts`: added the `home` view.
- `C:\Sisih\web\src\components\dashboard-view.tsx`: wires in HomeView.
- `C:\Sisih\web\src\components\home.tsx`: new untracked homepage draft.
- `C:\Sisih\web\src\components\shell.tsx`: draft public navigation for `/`, `/connect` and `/tour`; workspace navigation moved to `/workspace`.
- `C:\Sisih\web\src\components\overview.tsx`: removed the large introduction, changed the workspace heading and added a terminal shortcut.

These drafts have NOT been styled, typechecked, built, browser-tested, deployed or committed. New classes such as `public-*`, `home-*` and `workspace-terminal` currently have no dedicated CSS. Finish and improve them rather than treating them as a completed milestone. Preserve unrelated user changes if new ones appear. The last committed milestone was `e3e4879` when this handoff was written.

## 1. Finish the public entry and owner workspace

Keep Sisih's approved forest green, lime and ivory identity, DM Sans / Geist Mono typography, logo and existing component language. Improve hierarchy, spacing, navigation and useful states. Avoid a new visual identity or unnecessary animation.

### Homepage `/`

- Make it a distinct, polished product entry page with compact public navigation.
- Explain the user problem and mechanism in plain English: committed funds first, agent spending from the remainder, preferences remembered between sessions.
- Primary action: Connect your agent. Secondary: Explore a recorded run. Keep Open workspace easy to find.
- Use real API-backed values for the shared vault preview. Label it as the shared demo, show loading/error states, and avoid showing fake zero values while loading.
- Do not imply that cached balances are fresh chain reads, that an agent is connected when only permission is active, or that free funds alone guarantee a purchase can proceed. Consider data recency and service failures in the presentation.
- Link to actual transaction, memory and session evidence. Label any illustrative explanation as such; do not fabricate terminal output, activity or success counts.
- Keep owner controls and wallet connection in the owner workflow rather than requiring them to understand the homepage.

### Owner workspace `/workspace`

- Preserve working screens and their data: commitments, requests, memory, learning impact, activity and settings.
- Make total, committed and free funds visible without a large marketing introduction above them.
- Show read-only versus enabled owner access accurately.
- Make held requests and their reasons easy to find. Existing approval, denial and hard-block behavior must remain intact.
- Use the CLI as a visible companion: copyable commands and a clear path to agent setup. The website remains a usable alternative where existing owner operations are supported.
- Update empty states that still tell users to run the built-in scripted agent from Demo controls. The primary next step should be connecting an external agent.
- Keep built-in task scenarios available only as clearly labeled demo/testing controls. Present them as scripted examples, not as the real external agent.
- Preserve old deep links. The draft redirects `/#workspace` to `/workspace`; verify it works and update current internal links and docs.

### Public navigation and shared shell

- Keep Home, Connect, Recorded run and Workspace understandable on desktop and mobile.
- Connect and the recorded walkthrough should be readable without unlocking.
- Preserve credential reveal behind the existing owner authorization. Preserve wallet signing, the existing demo dock and all backend authorization boundaries.
- Make navigation, copy buttons, dialogs, focus states, empty states and error recovery work with a keyboard and touch.
- Preserve dark-theme behavior for the new surfaces if the existing theme is selected.

## 2. Make Connect reproduce the verified agent setup

`C:\Sisih\web\src\components\connect.tsx` currently tells visitors to start plain `claude`, while the verified run used explicit restrictions. Make the website and README agree.

Provide complete, copyable Bash and PowerShell instructions:

1. Use a fresh agent folder with `.mcp.json` and `.claude/skills/sisih/SKILL.md`.
2. Download the skill from the deployment's `/skills/sisih/SKILL.md`.
3. Keep owner credentials out of the agent process. Unset `SISIH_OWNER_TOKEN` and `DEMO_TOKEN` there; set only the restricted agent credential for this integration.
4. Show the recorded flags: `--setting-sources project --mcp-config .mcp.json --strict-mcp-config --tools Skill,ToolSearch --permission-mode dontAsk`, plus `--allowedTools` for the five Sisih tools, Skill and ToolSearch. Preserve correct quoting and variable expansion in each shell.
5. Start with the tested `claude -p` read-only connection check. Interactive mode was not verified in the handoff; do not advertise it as tested unless you actually verify it.
6. Explain a paid task, a held request, owner approval in the separate owner terminal, and continuation using the same request ID. Status checks must not trigger another payment.
7. Explain finishing with `end_demo_session` or the owner releasing the shared lease.

Do not expose credentials in source, URLs, screenshots, logs or copied commands. Retain placeholders. Keep the testnet demo-owner signing disclosure accurate.

Distinguish two starting conditions: the current shared demo may already remember ChainScope and approve it automatically; a complete first-approval learning demonstration starts from an explicit owner-controlled fresh reset. Do not tell every visitor their first request will necessarily be held.

Also clarify that a genuinely new purchase needs a new idempotency key, while retries of that purchase reuse its key. Avoid encouraging every visitor to reuse one fixed date-based example key in the shared namespace.

## 3. Fix the MCP catalog description

In `C:\Sisih\server\src\mcp\server.ts`, the `list_services` tool description still says all services have fixed sample content. Correct it: all are demo merchants, ChainScope returns live onchain data, and the others return labeled fixed examples. The individual service metadata remains the source for an agent choosing a service. Preserve the MCP tool set and authority boundaries.

## 4. Make the recording guide reproducible

In `C:\Sisih\docs\RECORDING.md`:

- Use the verified `-p` workflow unless interactive mode is actually verified.
- After `demo cycle`, include `pnpm sisih suggestions`, acceptance of the current Inference API suggestion with `pnpm sisih suggestions accept <current-id>`, and then `pnpm sisih session next`.
- The recorded run raised Inference from 6.00 to 7.00. Omitting that acceptance leaves enough free funds for a purchase that the script expects to block.
- Obtain new IDs from the current run. Old commitment/suggestion IDs must not be hardcoded as universal instructions.
- Before showing the reserve block, inspect the current funds and verify free funds are below the 0.80 ChainScope price. Use the current savings commitment ID and actual balances. Explain that 5.50 was the recorded target, not a guarantee for every modified run.
- Wait until bills are actually due; a reset starts a two-minute demo cycle. Edited video timestamps are not elapsed execution guarantees.
- Preserve existing evidence before a reset and keep pending, failed and stored memory states honest.

## 5. Explain shared-demo readiness for judges

Add a concise preflight to the relevant README/handoff/Connect surfaces without turning the product UI into an engineering checklist:

- Read-only exploration works without credentials.
- Agent execution requires the privately delivered credential and an available shared lease.
- At the last inspected state, `sisih-hosted-9` had 1.60 free testnet USDC and ChainScope cost 0.80. That permits at most two new purchases from that free pool under otherwise permitting conditions; it is not a persistent readiness guarantee.
- Have the owner inspect status, limits, preferences and evidence before a live judging session. Explain the existing owner-controlled way to prepare testnet funds if needed.
- Never silently reset the shared run or lower the user's commitments to manufacture a successful purchase. Preserve the recorded walkthrough as a useful fallback.

Preserve the distinction between current live state and the historical `/tour`, which shows `sisih-hosted-6`. Do not relabel that walkthrough as hosted-9 unless its content and evidence are actually replaced with matching verified artifacts.

## Scope and execution boundaries

Keep the existing Move contracts, reserve logic, payment engine, x402 settlement, Tatum integration, Walrus learning, idempotency, leases and owner/agent authority separation. This is a frontend, instruction and judging-readiness task. Reuse the working backend rather than rebuilding it.

Work locally and provide a tested result. Keep production state, live funds and historical evidence intact while developing and checking the UI. No push, public repository change, production deployment, blog/X publication or hackathon submission is authorized by this prompt. Prepare those as later steps, not as something to silently perform.

## Verification and completion

- Run the appropriate existing tests, `pnpm typecheck`, and `pnpm --filter @sisih/web build`. The preceding milestone reported server 107 and web 18 passing; report your actual results rather than copying these counts.
- Add meaningful checks only where the changed routing or behavior warrants them. Do not add tests that merely match copy or mirror implementation.
- Open the finished local app in a real browser. Verify `/`, `/connect`, `/tour`, `/workspace` and the existing workspace links. Check navigation, loading/error states, copy controls and legacy `/#workspace` behavior.
- Check 375, 768, 1280 and 1440 px widths. Long commands and network badges must not create page-level horizontal overflow. Verify light and existing dark mode.
- Use isolated local fixtures or read-only production data for UI checks; don't spend shared demo funds just to take screenshots.
- Save actual screenshots showing the new homepage, owner workspace and a narrow viewport. Report what was and was not exercised; don't call screenshot inspection a full live-agent test.
- Update `C:\Sisih\docs\PROGRESS.md` and the handoff with the changes, checks and remaining work. Preserve the earlier real-agent evidence and its limitations.
- Finish with a concise report: files changed, the resulting visitor/owner journeys, tests/build results, screenshots, remaining limitations, and the exact next step for recording. State clearly that these changes are local until deployed.
