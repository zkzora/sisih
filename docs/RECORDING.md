# Recording the Sisih demo (Sui Testnet · Walrus Memory Mainnet)

The video is about 3 minutes, and the main story is in the terminal: Claude Code buys through Sisih
over MCP, and the owner answers from a second terminal with `pnpm sisih`. Everything you see is
live: the vault and x402 on Sui Testnet through Tatum, and memories on Walrus Mainnet. Say the
networks once on camera, as the banner and the CLI do: "Sui Testnet · Walrus Memory Mainnet". A
browser-only story (the dashboard plus the dock) is kept at the end as an alternative.

## Setup

- **Two terminals side by side**, in a large font with a dark theme.
  - Left: the agent's empty folder with `.mcp.json` and `.claude/skills/sisih/SKILL.md` (README,
    "Agent terminal").
  - Right: the repo, with `SISIH_URL` and `SISIH_OWNER_TOKEN` set (README, "Owner terminal").
- **Credentials.** Set both before you start recording and never show their values. In the agent
  terminal, remove the owner token: `Remove-Item Env:SISIH_OWNER_TOKEN, Env:DEMO_TOKEN
  -ErrorAction SilentlyContinue`.
- **Claude Code.** Start it with the README's `$sisih` flags, so it has only the Sisih tools.
  Interactive `claude @sisih` reads better on camera than `-p`.
- **Browser (optional).** Use the dashboard for one closing shot of Onchain activity or Memory, at
  1440x900 and 100% zoom.
- **Signing.** Owner transactions are signed on the server by "Demo owner (server-signed, testnet)",
  and the CLI prints this after each one. Say it once.

## Before the reset: keep the evidence of the current run

The hosted demo shows the final terminal run of 2026-11-07 (namespace `sisih-hosted-9`). Its
evidence is saved in `docs/evidence/final-run-sisih-hosted-9/`. Earlier runs are in
`docs/evidence/agent-run-sisih-hosted-7/` and `docs/evidence/sisih-hosted-6/`.

**A reset switches the dashboard to a new Walrus namespace (`sisih-hosted-<n+1>`) and clears the
app database:** requests, activity rows, memory rows and sessions. The memories stay on Walrus
Mainnet and the transactions stay on Sui Testnet, but the dashboard no longer shows them. Before
you reset a run you have not saved yet, save the public API (it contains no secrets):

```sh
ns=$(curl -s https://sisih-azure.vercel.app/api/state | node -e 'console.log(JSON.parse(require("fs").readFileSync(0)).memory.namespace)')
mkdir -p docs/evidence/$ns
for p in state memories activity insights sessions requests rules suggestions; do
  curl -s https://sisih-azure.vercel.app/api/$p > docs/evidence/$ns/$p.json
done
```

## Before each take: clean state

In the owner terminal:

```powershell
pnpm sisih demo reset --yes      # 38 s in the final run: new namespace, 20.00 / 16.50 / 3.50
pnpm sisih limits set --per-request 2.00 --per-day 6.00 --days 30
pnpm sisih status
```

## The terminal story (about 3:00)

Timings are what we observed on 2026-11-07 (`docs/evidence/final-run-sisih-hosted-9`).

