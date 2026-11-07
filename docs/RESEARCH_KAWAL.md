# Kawal: agent interfaces, public testing, and lessons for Sisih

Reviewed on 2026-11-07, Asia/Jakarta.

## Scope and provenance

Primary repository: https://github.com/PugarHuda/kawal

The default branch is `master`. The inspected current revision is `878834d7bb33c00bfa0e1f36f9ef37de33458609` (2026-10-29). A shallow copy was downloaded to a temporary research directory and read; its dependencies, build scripts, tests, and financial commands were not executed. Additional history was fetched to examine revision `099c811` dated 2026-09-07, before the organizer's stated September 9 build deadline. That revision already contains SKILL.md, lib/server.mcp.ts, tests/mcp.spec.ts, and ADVANTAGE.md. This does not establish exactly which revision judges evaluated.

The repository identifies BNB Chain's Build the Era event, not Tatum Total Recall. The official event page confirms the marketplace brief and separate main/partner prizes:
https://www.bnbchain.org/en/hackathons/smart-money-era

An organizer announcement naming Kawal and its exact award was not independently located in this review. Treat the user's award report separately from verified implementation evidence. Do not claim MCP, a particular feature, or the current revision caused an award.

## Concrete problem and mechanism

Kawal serves someone selecting an agent from the BSC registry. A registration can declare an interface without proving that it answers or completes useful work. Kawal probes the declared interface, retains observations, examines reputation authorship, compares candidates, and plans scoped authority for different jobs.

Its public server exposes capabilities to other agents. An embedded LLM is not required for these protocol probes, deterministic classifications, or authority calculations. The reviewed classifier is explicitly keyword based. A separate report harness invokes external agents' tools for actual tasks. Do not conflate these three mechanisms with a single autonomous LLM workflow.

## Independently exercised public MCP path

Endpoint: https://kawal-three.vercel.app/api/mcp

Used a small independent HTTP client, without credentials and without running repository code:

| Request | Observed result |
| --- | --- |
| initialize, protocol 2025-11-25 | HTTP 200, server kawal version 0.1.0, requested revision accepted |
| tools/list | HTTP 200, nine tools |
| plan_mandate, capitalUsdt 100, days 7 | HTTP 200; daily seat caps 35, 30, 20, 15 USDT |
| plan_mandate, capitalUsdt 200, days 7 | HTTP 200; daily seat caps 70, 60, 40, 30 USDT |

The nine tools were verify_agent, check_payment, read_reputation, find_agents, agents_by_owner, compare_agents, uptime_history, plan_mandate, and deep_report. Both planning results explicitly stated that no grant was signed or registered. No wallet was connected, no payment was made, and no session authority was created or revoked.

This verifies the public MCP transport and parameterized planner. It does not establish complete interoperability with a real Claude Code conversation or validate every tool and downstream agent.

Tool documentation:
https://github.com/PugarHuda/kawal/blob/878834d7bb33c00bfa0e1f36f9ef37de33458609/SKILL.md

## Independently inspected public website

Opened https://kawal-three.vercel.app/ in a browser. The first screen explains the failure and provides distinct routes to browse agents, inspect limits, and read evidence. It links the public MCP endpoint and A2A card.

Followed “See the limits” to https://kawal-three.vercel.app/mandate. The page separates historical onchain session grants from an unsigned planner. It displays an operator-token field and explicitly restricts revocation and granting to the operator. At review time it displayed zero live sessions out of eleven recorded sessions, with expired/revoked/preempted statuses. Historical transaction evidence must not be described as eleven currently running agents.

The source confirms server-side operator checks before both grantAction and revokeAction, not just disabled browser buttons:
https://github.com/PugarHuda/kawal/blob/878834d7bb33c00bfa0e1f36f9ef37de33458609/lib/operator.ts
https://github.com/PugarHuda/kawal/blob/878834d7bb33c00bfa0e1f36f9ef37de33458609/app/mandate/actions.ts

The public MCP mostly reads, probes registered endpoints, or prepares plans. The paid report consumes evidence of a payment the caller made; it does not give anonymous callers authority to spend the operator wallet. Public usefulness and authenticated financial authority coexist.

## Testing and proof supplied by the project

Read the tests and harness, but did not run the full suite. The reviewed source covers:
- User navigation and the keyboard journey from browsing through comparison to a mandate.
- MCP discovery, schemas, protocol revisions, malformed arguments, resources, prompts, and plan limits.
- Paid-report challenges and rejection of malformed or unrelated transaction receipts.
- A separate production-build instance pointed at a nonworking registry, including fallback and dependency-error behavior.
- Different browser engines, phone widths, accessibility, and content-security-policy behavior.

These are test definitions, not independently observed passing runs from this research.

The Agent Advantage Report compares three external MCP tasks with direct RPC/REST work and describes repeated measurements, costs, outputs, and losses. The source harness invokes actual named tools rather than stopping at connection discovery. Its reported numbers were not rerun here. Its baselines are not uniformly equivalent: for example, the yield path compares multiple vaults with one direct market, and the report itself discloses differences in scope and returned results. Its value as a research pattern is the explicit comparison, not proof that hiring universally wins.

https://github.com/PugarHuda/kawal/blob/878834d7bb33c00bfa0e1f36f9ef37de33458609/ADVANTAGE.md
https://github.com/PugarHuda/kawal/blob/878834d7bb33c00bfa0e1f36f9ef37de33458609/scripts/advantage.ts
https://github.com/PugarHuda/kawal/blob/878834d7bb33c00bfa0e1f36f9ef37de33458609/playwright.config.ts

The README explicitly limits the meaning of an answering interface: successful discovery is not proof that an agent's tasks work. Its paid-report example is its own service; the README does not claim completed paid purchases from arbitrary third-party agents. These disclosures are important when comparing what is actually demonstrated.

## Implications for Sisih

Keep the decision to expose Sisih to an external agent through MCP. The strongest transferable pattern is one domain capability reachable by a person and by an agent, with inspectable results and an explicit authorization boundary.

Public visitors should be able to understand and exercise a safe useful slice immediately: inspect the example budget, service prices, an explanatory decision preview or recorded walkthrough, and existing receipts/memory evidence. Label previews and replay as such. These experiences must not silently initiate payments or present calculations as fresh contract execution.

Purchases through the live shared vault require an agent-scoped credential, bounded requests, idempotency, and existing concurrency controls. Owner approval, reset, withdrawals, and reserve changes remain separately authenticated. Kawal's open read tools do not justify exposing Sisih's operator-funded payment path anonymously.

The critical Sisih acceptance test remains: a real external agent requests a useful service, receives a pending ID when necessary, the owner decides in the dashboard, the same request settles exactly once, and the agent uses the returned service content. A second session demonstrates the remembered preference. A separate reserve-boundary case still fails even with that preference active.

For an effectiveness comparison, use the same requests, balances, commitments, and owner preferences in both conditions. Compare a competent static-policy baseline with Sisih's memory-assisted decisions, reporting legitimate completions, reviews, reserve violations, latency, and costs. Do not manufacture a universally declining review trend or claim a transaction refusal alone proves demand.

No implementation, publication, transaction, or change to Sisih's live demo was performed as part of this review.
