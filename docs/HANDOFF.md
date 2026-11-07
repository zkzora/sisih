# Handoff

## Network decision (2026-11-06, replaces the mainnet migration)

| Integration | Network | Endpoint |
| --- | --- | --- |
| Move vault (reserves, caps, permission), agent releases, bill payments | **Sui Testnet** | package `0x37a5513a911110d00b9c795390d1af5b04a3873e6df4856b54ede7e74ba886e9`, vault `0xbfb09999511c994267cc79aa4d28de859004a0ff3b91de30155c8ee205fae962` |
| x402 settlement (demo merchants, facilitator) | **Sui Testnet** | network id `sui:testnet`, testnet USDC |
| Every Sui read and write | **Tatum Sui Testnet gRPC** | `sui-testnet-grpc.gateway.tatum.io:443` |
| Walrus Memory (decisions, rules, outcomes, summaries) | **Walrus Mainnet** | relayer `https://relayer.memory.walrus.xyz`, server-side delegate key |

Basis: the hackathon rules (https://thewalrussessions.wal.app/tatum-total-recall and
https://recall-tatum-walrus.vercel.app/) require Walrus Memory writing on Mainnet, at least 10 memories
on Mainnet, Tatum RPC for onchain data where relevant, a published blog post, a working demo, a public
repo and a 2 to 3 minute video. Neither page names a Sui network; the Best Use of Agent Payments bonus
says "settled on Sui". No eligibility or bonus is claimed beyond that text.

The judge never switches wallet networks for memory: the server writes Walrus Memory with its own
delegate key.

## Cancelled: mainnet funding and migration (historical, do not act on it)

The earlier Phase 5 plan moved the vault and x402 to Sui mainnet and asked for 23.50 USDC + 1.50 SUI
on the mainnet owner address. **Cancelled on 2026-11-06. Do not send mainnet funds.** No mainnet
transaction, deployment or funding was made. The fresh mainnet keys generated for it are kept,
unused, in `.env.mainnet` (gitignored, never on Vercel). A 20.00 USDC transfer to that owner
address landed on testnet and is untouched.

## Status

The agent-first, terminal-first milestone is done (2026-11-07). Nothing has been pushed, published
or submitted.

- Claude Code buys over MCP with its own credential.
- The owner works from the terminal with `pnpm sisih`.
- The dashboard is the optional workspace.

The final run is `sisih-hosted-9`: docs/evidence/final-run-sisih-hosted-9 and docs/PROGRESS.md.

## Done (Phase 6 prep, 2026-11-06)

| Deliverable | File |
| --- | --- |
| Root README: target user and problem, live demo link, Mermaid flow, hard vs soft rules, networks, Tatum / Walrus / x402 code paths, evidence with links, demo boundaries, fresh-clone setup | README.md |
| MIT license (copyright line "zkzora", the git author; change it if you want another name) | LICENSE |
| Blog draft, 1,199 words, reviews per session reported as 2, 1, 1, 2, 2 | docs/BLOG.md |
| Form answers per field, mandatory vs bonus, private judge-access text | docs/SUBMISSION.md |
| X thread draft, 3 posts within 280 characters, no dashes, only existing links | docs/SOCIAL.md |
| Recording guide: keep evidence before a reset, leave the run in place after, voiceover script | docs/RECORDING.md |
| Public API snapshot of the documented run (namespace sisih-hosted-6) | docs/evidence/sisih-hosted-6/ |

Checks:

- Secret scan of the full Git history (24 commits, all refs, 198 paths ever committed): every secret
  value in `.env` and `.env.mainnet` (Tatum keys, all private keys, MEMWAL_KEY, DEMO_TOKEN) searched
  as an exact string: none found. Patterns (Sui private keys, PEM keys, Postgres URLs with a password,
  GitHub / Slack / AWS / sk- tokens): none. No `.env`, database, dump or key file was ever committed;
  only `.env.example` is tracked. The one archive (docs/design/sisih-brand/sisih-brand-kit.zip) holds
  brand files only. Positive control: the scan finds the public vault and package IDs, so it works.
  No dedicated scanner (gitleaks, trufflehog) is installed; this was a scripted scan.
- Ignored and never tracked: `.env`, `.env.mainnet`, `.vercel/`, `server/data/` (PGlite),
  `contracts/sisih/build/`.
- Links in README, blog, submission, X draft, recording and web README: all pages answer 200. The
  relayer base URL answers 404 at its root (it is an API, linked as an endpoint, not a page).
  Suiscan answers 200 for any path, so every cited digest was also read back through Tatum testnet:
  9 of 9 exist, 8 succeeded and the contract check failed with EExceedsFree as documented. All 6
  cited blob IDs were listed in sisih-hosted-6 by the Walrus Memory SDK on mainnet (35 memories) on
  2026-11-06. On 2026-11-07 the namespace-filtered listing returned 0, so all 35 were verified again,
  one by one, through their relayer jobs (35 of 35 done with matching blob ids, and 35 in the
  unfiltered account listing: docs/evidence/sisih-hosted-6/verify-memories-2026-11-07.txt).
- Every number in the docs matches the snapshot: manual reviews 2, 1, 1, 2, 2; 35 memories stored
  (decision 14, obligation_outcome 13, session_summary 4, reserve_change 2, rule 2); money protected
  13.40.
- Fresh clone (no .env): `pnpm install --frozen-lockfile`, `pnpm test` (web 18, server 44),
  `pnpm typecheck`, `sui move test` 46/46 all pass. `corepack enable` needs admin rights on Windows
  (README says so).

Public but personal: docs/PROGRESS.md names your own Walrus Memory account owner wallet
(0xd89f…ae32). It is not a secret; remove it before publishing if you prefer.

## Terminal-first milestone (2026-11-07)

What changed:

- **Owner CLI.** `pnpm sisih` covers status, commitments, requests, preferences, limits, reserves,
  approve and deny (optionally remembered), pause, resume, revoke, session next, evidence and
  release. Reset, cycle and deposit are in a labeled demo group.
- **Agent results.** Held results carry `owner_cli`. Blocks carry `owner_hint`. Settled results
  carry receipts and memory evidence.
- **ChainScope.** It returns live Sui Testnet data read through Tatum. The other merchants return
  labeled fixed examples.
- **Sisih skill.** Served at `/skills/sisih/SKILL.md`.
- **Website.** Connect your agent, Explore a recorded run and Open workspace are the entry points.
- **gate-release.ts.** It no longer runs a release on `--help`.

Evidence: docs/evidence/final-run-sisih-hosted-9/README.md. It holds the seven real Claude Code
runs, the owner CLI log, and 12 of 12 memories verified per job.

The hosted demo is left in session 2 of `sisih-hosted-9`:

- The vault holds 17.60 total, 16.00 committed and 1.60 free.
- The ChainScope preference is active, and the lease is released.
- A judge's agent can buy ChainScope at once through the remembered preference, without a reset.

### Try it yourself (PowerShell)

The README's quickstart has the full commands. In short:

1. **Owner terminal.** In the repo, after `pnpm install`:
   - `$env:SISIH_URL = "https://sisih-azure.vercel.app"`
   - `$env:SISIH_OWNER_TOKEN = "<demo token>"`
   - `pnpm sisih status`
2. **Agent credential.** On https://sisih-azure.vercel.app/connect, unlock Demo controls with the
   demo token and reveal the agent credential.
3. **Agent folder.** Use a new, empty folder.
   - Download the skill to `.claude/skills/sisih/SKILL.md` and write `.mcp.json`. The README writes
     it without a BOM.
   - `Remove-Item Env:SISIH_OWNER_TOKEN, Env:DEMO_TOKEN -ErrorAction SilentlyContinue`
   - `$env:SISIH_AGENT_TOKEN = "<agent credential>"`
   - Start `claude` with the README's `$sisih` flags.
4. **Run.** Ask the connection check, then the ChainScope task. For a held step, reset first, so
   that ChainScope is new: `pnpm sisih demo reset --yes`.
5. **Approve.** When Claude prints `pnpm sisih approve <id> --remember`, run it in the owner
   terminal. Then tell Claude you approved.
6. **Next session.** Run `pnpm sisih session next`, then start a fresh Claude session with the same
   task. It goes through on the remembered preference.
   - Try a block: `pnpm sisih reserve set <id> <amount>` to leave less free money, or
     `pnpm sisih pause`.
7. **Finish.** `pnpm sisih evidence`, then `pnpm sisih release`, or ask Claude to call
   `end_demo_session`.

## MCP milestone (2026-11-07)

Done: real Claude Code agent -> Sisih MCP -> owner approval in the dashboard -> purchased result ->
continued task, plus "Explore demo" and "Connect your agent" on the site. Evidence and limitations:
docs/PROGRESS.md ("MCP for external agents"), transcripts in docs/evidence/agent-run-sisih-hosted-7/.

The hosted demo now shows namespace sisih-hosted-7 (the agent run: 4 stored memories, sessions 1-2,
one reserve-blocked request still held, the vault at 17.10 / 16.50 / 0.60). A stray 0.50 release of
mine is explained in PROGRESS and in the activity feed; the next reset sweeps it back.

### Private credential delivery (agent credential, SISIH_AGENT_TOKEN)

- The value is in the local `.env` and in the Vercel production env (sensitive). It is not in git,
  the README, the docs, the transcripts or any screenshot.
- A judge who has the demo token gets it on https://sisih-azure.vercel.app/connect: unlock Demo
  controls with the demo token, click "Show agent credential", copy it into `SISIH_AGENT_TOKEN`.
  So the only secret you hand over privately is the demo token, in the form's private field.
- To rotate it: generate a new random value, put it in `.env`
  (`SISIH_AGENT_TOKEN=...`), run
  `vercel env add SISIH_AGENT_TOKEN production --sensitive --force` with the new value on stdin, then
  `vercel deploy --prod`. Old agent configs stop working at once.

### Try it in the browser (earlier flow, still works)

1. Open https://sisih-azure.vercel.app/tour and click through the five steps (no token needed).
2. Open https://sisih-azure.vercel.app/connect, unlock Demo controls with the demo token, reveal the
   agent credential.
3. In a new empty folder: create `.mcp.json` from the Connect page, then in that terminal
   `export SISIH_AGENT_TOKEN="<the credential>"` (PowerShell: `$env:SISIH_AGENT_TOKEN = "..."`), then
   run `claude` there.
4. Ask the connection check from the Connect page (read only), then the sample task.
5. When Claude prints the approval link, open it, unlock in the drawer, Approve & remember.
6. Tell Claude you approved; it checks the same request and uses the result.
7. Dock > Start new session; in a new Claude session ask for SearchBox again: it goes through on the
   remembered rule. Ask once more when free funds are low: Sisih blocks it.
8. Ask Claude to call end_demo_session, or click Lock demo controls.

Reset the demo first if free funds are too low for a new SearchBox purchase (it needs 1.20 free and
SearchBox must be new for the approval step); docs/RECORDING.md says how to save the current
evidence before a reset.

## Missing inputs (only you can provide them)

- Video URL (after recording and uploading).
- Published blog URL.
- Public GitHub repo URL.
- Form: email, Discord handle, LinkedIn, how you heard about the event, first Web3 project, Tatum
  dashboard account ID, SUI address, "Account ID (SUI)" (undefined on the page; see SUBMISSION.md).
- Your own answer to "How was your experience building with Walrus?" (notes in SUBMISSION.md).
- The demo token, pasted only into the private form field.

## Your steps, in order

1. Record the terminal story (docs/RECORDING.md). The evidence of `sisih-hosted-9` is already
   saved in docs/evidence/.
   - Start with `pnpm sisih demo reset --yes`, then record the owner terminal and the agent
     terminal side by side.
   - Release the lease at the end, and do not reset after the final take.
2. Write the new run into docs/PROGRESS.md: namespace, request ids, digests.
   - Verify the memories with
     `pnpm --filter @sisih/server exec tsx scripts/verify-memories.ts <namespace>`. At least 10
     must be stored.
   - If you cite the video's run instead of `sisih-hosted-9`, update README, BLOG, SUBMISSION and
     SOCIAL to match.
3. Upload the video; add its URL near the top of README.md and in SUBMISSION.md.
4. Review README.md and docs/BLOG.md, then publish the blog; add its URL to README.md and
   SUBMISSION.md.
5. Create the GitHub repo and push (private first, check it, then public):
   `gh repo create sisih --private --source . --push`, then
   `gh repo edit --visibility public --accept-visibility-change-consequences`.
6. Post the thread from docs/SOCIAL.md (optional bonus).
7. Fill in and submit the form from docs/SUBMISSION.md before 10 Nov 2026 17:00 UTC; the demo token
   goes only into a private field.

## Skipped or risky

- The submission form itself was not opened (it sits behind "Submit Project"); fields come from the
  walrussessions page. Check the live form for extra fields.
- Learning impact does not trend down over five sessions; the docs say why. Do not rewrite it as an
  improvement.
- A reset before recording replaces what the dashboard shows. The snapshots in docs/evidence keep
  sisih-hosted-6, -7 and -9 inspectable.
- The real-agent acceptance runs used `claude -p` (headless) with the isolation flags. An
  interactive `claude` session with the same flags was not separately recorded.
