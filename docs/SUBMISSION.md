# Submission prep (Tatum x Walrus "Total Recall")

Working document for filling in the form. It holds no secrets. Fields marked **Needs your input**
cannot be filled by anyone else; nothing here is a link that does not exist yet.

Sources checked on 2026-11-06: https://recall-tatum-walrus.vercel.app/ (rules, "Submit Project"
button) and https://thewalrussessions.wal.app/tatum-total-recall (lists what the application must
contain). The form itself sits behind the "Submit Project" button and was not opened here; check the
live form for any field not listed below. Deadline: 10 Nov 2026, 17:00 UTC.

## Requirements

Mandatory (both pages):

| Requirement | Status |
| --- | --- |
| Walrus Memory integrated and writing on Mainnet | Done: relayer https://relayer.memory.walrus.xyz; every decision, rule, outcome and summary is a memory |
| Tatum RPC used for onchain data where relevant | Done: every Sui read and write through Tatum's Sui Testnet gRPC gateway (`server/src/lib/tatum.ts`) |
| At least 10 memories stored on Mainnet | Done. Final run `sisih-hosted-9`: 12 stored, each checked through its relayer job (docs/evidence/final-run-sisih-hosted-9). Earlier run `sisih-hosted-6`: 35 stored, re-checked the same way on 2026-11-07 |
| Published blog post: what it does, how it uses Tatum + Walrus, how it learned over time | Draft ready: docs/BLOG.md. **Needs your input:** publish it and paste the URL |
| Working demo and public repo | Demo live: https://sisih-azure.vercel.app. **Needs your input:** make the GitHub repo public |
| Short demo video (2 to 3 min), asked on the form | Script ready: docs/RECORDING.md. **Needs your input:** record and upload it |

Bonus criteria (no prize or eligibility is guaranteed; judges decide):

| Bonus | What the page says | Sisih |
| --- | --- | --- |
| Best Use of Agent Payments ($500) | "Best app across tracks using x402 or MPP, settled on Sui" | x402 settled on Sui Testnet with Tatum-verified digests |
| Best Walrus Memory ($500) | "Deepest learning loop. Memories that visibly change the product." | Owner decisions become rules recalled each session; bill outcomes become reserve suggestions |
| Best Tatum AI Builder app ($500) | "Best shippable product built primarily with ai.tatum.io" | Not applicable: Sisih was not built with Tatum AI Builder |
| Social sharing | "Share your project on X or LinkedIn"; tagging @Tatum_io and @WalrusFoundation "is optional and may earn extra points" | Draft in docs/SOCIAL.md |

## Form fields

