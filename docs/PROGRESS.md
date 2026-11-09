# Progress

## Current phase

Mainnet proof executed and verified (8 November 2026), based on `1109d5b`; the owner subsequently requested Mainnet-only publication on the canonical site. Original execution-time identities remain in the immutable evidence archive; Git history identifies subsequent publication changes.

- Current product is Home / Connect / read-only Proof, one MCP URL with separate agent and owner roles, and the owner CLI/local signer. Server owner credential is `SISIH_OWNER_MCP_TOKEN`; CLI alias is `SISIH_OWNER_TOKEN`.
- Selected the tested Sisih Move vault after checking native Allowance functions directly through Tatum Mainnet and comparing OpenZeppelin source reuse. See `mainnet/VAULT_DECISION.md` and `primitive-inspection.json`.
- Added strict manifest validation, isolated env layering/server export, publication/setup restart journal and lock, persistent concurrent USDC/gas budgets, owner proof scope, pre-submission known digests and payment reconciliation. Mainnet namespace cannot fall back to historical Testnet state.
- Exact verifier accepts the historical release control and exits 1 for an unrelated successful transaction. Mainnet settlement checks exact payer/recipient/asset/amount before delivery.
- Server: 190 tests in 22 files; web: 18 tests; Move: 46 tests. Typechecks and production build passed. A separate fresh clone without developer env files also passed offline locked install, tests, typechecks, build and command-help checks.
- Chromium: Home/Connect/Proof at 375/768/1280/1440, no overflow; keyboard/focus, copy success/failure, API outage/retry, dark theme persistence and redirects checked. Genuine captures are under `verification/public-site-20261108`.
- Approved funding was verified at checkpoint 343006171. Published the selected Move package, created the vault and deposited 3.00 USDC with a 0.80 reserve. Initial preflight remains a historical preparation artifact.
- **Real Codex Mainnet task completed:** first purchase held, local owner approval remembered, two 0.80-USDC x402 settlements delivered useful live reports, fresh-session rule recalled, third purchase refused with 0.60 free. Unsigned contract simulation confirmed `EExceedsFree`. Owner revoked permission; final vault 1.40 USDC. All eight receipts passed exact read-back; unrelated Mainnet digest failed. Four of four Walrus jobs/blobs verified.
- Actual net gas: 0.083418818 SUI under the 0.205-SUI ceiling. Claude Code hit its weekly quota before tool use; Codex performed the task. Evidence: `evidence/mainnet-20261108/README.md`. No extra payment was made for screenshots or provenance checks.
- At the owner's later request, pushed the verified Mainnet milestone to GitHub and deployed public Home/Connect/Proof from `bcee8ee` to Vercel. Production pages now expose the recorded Mainnet trace and Codex client details. Live runtime stays Testnet, same vault/session/namespace; no env migration or purchase. Production browser checks and HTTP auth/x402 invoice probes passed; see `verification/deployed-site-20261108`.
- That intermediate deployment is superseded by the owner's explicit “just delete the testnet we are full mainnet” instruction. Public flows now contain only Mainnet evidence/connection. Completed proof state and consumed budgets were migrated to a dedicated hosted PostgreSQL schema, all wallet signing keys removed from production config, and a read-only public-origin binding added without changing the original financial manifest. Owner writes, new purchases and merchant settlement are closed. Eight receipts and four memories were independently rechecked, plus the earlier 13-memory inventory for submission evidence. No new gas or merchant payment occurred.
- **Mainnet production deployment completed (8 November 2026).** Vercel production environment updated with `configure-public-env.ts --execute --resume`: `SUI_NETWORK=mainnet`, `MAINNET_READ_ONLY=true`, `DATABASE_SCHEMA=sisih_mainnet_proof_20261107`, `PUBLIC_BASE_URL=https://sisih-azure.vercel.app`. No private keys uploaded. Deployment `dpl_mzbJfke5M4Ec7YPLbmopJr22Piq8` verified: `/api/state` returns `network: mainnet`, vault `0x24649e...32fc` with 0.60 free / 0.80 reserved / 1.40 total USDC, 4 stored Walrus memories in namespace `sisih-mainnet-proof-20261107`, Tatum Sui Mainnet gRPC green. All three public pages (Home, Connect, Proof) return 200. Secret verification passed with zero findings across 414 working files, 834 history blobs, and 395 production artifacts. Server tests: 195 passed (24 files). Web tests: 26 passed (3 files). TypeScript typecheck: 0 errors. Production build: all 14 routes generated.
- **Final security hardening & MCP read-only enforcement completed (9 November 2026).**
  - **MCP Strict Read-Only Tool Discovery:** Enforced at registration layer in `server/src/mcp/server.ts`. In Mainnet read-only mode, all mutation tools (`request_purchase`, `end_demo_session`, `decide_request`, `add_preference`, `set_preference_enabled`, `set_threshold`, `decide_suggestion`, `set_reserve`, `add_commitment`, `set_limits`, `set_agent_permission`, `start_next_session`, `release_demo_run`, `demo_reset`, `demo_advance_cycle`) are hidden from `tools/list` for both Agent and Owner roles. Direct unadvertised invocations fail closed before any side effect.
  - **Dependency Security Remediations:**
    - Resolved `esbuild <=0.24.2` advisory (GHSA-67mh-4wv8-2f99) via `overrides.esbuild: ">=0.25.0"` in `pnpm-workspace.yaml`.
    - Mitigated `zod <4.6.6` advisory (GHSA-mrhx-c7xc-m3w5) via explicit body size limit enforcement (`content-length` <= 64KB on MCP endpoint, returning HTTP 413) and bounded input schemas.
  - **Vercel Observability Verified:** Read-only historical function logs from `dpl_mzbJfke5M4Ec7YPLbmopJr22Piq8` confirm zero 500 errors, zero unhandled exceptions, and healthy 200 responses for public reads alongside proper 401/403/410 security rejections.
  - **Full Regression Verification:** 46/46 Move unit tests passed; 198/198 Server tests passed (24 files); 26/26 Web tests passed (3 files); TypeScript clean; Next.js 16.4.5 Turbopack production build generated 14 routes; Secret scan passed with zero findings across 439 working files, 837 history blobs, 395 production artifacts.

## Historical implementation log

Entries below describe earlier revisions and historical runs. Their dashboard layouts, signing assumptions and old funding proposals are superseded by the current phase, README and Mainnet runbook. Historical evidence files remain unchanged. Only the recorded spending-agent Claude Code task is a verified model-client run; owner-assistant tools have isolated MCP SDK coverage.

### Agent-neutral public copy (2026-11-07)

- Public page headings and explanatory copy now use "your agent" or "the agent" rather than a client brand.
- Connect starts with the agent MCP configuration, followed by the recorded CLI example. Client-specific executable names, flags, and skill paths remain accurate.
- Proof narratives use generic agent wording; the original recorded client details remain in the linked evidence files.

### Unified handoff: 3-Page Public Site, Role-Scoped MCP & Mainnet Prep (2026-11-07)

- **Product Restructuring:**
  - Removed in-app dashboard UI, tabs, and mutating forms from public exposure.
  - Three canonical public routes:
    - `/` (Home): Problem statement, Move reserves vs spendable pool, raw wallet failure comparison, 4-step workflow, and brand-approved styling.
    - `/connect` (Connect): Two verified recipes (Claude Code as spending agent; Owner assistant over MCP), companion CLI reference, environment isolation, and shared demo guidelines.
    - `/proof` (Proof): Recorded proof from `sisih-hosted-9` with Suiscan Testnet tx links and Walruscan Mainnet blob links, memory verification status (13/13 verified), limitations, and historical runs.
  - Legacy routes (`/workspace`, `/tour`, `/obligations`, `/agent`, `/memory`, `/learning`, `/activity`, `/settings`) redirect cleanly.
- **Unified Role-Scoped MCP Endpoint (`/api/mcp`):**
  - Spending Agent role (`SISIH_AGENT_TOKEN`): `get_budget`, `list_services`, `request_purchase`, `get_request_status`, `end_demo_session`.
  - Owner Assistant role (`SISIH_OWNER_TOKEN`): `owner_status`, request inspection and decisions, preferences, limits, commitments, reserve suggestions, agent permission, session controls, evidence, and local-signing intents. Exact tool names are listed in `server/src/mcp/server.ts` and the README.
  - Comprehensive unit test suites added: `server/src/auth/context.test.ts` (9 tests), `server/src/mcp/roles.test.ts` (6 tests), `server/src/owner/intents.test.ts` (12 tests). Total server suite expanded to 164 passing tests across 14 test files.
- **Sui Mainnet Proof Package:**
  - Generated `docs/mainnet/preflight.json`, `docs/mainnet/MANIFEST.json`, `docs/mainnet/MANIFEST.md`, and `docs/MAINNET_READINESS.md`.
  - Real gas measurements rescaled from testnet recorded runs; total aggregate gas cap calculated at 0.5954 SUI, USDC deposit 3.20 USDC.
  - Strict isolation: zero writes to root `.env`, zero live transactions broadcast, status documented as `prepared · not deployed · not funded · not executed`.
- **Verification & Testing:**
  - Server unit tests: 164 passed (14 test files).
  - Web unit tests: 18 passed (2 test files).
  - TypeScript typecheck: 0 errors in both `web` and `server`.
  - Next.js production build: succeeded cleanly with Turbopack.
  - Browser verification: 12 screenshots captured at 1440px, 1280px, 768px, and 375px across Home, Connect, and Proof. All routes verified 200 OK.

- **Homepage (`/`):** Dedicated public entry explaining the problem ("Your money has a purpose. Your agent has a limit"), live API-backed demo vault preview, compact public navigation, primary action "Connect your agent", secondary "Explore a recorded run", and direct links to onchain transaction, Walrus memory, and learning evidence.
- **Owner Workspace (`/workspace`):** Moved workspace root to `/workspace` with backward-compatible `/#workspace` hash migration. Visible total, committed, and free funds without top marketing banner. Prominent terminal companion (`pnpm sisih status`) with copy control.
- **Empty States & Demo Scenarios:** Updated empty states in `agent.tsx` and `memory.tsx` to point visitors to connect an external agent. Relabeled `demo-dock.tsx` task buttons as scripted test scenarios to avoid confusion with the external autonomous agent.
- **Connect Flow (`/connect`):** Complete, copyable Bash and PowerShell commands using the verified Claude Code flags (`--setting-sources project --mcp-config .mcp.json --strict-mcp-config --tools Skill,ToolSearch --permission-mode dontAsk --allowedTools ...`), unsetting owner credentials in the agent shell, `-p` read-only connection check, status check polling explanation, and shared lease handling. Added judge readiness preflight card explaining free pool dynamics (1.60 free testnet USDC in `sisih-hosted-9`).
- **MCP Server Description:** Corrected `list_services` in `server/src/mcp/server.ts` to state that all are demo merchants with ChainScope returning live onchain data and others returning labeled fixed samples.
- **Recording Guide (`docs/RECORDING.md`):** Updated to use verified `-p` flags, dynamic IDs, explicit Inference suggestion acceptance (`pnpm sisih suggestions accept <current-id>`) raising reserve from 6.00 to 7.00, cycle maturity wait (2-minute demo cycle), and balance calculations before reserve blocks.
- **Styling & Tokens:** Added dedicated CSS for `public-*`, `home-*`, and `workspace-terminal` in `web/src/app/live.css` following Sisih's forest green, lime, ivory, DM Sans, and Geist Mono branding. Verified at 375px, 768px, 1280px, and 1440px with no horizontal overflow and full dark mode support.
- **Verification:**
  - TypeScript typecheck: 0 errors across `@sisih/web` and `@sisih/server`.
  - Vitest test suites: `@sisih/server` 107 passed (107), `@sisih/web` 18 passed (18).
  - Production build: `next build` succeeded, prerendering all 13 routes.
  - Browser verification: Local Next.js server verified with 200 OK across 10 routes; 8 screenshots saved to `docs/screenshots/`.