| Time | Terminal | Do | Expect (observed) |
| --- | --- | --- | --- |
| 0:00 | Owner | `pnpm sisih status` | 20.00 total, 16.50 committed, 3.50 free; agent active, 2.00 per request, 6.00 per day; no preferences |
| 0:15 | Agent | Give the ChainScope task from the README or the Connect page | About 30 s. Claude reads the budget (3.50 free, largest payment 2.00) and the services, then requests ChainScope. Sisih answers `awaiting_owner_approval`, and Claude prints `pnpm sisih approve <id> --remember` |
| 0:45 | Owner | `pnpm sisih requests --held`, then `pnpm sisih approve <id> --remember` | 12 s: vault release, x402 settle, both verified through Tatum; preference saved to Walrus Memory |
| 1:00 | Agent | "I approved it from my terminal. Check the request and finish the task." | About 25 s. The same request is settled, with live data from a Sui Testnet checkpoint (committed vs free, the largest payment now), and the session ends |
| 1:25 | Owner | `pnpm sisih demo cycle`, then `pnpm sisih session next` | Cycle 28 s (bills paid, simulated income). Session next 18 s: rules rebuilt from Walrus recall (2 s of recall) |
| 1:45 | Agent | A fresh Claude session: "New day: run the vault health check again …" | Settled with no approval, through the remembered preference (`allow_rule`), with a new checkpoint. 30 to 90 s; cut the wait |
| 2:10 | Owner | `pnpm sisih commitments`, then `pnpm sisih reserve set <savings id> 5.50` | Reserve raised; 0.60 free |
| 2:20 | Agent | Ask for the report once more | `blocked`, `would_cut_reserve`. The preference does not unlock committed funds, and Claude does not work around it |
| 2:35 | Owner | `pnpm sisih pause`; in the agent terminal ask for DataMart | `blocked`, `agent_paused`; Claude relays the `owner_hint` `pnpm sisih resume` (observed in the post-deploy check, A7) |
| 2:50 | Owner | `pnpm sisih resume`, `pnpm sisih evidence`, `pnpm sisih release` | Verified transactions and stored memories with Walrus links; lease released |

Say once on camera that ChainScope's report is live onchain data and the other merchants return
fixed example content. Claude says it too.

## Voiceover (terminal story)

**0:00 Status.** This is Sisih. My agent pays for data with USDC, from the same money that has to
cover my bills and savings. The vault holds 20, but 16.50 is promised, so the agent can spend 3.50
at most, and never more than 2 at once. The vault is a Move contract on Sui Testnet, read through
Tatum, and Sisih's memory lives on Walrus Mainnet.

**0:15 The agent asks.** On the left is Claude Code. Its only tools are Sisih's: it cannot read my
files or my owner token. I ask it to check my vault's health with a live report from ChainScope.
ChainScope is new, so Sisih holds the purchase. Nothing is paid, and Claude gives me the exact
command to run.

**0:45 I approve.** In my own terminal, I approve and remember. Sisih releases 0.80 from free
funds, pays the x402 invoice on Sui, verifies both transactions through Tatum, and saves my
preference to Walrus Memory. These owner transactions are signed by the server's demo owner on
testnet, not by my own wallet.

**1:00 Claude continues.** Claude picks up the same request. It never pays twice. It reports what
the chain says right now: the checkpoint, committed versus free, and the largest payment it could
make.

**1:25 Next day.** Bills come due and are paid from their reserves. A new session rebuilds the
rules from Walrus. A fresh Claude session asks for the report again, and this time it goes through
without me, because of the memory I created.

**2:10 Hard rules.** I raise my savings reserve, and only 0.60 is free. Claude asks again, and the
preference is still active, but Sisih blocks it: the payment would touch committed money, and the
contract would refuse it anyway. I pause the agent, and nothing goes through until I resume.

**2:50 Evidence.** Every transaction is verified through Tatum, every memory is on Walrus Mainnet,
and I release the shared demo. That is Sisih: memory makes it ask less, and it never makes the
vault pay more.

## If a take fails

- **The CLI exits 3**: `SISIH_OWNER_TOKEN` is not set in the owner terminal, or it is wrong.
- **The CLI exits 4 (busy)**: someone else holds the shared run. Wait, or ask the agent to call
  `end_demo_session`.
- **Claude reaches for files or a shell**: it was started without `--tools "Skill,ToolSearch"`.
  Restart it with the README's flags.
- **"Another visitor is running the demo"** (423): someone else, or an old tab, holds the demo.
  Wait for the time shown (at most 10 minutes) or click Lock in that other tab.
- **"Another demo action is still running"** (409): wait a few seconds and click again.
- **"A connected agent is running the demo"** (423, agent_run_active): Claude holds the shared run.
  You can still approve or deny its requests and start a new session; for anything else ask Claude
  to call `end_demo_session`, or wait up to 10 minutes.
