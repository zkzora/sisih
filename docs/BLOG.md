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

## Two kinds of rules

Sisih splits rules into two kinds and never mixes them up.

**Hard rules** are enforced by the `sisih::vault` Move contract on Sui Testnet: a reserve per
commitment, a per-request cap (5.00 USDC in the demo), a 24-hour cap (10.00), a permission expiry,
pause and revoke. The agent is only ever paid by `release_to_agent`, which splits coins from the free
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

## How memory changed a decision

The demo below ran on 2026-11-06 in one workspace (Walrus namespace `sisih-hosted-6`). Sessions 1 and
2 were clicked through the dashboard.

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
outcomes, 4 session summaries, 2 reserve changes and 2 rules.

## Limits

The merchants and bill payees are ours, labeled demo; the income is simulated and a billing cycle
lasts two minutes so a demo fits in three. The vault and payments run on Sui Testnet; Walrus Memory
runs on Mainnet. On testnet, a visitor with the demo token can sign deposits, reserve changes, pause
and resume without a wallet, through a server key that the UI labels "Demo owner (server-signed,
testnet)"; that path is refused on mainnet. Sisih is a hackathon build, unaudited.

## What's next

Real merchants instead of demo ones, an owner wallet flow on mainnet, and memory that explains
itself better: why a rule exists, when it was last used, and when it should expire.

Code, evidence and every transaction digest: see the repository README and `docs/PROGRESS.md`.
