# Real Claude Code runs against the Sisih MCP endpoint

Generated from the raw `claude -p --output-format stream-json` output (2026-11-06, about 17:25 to 17:32 UTC). Endpoint https://sisih-azure.vercel.app/api/mcp, configured through `.mcp.json` with `Authorization: Bearer ${SISIH_AGENT_TOKEN}` (no credential appears in the output). Only the five sisih tools were allowed. The owner approval between A1 and A2 was done in the dashboard UI. Namespace sisih-hosted-7.

## Run A, part 1: task, purchase held

Claude Code 2.1.201, model claude-opus-4-8, session 7d6c13d4-8cbd-47ad-a26f-a6ba36736856, 5 turns, 20 s.

Prompt:

> Research what tends to move the SUI token price. Use the sisih MCP server to buy the SearchBox premium search for this task. If Sisih holds the purchase for my approval, give me the approval link and wait for me. Once it is settled, summarize what you bought, say clearly that it is demo service content, and end the demo session.

Tool calls:

- `ToolSearch` {"query":"sisih SearchBox premium search purchase buy","max_results":15}
- `mcp__sisih__list_services` {}
- `mcp__sisih__get_budget` {}
  - result: `{"services":"datamart 0.50, searchbox 1.20, reportlab 3.00"}`
  - result: `{"free_usdc":"3.50"}`
- `mcp__sisih__request_purchase` {"service":"searchbox","task":"Research what tends to move the SUI token price"}
  - result: `{"outcome":"awaiting_owner_approval","paid":false,"request_id":"req-ef83634b-191","decision_code":"new_merchant","amount_usdc":"1.20","duplicate":false,"reason":"New merchant. Free funds are sufficient, but SearchBox has no approved rule yet."}`

Final answer:

> The purchase is **held for your approval** — SearchBox is a new merchant with no approved spending rule yet, and $1.20 is above your $0.50 auto-approval limit. Nothing has been paid.
> 
> **👉 Approve or deny here:** https://sisih-azure.vercel.app/agent?request=req-ef83634b-191
> 
> - **Service:** SearchBox (demo) — Premium search
> - **Amount:** 1.20 testnet USDC (Sui Testnet, via x402)
> - **Request ID:** `req-ef83634b-191`
> - **Task:** Research what tends to move the SUI token price
> 
> Once you've approved it in the dashboard, tell me and I'll check the status and proceed. I'll wait for your go-ahead.

## Run A, part 2: same session resumed after the owner approved in the dashboard

Claude Code 2.1.201, model claude-opus-4-8, session 7d6c13d4-8cbd-47ad-a26f-a6ba36736856, 3 turns, 11 s.

Prompt:

> I approved it in the dashboard. Check the request and finish the task.

Tool calls:

- `mcp__sisih__get_request_status` {"request_id":"req-ef83634b-191"}
  - result: `{"outcome":"settled","paid":true,"request_id":"req-ef83634b-191","decision_code":"new_merchant","amount_usdc":"1.20","reason":"New merchant. Free funds are sufficient, but SearchBox has no approved rule yet.","settle_digest":"FRwkBgsUMin3VBi5viiEomdgBHQTRE8ceeQ8D77E8bKh","verified_via_tatum":true}`
- `mcp__sisih__end_demo_session` {}
  - result: `{"ended":true}`

Final answer:

