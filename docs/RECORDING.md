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

## Before each take: clean state

1. Unlock the dock with the token. Dock > **Reset demo**, confirm. It takes about 15 to 40 s
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

## Back to the clean state after recording

Dock > **Reset demo**, then **Lock demo controls**. The site is then at 20.00 / 16.50 / 3.50 with an
empty namespace and free for judges. The evidence of the recorded run stays on Sui Testnet and on
Walrus Mainnet; note its namespace and digests in docs/PROGRESS.md before you reset.