- **Claude says the tools are missing or unauthorized**: `SISIH_AGENT_TOKEN` is not set in that
  terminal, or `.mcp.json` is not in the folder where Claude Code was started.
- **Advance billing cycle says nothing is due**: wait for the seconds shown, then click again.
- **A memory shows "Writing"**: Walrus writes take about 20 to 25 s. Start new session waits for
  them; a write whose server function died is finished on the next poll.
- **Too many reset requests** (429, 3 per 10 minutes): wait, or use a local `next start`.
- Anything else: Reset demo, wait 2 minutes, start the take again.

## After recording: leave the run in place

Do **not** reset after the final take. Judges should find the recorded run.

1. Run `pnpm sisih release`, so the next visitor is not blocked.
2. Verify the memories and write the run into docs/PROGRESS.md: the namespace, request ids,
   digests and stored memories (at least 10).
   ```sh
   pnpm --filter @sisih/server exec tsx scripts/verify-memories.ts <namespace>
   ```
   This checks each memory's relayer job and blob id. Do not count top-k recall results.
3. If the run ends with less free money than any service costs, use `pnpm sisih reserve set` to
   leave the free funds a judge's agent needs. Record that digest too.
4. Call the video recorded only once the file or its uploaded URL exists. Put the URL in
   docs/SUBMISSION.md and the README at that point, not before.

## Alternative: the browser story (dashboard and dock)

This is the earlier recording plan. It uses the built-in Research Agent, driven from the dock, and
the owner decides in the request drawer. Part A is live (sessions 1 and 2). Part B shows the screens
after sessions 3 to 5 ran off camera. Before you start, unlock the dock with the demo token. With no
wallet connected, the top bar shows "Demo owner (server-signed, testnet)".

### Clean state (browser)

1. Unlock the dock with the token. Dock > **Reset demo**, confirm. It took 13 to 40 s in our runs
   (emergency withdraw, sweeps, reseed, fresh Walrus namespace).
2. Check Overview: **20.00 / 16.50 / 3.50**, Session 1, Walrus badge "0 memories".
3. **Wait 2 minutes** before you start recording: bills fall due one demo cycle (2 minutes) after the
   seed, and step 5 below needs them due. The dock clock shows when the next bill is due.

### Part A (live, about 2:15)

| Time | Screen | Do | Expect |
| --- | --- | --- | --- |
| 0:00 | Overview | Show the balance card and the "Verified via Tatum" badge | 20.00 total, 16.50 committed, 3.50 free |
| 0:20 | Dock | **Buy market data** | DataMart 0.50 auto-approved (default threshold); x402 steps run; free 3.00 |
| 0:35 | Dock, then Agent & requests | **Search the web**, open the held SearchBox request | Held: new merchant, 1.20 |
| 0:45 | Request drawer | **Approve & remember**, then **Save to memory & approve** | 4 x402 steps to "settle verified"; toast "Memory stored on Walrus mainnet." about 20 s later |
| 1:05 | Dock, then drawer | **Get a research report**, open ReportLab | Held: would cut reserves by 1.20; **Approve once** is disabled |
| 1:15 | Request drawer | **Deny & remember**, then **Save to memory & deny** | Denied, no funds released; end of session 1: 18.30 / 16.50 / 1.80 |
| 1:25 | Dock | **Advance billing cycle** | Income 17.00 (simulated), 4 bills paid; Inference API 6.80 against a 6.00 reserve |
| 1:35 | Commitments | Suggestion card: **Accept 7.00 USDC** | Signed (wallet or demo owner), verified via Tatum; 18.00 / 16.00 / 2.00 |
| 1:50 | Dock | **Start new session** | About 25 s: memories finish, rules rebuilt from Walrus recall; "What changed" card on Overview |
| 2:00 | Dock | **Search the web** | SearchBox 1.20 auto-approved by the rule memory chip |
| 2:10 | Dock | **Buy market data**, then **Get a research report** | DataMart auto; ReportLab held, cuts 2.70, "You denied this before"; end of session 2: 16.30 / 16.00 / 0.30 |

Stop recording. Click **Lock demo controls** in the dock (this hands the demo back, so the script
below is not blocked).

