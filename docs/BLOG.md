# Sisih: an AI agent that can only spend money you haven't promised

Giving an AI agent a wallet is easy. Giving it the right part of a wallet is not.

Say you run a small research agent. It buys market data, premium search results and the occasional
report, paying per call with x402. It spends from the same USDC that has to cover your inference
bill, your VPS, a weekly savings transfer and a domain renewal. The balance looks like 20 USDC. Most
of it is already promised. A spending limit does not know that, and neither does the agent.

Sisih is a vault that knows. It reserves money for every commitment first, lets the agent spend only
what is left, and learns from what you approve so it asks you less often. The learning lives in
Walrus Memory. The money lives in a Move contract on Sui, and the contract has the last word.

Live demo: https://sisih-azure.vercel.app

## Two terminals: your agent buys, you decide

Sisih is built for an agent that already works in a terminal. Claude Code connects to Sisih's MCP
server with its own credential. That credential lets it read its budget and the services it may
buy, request a purchase for its task, and read its own requests. Nothing else. There are no owner
tools on that server, and there is no switch that turns the rules off.

The owner sits in a second terminal with the Sisih CLI and an owner token the agent never sees. From
there the owner can:

- check the budget (`pnpm sisih status`)
- set the agent's limits
- change reserves
- answer held purchases (`pnpm sisih approve <id> --remember`)
- pause, resume or revoke the agent
- inspect the evidence

The dashboard shows the same state, but it is optional.

Here is the final run, on 2026-11-07 (Walrus namespace `sisih-hosted-9`). For this test, Claude Code
was started with only Sisih's tools: it could not read files, run a shell or see the owner token.

1. The owner set a 2.00 per-request and 6.00 per-day limit from the terminal.
2. The agent was asked to check the vault's health with a live report from ChainScope. ChainScope
   is a demo merchant that reads the vault through Tatum at purchase time. It is new, so Sisih held
   the 0.80 purchase. Nothing was paid, and Claude printed the exact command for the owner.
3. The owner ran `pnpm sisih approve req-637fe5e4-e5a --remember`. Twelve seconds later the release
   from free funds and the x402 settlement were both verified through Tatum, and the preference
   ("allow ChainScope data up to 1.00 USDC") was on its way to Walrus Memory.
4. Claude checked the same request, never paying twice, and answered from live data at Sui Testnet
   checkpoint 403681845.
5. After a billing cycle and `pnpm sisih session next`, a fresh Claude session asked again. The
   purchase went through on its own, because the preference had been rebuilt from Walrus.
6. Then the owner raised the savings reserve until only 0.60 was free, and Claude asked once more.
   The preference was still active, but Sisih blocked the purchase: it would have used 0.20 of
   committed money. The same 0.80 release sent straight to the vault aborted on chain:
   https://suiscan.xyz/testnet/tx/AFKJwvpjY4gYphMeyKsWuz1PrXrRzcoQm8MMWRXEtKqG
7. The owner paused the agent from the terminal, and the next purchase was blocked until the owner
   resumed it.

Every Claude Code transcript, the owner's command log, and each of the 12 memories (checked one by
one against the Walrus relayer) are in the repository under
`docs/evidence/final-run-sisih-hosted-9`.

## Two kinds of rules

Sisih splits rules into two kinds and never mixes them up.

**Hard rules** are enforced by the `sisih::vault` Move contract on Sui Testnet: a reserve per
commitment, a per-request cap and a 24-hour cap (5.00 and 10.00 USDC in the seeded demo; the owner
set 2.00 and 6.00 from the terminal in the final run), a permission expiry, pause and revoke. The agent is only ever paid by `release_to_agent`, which splits coins from the free
pool and aborts with `EExceedsFree` if the amount would touch a reserve.

**Soft rules** are the owner's preferences: which merchants are trusted, up to what amount, and for
how long. They are stored as memories on Walrus Mainnet and rebuilt at the start of every session.
They only ever choose among payments the vault would already allow.

## How it uses Tatum

Every Sui read and write goes through Tatum's Sui gateway, over native gRPC, from one module
(`server/src/lib/tatum.ts`). The server reads the vault object and balances, executes the operator's
releases and bill payments, submits the x402 settlements, and then reads every transaction back with
`GetTransaction` before the dashboard shows it as "verified via Tatum". The browser never talks to a
fullnode; it goes through a server route that uses the same client. Tatum's free plan allows three
requests per second, so the client keeps one call in flight and retries rate limits, and the
dashboard reads a cached vault state instead of polling.

## How it uses Walrus Memory

