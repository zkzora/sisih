# Sisih

An English-language dashboard that sets aside committed USDC before an AI agent can spend the remainder. Built from the approved Sisih design: forest green, lime, ivory, DM Sans, and the Sisih wordmark.

## Run

```sh
npm install
npm run dev -- --port 3000
```

Open http://127.0.0.1:3000. Production: `npm run build`, then `npm start`.

## Product checkpoint

- **User:** builders and power users giving an AI research agent a budget for paid APIs.
- **Failure:** apparently available wallet funds include money already committed to hosting, inference, savings, or renewals. Agent spending can leave those commitments short.
- **Mechanism:** reserve commitments first; apply agent permission, expiry, daily and per-request limits before any remembered preference; let the owner approve unknown merchants and optionally retain a scoped rule.
- **Strongest alternative:** a separately funded agent wallet with conventional spend limits. Sisih's proposed advantage is making commitment funding and the reason for each remembered decision inspectable in the same workflow.
- **Validation:** the demo demonstrates state transitions and invariant checks. It does not establish customer demand or production effectiveness. A later pilot should measure repeated reviews, legitimate payment completion, and missed commitments against the separate-wallet alternative.
- **Minimal demo:** small API payment → reviewed merchant → remembered rule in a new session → blocked overspend → usage bill outcome → owner-approved reserve adjustment.

## Screens and interactions

Overview, Commitments, Agent & requests, Memory, Learning impact, Onchain activity, and Settings. Includes commitment creation/editing/payment/removal, deposits and withdrawals, request review, scoped allow/deny rules, revocation, pause/resume, billing outcomes, reserve suggestions, session metrics, filtering, local receipts, CSV/JSON exports, and light/dark appearance.

The floating **Demo controls** panel runs three merchant scenarios, advances a simulated billing cycle, starts another session, and resets the local workspace. State persists in this browser's localStorage.

## Suggested walkthrough

1. Open **Review request** for SearchBox. Choose **Approve & remember**, then **Save rule & approve**.
2. Open **Demo controls** and buy DataMart data. Available funds become 1.80 USDC.
3. Request ReportLab's 3.00 USDC report. Approval is disabled because it would use 1.20 USDC of commitments.
4. Advance the billing cycle. The demo adds 17.00 USDC income, settles the four bills, and reserves recurring commitments again. Inference usage is 6.80 USDC against a 6.00 reserve.
5. Accept the suggested 7.00 USDC Inference reserve. The vault now contains 18.00 total, 16.00 committed, and 2.00 available.
6. Start the next session and request SearchBox again. The saved rule approves it automatically, subject to every vault limit.
7. Inspect Memory, Learning impact, and the local activity receipts.

## Integration boundary

This is a functional frontend simulation, with integer USDC micro-units and deterministic local rule matching. The browser policy is not a security boundary for real funds. No real wallet is accessed and no private keys are used. Sui contracts, Tatum balance/transaction verification, Walrus storage/recall, and x402/MPP settlement are not connected. Network selection changes the demo label only. Receipts are local records, not explorer transactions.

A live implementation needs contract-enforced reservations and agent limits on Sui, authenticated server-side integrations, encrypted/private memory handling before Walrus persistence, and verified payment settlement. Those integrations must preserve the invariant that preferences cannot override reserved funds.

## Checks

```sh
npm test
npm run typecheck
npm run build
```

The engine suite covers integer amounts, reservation protection, duplicate approvals, remembered rules, expiry/revocation, changed and daily limits, paused permissions, withdrawals, priority funding, billing-cycle accounting, reserve changes, and invalid persisted balances.

Brand assets and the original approved preview are in `design/sisih-brand/`. Applied tokens are in `src/app/tokens.css`; public logo assets are in `public/brand/`.