| Field (as listed on the page) | Answer |
| --- | --- |
| Email | **Needs your input** |
| Discord handle | **Needs your input** |
| LinkedIn | **Needs your input** |
| How did you hear about this event? | **Needs your input** |
| Is this your first Web3 project? | **Needs your input** |
| Tatum ID (Tatum dashboard account ID) | **Needs your input**: dashboard.tatum.io |
| SUI address | **Needs your input**: the address you want to give (the page does not say what it is for; do not use a demo key's address unless you mean to) |
| Account ID (SUI) | **Needs your input**: the page gives no definition. If it means the Walrus Memory account, Sisih's is `0xc6408ac06d2e4ba3c4df92a47646cc7e4051ebdf20765a7ae63f572d2d8523ba`; confirm on the form |
| MEMWAL_AGENT_ID (public key under Delegate keys) | `2bd5ef9fe819eb9fc39de0b6d37b341ec8cf9dc091f82bdea74b5560c785e3b3` (the "Sisih server" delegate key that writes every memory) |
| Track | Consumer Finance Apps |
| Project description | See below |
| Short demo video (2 to 3 min) | **Needs your input**: the uploaded video URL |
| GitHub repo | **Needs your input**: the public repo URL |
| Blog post | **Needs your input**: the published URL |
| How was your experience building with Walrus? | **Needs your input** (your own words; notes below) |
| How was your experience building with the Tatum AI Builder? | Not used for Sisih; say so, or skip if optional |

## Project description

**Short description (one line):** Sisih is a USDC vault for AI agents: commitments are reserved in a
Move contract on Sui first, the agent (Claude Code over MCP) spends only what is left, the owner
decides held purchases from the terminal, and those decisions are remembered in Walrus Memory so the
next session needs fewer manual reviews.

**Problem.** People who let an AI agent pay for APIs and data (x402) often fund it from the same USDC
that must cover hosting, inference bills, savings and renewals. A spending limit does not know which
money is already promised, so the agent can spend next week's bills, while approving every small
purchase by hand defeats the point of an agent.

**Solution.** Hard rules live on chain: the `sisih::vault` Move contract reserves money per
commitment and enforces a per-request cap, a daily cap, permission expiry and pause; the agent can
only be paid from the free pool (`release_to_agent` aborts with `EExceedsFree` otherwise). Soft rules
are learned: when the owner approves or denies and chooses "remember", Sisih writes a rule memory to
Walrus Memory and rebuilds its rules from recall at every session start. Memory only decides among
payments the vault already allows, and the policy engine checks hard rules before it looks at memory.

**Integration details.**
- Tatum: every Sui read and write through Tatum's Sui Testnet gRPC gateway from one module
  (`server/src/lib/tatum.ts`): vault reads, balances, operator transactions, x402 settlement, and
  `GetTransaction` read-back of every digest before the dashboard marks it "verified via Tatum". The
  browser reaches Sui only through a server route.
- Walrus Memory (Mainnet): decisions, rules, rule disables, bill outcomes, reserve changes and
  session summaries; async write jobs tracked to "stored"; session start rebuilds rules from recall;
  each payment request recalls what is known about that merchant.
- x402 on Sui: `@tentaclepay/sui-x402`; demo merchants answer 402; the vault releases exactly the
  invoice amount from free funds; the agent pays with exactly that coin; the facilitator settles on
  Sui Testnet; both digests are verified through Tatum.
- **MCP for external agents.** Claude Code connects to `https://sisih-azure.vercel.app/api/mcp`
  with its own agent credential.
  - It gets five tools: budget, services, request purchase, request status and end session.
  - There are no owner tools on that server.
  - A held purchase returns the owner's terminal command (`pnpm sisih approve <id> --remember`) and
    a dashboard link.
  - A settled purchase returns the result, the receipts and the Walrus memory evidence.
  - Merchant output is treated as external data, never as instructions.
- **Owner CLI.** `pnpm sisih` lets the owner inspect, set limits and reserves, approve or deny
  (optionally remembered), pause, resume, revoke, start the next session, inspect the evidence and
  release the shared demo. Owner transactions are signed by "Demo owner (server-signed, testnet)".
- **Live data.** ChainScope, a demo merchant, sells a live Sui Testnet vault report read through
  Tatum at purchase time. If the read fails, the purchase is not charged. The other merchants return
  labeled fixed examples.

**Learning loop, terminal run (2026-11-07, `sisih-hosted-9`).** Claude Code asks for the
ChainScope report and it is held. The owner runs `pnpm sisih approve <id> --remember`, and Claude
resumes with live data. After `pnpm sisih session next`, a fresh Claude session buys it with no
approval, through the preference rebuilt from Walrus. When a higher savings reserve leaves too
little free money, the same purchase is blocked, and the contract refuses the release directly
(`EExceedsFree`). Pause from the terminal blocks the agent until resume. The evidence is in
docs/evidence/final-run-sisih-hosted-9.

**Learning loop, five-session run (2026-11-06, `sisih-hosted-6`).** Session 1: SearchBox 1.20 is held as a new merchant; the owner approves and
remembers; a rule memory is stored on Walrus. Session 2: rules are rebuilt from Walrus recall and the
same request is approved automatically. A 6.80 Inference bill against a 6.00 reserve is stored as an
outcome memory and produces a suggestion to raise the reserve to 7.00, which the owner signs.
Manual reviews over the five demo sessions of the documented run: 2, 1, 1, 2, 2 (sessions 1 and 2
through the UI, 3 to 5 scripted with one fixed owner policy; reviews rose again when a higher reserve
left too little free money). Five demo sessions in one workspace, not users.

**Working demo and evidence.** https://sisih-azure.vercel.app (read-only without the demo token).
Networks: Sui Testnet for the vault and x402, Walrus Memory Mainnet. Evidence with explorer and
Walruscan links: README "Evidence" and docs/PROGRESS.md, including the contract refusing a
release that memory would have allowed:
https://suiscan.xyz/testnet/tx/AFKJwvpjY4gYphMeyKsWuz1PrXrRzcoQm8MMWRXEtKqG (final run) and
https://suiscan.xyz/testnet/tx/3QcakorFNa8YhAaXHdv8wHU39kYXnis4EdJA6mLhRGeM (five-session run).

**Experience with Walrus (notes for your own answer).** The SDK's async remember job (about 20 s to
stored) shaped the UI's "Writing" state; recall with an explicit limit can miss rule memories in a
larger namespace, so Sisih runs tag queries next to the broad recall; the relayer sponsors gas, so
writing memory needs no wallet on the user side. On 2026-11-07 the namespace-filtered listing
returned 0 while per-job status still worked, so verification moved to per-job checks; one write
failed once with "Memory encryption backend is unavailable" and succeeded on retry.

## Judge access (private channel only)

Paste this into a private field of the form (or send it privately). Never put the token in the repo,
README, blog or a public post.

> Demo: https://sisih-azure.vercel.app. Sui Testnet for the vault and x402, Walrus Memory Mainnet.
> No token needed for "Explore a recorded run". Owner token (private): [paste the token from your
> password manager here, in the private field only].
> Terminal workflow (README, "Quickstart"):
> (1) In the repo, after pnpm install, set SISIH_URL=https://sisih-azure.vercel.app and
> SISIH_OWNER_TOKEN=<owner token>, then run `pnpm sisih status`.
> (2) On /connect, unlock Demo controls with the owner token and reveal the agent credential. Put
> it in SISIH_AGENT_TOKEN, in a separate, empty agent folder with the .mcp.json and skill from
> /connect. Never put the owner token there.
> (3) Ask Claude Code the ChainScope task. When it prints `pnpm sisih approve <id> --remember`,
> run it in the owner terminal, then tell Claude you approved.
> (4) `pnpm sisih evidence` shows the verified transactions and memories. `pnpm sisih release`
> hands the shared demo back.
> Owner actions are signed by "Demo owner (server-signed, testnet)", not by your wallet. One
> visitor or agent runs the demo at a time. `pnpm sisih demo reset --yes` starts a clean run.