### Agent-first product, terminal-first owner workflow (2026-11-07)

This milestone made the owner's terminal the primary owner interface. The Claude Code agent buys over
MCP, and the owner sets limits and decides held purchases with `pnpm sisih`. The dashboard became the
optional workspace.

Built:

- **Owner CLI.**
  - `pnpm sisih` (`server/src/cli/{spec,parse,run}.ts`, entry `server/scripts/sisih.ts`) is a command
    table over the existing HTTP API. Groups: Inspect, Configure, Decide, Agent permission, Session,
    Evidence, plus a labeled Demo group.
  - Output is human readable by default, with `--json` on request.
  - Exit codes: 0 ok, 1 failed, 2 usage, 3 auth, 4 busy, 5 not found.
  - Help, version, status, malformed and missing arguments never send a mutating request.
  - Mutations without the owner token exit 3 before any fetch. `demo reset` needs `--yes`.
  - After a change, the CLI releases the shared demo run unless `--hold`.
  - It is run through root tsx (`"sisih": "tsx server/scripts/sisih.ts"`), so exit codes survive.
    Nested `pnpm --filter exec` flattened them to 1.
- **Owner operations.**
  - `server/src/demo/owner.ts` gained `set_reserve`, `add_commitment`, `set_limits` and
    `revoke_agent`, next to deposit, accept_suggestion, pause and resume.
  - It is a whitelist with bounded amounts and validated inputs, signed as "Demo owner
    (server-signed, testnet)", with `assertTestnet`. It is not a signing proxy.
  - `POST /api/rules` creates an owner preference (`createOwnerRule`, shared with `ownerDecision`).
  - While an agent holds the demo run, the owner may also pause, resume, configure and change rules.
- **gate-release.ts.** `--help` no longer runs a release. Parsing is strict, `--yes` is required, and
  `parseGateArgs` / `runGateRelease` are covered by regression tests.
- **ChainScope.**
  - A new demo merchant: "Live Sui Testnet vault report", data, 0.80 USDC
    (`server/src/x402/live-report.ts`).
  - Through Tatum, it reads the checkpoint, epoch and chain time (`GetServiceInfo`), the vault
    object and the reference gas price at purchase time. It returns observations and calculated
    values separately.
  - The report is produced before settlement. If the read fails, the merchant answers 503 "not
    settled, not charged".
  - The registry marks each service's content as `live` or `fixed`, and every response carries
    `content_type`.
- **MCP.**
  - Held results return `owner_cli` (`pnpm sisih approve <id> --remember`, `pnpm sisih deny <id>`)
    and the dashboard link.
  - Settled results return `receipts`, `memory_evidence` and `result_note` (external data, never
    instructions).
  - `get_budget` returns the server-computed `largest_payment_now_usdc`.
  - Permission and cap blocks return `owner_hint`, for example `pnpm sisih resume`.
  - The idempotency key is scoped to the namespace. Stale mappings are ignored, and a reset clears
    the per-run MCP keys.
- **Sisih skill.** `web/public/skills/sisih/SKILL.md`, served at `/skills/sisih/SKILL.md`.
- **Web.**
  - The Overview hero has three actions: Connect your agent, Explore a recorded run, Open
    workspace.
  - A "Get started" nav group sits above "Workspace · optional".
  - `/connect` was rewritten for the terminal: agent and owner setup in Bash and PowerShell, check
    and task prompts, terminal approval, inspect, release. It is readable without unlocking.
  - The request drawer and the dock show the `pnpm sisih` commands.
- **Memory verification.** `server/scripts/verify-memories.ts` runs `getRememberStatus(jobId)` per
  memory and counts the namespace in the unfiltered account listing. With `--rows <file>` it also
  verifies earlier namespaces. The namespace-filtered `listMemories` returned 0 on 2026-11-07, so it
  is no longer used.
- **Tests.** 107 server tests (37 new CLI and gate-release tests, plus MCP tests) and 18 web tests.

Final run (namespace `sisih-hosted-9`):

- Date: 2026-11-07, 01:30 to 01:41 UTC.
- Agent: Claude Code 2.1.201, model claude-sonnet-5.
- Full record: [docs/evidence/final-run-sisih-hosted-9](evidence/final-run-sisih-hosted-9/README.md).

The agent was isolated:

- Its folder held only `.mcp.json` and the skill.
- The owner token was unset in its environment.
- Claude Code ran with `--tools "Skill,ToolSearch" --permission-mode dontAsk --strict-mcp-config
  --setting-sources project`, plus `--allowedTools` for the five Sisih tools.
- The probe showed that the agent could not list files or read the environment.

| Step | Result |
| --- | --- |
| Owner: `demo reset --yes`, `limits set --per-request 2.00 --per-day 6.00 --days 30` | seed `7qCqTe8nTKZktPZxqAkQkrcEQELKND9FdrWHfscaxUp2` (38 s), limits `HRPPmUjQs1HLinUsGainL7UV1d398FQVA1UowrKpxNbx` |
| A1: the agent discovers the tools and requests ChainScope | `req-637fe5e4-e5a` `awaiting_owner_approval` (`new_merchant`), with `owner_cli` |
| Owner: `approve req-637fe5e4-e5a --remember` (12 s) | release `3sts8iZ2UNtF7CrNK28U2HQvAkc8GCrd1SPcap4XcCy6`, settle `ErfGvPGLEKaxJJTaLCrDiYgqmnnxsVADj5kPguXhNZiu`, `rule-b2dbdeb1`, blob `Nx9vQ0lsbU1sNtVLXqweYEoO31FlGz17Mb1yqLjKN_8` |
| A2: same session, `get_request_status` | settled, live data at checkpoint 403681845 |
| Owner: `demo cycle`, `suggestions accept sug-6cf565d5`, `session next` | Bills and income `BN9hirNW…`, `Bz7veNSS…`, `9xSUo3Ly…`, `8s6qNhAw…`, `4cXWQWTL…`. Inference API reserve raised from 6.00 to 7.00: `6Nm5B5rv7HbFMcbQtQPkTxsBx4h7utSheZb1FUds1Z1i`. 1 rule rebuilt from 7 recalled memories in 2056 ms |
| A3: a fresh session buys ChainScope | `req-e2e8e0e4-b03` settled by `allow_rule`: release `HJXGudjrcFGPiJ1xUhv9MuPe5qqRVjzuCo3NkhtDJVNk`, settle `DGhrQx2GuVHzJL5GH4iUzBy8R7GioiQkJzwH6ctfiheq`, checkpoint 403682570 |
| Owner: `reserve set 58 5.50` | `82Z7cwv5b7h9UaDdrb6q7gSxzPmzFWtspnGMrBmEfYXY`; vault 18.10 total, 17.50 committed, 0.60 free |
| A4: ChainScope again, with the preference active | `req-5176bfd5-d5c` `blocked` (`would_cut_reserve`, 0.20). Direct release aborts with `EExceedsFree`: `AFKJwvpjY4gYphMeyKsWuz1PrXrRzcoQm8MMWRXEtKqG` (intentional). The owner denied the request from the CLI |
| Owner: `pause` | `GJ3AGmivtxtBKH3v7DjRiGsvftqyJ1pma7GZXcs2Rkq5` |
| A5: DataMart while paused | `req-24c634a4-1e1` `blocked` (`agent_paused`); `get_budget` largest payment 0.00 |
| Owner: `resume` | `GLgCsrdrk8J6Fk4JX4jTiz49VEBxubh1We8wiHQJFFLJ` |
| A6: DataMart | `req-fe4eada9-2c0` settled (`default_threshold`): release `AD3AHbwT5amDYnJsJT1RXK6HrVaDTaN9S7qagkAap9oP`, settle `66z3Ttbb5puKteSY5hQYJNaHPJLj89FH94iAXHAJ9YEH`; the agent called it fixed example content |
| Owner: `release`; afterwards `reserve set 58 4.00` | Lease released. `461wEbPYi5epwCt4W11FtnmBTTHfKvn2592rTvm2EHtR` leaves 1.60 free, so a judge's agent can buy |
| Post-deploy check (A7) | `pause` `9ErBHNraWLS4qNJiozd4qKQgBSB5UPgmxqExn18ZBmtt`. `req-6136b586-89d` `blocked` with `owner_hint`, and Claude relayed `pnpm sisih resume`. `resume` `BEucMsFcWsehH7pkqEd9WxZW3dZhFWFr7gqwXL9p2y5B` |
| Walrus Mainnet | 12 of 12 memories `done` with matching blob ids (per job) at the end of the run, and 13 of 13 in the final state after A7. The unfiltered listing agrees. One write (`mem-ae3f69ee-a69`) first failed with "Memory encryption backend is unavailable" and was stored after one owner retry |

Earlier namespaces were re-verified per job on 2026-11-07: `sisih-hosted-6` 35 of 35 and
`sisih-hosted-7` 4 of 4 (`verify-memories-2026-11-07.txt` in each evidence folder).

Bugs found by the real runs, and fixed:

- **Isolation.** In the preliminary `sisih-hosted-8` run, `--allowedTools` did not remove built-in
  tools, and the agent used `Read` and `Bash` (see `docs/evidence/preliminary-run-sisih-hosted-8`).
  Fixed with `--tools` and `dontAsk`. The hosted-8 run is kept as preliminary.