> Done. Here's the wrap-up.
> 
> ## Purchase summary
> - **Service:** SearchBox (demo) — Premium search
> - **Paid:** 1.20 testnet USDC on Sui Testnet, via x402, verified through Tatum
> - **Request ID:** `req-ef83634b-191`
> - **Settlement tx:** [`FRwkBgsU…D77E8bKh`](https://suiscan.xyz/testnet/tx/FRwkBgsUMin3VBi5viiEomdgBHQTRE8ceeQ8D77E8bKh)
> 
> ## What the search returned — ⚠️ demo service content
> This is **fixed sample content from Sisih's demo merchant — not real, current, or market data.** Treat it as a placeholder illustrating the service, not as actual research on SUI.
> 
> On the query "SUI token price drivers," the demo returned three sample drivers:
> 1. **Network activity & transaction fees** — higher onchain activity cited as a driver of token demand.
> 2. **Token unlock schedules** — scheduled unlocks add supply and are commonly tracked by analysts.
> 3. **Stablecoin liquidity on the network** — stablecoin supply used as a proxy for available liquidity.
> 
> Because this is demo content, I can't present it as a genuine answer to "what moves the SUI price." If you want real research, I can run an actual web search (free) and pull current, sourced information — just say the word.
> 
> ## Session
> The Sisih demo session has been **ended** and handed back for the next visitor.

## Run B: fresh session after the owner started session 2 (rules rebuilt from Walrus)

Claude Code 2.1.201, model claude-opus-4-8, session 48536767-3372-4031-ab5b-4dfb8916b6cc, 4 turns, 23 s.

Prompt:

> I want a quick overview of what drives activity on the Sui network. Use the sisih MCP server to buy the SearchBox premium search for this. If it needs my approval, give me the link and stop. If it settles, summarize what you got, say whether it is demo content, and end the demo session.

Tool calls:

- `ToolSearch` {"query":"sisih SearchBox premium search buy purchase","max_results":10}
- `mcp__sisih__request_purchase` {"service":"searchbox","task":"Get an overview of what drives activity on the Sui network"}
  - result: `{"outcome":"settled","paid":true,"request_id":"req-ebf326db-79f","decision_code":"allow_rule","amount_usdc":"1.20","duplicate":false,"reason":"Approved by your remembered rule: Always allow search from SearchBox up to 1.50 USDC until 2026-12-06. All vault limits passed.","settle_digest":"4TrgbQVA3SvHSYSAkW5wM1B8WKENvq1DXyTS61TvCaw5","verified_via_tatum":true}`
- `mcp__sisih__end_demo_session` {}
  - result: `{"ended":true}`

Final answer:

> Done. Here's the rundown.
> 
> ## What settled
> - **Service:** SearchBox premium search
> - **Paid:** 1.20 testnet USDC — settled automatically (no approval needed; it matched your remembered rule *"Always allow search from SearchBox up to 1.50 USDC until 2026-12-06"*)
> - **Verified:** x402 settlement confirmed on Sui Testnet via Tatum — [explorer link](https://suiscan.xyz/testnet/tx/4TrgbQVA3SvHSYSAkW5wM1B8WKENvq1DXyTS61TvCaw5)
> 
> ## What drives Sui network activity (per the search)
> 1. **On-chain activity & transaction fees** — higher on-chain usage is cited as a driver of token demand.
> 2. **Token unlock schedules** — scheduled unlocks add supply and are commonly tracked by analysts.
> 3. **Stablecoin liquidity** — stablecoin supply on a chain is a common proxy for available liquidity.
> 
> ## Is it demo content?
> **Yes — this is demo content.** The result is explicitly flagged as fixed sample data from Sisih's demo merchant, *not* real-world or current market data. (Note the query ran as "SUI token price drivers" rather than a live network-activity search.) Treat the three points above as illustrative placeholders, not actual findings about Sui. If you want a real overview, I can run a live web search instead.
> 
> ## Session
> Demo session **ended** — the shared demo is free for the next visitor.

## Run C: fresh session, SearchBox again with 1.10 free (allow rule active)

Claude Code 2.1.201, model claude-opus-4-8, session ea230fc8-26f9-406b-b44c-cb9bf9a52dc3, 4 turns, 20 s.

Prompt:

> Use the sisih MCP server to buy one more SearchBox premium search, this time for: how stablecoin liquidity on Sui has changed. Report exactly what Sisih decided and why, then end the demo session.

Tool calls:

- `ToolSearch` {"query":"sisih searchbox premium search buy","max_results":10}
- `mcp__sisih__request_purchase` {"service":"searchbox","task":"A premium web search on how stablecoin liquidity on Sui has changed"}
  - result: `{"outcome":"blocked","paid":false,"request_id":"req-9fbb3d5d-2ed","decision_code":"would_cut_reserve","amount_usdc":"1.20","duplicate":false,"reason":"Would use 0.10 USDC of committed funds. Reserves are locked by the contract."}`
- `mcp__sisih__end_demo_session` {}
  - result: `{"ended":true}`

Final answer:

> Done. Here's exactly what happened:
> 
> ## Sisih's decision: **Blocked — not paid**
> 
> I asked Sisih to buy one SearchBox premium search (price per its own invoice: **1.20 USDC**) for the task *"how stablecoin liquidity on Sui has changed."*
> 
> **Decision:** `blocked` (`decision_code: would_cut_reserve`) — nothing was paid.
> 
> **Why:** Paying would have drawn **0.10 USDC of committed funds**. Those funds are reserved by the contract for the owner's bills, and the vault only ever pays from *free* funds. Since free funds weren't enough to cover the purchase without eating into the reserve, Sisih refused it on its own — the owner can't even approve it unless free funds grow.
> 
> Per Sisih's rules, I did **not** try to route around the limit with a different service. The request stays on record as `req-9fbb3d5d-2ed` (re-checkable via `get_request_status`, which never triggers a payment).
> 
> **Demo session:** ended — the shared demo is now free for the next visitor.
> 
> So: no search results to report, because no premium search was purchased — the owner's spending commitments blocked it.