### Off camera: sessions 3 to 5

```sh
API_URL=https://sisih-azure.vercel.app pnpm demo:continue
```

It reads `DEMO_TOKEN` from `.env`, takes the demo, and for each session: advances the cycle (waits
until bills are due), accepts open reserve suggestions as the owner, starts a new session, runs the
three tasks. One fixed owner rule decides every held request: approve once when the vault allows it,
deny when it would cut reserves. About 10 minutes. It prints every digest and releases the demo at
the end.

### Part B (live, about 0:45)

| Time | Screen | Show |
| --- | --- | --- |
| 2:15 | Memory | Timeline with blob IDs and Walrus links, Active rules, Last recall with distances |
| 2:35 | Learning impact | Manual reviews per session, money protected, obligations on time; captions name the sources |
| 2:50 | Onchain activity | Every row "verified" through Tatum; open one row: events and the Suiscan testnet link |

Join A and B with a title card "After 3 more sessions".

### Voiceover script (browser story, about 3 minutes)

Timings follow Part A and Part B above. Lines in brackets are what you do; read the rest. Pauses
note waits we measured in our runs.

**0:00 Overview.** This is Sisih. My research agent pays for data and search with USDC, from the
same money that has to cover my inference bill, my server, my savings and a domain renewal. The
vault holds 20 USDC, but 16.50 is already promised. Only 3.50 is free, and that is all the agent can
spend. The vault is a Move contract on Sui Testnet, every number is read through Tatum, and Sisih's
memory lives on Walrus Mainnet.

**0:20 DataMart.** [Buy market data.] Half a USDC for price history. That is under my automatic
threshold, so it goes through: paid over x402, settled on Sui, verified through Tatum.

**0:35 SearchBox.** [Search the web, open the request.] Now 1.20 for a premium search from a
merchant Sisih has never seen. It waits for me. I approve, and I tell Sisih to remember: allow
SearchBox up to 1.50 for thirty days. [Approve & remember, save.] Watch the four x402 steps. The
rule is written to Walrus Memory; that takes about twenty seconds. [Wait for "Memory stored on
Walrus mainnet."]

**1:05 ReportLab.** [Get a research report, open it.] A 3 USDC report. Only 1.80 is free, so paying
would eat 1.20 of my reserved money. Sisih will not even let me approve it: the contract would
refuse. I deny it and remember that too. [Deny & remember, save.]

**1:25 Billing cycle.** [Advance billing cycle.] Simulated income arrives and the bills are paid
from their reserves. The inference bill came in at 6.80, but I only reserved 6.00. The vault covered
the gap from free money, and Sisih remembers that. [Open Commitments.] So it suggests raising the
reserve to 7. Reserves are mine to change, so I sign it. [Accept 7.00.]

**1:50 New session.** [Start new session; wait about 25 seconds.] A new session starts the way an
agent's next day would: Sisih rebuilds its rules from Walrus. [Search the web.] The same SearchBox
request now goes through on its own, and the reason is the memory I created. [Buy market data, Get a
research report.] ReportLab is held again, and Sisih reminds me I said no before.

**2:15 Cut to Part B.** [Title card "After 3 more sessions".] Off camera, a script ran three more
sessions with one fixed rule for my decisions: approve when the vault allows it, deny when it would
touch reserves. Nothing was tuned. [Memory screen.] Every decision, rule and bill outcome is a
memory on Walrus Mainnet, each with its blob ID. [Active rules, Last recall.] These are the rules
rebuilt every session, and what recall returned for the last request.

**2:35 Learning impact.** [Learning impact.] Manual reviews per session. In our documented run
they went 2, 1, 1, 2, 2: memory took SearchBox off my plate, and later my own higher reserves left
too little free money, so the vault's limits took over again. Memory makes Sisih ask less. It never
makes the vault pay more. [Read your own run's numbers here if they differ.]

**2:50 Onchain activity.** [Onchain activity, open one row.] Every transaction, checked through
Tatum, with a link to the Sui explorer. Demo merchants, testnet money, real contract. That is Sisih.