- **Stale idempotency.** After a reset, a reused key pointed at a deleted request ("No request
  req-adfd4a17-2e8", three times). The key is now scoped to the namespace, stale mappings are
  ignored, and a reset clears the per-run keys. A test was added.
- **Arithmetic.** The agent took 3.50 free as its ceiling, although the per-request cap was 2.00.
  `get_budget` now returns `largest_payment_now_usdc`.
- **Pause hint.** On a pause, the agent could only point to the dashboard. Blocks now carry
  `owner_hint`, confirmed by the real A7 run after the deploy.

Limitations:

- **A2's answer was terse.** It omitted the receipts and the checkpoint the prompt asked for.
- **A3 listed no memory blob.** The memory was still "writing" after two checks, about 20 s.
- **A3 took 92 s.** The agent searched for tools it did not have.
- **One shared workspace, server-signed owner.** There are no per-visitor vaults.
- **pnpm prints one `$ tsx …` line** before the CLI output, unless `-s` is used.
- **User-level skills are excluded** only through `--setting-sources project`.

### MCP for external agents and first-visit entry points (2026-11-07)

Built:

- `POST /api/mcp` (server/src/mcp): official MCP SDK 1.32.1, Streamable HTTP, stateless, JSON
  responses (a fresh server and transport per request; nothing held open while a human decides).
  Tools: get_budget, list_services, request_purchase, get_request_status, end_demo_session.
- Agent credential SISIH_AGENT_TOKEN (Bearer), separate from DEMO_TOKEN and the wallets; on Vercel a
  missing credential locks the endpoint (503). Owner routes still require DEMO_TOKEN, so the agent
  cannot approve, deny, reset, withdraw, change reserves or policy, or sign. Owner-only
  `/api/demo/agent-credential` delivers the credential to a demo-token holder.
- Shared demo: the agent holds the demo-run lease as `agent:demo`; other visitors get `busy`
  (structured, not an error) or 423 `agent_run_active`, but owners may still decide the agent's
  requests and start a new session. end_demo_session hands the run back.
- request_purchase fetches the merchant's own 402 invoice from the registry URL and calls the same
  submitRequest -> policy engine -> x402 executor; the server never trusts a model-supplied price,
  recipient, category or URL. Idempotency mapping (key or service+task+session) is written in
  submitRequest's new `onCreated` hook, before any payment; get_request_status only reads.
- Executor now stores the merchant response (`purchase_result:<id>`) before marking paid, and the
  payment error on failure. ownerDecision leaves "held" only through a conditional update, before
  any rule memory or payment, so a concurrent second decision cannot pay or write a rule twice.
- Demo merchant payloads are richer but say "Fixed sample data, not real-world or current market
  data" in every response.
- Web: "Try Sisih" sidebar group, Overview intro card, `/tour` (five-step replay of the recorded
  sisih-hosted-6 run, labeled recorded, no API calls) and `/connect` (endpoint, `.mcp.json` and
  `claude mcp add`, env-var credential setup, check prompt, sample task, approval and finish steps;
  credential revealed only after unlocking with the demo token). Request drawer offers the demo-token
  unlock inline (the drawer is modal, and owners arrive there from the agent's link). Top bar no
  longer overflows in judge mode at 1280 or 1440 on any page.
- `pnpm mcp:check` (read-only SDK client check).

Automated tests (server/src/mcp/mcp.test.ts, 20 tests, real MCP SDK client over handleMcp, PGlite,
stubbed vault read, invoice, Walrus and a counting payment executor): tool discovery; credential
refusal and the owner token not accepted at /api/mcp; nine owner/admin routes refuse the agent
credential; no owner-like tool exists; held purchase not charged; repeated status and duplicate
submissions do not charge; approval pays the original request exactly once; a concurrent second
approval cannot pay; denied and blocked requests cannot be resumed into payment; purchased content
returned to the right request; concurrent purchases never run two payments at once; unknown request
is a fixable tool error; busy and end_demo_session; owner may decide but not reset during an agent
run. Suite: server 64, web 18; typecheck and build pass. Move contract unchanged (no Move run needed).

Real Claude Code runs (Claude Code 2.1.201, model claude-opus-4-8, fresh folder with only `.mcp.json`
and SISIH_AGENT_TOKEN in the environment, only the five sisih tools allowed; transcripts in
docs/evidence/agent-run-sisih-hosted-7/claude-code-runs.md). Hosted demo reset first because the
test needs SearchBox to be a new merchant and free funds (sisih-hosted-6 evidence already saved):
reset B9wyWbMjANszKbfgYLWDTvRdXTeewpfxHfwVdBfUFT5o, namespace sisih-hosted-7, 20.00 / 16.50 / 3.50.

| # | What happened | Evidence |
| --- | --- | --- |
| 1-3 | Run A (20 s): Claude found the sisih tools, called list_services and get_budget (3.50 free), then request_purchase searchbox | request `req-ef83634b-191`: `awaiting_owner_approval`, paid false, dashboard link https://sisih-azure.vercel.app/agent?request=req-ef83634b-191 |
| 4-5 | Owner (Playwright in the dashboard UI) opened that link, unlocked, chose Approve & remember | rule memory O-QtCBRXvteV5QWhBXJEzen7iRtdn9W3hI0LhbnM79s ("Always allow search from SearchBox up to 1.50 USDC"); settled 23 s after the click |
| 6 | Same request settled, Tatum-verified | release 2q58QD4tRMzTemn9PZxsPz3D6zKTDpxZYSN7wdMEPBnV, x402 settle FRwkBgsUMin3VBi5viiEomdgBHQTRE8ceeQ8D77E8bKh |
| 7 | Run A resumed (11 s): get_request_status on the same id (no new purchase), summarized the purchased content as demo content, called end_demo_session | transcript |
| 8 | Owner started session 2: 1 rule rebuilt from Walrus recall (origin walrus, 3.9 s). Fresh Run B (23 s) bought SearchBox for a different task | `req-ebf326db-79f`: settled automatically, code allow_rule, rule-2b66a3c5; release C9hywTAFw8d1MvGzRsfnDvdbMPDRT2KmEiwnwVQhW3Qq, settle 4TrgbQVA3SvHSYSAkW5wM1B8WKENvq1DXyTS61TvCaw5 |
| 9 | Fresh Run C (20 s) with 1.10 free and the rule active | `req-9fbb3d5d-2ed`: `blocked`, would_cut_reserve (0.10 of committed funds); Claude did not work around it. The same 1.20 sent straight to the vault: GhJbwaKGU6Mn7uLGoy9jmgbngmF15W8VLuMqmKtCyqvm, EExceedsFree |

All six new digests re-read through Tatum testnet (5 success, the contract check failed as
intended). Memories in sisih-hosted-7: 4 stored (rule O-QtCBRX…, decisions c1HS_Tn9…, 7G-Ja7VV…,
session summary fBtwN22l…), all 4 returned by recall from the mainnet relayer.

Distinctions: automated protocol tests use stubs; Runs A to C are actual Claude Code invocations;
the owner approval was a scripted browser acting in the real dashboard; `/tour` is a replay of
recorded sisih-hosted-6 results, not new transactions; merchant content is fixed demo data.

Problems found and what was done:

- My mistake during verification: a stray `gate-release.ts --help` call ran that script's default
  sequence, releasing 0.50 from the vault to the agent (HkBdHDH7NuuVKPFKEF4QcHrNNyGHi9Pd4L7WsHTK9iXz)
  plus a failing 5.00 release (gas only, no USDC moved, digest not recorded). The 0.50 is recorded in
  the hosted activity feed with that explanation and sits with the agent until the next reset's
  recycle. Vault now 17.10 / 16.50 / 0.60. Runs A to C and the GhJbwaKG contract check happened
  before it.
- Walrus Memory SDK `listMemories` with a namespace filter returned 0 on 2026-11-07 for both
  sisih-hosted-6 (35 on 2026-11-06) and sisih-hosted-7, while recall returns all 35 and all 4. Docs
  now rely on recall; Sisih's rule rebuild already uses recall.
- The agent's deep link opens a modal drawer that covers the dock: fixed with an inline unlock.

Limitations: the hosted demo now shows sisih-hosted-7 (4 memories, two sessions); the 35-memory run
is sisih-hosted-6 (Walrus, docs/evidence). One configured agent credential, one shared workspace and
one run at a time. Held requests do not expire on their own; they wait for the owner.

### Phase 6: submission documents (2026-11-06, nothing pushed, published or submitted)

- Written: README.md, LICENSE (MIT), docs/BLOG.md (1,199 words), docs/SUBMISSION.md, docs/SOCIAL.md,
  docs/RECORDING.md (evidence before resets, leave the final run in place, voiceover script),
  docs/evidence/sisih-hosted-6/ (public API snapshot of the documented run, taken read-only).
- Facts in the docs come from the Phase 5 run below. Newly checked on 2026-11-06 without any new
  transaction: all 9 cited digests read back through Tatum testnet (8 success, the contract check
  failed with EExceedsFree), all 6 cited blob IDs listed in sisih-hosted-6 by the Walrus Memory SDK
  (35 memories), all doc links answer 200 (relayer root is an API and answers 404 at /), numbers
  match the snapshot.
- Secret scan of the full history (24 commits, 198 paths): no secret value from .env or .env.mainnet,
  no secret pattern, no env, database, dump or key file ever committed; details in docs/HANDOFF.md.
- Fresh clone without .env: install, `pnpm test` (web 18, server 44), `pnpm typecheck`,
  `sui move test` 46/46 pass.
- Missing user inputs and the remaining steps: docs/HANDOFF.md.

### Phase 5: testnet demo finalization (2026-11-06)

Network check (verified on the live deployment, 2026-11-06):

| Integration | Network | Evidence |
| --- | --- | --- |
| Vault + reserves + agent policy | Sui Testnet | /api/state network testnet, vault 0xbfb09999511c994267cc79aa4d28de859004a0ff3b91de30155c8ee205fae962, https://suiscan.xyz/testnet/object/0xbfb09999511c994267cc79aa4d28de859004a0ff3b91de30155c8ee205fae962 |
| Every Sui read and write | Tatum Sui Testnet gRPC | /api/health tatum host sui-testnet-grpc.gateway.tatum.io:443, level green |
| x402 settlement | Sui Testnet | settle digests below, all verified through Tatum testnet |
| Walrus Memory | Walrus Mainnet | /api/health relayer https://relayer.memory.walrus.xyz, status ok; SDK listMemories on Walrus returns 35 for the final namespace |
| Vercel env | testnet only | no variable with MAINNET in the production env; .env.mainnet stays local and unused |

UI: the demo banner reads "Sui Testnet · Walrus Memory Mainnet" on every screen (checked at 1440 and
1280, public and judge mode, no top-bar overflow, no console errors). The Walrus badge keeps
"· Mainnet" except in judge mode, where the "Demo owner (server-signed, testnet)" badge needs the room.

Final demo run (all newly verified on 2026-11-06, hosted, namespace **sisih-hosted-6**):

- Reset: emergency withdraw AAMQquvszSDDievVWFznf58nUte5bTKpXQDCJWPecVDc, seed
  8dQKZDKAAbQ5Lx5d3eU7WQFpmX4mDip3KubfmzoHL1sZ -> 20.00 / 16.50 / 3.50 (20.00 deposited, 16.50 reserved:
  Inference API 6.00, Hosting VPS 5.00, Weekly savings 4.00, Domain renewal 1.50).
- Sessions 1 and 2 through the UI (Playwright, judge path, no wallet): every SPEC balance and decision
  ok, no console errors.
  - DataMart 0.50 auto (default threshold): release 2Ju96fSrg2qk1iJcy41x4LsYTd6cSeSo59Lcu2zVSy3A, x402
    settle EC38SWXoisFLojvYwkuD4xckwHkVTnvG8m2JwkNJvjMC.
  - SearchBox 1.20 held (new merchant) -> Approve & remember: release
    BPQsJKfz6YTwU7kuq1gYi7FfoKiPYLas8jzZ4jh4578f, settle 5SwM31dV71TcmdA9kT1MJfqKD3nveSKo9sAuTecoVvNz; rule
    memory stored, blob pzgbmXXnEEVdL1ApgYfg0zdvc-SOZUWKzLMvzyBGneA ("Always allow search from SearchBox
    up to 1.50 USDC").
  - ReportLab 3.00 held, would cut reserves by 1.20, Approve disabled -> Deny & remember (rule blob
    ZVIl3B9YMpjjsWn3N4OmOc9D8MlAF5jvCihHTM5gZO0). End of session 1: 18.30 / 16.50 / 1.80.
  - Advance cycle: Inference API bill 6.80 against a 6.00 reserve (outcome blob
    UMqAuiVX1Yoxcqc2ebS2PJp8NpObkOEADrw75nV7Ds8) -> suggestion 6.00 -> 7.00 -> owner accepted (demo
    owner) 6DaXxdwoEotRTRzT3Mqio9sMDKL7NCwimDpDQxPa7veL. Start of session 2: 18.00 / 16.00 / 2.00.
  - Session 2: 2 rules rebuilt from Walrus recall; SearchBox 1.20 auto by allow_rule (release
    nYxWRpJk31MyFQYAiQD6ffRiou7c1UrDZgJBKm5o436, settle 5jqPJmRqi4QjayKn1RfhCdoJDeLBv8UuG95pGVAY1UmK);
    ReportLab held, cuts 2.70, "You denied this before". End of session 2: 16.30 / 16.00 / 0.30.
  - Owner deposit 0.10 4Y1aQm3FAnU2uXoU7brY6Q4KwveDY4DGa8SpHnacXJy3, pause
    3ccB4rsFtqkUqwZ4JDPmfTacJdAkSha3FCBQx5DPkYcg, resume AAiZXrAMTEGc57YjMYRGRk9XgSbM4J53TgdNMXhFttk (demo
    owner, all verified).
- Sessions 3 to 5 with `pnpm demo:continue` (one fixed owner rule: approve once if the vault allows
  it, deny if it would cut reserves; nothing tuned):

| Session | Before the session | DataMart 0.50 | SearchBox 1.20 | ReportLab 3.00 | End balance |
| --- | --- | --- | --- | --- | --- |
| 3 | bills 6.40 + 5.00 + 4.00, income 17.00 | auto | auto, allow_rule | held, cuts 2.70 -> deny | 16.30 / 16.00 / 0.30 |
| 4 | bills 7.20 (0.20 short) + 5.00 + 4.00; owner accepted Inference 7.00 -> 7.50 (A1TBFm9nTHgrxzxjuxTGDyTGjsRQ3Ytfi7VNZXAqXB61) | auto | held, cuts 1.10 -> deny | held, cuts 2.90 -> deny | 16.60 / 16.50 / 0.10 |
| 5 | bills 6.90 + 5.00 + 4.00 | auto | held, cuts 0.50 -> deny | held, cuts 2.30 -> deny | 17.20 / 16.50 / 0.70 |

Real outcome, reported as is: manual reviews per session 2, 1, 1, 2, 2. Sessions 4 and 5 rose again
because the owner raised the Inference reserve to 7.50, which left 0.10 to 0.70 free. SearchBox 1.20
would have cut reserves, so the engine held it on the reserve check, which runs before any remembered
rule, while the SearchBox allow rule stayed active (2 active rules rebuilt from Walrus every session).
That is the hard-rules-first design, not a learning failure.

Memory evidence (newly verified 2026-11-06):

- Namespace sisih-hosted-6: **35 stored** memories (0 writing, 0 failed) in the app database, and 35
  returned by the Walrus Memory SDK listMemories from the mainnet relayer. By type: decision 14,
  obligation_outcome 13, session_summary 4, reserve_change 2, rule 2.
- Recall on Walrus mainnet for "SearchBox premium search 1.20 USDC search merchant" (limit 3, 4.6 s):
  distance 0.252 blob jjwBY4VbUj0Q_et-I0XGsLerI-NzNnAjzfnDZc4_0yA (session 1 owner approval), 0.299
  kxqkFTnSNW0u5RY0lK2NL6hUZSNMsyx-C88097mHzyI and D5fHBAaPHl-lMZ10YGWeLPu1cy1UhBAHelD0DNv73lc (sessions 3
  and 2 automatic approvals). Session starts rebuilt the rules from 16, 24 and 31 recalled memories
  (sessions 3, 4, 5).
- Walrus links: https://walruscan.com/mainnet/blob/<blob id> (the Memory screen links every row).

Memory cannot beat hard limits:

- Onchain, newly verified: the operator released 1.20 (the SearchBox amount, allowed by the
  remembered rule up to 1.50) with 0.70 free, bypassing the server: aborted with EExceedsFree,
  https://suiscan.xyz/testnet/tx/3QcakorFNa8YhAaXHdv8wHU39kYXnis4EdJA6mLhRGeM (in the hosted activity feed as
  a contract check). Command: `scripts/gate-release.ts --skip-success --amount=1.20`.
- Live, newly verified: SearchBox held in sessions 4 and 5 with its allow rule active (table above).
- Engine tests ("hard rules come before memory"): an allow rule cannot unlock reserves; paused,
  revoked, expired permission, over the per-request cap and over the daily window are auto-denied
  even with an allow rule.
- Move tests (46/46): release_takes_only_free_never_reserves, release_one_unit_over_free_aborts,
  release_over_per_request_aborts, release_over_daily_window_aborts, release_after_expiry_aborts,
  release_when_paused_aborts, release_after_revoke_aborts, owner_cannot_withdraw_reserves.

UI check of the final state (read-only Playwright walk, hosted): 55 checks ok, no console errors;
Learning impact shows "Data from 5 demo sessions". The one open miss is a selector artifact (the
composition legend shows "Available 0.70" in the screenshot).

Checks: `pnpm test` (web 18, server 44), `pnpm typecheck`, `pnpm build`, `sui move test` 46/46, all
pass. The hosted demo is left in this final 5-session state (namespace sisih-hosted-6) with the
demo-run lease released; docs/RECORDING.md explains the reset to the clean state before recording.

Built: server/scripts/demo-continue.ts (`pnpm demo:continue`), demo-run.ts sends the demo token,
gate-release.ts --amount, docs/RECORDING.md, server vitest hookTimeout 30 s, judge-mode top-bar fit.

### Phase 4: wire the dashboard and host it (2026-11-05 to 2026-11-06)

Gate so far:

| Item | Result | Evidence |
| --- | --- | --- |
| Full demo flow runs from the UI alone, on the public URL | pass (hosted) | https://sisih-azure.vercel.app, 2026-11-06: POST /api/demo/reset in 36.8 s (seed 7UQTp63nx6AZrHWCxAoHEJsgyGkf17fz6Xgovuf9Qu4F, namespace sisih-hosted-2), then the same Playwright UI flow: 35/35 checks ok, no console errors, "PASS: full demo flow ran from the UI alone". S1 DataMart release Dc6thTdAMG2URN2dqDSPoJKcXa9tctSGdCCaSAFskjKa + x402 settle 4DGLZfQyRHjtsD1vxvQsisQMyxNjQRpPVZyGJcJwaHnp; reserve change signed in the browser wallet 7ZMUD96usoJtWWhxzTFNp6PHHamhhgvKvfNVSjvjYsYg (verified, owner-signed); 2 rules rebuilt from Walrus; owner deposit 0.10 Hp3pHU9iYMC2amhf2jrNdBQhyCunsxpjrXnFXvA9YyGt -> 16.40/16.00/0.40; manual reviews S1 2/3, S2 1/3; 13 memories stored |
| Full demo flow runs from the UI alone, no terminal | pass (local combined app) | Playwright drives only the dashboard (dock, drawers, wallet) at 1440x900 against `next start` on 127.0.0.1:3000, after POST /api/demo/reset (seed 3Z2PyNX9WJ5UBw73zWfQg3AuoU72HBBdMdZLDcce5oNd, namespace sisih-local-5). Overview balances 20.00/16.50/3.50 -> 18.30/16.50/1.80 -> 18.00/16.00/2.00 -> 16.30/16.00/0.30, every decision as in SPEC (S2 SearchBox auto by allow_rule, 2 rules rebuilt from Walrus, ReportLab held with "denied before"), 29/29 checks ok |
| Owner transactions from the browser wallet go through the Tatum proxy, digests verified | pass (local) | set_obligation_target DmQ1gwxCRQiz3xyTCAcaftU9ZiuJ1UJsWU8CHbxjc3UG (reserve suggestion 6.00 -> 7.00, recorded as owner-signed); deposit 0.10 CRp8ojnh1w76R8aFuUJnomWkAPTNk9mHacgtPiyiujce (1 wallet signature, built and executed via /api/sui-rpc, verified via Tatum; Overview 16.40/16.00/0.40, no console errors) |
| All 12 UI states visible at /dev/states | pass | committed in ffae9a6 |
| Public URL serves the live testnet stack | pass | https://sisih-azure.vercel.app (Vercel project `sisih`, root web/, iad1; Supabase `sisih-db` iad1). No login wall; /api/health: Tatum testnet green, Walrus relayer ok; demo merchants answer 402 |
| Every SPEC feature checklist item done | pass | checklist table below (hosted walk, 2026-11-06) |

Built (uncommitted, hosting move):

- Hosting moved from Railway (Dockerfile) to one Vercel project: the Hono server (server/src) is
  mounted inside Next.js route handlers (web/src/app/api/[...path], web/src/app/merchants/[...path],
  web/src/server/hosted-api.ts), so /api/* and the demo x402 merchants share one origin.
  maxDuration 300 s for reset / advance-cycle / new-session.
- Database: SQLite -> Postgres via drizzle pg-core. Hosted: DATABASE_URL or POSTGRES_URL (Vercel x
  Supabase integration, transaction pooler 6543) through node-postgres (pg 8.23.1). Local and tests:
  embedded PGlite (DATABASE_URL=pglite:./server/data/pglite, tests use pglite::memory:).
- initDb skips DDL when all 10 schema objects exist (catalog read, no locks).
- Root package.json pins pnpm 11.28.6 (11.13.0 is marked broken on npm; Vercel refused to install it).
- .vercelignore keeps .env*, server/data/ and build output out of CLI uploads.
- Background work (Walrus remember jobs, event inserts, recall) is tracked by lib/background.ts and
  drained with Next's after(), so a serverless function stays alive until it settles.
- Live updates: events are stored in Postgres; the dashboard polls our own GET /api/events?after=<id>
  (1.5 s visible, 10 s hidden) instead of holding an SSE connection. It still never calls Tatum.
- Demo reset names namespaces <MEMWAL_NAMESPACE_PREFIX>-<n> so local and hosted runs never share one
  (local sisih-local, hosted sisih-hosted).
- server/src/demo/bills.json -> bills.ts. New test server/src/lib/bus.test.ts (event feed order,
  bigint as base-unit strings, kv upsert on PGlite, schema check). Server suite 39/39.

Built (judge access and serverless safety, 2026-11-06):

- Guard (server/src/api/guard.ts), shared by every mutating /api/* call and /api/sui-rpc:
  DEMO_TOKEN (fails closed on Vercel when unset), rate limits in Postgres (rate_limits: reset 3 /
  10 min, run-task 10 / min, signing 20 / min, all mutations 30 / min per IP), the demo-run lease
  (leases.demo_run: one visitor's x-demo-client id at a time, extended by each action, freed after
  10 idle minutes or by Lock in the dock; others get 423 demo_busy), and an action mutex
  (leases.demo_action, capped at maxDuration + 30 s) on run-task, advance-cycle, new-session,
  reset, owner-action, decisions, suggestion accept and request submit (409 demo_action_running).
- Demo owner for judges (testnet only): POST /api/demo/owner-action { deposit (up to 1.00) |
  accept_suggestion | pause_agent | resume_agent }, signed with OWNER_PRIVATE_KEY, recorded as tx
  source demo_owner, labeled "Demo owner (server-signed, testnet)" in the top bar, Settings, the
  deposit dialog, toasts, activity labels and the transaction drawer. A connected owner wallet
  still signs through /api/sui-rpc. assertTestnet refuses it on mainnet. Clients can no longer
  claim a source other than owner / import on POST /api/tx.
- Reset leaves the owner a 0.50 testnet USDC deposit float (separate operator transfer, digest in
  the reset result as ownerFloat and in the reset log).
- Memory jobs: reconcile on every poll does one getRememberStatus per stale row (no long waits),
  resubmits rows that never got a job id after 60 s under lease memjob:<id>, and stored / failed
  transitions only leave "writing" (no double publish). maxDuration: /api/* 300 s, /merchants/*
  300 s (was 60), /api/sui-rpc 120 s.
- Docs: CLAUDE.md and BUILD_PLAN.md describe the built stack (Vercel route handlers, node-postgres
  on Supabase, PGlite locally and in tests, polled event feed). Railway Dockerfile and
  .dockerignore deleted.

Hosted runs after these changes (https://sisih-azure.vercel.app, 2026-11-06, Playwright, UI only):

- Judge path (demo token, no wallet): reset sisih-hosted-3 (seed FPwnKkHqgWbAPvPxneA7ngvZU2BJxsR3pnduaSWLR4L8,
  owner float BsXMKHATouaUHgxc3ACcQHJC1F7XrPxqcdBPpGJAhjHq). Top bar shows "Demo owner (server-signed,
  testnet)"; every SPEC balance and decision ok; 0 wallet signatures; source demo_owner for the reserve
  change A9HyChNYNy3tk18fyVcA7QTZFW2d36NS2uRb2rjudZ5Z, deposit 0.10 HmEuzZurjHgU4Y74P51fjwyUr2qgYFyvog1ueWB8tA3f
  (the dialog names the signer), pause FoecrxRCa2U4g1Qv5xYjkzyJv7WPP9PxARuviE2MeacQ and resume
  9b2CWZW3zEyqhs2Won4tKfhronzXXCT5jBgvt4xUyXEw; no console errors; PASS.
- Owner wallet path (unchanged): reset sisih-hosted-4 (seed 2vWu8J8yy37gQsjgPJ3gT3Y5zr75ttwLmEQmJM2QAaru,
  owner float HSGVHeNmN7x4EjYXAUQHtbJ95kcQ9F4RuCuiZv65ZmKP, no manual top-up); 1 wallet signature each,
  source owner: reserve change bpfZA4AvwXAcw5nPFhoRLbxavkx8Q5AgvYjcT4Wcysw, deposit
  8yEhMwvdGPv6hEDDuu1ZxytEqtAQdY3dUUXHwp8LFQrj; PASS.
- Second visitor while a run holds the demo: POST /api/demo/run-task -> 423 demo_busy ("Another visitor
  is running the demo. It frees up within 9 min."); token-check -> busy true. Public POST -> 401.
- Lock hands the demo back: a browser that toggled a rule held the lease (second visitor busy: true);
  after "Lock demo controls" the second visitor was free at once (busy: false).
- Left clean for judges: reset sisih-hosted-5 (seed 2mWgoyjGDEN6L9WvcNkDHKYGerpbaZyDfJohKH3t1rh1, owner
  float FL29EHtXtwNQmEkF9Wed7GtxqvLaykkyyJjFnLNkaQXj), vault 20.00 / 16.50 / 3.50, lease released.

SPEC feature checklist walk (hosted, 1440x900, read-only Playwright walk + screenshots, 2026-11-06):
55 automated checks ok, no console errors. Fixed during the walk: the top-bar session indicator was
hidden below 1600 px (now a compact "S2" with a tooltip), and the live UI had no "memory stored"
toast (now shown on memory.stored with the Walrus link; memory.failed shows an error toast; seen
live: blob CmOs7MfUdYH00F22PkdZ3DoU1E3CKvgw_xAZScEEUf4, 29 s after a rule toggle).

| Area | Item | Status |
| --- | --- | --- |
| Global | Sidebar with 7 screens and a held-request badge | done |
| Global | Top bar: free-funds meter, Sui network, Walrus Memory, Tatum status, session, wallet | done (session fixed) |
| Global | Demo-mode banner | done |
| Global | Right drawer: request, obligation, memory, transaction | done |
| Global | Toasts: pending, success, failed, memory stored | done (memory stored added) |
| Global | Collapsible demo dock | done |
| Overview | Balance card total / committed / free | done |
| Overview | Composition bar per obligation | done (bar + legend per obligation and Available) |
| Overview | Verified via Tatum badge | done |
| Overview | Upcoming commitments, held requests, what changed, stats, recent activity | done |
| Overview | Quick actions: Deposit, Add commitment, Pause agent | done |
| Commitments | 10-column table with reserve progress bars | done |
| Commitments | Add and edit form | done |
| Commitments | Obligation detail drawer | done |
| Commitments | Reserve suggestion card (Accept, Change amount, Reject) | done (accepted in both hosted runs) |
| Commitments | Underfunded banner and remove confirmation | done (underfunded: /dev/states 10; remove confirmation opened and cancelled on the live site) |
| Agent | Agent card with hard limits, Pause, Revoke | done |
| Agent | Request feed with filters | done |
| Agent | Held drawer: reason, balance simulation, recall results, 4 actions | done |
| Agent | Approve disabled when it would cut reserves | done |
| Agent | Rule composer with structured preview | done |
| Agent | Four-step x402 status | done |
| Memory | Stats header; Timeline, Active rules, Last recall tabs | done |
| Memory | Before and after card | done |
| Memory | Memory detail drawer with Walrus link | done |
| Learning impact | Stat cards and 5 charts with source labels | done (5 charts, 5 captions) |
| Onchain activity | Table with Tatum verification, filters, detail drawer | done |
| Settings | Wallet, default policy, hard limits, agents, integrations, demo-mode toggle | done |
| States | All 12 states in the UI states table | done (/dev/states 1-12 match SPEC names) |

Memory kill test (2026-11-06, local `next start` on PGlite, namespace sisih-local-5, process
hard-killed with Stop-Process -Force, then restarted and only GET /api/events polled, as the dashboard does):

| Case | Killed when | After restart | Result |
| --- | --- | --- | --- |
| A: job id saved | 2.8 s after PATCH /api/rules/rule-76ccee54 (disable), row writing with job 237383db-41c9-4a5e-967d-5dd6af6b806b | first poll: one getRememberStatus -> done | mem-5ea6ab38-73a stored, blob N3twFcBduew2sAkFqGdobmsAmV_FQYBhuPwqCriDwLI; events memory.writing -> memory.stored |
| B: no job id yet | right after the PATCH (enable) returned in 45 ms | row writing, jobId null | after the 60 s grace one reconcile resubmitted it (memory.resubmitted, job 2832b052-019d-4604-b049-541f9f922785, +80 s), stored 20 s later, blob tlVlbnfs9THJvSl0FIuYPnlzQtLukkuItVwWFupVacI |

Findings:

- The first hosted deploy hung on every API call (300 s function timeouts, Postgres statement
  timeouts on trivial selects). pg_stat_activity showed pooler backends stuck "active / ClientRead"
  for minutes, one of them a `delete from events` holding a RowExclusiveLock. Three causes, all fixed:
  1. postgres-js with prepare: false sends each parameterized query in two round trips
     (Parse/Describe/Flush, then Bind/Execute/Sync; `describeFirst`). Through Supavisor's transaction
     pooler on Vercel, backends got stuck between the halves. Replaced with node-postgres, which sends
     an unnamed statement in one round trip.
  2. housekeeping() (reconcile memories, prune events) ran untracked, so Vercel could suspend the
     instance mid-query. It now runs through background(), drained by after().
  3. initDb ran CREATE INDEX IF NOT EXISTS on every cold start; it needs a ShareLock on events, queued
     behind the stuck writer, and every later events query queued behind it.
  The session pooler (5432) was tried and rejected: it caps clients at 15 and filled up at once
  (EMAXCONNSESSION). After the fix: 90 sustained requests with 0 non-200, no backends left active.

- After a reset the owner wallet holds 0.00 USDC (all 20.00 is seeded into the vault), so an owner
  Deposit from the UI cannot be built until the owner is topped up. The local run topped it up with
  0.50 from the operator (see Wallets), and so did the hosted run.

### Prep (2026-11-05)

- Dashboard approved: Next.js app with all 7 screens, demo dock, and a local engine
  (web/src/lib/engine.ts, 12 vitest tests passing, typecheck clean). It is a local
  simulation; no chain, Tatum, Walrus or x402 connection yet.
- Spec translated to English in docs/SPEC.md; build plan in docs/BUILD_PLAN.md.
- CLAUDE.md written for Sisih.
- Repo restructured: dashboard in web/ (@sisih/web), brand kit in docs/design/, pnpm
  workspace at the root (web, server). Dependencies pinned to exact versions.
  next.config.ts no longer forces turbopack.root (it broke resolution under pnpm;
  Next.js detects the root from pnpm-lock.yaml). `pnpm test` 12/12, `pnpm typecheck`
  and `pnpm build` pass.
- Plan updates: scripts/recycle.ts moved from Phase 5 to Phase 3 so testnet demo cycles
  reuse funds; Spike C must report whether the x402 library pays from coin objects,
  address balances, or both; the dashboard never polls Tatum (server cache + SSE).

### Phase 0: setup and 3 spikes (2026-11-05)

Gate:

| Item | Result | Evidence |
| --- | --- | --- |
| Workspace build, sui move build | pass | `pnpm build`, `pnpm typecheck` (web + server), `pnpm test` (web 12/12, server 3/3), `sui move build` in contracts/sisih |
| Spike A: tx submitted and read back through Tatum | pass | operator SUI self-transfer 4Ed9Ppsxqw1UPMwxXXdijxU9y9eXafpFaNV4BTdxMY5A, checkpoint 403066573, read back on attempt 2 |
| Spike B: memory stored on Walrus mainnet and recalled | pass | job 1d002dfe-2e7b-41db-a67b-c0cdd3281d61, blob LbofEH99Akbm3-H-yDlMapCQRP5cMENcd94JvDkBidU, namespace sisih-spike, recall distance 0.60 |
| Spike C: 0.01 USDC x402 settles on testnet, digest verified | pass | from agent Coin object: 8G4cQRFVnv4KyMgnjSiVB9NYs9o7QpWfRuZkvMRXFVCv (checkpoint 403067497); from agent address balance: EUwUqwZJpQPrVXph7b8uvC58PcqNoXtn7rkrbqUJ2Tsr (checkpoint 403067648) |
| PROGRESS records x402 path, memwal fields, Tatum issues | pass | sections below |

Built:

- contracts/sisih: empty Move package (`sui move new sisih`), builds.
- server/ (@sisih/server): Hono, tsx, vitest, drizzle-orm, better-sqlite3 (native build
  approved in pnpm-workspace.yaml allowBuilds; protobufjs postinstall denied).
- server/src/lib/tatum.ts: the only Sui path. SuiGrpcClient over native gRPC to Tatum,
  throttleTransport (one call in flight, >= 400 ms, retry 429/UNAVAILABLE/RESOURCE_EXHAUSTED
  with backoff, unit tested), setGas (reference gas price + explicit budget), signAndExecute,
  verifyTransaction (retries NOT_FOUND). server/src/lib/env.ts loads the root .env.
- server/scripts: spike-tatum.ts, spike-memwal.ts, spike-x402.ts, fund-agent.ts
  (testnet plumbing: operator -> agent as `coin` or `address` balance).
- web/: added @mysten/dapp-kit 1.1.17, @tanstack/react-query 5.104.5, @mysten/sui 2.39.0
  (not wired yet; Phase 4). Dashboard untouched otherwise.
- Demo merchant keypairs generated into .env (DataMart, SearchBox, ReportLab). Private
  keys exist only so recycle.ts (Phase 3) can sweep funds back.

x402 path: **the package path works**, no custom flow needed.

- @tentaclepay/sui-x402 2.1.12 + @x402/core 2.12.0 (x402 V2: headers PAYMENT-REQUIRED,
  PAYMENT-SIGNATURE, PAYMENT-RESPONSE; network id `sui:testnet`).
- Pass our Tatum SuiGrpcClient via `createSuiClientRegistry().set("sui:testnet", client)`
  as `clientRegistry` to both the client and facilitator schemes; otherwise the library
  uses fullnode.testnet.sui.io directly.
- Client builds `0x2::balance::send_funds<USDC>(tx.balance({ useGasCoin: false }), payTo)`,
  signs it as sender; the facilitator is gas owner, verifies (structure + simulate),
  co-signs and executes.
- **Coin objects vs address balances: both.** Paid once from a Coin object and once from
  an address balance; both settled. The merchant always receives into its **address
  balance** (coinBalance stays 0), so recycle.ts must sweep with coinWithBalance.
- Testnet USDC is "gasless" in the library (TESTNET_GASLESS_TOKEN_RULES minAmount 0):
  gas price and budget 0, no gas payment. The facilitator's SUI did not change.
  On mainnet USDC is gasless only from 0.01 USDC (minAmount 10000); below that the
  facilitator pays gas. (Moot since 2026-11-06: x402 stays on testnet.)
- Library bug: `settle()` returns `success: true` with an empty `transaction` when
  verify fails. Only accept a payment with a non-empty digest that verifyTransaction confirms.

Walrus Memory fields (what the UI can show):

- remember() -> `{ job_id, status: "running" }`.
- getRememberStatus(job_id) -> `{ job_id, status: pending|running|uploaded|done|failed|not_found, owner, namespace, blob_id?, error? }`.
- waitForRememberJob(job_id) -> `{ id, job_id, blob_id, owner, namespace }` (took 21.4 s).
- recall({ query, limit, namespace }) -> `{ results: [{ blob_id, text, distance, created_at }], total }`.
- Persist per memory in SQLite: job_id, status, blob_id, namespace, created_at. Show in UI:
  type chip, text, status (Writing = pending/running/uploaded, Stored = done, Failed),
  shortened blob_id, namespace, created_at, recall distance in the Last recall tab.
  owner is the MemWal account owner wallet; no need to show it.
- Writes take ~20 s, so the "Writing" chip state is real and must be designed for.

### Phase 3: agent, demo merchants, x402, demo controls (2026-11-05)

Gate:

| Item | Result | Evidence |
| --- | --- | --- |
| `demo-run.ts` passes end to end on testnet, no intervention | pass | scripts/demo-run.ts from reset: every SPEC check ok (balances 20.00/16.50/3.50 -> 18.30/16.50/1.80 -> 18.00/16.00/2.00 -> 16.30/16.00/0.30; requests table identical to SPEC; manual reviews 2 of 3, then 1 of 3); "PASS: demo flow reproduced the SPEC tables end to end" |
| Every x402 settlement has a Tatum-verified digest; 4 steps on SSE | pass | 4 settlements, all `verified`: S1 DataMart HfQMtZ2bnaJUe7Gr9jMxETRxHKdrTmhSwJP1zu839DTV, S1 SearchBox DgPafFFZjfX7unng6R9wSLD4Ga8Xdms5ooihTJyaUK2a, S2 SearchBox CcTeQoP9KkCgnW8YtARbTNpzUM6pUwGeqSjhkM6HjxSu, S2 DataMart 4QzBWqs31wNQFATcByh5SUSXBh1i6SMuS1FQeMHiV3Xk. SSE per paid request: invoice_received -> funds_released (release digest + coin id) -> payment_sent (same coin id) -> settle_verified |
| Advance cycle: Inference API 0.80 short, 7.00 suggestion | pass | pay Inference API 6.80 ELksDfZ4EFEehBS4S7XCWChzZcu9JLxfBLEmCWsSZM5 -> suggestion "Inference API: raise 6.00 to 7.00 USDC. Last cycle was 0.80 short."; owner accepted with set_obligation_target A5Qbw4r3g9LbHn6uoez4jqEPPwzpEzmYr6DPLAq5VEQw (verified; reserve_change memory written) |
| Session 2: SearchBox 1.20 auto-approved by the rule from Walrus | pass | new session rebuilt 2 rules from Walrus (SearchBox allow, ReportLab deny); S2 SearchBox auto_allowed, code allow_rule, paid via release 7a7cxMssER6oiFvo24XDXrVHCVHv5fDoRW4942xAABkv + settle CcTeQoP9... |
| Demo reset: clean vault and new memory namespace | pass | POST /api/demo/reset: emergency withdraw 8TtNicmKRKWVSZnQMhJNnMVwXKeRthEzEaybTZyVBeWn; 6 recycles (payees 6.80 / 5.00 / 4.00 / 1.50, DataMart 0.50, SearchBox 1.20, all verified); owner top-up HEJfQ4GGcASzJsftKw93SU83ePPAmz3iNRzNUaJAr5UR; seed DZuc4Kn48evGF1h1EmY7x76DHFJzwrCNCgLFsaQk5oYT -> vault 20.00/16.50/3.50, agent 0 USDC, namespace sisih-demo-4 with 0 memories, session 1, cycle 1 |

Full demo-run digests (testnet): reset seed DpFFmGGX3eZ6QEYucE8syb2ez3njDTFdzTZQDjqoMFBo;
S1 DataMart release FPvDjmfp6p8sFyoPhvBUfXKU2biVbwDGk6wCPtRDJHnS; S1 SearchBox release
Fn8DHVu8BVLv4GW1gxjVYqkihdJNe8ruu9Lgx9yfMWqr; recycle DataMart ge4dSe7D4XG5SzhVaRpwM5KKRw9x1SV2wePqyM4fQh6,
SearchBox Acf9DfShx9W4a5oaQQSstVSYdguX6ZQ49bcj3cnvc25N; income 17.00 Cx2KhcvhH9kg7zznhrjmnj4jCjYijLRQFeKPnjU6g2iW;
pay Hosting 4JrbunUjpruqWumzzVxy2uVPtyv3FypCDy7KaABLMrwA, Savings GvaPf4gifpCtc1haP46jAkYdCk1QRhDwqBXD7PZMUXW8,
Domain 3mKVS8cA3zjfaFqyBwEsCf5wVkPvVFqJ4tNQXT4UgBM5; fund reserves 43k5spckYd4fLTbmgYrvydDG6TANbsvvZKkMuAGXFnPb;
S2 DataMart release 94K9rwxiNyh7YyoYnzSDjTAm7V9JsaEXYbEMmbGfFqw3. That run wrote 13 memories to namespace
sisih-demo-3 (all stored).

Rule rebuild at scale (scripts/scale-rules.ts, namespace sisih-scale-1793872370015, its own SQLite file):

- Wrote 30 mixed memories to Walrus mainnet in bulk (decision 14, obligation_outcome 6,
  session_summary 3, reserve_change 2, merchant_note 1, rule 3, rule_disabled 1): 30/30 stored in 125.8 s.
- Wiped the cache, ran start_session: exactly the expected rules came back (SearchBox allow active,
  ReportLab deny active, DataMart allow disabled), origin walrus; broad recall 30 of 30; 4076 ms.
- With an explicit limit of 10: broad recall returned **0 of the 4** rule memories, while each tag
  query (`[sisih:v1:rule]`, `[sisih:v1:rule_disabled]`) returned all 4 in its top 10. Plain recall
  cannot guarantee rules once a namespace outgrows the limit, so loadRules always runs the two tag
  queries (limit 100, set explicitly) next to the broad recall and merges results by blob id.

Built:

- src/x402/: facilitator (Tatum clientRegistry, gas owner), merchants (demo routes answer 402, then
  verify + settle, and record the settle digest through Tatum), agentPay (fetchInvoice, payInvoice;
  refuses any payload that does not spend exactly the released coin, or that draws from the agent
  address balance).
- services/payments.ts: x402PaymentExecutor (now the default) = invoice check against the merchant
  registry -> releaseToAgent -> coin id from effects -> payInvoice -> settlement verified; digests on
  the request (payment_status paid | failed). SSE x402.* steps.
- src/agent/runner.ts: scenarios cheap_data, new_merchant_search, expensive_report.
- src/demo/: owner.ts (seed, emergency withdraw, set target; owner key = demo plumbing), recycle.ts
  (sponsored gasless USDC sweeps, operator top-ups, waitForBalance), controls.ts (clock,
  advanceCycle, resetDemo), bills.ts (cycle 1 Inference API 6.80).
- API: POST /api/demo/run-task | advance-cycle | new-session | reset, GET /api/demo/clock; merchant
  routes /merchants/datamart/token-history, /merchants/searchbox/premium-search,
  /merchants/reportlab/onchain-report.
- Scripts: recycle.ts, demo-run.ts, scale-rules.ts; seed-vault.ts now uses src/demo/owner.ts.

Findings:

- Gasless sponsored transfers sweep holders that have no SUI: sender = holder, gas owner = operator,
  `setGasPayment([])`, built with the client, signed by both. Same shape as the x402 facilitator.
  Used for every recycle.
- Read-after-write lag also hits balances. Right after a transfer, getBalance (served by a lagging
  node) can still show the old total while listCoins already sees the new coin, and coinWithBalance
  throws "Insufficient balance ... Required 20000000, Available 20000000". waitForBalance() polls
  before seeding and before depositing income.
- seedVault revokes an existing agent policy before setting it, so every reset starts a fresh 24 h
  window (set_agent_policy keeps the window for the same agent by design).
- Demo reset uses OWNER_PRIVATE_KEY inside the server (testnet only, assertTestnet). On mainnet the
  reset path is refused; owner actions there come from the browser wallet or scripts.
- Obligation ids keep increasing across resets (next_obligation_id). The UI must use ids from the
  API and never hardcode them. After the latest reset they are 12..15.

### Phase 2: server core (2026-11-05)

Gate:

| Item | Result | Evidence |
| --- | --- | --- |
| Policy engine unit tests pass for the 6 SPEC requests | pass | server/src/policy/engine.test.ts replays session 1 (20.00/16.50/3.50) and session 2 (18.00/16.00/2.00) from SPEC fixtures: auto / held new merchant / held cut 1.20 / auto by rule / auto / held cut 2.70 + "denied before". Server suite 29/29 |
| `GET /api/state` equals the chain, read through Tatum | pass | scripts/gate-state.ts: 20/20 fields equal an independent Tatum getObject (free 3.00, committed 16.50, every obligation, policy). Explorer: https://suiscan.xyz/testnet/object/0xbfb09999511c994267cc79aa4d28de859004a0ff3b91de30155c8ee205fae962 |
| "Approve & remember" writes to Walrus mainnet, writing -> stored on SSE | pass | SearchBox 1.20 held (new merchant) -> approve_and_remember. SSE: memory.writing then memory.stored for the rule (blob pLRApww36bxb5gbirEcHCWjfYEpaKOor5g9hsCgbPvY, job ac57ac1f-a79e-4274-b4ac-0dffaf73323c, 22.5 s) and the decision (blob sM6oQbKKuUWmSgUmVsnOMEgGgRutf9qGYfovec4RtEw, 24.5 s) |
| Restart + new session rebuilds rules from Walrus recall | pass | server stopped, rules_cache wiped, restarted (0 rules), POST /api/sessions -> 1 rule loaded, origin `walrus`, source blob pLRApww3..., recall 2 of 2 namespace memories in 2.9 s. A new SearchBox 1.20 request in session 2 was auto_allowed by rule-0677970a |
| `GET /api/activity` shows vault events with Tatum verification | pass | scripts/gate-activity.ts imported 6 digests via POST /api/tx; 11 rows (deposit, 4 reserves, policy, vault created, publish, release 0.50 verified, release 5.00 failed with EExceedsFree, x402 settle). Each digest cost exactly 2 Tatum calls: 1 GetTransaction + 1 BatchGetObjects |

Measurements:

- Recall latency (Walrus mainnet, recall limit 5): 1769 ms on an empty namespace,
  1436 ms with 2 memories. Session-start rule rebuild (recall limit 100 + listMemories):
  2915 ms. Remember jobs: 22.5 s and 24.5 s to stored.
- Decisions are made before recall returns: the held SearchBox response came back with
  `recall.pending: true`; recall landed later as SSE request.recall.
- Tatum: server boot = 1 call (vault getObject). Recording a transaction = 2 calls.
  The API serves everything else from SQLite and the cached VaultState.

Built (server/src):

- policy/engine.ts (pure decide + shared hardLimit used as the pre-send check),
  composer.ts (rule draft + sentence, max rounded up to 0.50, 30-day expiry),
  suggestions.ts (bill rounded up to 0.50, raised by past bills).
- chain/vault.ts: parseVault, cached readVault, recordTx (GetTransaction effects+events,
  then 1 vault read), operator writes releaseToAgent / payObligation / fundReserves /
  depositIncome (pre-check from cache -> SDK dry-run -> execute -> recordTx; dry-run aborts
  return a readable reason via vaultAbortName and spend no gas). chain/activity.ts maps
  tx_log events to feed rows with explorer links.
- memory/format.ts (`[sisih:v1:<type>] sentence {json}`), memory/memwal.ts (remember as
  tracked background job + retry + waitForPendingMemories, timed recall, loadRules with
  listMemories cross-check, cached health).
- services: state (sessions, rules cache, settings, known merchants), requests (submit,
  owner decisions, rule draft, parallel recall), sessions (start_session), chainEvents
  (obligation_outcome + suggestions, accept via owner digest, reject), insights, payments
  (PaymentExecutor; Phase 2 stub sets payment_status=stub).
- db: drizzle schema + startup DDL; DATABASE_URL default file:./server/data/sisih.db.
- api/app.ts: every endpoint in the build plan plus POST /api/requests, POST /api/tx,
  GET /api/requests/:id/rule-draft, POST /api/state/refresh, POST /api/memories/:id/retry,
  GET /api/sessions; SSE at /api/events with Last-Event-ID replay and 15 s pings.
- Scripts: gate-state.ts, gate-activity.ts. Walrus links use https://walruscan.com/mainnet/blob/<blobId>.

Live state after the gate: session 2, 1 rule (SearchBox <= 1.50) in namespace sisih-demo-1,
4 memories stored, 2 requests (both with payment_status=stub: no funds moved).

### Phase 1: Move vault (2026-11-05)

Gate:

| Item | Result | Evidence |
| --- | --- | --- |
| `sui move test` passes, incl. agent cannot touch reserves | pass | 46/46, no warnings (contracts/sisih/tests/vault_tests.move) |
| Package and vault published on testnet through Tatum, IDs in .env | pass | publish E1yi2YGwQKvptBFmpJ6JXgJzChKfnwFeZB7YnomnXSax (checkpoint 403085774); create_vault BPpnht7M5SKmzETvfYH11FhqkBCUsQqVxe7oZPEZPuDL (checkpoint 403085788) |
| Seed: total 20.00, committed 16.50, free 3.50, read through Tatum | pass | seed 6CGR8T7aEwX8kRQz39XpyV7dEh8rCqjTpNjaqQmW9tma (checkpoint 403085839, 6 events); show-vault.ts printed 20.00 / 16.50 / 3.50 |
| release_to_agent 0.50 succeeds | pass | BdvJPeHs5a9W9fHALBwHNVxtNbiSz4kxbhpmMCefWTPs; agent USDC 0.00 -> 0.50, vault free 3.50 -> 3.00 |
| release_to_agent 5.00 fails (exceeds free funds) | pass | BQyCnzJuPWTxm5YijiSJkYduCQycqX7ex3XtDrxQiJ1w executed and failed on-chain (checkpoint 403086321) with MoveAbort EExceedsFree; reserves still 16.50 |

Deployed (testnet):

| Item | ID |
| --- | --- |
| Package (SISIH_PACKAGE_ID) | 0x37a5513a911110d00b9c795390d1af5b04a3873e6df4856b54ede7e74ba886e9 |
| Vault<USDC> (VAULT_ID, shared) | 0xbfb09999511c994267cc79aa4d28de859004a0ff3b91de30155c8ee205fae962 |
| OperatorCap (OPERATOR_CAP_ID, held by operator) | 0xd6c6f6fa29a22c63ae566ee30ecccc160bb81809146d441a2c2605744723b5db |
| UpgradeCap (UPGRADE_CAP_ID, held by owner) | in .env |

Demo payees (keys in .env as PAYEE_*_PRIVATE_KEY, demo plumbing for recycle.ts):
Inference API 0x15492a0729e0de31320da8222c253f271d5c8f7e1e8b849aa264618f0e03d5d9,
Hosting VPS 0x02b29ca85082502220a83acba4f281a35abf139d556a294522fc34e29c9c4907,
Weekly savings 0xff7f2256fd0bb2fc3787eafa8e3890702cd264af2a1546010333953d4e06c2c5,
Domain renewal 0xa0ae37a8edb10656b3a8e9db4d4749c7e1fe5f4b2b273b8a0aad22703f59c5d9.
All four obligations first due 2026-11-05T09:07:29Z (one demo cycle after seeding);
agent policy 5.00 / request, 10.00 / day, expires 2026-12-05.

Contract (approved struct list, plus `name` in ObligationPaid and ObligationRemoved):
- contracts/sisih/sources/vault.move. Every mutating entry point checks `version`;
  release_to_agent splits only from `free` and never borrows `obligations`.
- Vault pays payees, agent and owner as Coin objects. Errors have stable codes
  (#[error(code = N)]), mapped in server/src/chain/sisih.ts (VAULT_ERRORS, vaultAbortName).
- Recurring obligations skip missed cycles on late payment; one-time ones are removed
  after payment and the event keeps their name.

Scripts (server/scripts): publish.ts (refuses to republish without --force), seed-vault.ts,
show-vault.ts (`--raw` dumps the Vault JSON), gate-release.ts (`--skip-success` runs only
the failing case). Gas: publish 0.0766 SUI, create_vault 0.0048 SUI.

Findings for Phase 2+:
- The SDK simulates every transaction while building it and **throws** on a Move abort
  (`SimulationError: Transaction resolution failed: MoveAbort ... 'EExceedsFree'`), so a
  doomed transaction never reaches the chain. That is the right default for the server:
  catch SimulationError, map it with vaultAbortName, and report it as a refusal without
  spending gas. Only build fully resolved transactions (explicit object refs + gas payment)
  when on-chain failure evidence is wanted, as gate-release.ts does.
- Faucet SUI also sits in address balances (the operator has no SUI coin object big enough
  for gas). Gas from an address balance works with `setGasPayment([])` plus a
  `ValidDuring` expiration (chain id + current epoch); the normal build path handles this
  automatically.
- Clever-error abort codes: 0xT_CCC_LLLL_IIII, code in bits 48-59, line in bits 16-31.
  Testnet sample 13836185948054749199 = code 4 (EExceedsFree), line 464. Unit tested.
- Vault JSON from gRPC getObject: `free` and `reserve` are Balance JSON, obligations are
  `obligations.contents[{ key, value }]`, agent_policy is an Option. See show-vault.ts.

## Notes for Phase 4 (recorded in Phase 3)

- Accepting a reserve suggestion: the browser wallet signs set_obligation_target(id, suggestedTarget)
  and posts the digest to POST /api/suggestions/:id/accept (demo-run.ts does exactly this with the
  owner key). Any other owner-signed transaction goes to POST /api/tx.
- Demo dock -> POST /api/demo/run-task { scenario }, /advance-cycle (returns secondsToNextDue when
  nothing is due), /new-session (blocks while pending memories finish, about 25 s), /reset (2-3 min),
  GET /api/demo/clock. Show progress from SSE demo.* events.
- x402 stepper: SSE x402.invoice_received, x402.funds_released, x402.payment_sent,
  x402.settle_verified, x402.failed (all carry the request id).
- Only one server process per DATABASE_URL. Scripts that need the DB use their own file
  (scale-rules.ts uses server/data/scale-test.db).

## Notes for Phase 3 (recorded in Phase 2)

- Reset must sweep the agent to 0 USDC (it holds 0.50 from the Phase 1 gate release).
- The agent must pay with the exact coin from release_to_agent. The x402 client builds
  `tx.balance({ useGasCoin: false })`, which may draw from any coin or the address balance;
  either keep the agent at 0 between payments or build send_funds from that exact coin.
- Replace stubPaymentExecutor (services/payments.ts) via setPaymentExecutor: releaseToAgent
  -> x402 pay -> recordTx of both digests (request_id links them) -> payment_status paid/failed.
- Call onVaultEvents(rec) after payObligation so the 6.80 Inference bill creates the 7.00
  suggestion (it already runs for digests posted to POST /api/tx).
- The server must run with only one process per DATABASE_URL.

## Notes for Phase 2 (recorded at the start of Phase 1)

- The activity feed is built from our own tx_log of digests plus the events of each
  transaction, read through Tatum with gRPC `GetTransaction` + `include: { events: true }`
  (`ListEvents` is blocked). Every owner-signed transaction from the browser must post its
  digest to the server, or it never appears in the feed.
- Rules created in a session apply immediately from the local cache. `start_session` waits
  for all pending remember jobs (about 21 s each) to finish before it reloads rules from
  Walrus recall, so a rule written seconds earlier is not lost.
- Payees and merchants may hold funds as coin objects or address balances. Always read
  `getBalance().balance` (coins + address balance) and sweep with `coinWithBalance`.
- The vault pays payees, the agent and the owner as Coin objects (testable with
  test_scenario); x402 merchants receive into address balances.

## Decisions

- Product name is **Sisih** (spec was drafted as BillFirst). Move module `sisih::vault`,
  package dir `contracts/sisih`, memory tag `[sisih:v1:<type>]`, env `SISIH_PACKAGE_ID`.
- Everything in English (international hackathon).
- The existing dashboard lives in web/ and gets wired to the API in Phase 4 instead of
  being rebuilt from mockups.
- Added to the plan: hosted public deployment at the end of Phase 4; user conversation
  log in docs/USER_LOG.md; no placeholder links in the README.

## Tatum findings (2026-11-05)

- Testnet and mainnet API keys are in .env and accepted (response header
  `x-ttm-plan: free;ratelimit=3;strategy=shared`).
- JSON-RPC at https://sui-{testnet,mainnet}.gateway.tatum.io returns 404 on every path,
  with or without a key. Sui deprecated JSON-RPC.
- gRPC at https://sui-{testnet,mainnet}-grpc.gateway.tatum.io works:
  `sui.rpc.v2.LedgerService/GetServiceInfo` returned chain `testnet` (sui-node 1.83.1) and
  `mainnet` (sui-node 1.82.4).
- Working client (verified): @mysten/sui 2.39.0 `SuiGrpcClient` with
  `transport: new GrpcTransport({ host: "sui-testnet-grpc.gateway.tatum.io:443",
  channelCredentials: ChannelCredentials.createSsl(), meta: { "x-api-key": key } })`
  from @protobuf-ts/grpc-transport + @grpc/grpc-js. getChainIdentifier and getBalance work.
- The default gRPC-web fetch transport fails ("unexpected response content type:
  application/grpc", then "missing status"): Tatum replies with native gRPC framing and no
  trailers over HTTP/1.1. So the browser cannot talk gRPC-web to Tatum directly; the
  Next.js /api/sui-rpc route must call Tatum server side with the native transport.
- Faucet USDC lands in Sui **address balances** (getBalance: coinBalance 0,
  addressBalance 2000000), so listCoins returns nothing. Build payments and vault
  deposits with `coinWithBalance({ type, balance })` from @mysten/sui/transactions, which
  draws from the address balance; never assume coin objects exist.
- Rate limit is real: coinWithBalance + execute hits 429 without throttling. A wrapper
  on the transport's unary() (one call in flight, >= 400 ms apart, retry 429/UNAVAILABLE
  with backoff) made all three sweep transactions pass. Build lib/tatum.ts the same way.
- Read-after-write lag: GetTransaction right after ExecuteTransaction returned NOT_FOUND
  (Tatum routes to nodes that may lag); a retry 2 s later succeeded. Verification in
  lib/tatum.ts must retry NOT_FOUND a few times before marking a digest failed.
- No event queries: Tatum rejects `LedgerService/ListEvents` with PERMISSION_DENIED
  "gRPC method not allowed" (verified 2026-11-05; a burst first showed up as 429).
  Activity is built from digests we record in tx_log, each read back with GetTransaction
  (include events). PERMISSION_DENIED is not retried.
- A failed gRPC call also rejects its headers/status/trailers promises; the throttle
  wrapper marks them handled, otherwise Node exits on an unhandled rejection before the
  NOT_FOUND retry runs. Covered by server/src/lib/tatum.test.ts.

## Walrus Memory (mainnet, set up 2026-11-05)

- Relayer https://relayer.memory.walrus.xyz, /config: package
  0xe7c16fbea0560e7057e2bf7422feaa4fb313749fc69c9e9092fac7a33b81d7f5, registry
  0x8bf82c9e09e36b8d1c38298f68b7cb68e7b8762887e7592add9986d5e9cf199f.
- Account owner wallet (user's own, separate from the 4 project wallets):
  0xd89f04e5fd0c4d46c506ee7641d99d47b866517db0308c53706ec1c7deb5ae32.
- MEMWAL_ACCOUNT_ID = 0xc6408ac06d2e4ba3c4df92a47646cc7e4051ebdf20765a7ae63f572d2d8523ba (in .env).
- The account already had one delegate key ("Web App", pubkey 3e7479…4700). The value first
  given as MEMWAL_KEY was that public key, not a private key, so a new delegate key was
  generated locally and registered with a sponsored add_delegate_key, label "Sisih server",
  tx DxQTmMGkm7BTu3pQXDqx5aaAnwHWSLBxLf2oUYCXo8Wf. Its private key is MEMWAL_KEY in .env.
- MEMWAL_AGENT_ID for the submission form (public key of the "Sisih server" key):
  2bd5ef9fe819eb9fc39de0b6d37b341ec8cf9dc091f82bdea74b5560c785e3b3.
- Authenticated listNamespaces works. Spike B wrote 1 memory to namespace sisih-spike; the demo namespace sisih-demo-1 is still empty.
- Transactions on the account need no SUI: the relayer sponsors gas
  (sign personal message -> POST /sponsor -> sign tx -> POST /sponsor/execute).

## Wallets (testnet, generated 2026-11-05)

Private keys are only in .env (gitignored). Balances read through Tatum gRPC on 2026-11-05:

| Role | SUI | USDC |
| --- | --- | --- |
| owner | 0.9181 | 0.00 (20.00 deposited into the vault) |
| operator | 0.9864 | 19.98 |
| agent | 0.4977 | 0.50 (from the gate release) |
| facilitator | 0.9977 | 0.00 |
| DataMart (demo) | 0 | 0.02 (address balance, from Spike C) |

USDC sweep to owner (testnet, through Tatum): operator 4f2M4VGZnbHwLBAbA4cPUrZEe5AjqJw1GPPf7d9RbEtE,
agent FnrQ4bRp7F7bRRJMkhQXFcuahzFDKKiSd6rGZzRowGpe, facilitator 6g8tr7bErvyGdZb3bMDGMWHkeDSSDzjtB9rkcHqj1Mud.
Operator funded from the Circle faucet (20.00), then sent the agent 0.01 USDC as a Coin
object (coinWithBalance + transferObjects): tx aHKicFhFqP6r88fkgALZreqfR7Pj8XRyTPY2hCJ58io,
verified through Tatum. Agent coin 0xeb20712f2afc79dd7093ad883b949aea2147108c4dbe3075c236ad5b9a1ba922
(coinBalance 10000, addressBalance 0). Balances now: owner 20.00, operator 19.99, agent 0.01,
facilitator 0.00 USDC.
Phase 0: operator -> agent 0.01 into the agent's address balance
(Aff8dr5wAT85dpDj2qbiy77srUmGhBahLS77aB9geo9g) for the second Spike C run.
Phase 4 (2026-11-06): operator -> owner 0.50 USDC as a Coin object for the browser-wallet deposit
test (HfaxE2pKxmXpAgxgFr5mxhvrhenTZRuWwZRKUstBEj7e). Balances before it: owner 0.00, operator 4.70,
agent 0.00, facilitator 0.00 USDC.
Phase 4 (2026-11-06, hosted run): operator -> owner 0.50 USDC after the hosted reset
(45Jop8go3LnRvc2qnAjHzquoVQzF1c5j3bznTdHi8xGR). Before it: owner 0.00, operator 20.00 USDC.

| Role | Address |
| --- | --- |
| owner | 0x85fe8337bd6329f10d291923b12ca641589eadba04bd5974a34f9bb65ac9ea70 |
| operator | 0xb72b7b13863cd53c3b5b2f021ce86875d15038a9a5620c2257c304c07f49e2de |
| agent | 0x0922682e5841dcf01b2fc25d3b2fda2e7532ab85f022a1a15b4406b49a5359ba |
| facilitator | 0xb9d27e53ee9856dc7e15a57e7c119fadd3ea1b939664591ce0279c5e352079f6 |
| DataMart (demo) | 0xc121cd758d3437bd426a77f6b83d88c39c38c67de719a8d686b69bb49d960065 |
| SearchBox (demo) | 0xfa2c4aa7f28b0eaef1185c25b3351a4b87a134d10178692083682bdf3b85b808 |
| ReportLab (demo) | 0x5fbfeab33761c7094a42325ee3373ab8f171a3b8e90576779aa1006ff75614a1 |

## Open issues

- pnpm 11 enforces a minimum release age. @tanstack/react-query 5.106.0 (1 day old) was
  rejected; the lockfile was pinned to 5.104.5 (2026-10-19) instead of adding an
  exclusion. Re-check this if pnpm complains about lockfile entries.
- Hosting: Vercel (project `sisih`, root web/) + Supabase Postgres `sisih-db` (iad1) through the
  Vercel Marketplace, provisioned and connected 2026-11-06 (POSTGRES_URL set by the integration).
  Live at https://sisih-azure.vercel.app; deployed with `vercel deploy --prod` from the working tree.
- The demo-run lease is per browser tab. A judge who closes the tab without "Lock demo controls"
  holds the demo for up to 10 idle minutes; the next visitor sees "Another visitor is running the
  demo" with the wait time. Test scripts must click Lock at the end (toast.mjs did not, 2026-11-06).
- Demo owner signing covers these whitelisted owner operations: deposit, reserve suggestions,
  pause, resume, revoke, reserve targets, add commitment, and limits (2026-11-07). Withdraw and
  removing or editing commitments still need the owner wallet.
- Learning impact over the 5 real sessions does not trend down (manual reviews 2, 1, 1, 2, 2): the
  sessions 4 and 5 holds come from low free funds after a reserve raise, not from memory. Phase 6
  docs must describe this as it is.
- The hosted demo is in the final state of `sisih-hosted-9`: session 2, 1.60 free, ChainScope
  preference active. Recording from a clean state needs `pnpm sisih demo reset --yes`
  (docs/RECORDING.md); that starts a new namespace. The hosted-6, hosted-7 and hosted-9 evidence
  stays on Sui Testnet, on Walrus Mainnet and in docs/evidence.
- The SDK's namespace-filtered `listMemories` has returned 0 since 2026-11-07. Verification uses
  per-job status plus the unfiltered listing (server/scripts/verify-memories.ts).

## Env vars

See CLAUDE.md and .env.example. New in Phase 0:
- MERCHANT_DATAMART_PRIVATE_KEY, MERCHANT_SEARCHBOX_PRIVATE_KEY, MERCHANT_REPORTLAB_PRIVATE_KEY
  (demo plumbing for recycle.ts).
- Optional: TATUM_MIN_INTERVAL_MS (default 400), SPIKE_MEMWAL_NAMESPACE (default sisih-spike).
New in Phase 1: OPERATOR_CAP_ID, UPGRADE_CAP_ID (written by publish.ts);
PAYEE_INFERENCE_PRIVATE_KEY, PAYEE_HOSTING_PRIVATE_KEY, PAYEE_SAVINGS_PRIVATE_KEY,
PAYEE_DOMAIN_PRIVATE_KEY (written by seed-vault.ts).
New in Phase 2 (optional): PORT (default 8787), HOST (default 127.0.0.1).
New in Phase 3 (optional): PUBLIC_BASE_URL (merchant URLs the agent calls; default http://127.0.0.1:PORT).
New in Phase 4: DEMO_TOKEN (unlocks the demo dock), WEB_ORIGIN (CORS), MEMWAL_NAMESPACE_PREFIX;
DATABASE_URL is now pglite:... locally or a Postgres URL hosted (POSTGRES_URL from the Supabase
integration also works); NEXT_PUBLIC_SUI_NETWORK, NEXT_PUBLIC_DEV_STATES (web).
New in the MCP milestone: SISIH_AGENT_TOKEN (agent credential, Vercel env only).
New in the terminal-first milestone:
- MERCHANT_CHAINSCOPE_ADDRESS, MERCHANT_CHAINSCOPE_PRIVATE_KEY (local .env and Vercel production).
- SISIH_URL, SISIH_OWNER_TOKEN, SISIH_CLIENT_ID (owner CLI, the owner's shell only).

## Later

- (nothing parked yet)
