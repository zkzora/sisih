# Mainnet vault decision

Decision: **retain the existing Sisih Move vault for this bounded Mainnet proof**. This is not a claim that custom code is generally preferable. It is the smallest currently verified path that keeps the product's defining invariant: delegated purchases can use only the live free pool, while commitment reserves remain unavailable onchain as reserves change.

## Concrete user failure and required boundary

The user is an owner financing an agent's API/data purchases from money also promised to savings or bills. A prepaid agent wallet or static allowance can cap total spend, but it can become stale after a new commitment or reserve top-up. The required mechanism therefore computes spendability from the current onchain free pool at the consequential release, then applies agent, per-request, daily-window, expiry and pause/revoke checks. The strongest alternative is a native app-bound Sui Allowance with a small custom reserve-policy app.

## Comparison

| Candidate | What is reused | Custody and bypass boundary | Fit and remaining work | Decision |
| --- | --- | --- | --- | --- |
| [Native Sui Allowances](https://www.docs.sui.io/onchain-finance/allowances) | Mainnet framework primitive and SDK transaction intent; no Sisih package needed for a direct allowance | Funds remain in the funder's address balance. A direct allowance permits its spender to call the native spend path. An app-bound allowance requires an app-issued `SpendPermit`, so every permitted path can be routed through custom policy. The allowance itself does not set funds aside. | Lifetime/rate/expiry controls map well. Dynamic commitment reserves, stored bill payees, reserve priority and current-free calculation still need a custom app and state. Migrating also changes the tested escrow model and x402/recovery path. The installed SDK 2.39.0 supports the API, but the installed Sui CLI 1.73.1 is below the current Mainnet prerequisite documented in [Using Allowances](https://www.docs.sui.io/onchain-finance/allowances/using-allowances). | Best future simplification candidate, not lower risk for this proof. |
| [OpenZeppelin Sui Spend Vault](https://docs.openzeppelin.com/contracts-sui/1.x/spend-vault) | Library source copied into this package; it is not a shared deployed vault instance | `SpenderCap` is a bearer capability. Budgets are per-cap ceilings over a pool, not segregated commitments; owner withdrawals can leave allowances without matching liquidity. A sender-gated wrapper is still needed for Sisih roles. | Still requires publication and adapters. It does not supply stored commitment payees, must/important reserve ordering, dynamic free-pool release, daily window, or the existing owner/operator semantics. The delegated-spending guide describes its example as experimental; this review does not call the integration audited. | More rewrite and semantic risk than reuse benefit. |
| Existing Sisih vault | One owner-specific package plus shared `Vault<USDC>` and `OperatorCap` | Owner controls deposits, commitments and policy. Operator can fund/pay stored commitments or call `release_to_agent`; that call splits only `vault.free`. It cannot spend a reserve or choose a commitment payee. Agent/facilitator never receive the OperatorCap. | Already covered by 46 Move tests and exercised on Testnet for successful release, x402 settlement and reserve refusal. Mainnet still requires publication and exact evidence, but no semantic migration. | Selected for the bounded proof. |

[Sui's payment-model guide](https://www.docs.sui.io/onchain-finance/choose-payments-model) treats payment/receipt tooling as a separate choice; it does not provide Sisih's reserve invariant. Payment Kit therefore is not a vault substitute here.

## Isolated boundary check

On 8 November 2026, Tatum Mainnet `MovePackageService.GetFunction` independently returned the deployed descriptors for `0x2::allowance::new`, `balance_spend` and `app_balance_spend` at checkpoint 342867743. The app-bound path explicitly consumes `SpendPermit<A>`. [primitive-inspection.json](primitive-inspection.json) preserves the actual responses. This confirms availability through the installed SDK/Tatum path; it does not establish a deployed Sisih reserve-policy app.

`server/src/mainnet/allowance-evaluation.test.ts` uses the installed `@mysten/sui` implementation, not a hand-written mock. It confirms that a direct allowance intent has no app gate, an app-bound intent carries both an app type and a required permit input, and allowance funds cannot silently fall back to the gas coin. This establishes the integration boundary; it is not an onchain Mainnet simulation. An onchain alternative prototype was deliberately not published because the local CLI is below the current Allowances prerequisite and publishing both designs would add cost without proving the selected reserve semantics.

## Selected contract responsibilities and limitations

The selected module enforces current free-versus-reserved separation; exact operator capability; fixed commitment payees; reserve funding order; per-request/daily/expiry/pause/revoke policy; and owner-only policy/commitment changes. Walrus preferences may decide whether to ask the owner, but cannot bypass these Move checks.

The owner can change or emergency-withdraw their own commitments, so reserves protect against the delegated agent/operator, not against the owner. The package is project code with test evidence, not a third-party audit. Deployment-held operator, agent and facilitator keys remain trusted for their scoped roles. Release and merchant settlement are separate transactions and require the persistent recovery process described in the runbook.