Every owner decision, every rule, every bill outcome, every reserve change and a summary of each
session are written to Walrus Memory on Mainnet through the mainnet relayer. A write is a job
that takes about 20 seconds; the dashboard shows it as "Writing" until it is stored, and a write
whose server function dies is finished on the next poll.

At the start of each session Sisih rebuilds its rules from Walrus recall. Postgres only caches them.
When the agent asks to pay a merchant, Sisih also recalls what it remembers about that merchant and
shows the results, with their distances, next to the decision.

## How memory changed a decision, over five sessions

An earlier run, on 2026-11-06 (Walrus namespace `sisih-hosted-6`), used the built-in Research Agent
for five sessions in one workspace. Sessions 1 and 2 were clicked through the dashboard.

Session 1 starts with 20.00 USDC in the vault, 16.50 of it reserved and 3.50 free. The agent buys
0.50 of data from DataMart; that is under the 0.50 automatic threshold, so it goes through, paid
over x402 and verified through Tatum.

Then the agent asks to pay SearchBox 1.20 for a premium search. SearchBox is new, so the payment is
held. The owner chooses "Approve & remember". The payment settles, and a rule memory is written to
Walrus: "Always allow search from SearchBox up to 1.50 USDC" for 30 days.

The agent then wants a 3.00 report from ReportLab. Only 1.80 is free, so paying would cut 1.20 out of
the reserves. The Approve button is disabled; the owner denies and remembers that too.

In session 2 Sisih rebuilds two rules from Walrus recall. The same SearchBox request for 1.20 comes
in and is approved automatically, with the remembered rule as its reason. Nobody clicked anything.

## How a bill becomes a better reserve

Between the sessions a billing cycle runs: simulated income arrives and the four bills are paid from
their reserves. The Inference API bill is 6.80, but its reserve was 6.00. The vault covers the 0.80
from free funds and Sisih writes the outcome to memory. From that outcome it suggests raising the
Inference reserve to 7.00. Changing a reserve is the owner's call, signed on chain; the owner accepts,
and session 2 starts at 18.00 total, 16.00 reserved, 2.00 free.

## The contract still says no

Memory can make Sisih ask less. It cannot make the vault pay more. To check that on chain, we sent
the release straight from the operator, bypassing the server's policy engine: 1.20 USDC, the
SearchBox amount the remembered rule allows, at a moment when only 0.70 was free. The vault aborted it
with `EExceedsFree`:
https://suiscan.xyz/testnet/tx/3QcakorFNa8YhAaXHdv8wHU39kYXnis4EdJA6mLhRGeM

## What five sessions showed, honestly

After the two clicked sessions we ran sessions 3 to 5 with a script (`pnpm demo:continue`) and one
fixed owner policy: approve once when the vault allows it, deny when it would cut reserves. Nothing
was tuned per session.

Manual reviews per session came out as **2, 1, 1, 2, 2**.

The drop from session 1 to 2 is the memory at work: SearchBox stopped needing a click. The rise in
sessions 4 and 5 is the hard rules at work. A 7.20 bill in a later cycle led the owner to raise the
Inference reserve again, to 7.50, which left only 0.10 to 0.70 free. SearchBox's 1.20 would then have
cut into reserves, so it was held by the reserve check even though its rule was still active. Across
the five sessions, held requests would have used 13.40 USDC of committed money; none of it left the
reserves.

That is five demo sessions in one workspace with demo merchants and testnet USDC. It is not five
users, and it is not evidence that Sisih works in production. It shows the loop working end to end:
the owner decides once, the memory changes the next decision, and the contract keeps the promises.

By the end of the run the namespace held 35 memories on Walrus Mainnet: 14 decisions, 13 bill
outcomes, 4 session summaries, 2 reserve changes and 2 rules. All 35 were checked again on
2026-11-07, one by one, through their relayer jobs.

## Limits

The merchants and bill payees are ours, labeled demo. Only ChainScope returns live data; the
others return fixed example content, and the agent is told which is which. The income is
simulated.

The vault and payments run on Sui Testnet; Walrus Memory runs on Mainnet.

The owner's terminal actions are signed by a server key, which the CLI and the UI label "Demo owner
(server-signed, testnet)", not by the owner's own wallet. That covers a fixed list of owner
operations: deposits, reserves, commitments, limits, pause, resume and revoke. It is refused on
mainnet.

It is one shared demo workspace, not a vault per visitor. Sisih is a hackathon build, unaudited.

## What's next

Real merchants instead of demo ones, an owner CLI that signs with the owner's own key, one vault
per owner, and memory that explains itself better: why a rule exists, when it was last used, and
when it should expire.

Code, evidence and every transaction digest: see the repository README and `docs/PROGRESS.md`.
