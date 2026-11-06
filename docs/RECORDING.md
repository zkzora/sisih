# Recording the Sisih demo (Sui Testnet · Walrus Memory Mainnet)

The video is about 3 minutes, in two parts: Part A is live (sessions 1 and 2), Part B shows the
screens after sessions 3 to 5 ran off camera. Everything you see is live: vault and x402 on Sui
Testnet through Tatum, memories on Walrus Mainnet. Say the networks once on camera, as the banner
does: "Sui Testnet · Walrus Memory Mainnet".

## Setup

- Site: https://sisih-azure.vercel.app (the same stack judges open). A local `next start` works the
  same way if the hosted site is busy.
- Browser window 1440x900, zoom 100%, no extensions in view. Demo banner on (Settings > Demo
  disclosure). Keep the dock visible bottom right.
- Demo token: from your password manager. Never show it on screen; type it before you start
  recording, or blur that frame.
- Owner signing, pick one:
  1. **No wallet (recommended).** With the token and no wallet connected, deposits, reserve
     suggestions, pause and resume are signed on the server. The top bar shows the badge
     "Demo owner (server-signed, testnet)"; mention it once.
  2. **Owner wallet.** Import the testnet owner key (`OWNER_PRIVATE_KEY` in `.env`) into Slush or
     Sui Wallet on **Testnet**, then Connect wallet. The wallet signs, Sisih submits through Tatum.
     Never use a mainnet key here.

## Before the first reset: keep the evidence of the current run

The hosted demo currently shows the documented 5-session run (namespace `sisih-hosted-6`, 35 stored
memories, recorded in docs/PROGRESS.md, Phase 5). **A reset switches the dashboard to a new Walrus
namespace (`sisih-hosted-<n+1>`) and clears the app database** (requests, activity rows, memory
rows, sessions). The memories stay on Walrus Mainnet and the transactions stay on Sui Testnet, but
the dashboard no longer shows them. Before you reset, save a snapshot of the public API (no secrets
in it):

```sh
mkdir -p docs/evidence/sisih-hosted-6
for p in state memories activity insights sessions requests rules; do
  curl -s https://sisih-azure.vercel.app/api/$p > docs/evidence/sisih-hosted-6/$p.json
done
```

Check `docs/evidence/sisih-hosted-6/state.json` shows namespace `sisih-hosted-6` before you continue.
The snapshot of the documented run was saved on 2026-11-06 and is committed in `docs/evidence/sisih-hosted-6/`; save a new one for any later run before resetting it.

## Before each take: clean state

1. Unlock the dock with the token. Dock > **Reset demo**, confirm. It took 13 to 40 s in our runs
   (emergency withdraw, sweeps, reseed, fresh Walrus namespace).
2. Check Overview: **20.00 / 16.50 / 3.50**, Session 1, Walrus badge "0 memories".
3. **Wait 2 minutes** before you start recording: bills fall due one demo cycle (2 minutes) after the
   seed, and step 5 below needs them due. The dock clock shows when the next bill is due.

## Part A (live, about 2:15)

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

## Off camera: sessions 3 to 5

```sh
API_URL=https://sisih-azure.vercel.app pnpm demo:continue
```

It reads `DEMO_TOKEN` from `.env`, takes the demo, and for each session: advances the cycle (waits
until bills are due), accepts open reserve suggestions as the owner, starts a new session, runs the
three tasks. One fixed owner rule decides every held request: approve once when the vault allows it,
deny when it would cut reserves. About 10 minutes. It prints every digest and releases the demo at
the end.

## Part B (live, about 0:45)

| Time | Screen | Show |
| --- | --- | --- |
| 2:15 | Memory | Timeline with blob IDs and Walrus links, Active rules, Last recall with distances |
| 2:35 | Learning impact | Manual reviews per session, money protected, obligations on time; captions name the sources |
| 2:50 | Onchain activity | Every row "verified" through Tatum; open one row: events and the Suiscan testnet link |

Join A and B with a title card "After 3 more sessions".

## If a take fails

- **"Another visitor is running the demo"** (423): someone else, or an old tab, holds the demo.
  Wait for the time shown (at most 10 minutes) or click Lock in that other tab.
- **"Another demo action is still running"** (409): wait a few seconds and click again.
- **Advance billing cycle says nothing is due**: wait for the seconds shown, then click again.
- **A memory shows "Writing"**: Walrus writes take about 20 to 25 s. Start new session waits for
  them; a write whose server function died is finished on the next poll.
- **Too many reset requests** (429, 3 per 10 minutes): wait, or use a local `next start`.
- Anything else: Reset demo, wait 2 minutes, start the take again.

## After recording: leave the run in place

Do **not** reset after the final take. Judges should find the recorded run: five sessions, the
Learning impact charts and the memories behind them.

1. Click **Lock demo controls** so the next visitor is not blocked.
2. Check the result on the live site, then write it into docs/PROGRESS.md:
   ```sh
   curl -s https://sisih-azure.vercel.app/api/state | node -e 'const s=JSON.parse(require("fs").readFileSync(0)); console.log(s.memory, "session", s.session)'
   ```
   The namespace must show at least 10 **stored** memories (writing and failed do not count; wait
   about 30 s for the last writes). Record the namespace, the stored count, and the manual reviews
   per session from Learning impact.
3. Only call the video recorded once the file or its uploaded URL exists; put the URL in
   docs/SUBMISSION.md and the README at that point, not before.

A clean state (20.00 / 16.50 / 3.50, empty namespace) is only for starting a new take.

## Voiceover script (about 3 minutes)

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
