# Research: how comparable agent-payment products are tried

Reviewed on 2026-11-06 (Asia/Jakarta). This is research and a proposed test plan, not an implementation or a claim of production security.

## Finding for Sisih

Sisih's target user is an owner funding an agent while money is already committed to bills or savings. The failure is that apparently available wallet money includes those commitments. The demonstration must show a useful purchase completing, an unfamiliar merchant reaching an owner, the agent continuing after that decision, a later request benefiting from memory, and a request still being refused when commitments leave insufficient free funds.

The strongest alternatives already provide agent budgets, approval queues, receipts, and MCP or HTTP integrations. Pink also presents purpose-specific vaults. Those features alone are not a distinctive Sisih claim. Sisih should demonstrate how commitment funding changes the available spending amount and how recalled owner preferences change permitted decisions without overriding the contract.

Separate three experiences: an immediately understandable example, a documented connection for an external agent, and inspectable network evidence. A public example may be simulated or replayed if labeled; it must not be presented as a newly executed onchain payment. The existing Sui Testnet and Walrus Mainnet integration remains the live evidence path.

## 1. Pink Agentic AI Payments

Sources:
- [Public demo console](https://agentic-sandbox.pinkwallet.com/demo)
- [Developer quickstart](https://pinkwallet.com/agentic/developers/quickstart/)
- [MCP and REST integration](https://pinkwallet.com/agentic/developers/)

First-hand browser check: opened the console without signing in. Its banner explicitly says it uses sample companies, changes are not saved, and reloading resets the demo. A guide panel explains what to try. Clicked “Simulate a day of agent spending”; it generated ten sample requests and showed automatic, waiting, and blocked outcomes with reasons. The approval queue also contained two initially seeded items, so its total waiting count was not a count of newly generated holds alone. Selected the 64-dollar Amazon Business request and approved it; the UI showed a simulated credential-issued confirmation and the waiting count decreased.

No real funds, external credentials, or live bank payments were used. This checks the public demonstration experience, not the sandbox backend's security or production availability. The developer quickstart separately describes creating a sandbox workspace, using an agent-specific key, testing three outcomes, and polling after a human decision.

Transferable lesson: explain the example, give a visible first action, and show the rule behind each outcome. Keep the developer connection and the human approval interface separate.

## 2. spendctl

Sources:
- [Official SDK and plugin repository](https://github.com/miraistudio/spendctl-sdk)
- [Maintainer's sandbox explanation](https://www.reddit.com/r/mcp/comments/1xges3d/spendctl_sandbox_a_remote_mcp_server_where_the/)

The official repository supplies a login-free sandbox plugin and separate agent and administrator APIs. The maintainer describes a remote MCP sandbox with disposable wallets and mocked paid services. Its suggested exercise includes a successful call, a denied endpoint, and inspection of remaining budget and receipts. The maintainer also describes a practical problem: representing a held payment as a tool error caused Claude to report a failure. A normal pending result with an approval identifier preserves the distinction between a completed tool invocation and a completed payment.

Evidence boundary: inspected the official repository and maintainer's account. Did not install the plugin or invoke its MCP sandbox. The main documentation website was inaccessible through the research tool. Maintainer descriptions of concurrency tests and sandbox behavior are not independent execution results from this review. The unrelated Python personal-finance project also named spendctl is not this product.

Transferable lesson: a payment request needs explicit machine-readable outcomes and stable identifiers. Agent credentials must not acquire administrator approval powers. The model must be able to read its own receipts and budget.

## 3. Coinbase Wallet MCP

Source: [Official Wallet MCP documentation](https://docs.cdp.coinbase.com/ai-agents/coinbase-for-agents/wallet-mcp)

The documented onboarding connects an MCP client and authorizes wallet access. Examples start with simple balance queries. For x402, the assistant initiates a request with a maximum payment, receives a human approval link and request identifier, and completes the request after authorization. The completion returns the paid endpoint's response. The documented x402 networks include Base and Base Sepolia; this is an interaction reference, not a Sui integration dependency.

Evidence boundary: documentation review only. No account connection, wallet authorization, or payment was performed. The documented skill guides the model through onboarding, approval handling, and result verification; exposing tools alone is not the whole experience.

Transferable lesson: provide an exact connection command, a harmless first prompt, an explicit approval handoff, and a clear continuation to the purchased result.

## Proposed Sisih experience

Implemented on 2026-11-07 (MCP adapter, Explore demo, Connect your agent); results in docs/PROGRESS.md.

1. An entry screen explains the owner, agent, commitments, and free funds in one concrete example.
2. “Explore an example” presents an isolated simulation or labeled replay of the existing evidence. It never silently mutates the shared live vault.
3. “Connect your agent” provides MCP instructions, an agent-scoped credential, supported services, a read-only connection check, and a copyable task prompt.
4. Claude Code requests a service; the dashboard shows the same request ID and its status. Prices, payees, and categories come from the validated merchant/invoice path.
5. A human approval happens in the owner interface. The agent resumes the existing request, receives the purchased service response, and produces a task result that is visibly based on that response.
6. A fresh agent session recalls the saved preference. A separate low-free-funds case still fails the vault rule.

Retain Sui Testnet for vault and settlement and Walrus Mainnet for memory. Label demo merchant content honestly. Do not promise current market research from the existing fixture payloads. An external agent must not receive permission to approve itself, reset the demo, withdraw funds, or change reserves.

For the first MCP proof, reuse the existing controlled live demo with scoped access; do not silently expand this into a per-visitor onchain wallet platform. The shared vault needs an explicit lease/busy response. Automatic isolated visitor vaults would be a separate implementation milestone.

## Acceptance tests for the real-agent integration

| Case | Independent observable result |
| --- | --- |
| Connection | A new Claude Code session discovers the documented tools and reads its allowed services without receiving owner authority. |
| Permitted purchase | One invoice leads to one verified settlement and a service response that the agent uses in its final answer. |
| Owner review | An unknown merchant produces a pending request ID, explains why, and does not charge while awaiting the owner. |
| Resume after approval | The same request continues after owner approval; polling or retrying does not create a second charge. |
| Refusal or expiry | The agent reports the actual outcome and does not retry indefinitely or replace it with a different purchase. |
| Reserve boundary | A remembered allow rule cannot pay an amount above free funds; no reserved balance is released. |
| Memory benefit | A fresh session retrieves the saved preference and changes the applicable decision, with a traceable source memory. |
| Repeated or parallel call | Duplicate calls do not double-pay, and concurrent requests cannot jointly exceed the enforced spending boundary. |
| Role separation | An agent credential is refused by owner, reset, withdrawal, and reserve-changing routes. |
| Failure visibility | Payment errors, pending verification, and memory writes still in progress remain distinct; the agent never reports unverified success. |

Run existing policy and Move tests as regression checks when changing their behavior. Add tests for the new MCP adapter and authorization/continuation boundaries; do not rerun or reset the hosted evidence merely to edit this research document.

## Small next experiment

Before building more UI, complete one genuine Claude Code invocation against the intended Sisih MCP adapter: request service, reach owner review, approve in the dashboard, resume, and obtain usable service content. Then test one reserve violation and a fresh-session recall. Record the model/client version, request IDs, elapsed times, transaction digests, memory blob IDs, and any failures. Do not force the model into a preselected successful trace or count a scripted simulation as this experiment.

These comparisons establish interaction patterns and practical alternatives. They do not establish competitor adoption, customer demand for Sisih, a security guarantee, or hackathon award eligibility.
