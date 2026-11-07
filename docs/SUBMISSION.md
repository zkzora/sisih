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
| At least 10 memories stored on Mainnet | Done in the documented run: namespace `sisih-hosted-6`, 35 stored (docs/PROGRESS.md, Phase 5) |
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
Move contract on Sui first, the agent spends only what is left, and the owner's decisions are
remembered in Walrus Memory so the next session needs fewer manual reviews.

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
- MCP for external agents: Claude Code connects to `https://sisih-azure.vercel.app/api/mcp` with its
  own agent credential and gets five tools (budget, services, request purchase, request status, end
  session). Held purchases return a request ID and a dashboard link; after the owner approves, the
  agent resumes the same request and receives the purchased content. Verified with real Claude Code
  runs on 2026-11-06 (README, "Connect a real agent").

**Learning loop.** Session 1: SearchBox 1.20 is held as a new merchant; the owner approves and
remembers; a rule memory is stored on Walrus. Session 2: rules are rebuilt from Walrus recall and the
same request is approved automatically. A 6.80 Inference bill against a 6.00 reserve is stored as an
outcome memory and produces a suggestion to raise the reserve to 7.00, which the owner signs.
Manual reviews over the five demo sessions of the documented run: 2, 1, 1, 2, 2 (sessions 1 and 2
through the UI, 3 to 5 scripted with one fixed owner policy; reviews rose again when a higher reserve
left too little free money). Five demo sessions in one workspace, not users.

**Working demo and evidence.** https://sisih-azure.vercel.app (read-only without the demo token).
Networks: Sui Testnet for the vault and x402, Walrus Memory Mainnet. Evidence with explorer and
Walruscan links: README "Evidence" and docs/PROGRESS.md (Phase 5), including the contract refusing a
release that memory would have allowed:
https://suiscan.xyz/testnet/tx/3QcakorFNa8YhAaXHdv8wHU39kYXnis4EdJA6mLhRGeM

**Experience with Walrus (notes for your own answer).** The SDK's async remember job (about 20 s to
stored) shaped the UI's "Writing" state; recall with an explicit limit can miss rule memories in a
larger namespace, so Sisih runs tag queries next to the broad recall; the relayer sponsors gas, so
writing memory needs no wallet on the user side.

## Judge access (private channel only)

Paste this into a private field of the form (or send it privately). Never put the token in the repo,
README, blog or a public post.

> Demo: https://sisih-azure.vercel.app. Start with "Explore demo" (no token needed). To run it live,
> open "Demo controls" (bottom right) and enter the demo token: [paste the token from your password
> manager here, in the private field only]. Without the token the site is read-only. With it, the
> dock runs the built-in agent's demo tasks, a billing cycle, a new session and a reset; owner
> actions are signed by "Demo owner (server-signed, testnet)" when no wallet is connected.
> To try a real agent: after unlocking, open "Connect your agent", reveal the agent credential, set
> it as SISIH_AGENT_TOKEN and follow the Claude Code steps there; approve the agent's requests in
> Agent & requests. One visitor or agent runs the demo at a time; "Lock demo controls" or the
> agent's end_demo_session hands it back. Sui Testnet for the vault and x402, Walrus Memory Mainnet.
