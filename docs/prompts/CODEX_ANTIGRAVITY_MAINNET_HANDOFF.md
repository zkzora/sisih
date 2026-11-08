# Codex in Antigravity: finish Sisih's real Sui Mainnet proof

Latest orchestration: read `C:\Sisih\docs\prompts\CODEX_ANTIGRAVITY_FINAL_HANDOFF.md` first. It incorporates this file's detailed execution requirements and adds vault reuse evaluation, a full README rewrite and submission/public-site alignment. Follow its current-state check instead of assuming the older HEAD below is current.

You are working in `C:\Sisih` on Windows. The user wants Sisih to actually support and demonstrate Sui Mainnet payments, not merely display a Mainnet badge or ship another preparation document. Continue the existing implementation and complete all independently actionable work. Produce a concrete funding/execution checkpoint before spending funds whose budget and targets have not been approved.

This prompt governs the Mainnet milestone. The accepted public-site and unified-MCP product decisions remain unchanged. Do not restart their implementation from scratch.

## 1. Recover current state and preserve completed work

At prompt preparation the working tree was clean at `7d599c7` (`Ship public site, role-scoped MCP, and bounded mainnet preparation`). Recheck rather than assuming this remains the latest revision. Read the actual diff and applicable AGENTS.md files. Do not reset or overwrite concurrent changes.

Read these files before deciding what to build:

- `C:\Sisih\CLAUDE.md`, `README.md`, `docs/SPEC.md`, `docs/PROGRESS.md`, `docs/HANDOFF.md`.
- `C:\Sisih\docs\MAINNET_READINESS.md`.
- `C:\Sisih\docs\mainnet\MANIFEST.json`, `MANIFEST.md`, `preflight.json`.
- `C:\Sisih\docs\prompts\GEMINI_SISIH_UNIFIED_HANDOFF.md` for established product behavior. Its previous preparation-only stopping point is superseded by this staged Mainnet completion task; its authority and evidence requirements remain.
- `C:\Sisih\docs\evidence\final-run-sisih-hosted-9\README.md` for historical Testnet evidence.
- `server/scripts/mainnet/`, `server/scripts/publish.ts`, `server/src/owner/`, `server/src/cli/signer.ts`, `server/src/mcp/`, configuration/env loading, payment execution and recovery code.

Already implemented or reported, to verify rather than blindly redo:

- Public Home / Connect / Proof with operational dashboard removed.
- One `/api/mcp` with delegated-agent and owner roles.
- Owner action intents, local owner signing through `pnpm sisih`, network-aware links.
- Isolated Mainnet env selection, preflight/manifest/setup/verification scripts.

The documented Mainnet status is **prepared, not deployed, not funded, not executed**. Do not promote it to a working deployment without evidence.

The source-observed manifest proposes 3.20 USDC deposited, a 1.00 USDC commitment, two 0.80 USDC ChainScope purchases, then a third blocked with 0.60 free. It proposes an aggregate 0.5954 SUI allocation for gas across roles. These are unapproved preparation values, not measured actual costs, a required minimum, or permission to spend. Recalculate exact integer amounts, role funding, budgets and remaining funds from current code and network conditions.

## 2. Product outcome and reference

Sisih protects an owner's bills and savings when an external agent purchases services. Hard reserves and delegated limits live in the Move vault; owner-approved preferences recalled from Walrus can change future decisions but cannot unlock reserves. Keep a successful useful purchase as well as a refusal in the proof.

Reference requested by the user:

- https://invoice-chaser-sigma.vercel.app/
- https://github.com/PugarHuda/invoice-chaser
- Read-only proof: https://invoice-chaser-sigma.vercel.app/api/chaser/proof

The public proof checked on 2026-11-07 reported Sui Mainnet through Tatum, native USDC, Walrus Memory Mainnet and transaction-backed payment records. These are application-reported observations, not an independent audit of every receipt. Its README documents wallet signing, shared Payment Kit registry payments, x402 and separate MPP flows. Its MCP is documented as read-only. Inspect current primary source before applying any details.

Learn the useful pattern: actual Mainnet payment -> verify exact chain effects -> persist memory -> expose inspectable proof. Do not copy its product, transplant its invoice registry as a replacement for Sisih's reserve vault, or add MPP, swaps, SuiNS or another dashboard merely because it has them. Invoice Chaser can reuse a payment registry; Sisih needs its own published vault and correct owner/operator capabilities.

Public site stays **Home / Connect / Proof**. Keep the approved brand and terminal-first operation. One canonical domain MCP serves role-scoped tools. Claude Code is one verified client, not a hardcoded model requirement. Owner signing may use the local helper; that does not require a second domain MCP or an operational browser dashboard.

## 3. Audit Mainnet blockers in current code, then fix them

Do not treat a passing unit suite or the existence of a manifest as readiness. Trace these consequential boundaries:

### Configuration and deployment isolation

- Preserve the working Testnet env, database, deployment and historical proof. Choose an isolated Mainnet state store and namespace. Never reset or relabel hosted-9.
- `.env.mainnet` already holds private keys from the earlier plan. Do not print, regenerate, delete, overwrite or upload it. Verify only public addresses and non-secret configuration. New deployment IDs belong in a separate ignored output file.
- Inspect `SISIH_ENV_FILE` precedence. Existing process env wins over dotenv and the first env file may win over later files; verify the documented two-file recipe really loads the intended IDs, network and credentials. Missing files, mixed inherited credentials or wrong-network IDs must fail clearly before signing.
- Mainnet's owner key remains local. Derive any necessary public owner/agent addresses locally. Build an explicit server env allowlist: operator/agent/facilitator and memory credentials only as required, distinct MCP roles, Mainnet IDs/asset/network and the isolated database. No bulk upload of local env files.
- Validate selected deployment origin, actual chain identifier, native Circle USDC metadata, coin type, package IDs and vault ownership/operator capability through Tatum. A file saying `mainnet` is not an independent network check.
- Read relevant installed Next.js docs before code changes. Confirm the build and runtime use the same selected environment; production build must not execute transactions, write memory or embed secrets.

### Local signing and authorization

- Keep `assertTestnet` on server-demo-owner signing, reset and recycling. Do not remove guards to make Mainnet work.
- Verify owner MCP and CLI configuration, approve/deny, preferences, next-session, pause/resume/revoke really work through the intended owner authorization. A returned unsigned intent is not a completed action.
- Audit `checkIntent`, intent generation, serialization, signature verification and application: owner, network, vault, package, asset, operation, recipients/commitment payee, amounts, permission expiry, nonce, validity window, gas budget and intended request must match authorized inputs. Reject malformed and negative values. Use actual independently reviewed limits, not just a broad hardcoded 100-USDC sanity bound.
- Bind offchain approvals/preferences to exact action parameters and request/environment. Enforce replay protection and intent state transitions durably. Validate actual submitted transaction contents/effects, not only a matching signature.
- Spending-agent credentials cannot use owner tools even when calling names hidden from discovery, legacy HTTP owner routes or signing/proxy endpoints. Missing credentials fail closed on Mainnet even in local mode. Owner identity never comes from a role string or client name.
- Preserve legitimate owner control while a spending-agent lease is held. A shared demo-token route must not bypass Mainnet owner authorization.

### Transaction execution, budget and retries

- Every Sui read, simulation and broadcast goes through existing Tatum native gRPC with throttling; no silent public-RPC fallback. Verify current official documentation where SDK/network details are uncertain.
- Audit publish, create_vault and setup as money-moving commands. `--help`, preflight, estimate and default simulation must not sign/broadcast. Require explicit execute mode and a validated manifest for live commands.
- Check manifest validation against actual operator/agent addresses, package/vault, USDC type, recipient, limits, expiry and selected environment, not merely owner and network strings.
- Publication/setup must persist progress immediately and resume safely after interruption. If publish succeeds and create_vault times out, recover the known transaction rather than republishing. Setup must not deposit twice or duplicate commitments when rerun.
- An aggregate manifest funding figure is not a budget enforcement mechanism. Implement persistent accounting/reservation for authorized USDC actions and gas attempts, with per-role limits and concurrency handling. Identify gross funding, net gas charged and storage rebates separately. Stop on remaining-budget exhaustion or unknown outcomes; never increase funding/caps automatically.
- Report hybrid Testnet-derived gas estimates as estimates. Replace with valid Mainnet simulations where possible; mocked-gas simulation is not a funded broadcast. Include every role's usable gas coin/budget requirement and any key-funding transfers in the execution plan.
- Before any broadcast, prebuild and persist the intended transaction/digest where supported. Reconcile unknown outcomes before retries. Retry a known signed transaction only with understood semantics; do not build a second spend because an HTTP response was lost.

### Payment delivery and evidence verification

- Trace invoice validation -> policy -> release -> x402 settlement -> delivered ChainScope report -> Tatum read-back -> memory. Model-supplied prices/recipients never override registered terms.
- Distinguish a completed release from completed merchant settlement. Merchant 503, timeout, failed delivery or pending chain outcome cannot be described as `nothing moved` if release happened. Implement and document recovery without duplicate release/settlement.
- Same key means same intended purchase; a fresh purchase uses a new key. Persist before execution; test process restart and concurrent attempts.
- Audit `mainnet/verify-evidence.ts`: currently it prints a chain execution failure but may exit successfully unless a digest is missing. A verifier should compare expected success/failure and expected sender, asset, recipient, amount, vault/package and effects. A valid unrelated success digest must fail verification. Expected simulated refusal is distinct from a broadcast transaction.
- Walrus writes are async: accepted job, writing and stored are different. Verify actual job/blob status and durable preference provenance. Do not fabricate memories just to reach a count or infer stored inventory from recall top-k.

## 4. Finish local implementation and produce an exact live checkpoint

Do all authorized code, fixture-based verification, build, read-only network preflight, simulations and documentation without waiting for funding. Use the existing scripts after auditing their behavior; do not run a money-moving script just because its filename sounds like a check.

Create/update:

- `docs/mainnet/RUNBOOK.md`: exact PowerShell commands from repo root, setup/env/cwd, key custody, build, preflight, isolated app startup/deployment, publication, creation, deposit/policy, owner/agent sessions, verification, interruption recovery and shutdown.
- `docs/mainnet/MANIFEST.json` / `.md`: exact public role addresses, environment/origin, merchant recipient, isolation target, maximum USDC allocation and purchase caps, integer-MIST gas caps, estimated vs actual methodology, operations and expected effects. An unresolved placeholder cannot be labeled approved or execution-ready.
- An explicit server env inventory with secret names only and a local-only owner signer recipe. Never put actual secrets into the runbook or evidence.
- Tests exposing the boundary failures above, using fixtures/mocks/simulation appropriately. Existing guards and Testnet workflows remain regression controls.

Choose routine defaults yourself where reversible: a unique `sisih-mainnet-proof-*` memory prefix, local isolated database for rehearsal, proposed separate project name. Do not send the user a list of optional preferences or require a hosted database just to test locally. An external process on the same machine can exercise local MCP.

Before live financial execution, present one compact checkpoint containing the final maximum USDC and SUI allocation, funding addresses, merchant recipient, exact deployment target, key custody and the operations to be performed. The user has requested Mainnet implementation; they have not approved the old manifest's specific funding values or an unrelated wallet transfer. If a later explicit approval already covers this exact plan, do not ask again.

Do not request private keys in chat. Tell the user the local ignored configuration variable/file if a secret is missing. Distinguish absent credentials from unfunded wallets and from a code defect. Keep progressing on independent work until only a genuine external dependency remains.

## 5. After explicit approval of the concrete live plan

This phase is part of the intended final outcome, not a reason to call the project done at preparation. Execute only the authorized target and budgets. Do not push, publish social/blog content, change repository visibility, submit the hackathon form or replace the working Testnet site unless specifically authorized. A separate public Mainnet deployment needs its target included in the approved checkpoint; a local proof can precede it.

1. Verify funding from the chain, current owner/operator identities, native USDC asset and remaining gas budget. Any wallet funding transfer must have its own authorized source/amount; detecting an accessible wallet does not authorize draining it.
2. Publish the actual vault contract, preserve UpgradeCap custody, create the Mainnet vault and read back package/object/cap ownership. Persist and reuse exact IDs.
3. Deposit the approved allocation, add the reviewed commitment and grant the scoped agent policy. Read back total/reserved/free and expiry.
4. Start an actual external spending-agent session with only delegated credentials. A new ChainScope purchase is held without settlement. Owner approves and remembers through owner MCP/local signing or the working CLI path; record which interface was used. Agent resumes the same request and consumes the live Mainnet report with receipts.
5. Wait for actual stored rule memory. Start a fresh agent session with no prior conversation; owner starts the new application session as required. A new purchase is allowed because of recalled preference, settles once and returns useful live data.
6. A third purchase is blocked when it would cut the remaining commitment. Verify the allow rule is still active and balances support the reason. Use a correctly scoped contract simulation to independently demonstrate `EExceedsFree`, labeled simulation. Broadcast a negative test only if explicitly included in the approved gas plan.
7. If included in the budget, demonstrate owner pause/revoke. Finish with a deliberate permission state and release shared leases. Do not silently withdraw reserves or collect funds from unrelated addresses.
8. Verify every actual receipt and memory. Record balances and gas actually charged per role, pending/unknown effects, what remains in the vault and who controls merchant proceeds. Project-operated merchant payments are not external customer revenue.

Use the real installed external-agent client available in this environment. Existing Claude Code evidence is not proof Codex/Antigravity was tested. A deterministic script exercising MCP is useful protocol coverage, but label it as scripted; it does not establish a real model selected and completed a task. Do not claim the owner assistant completed local signing if a person ran CLI commands instead.

## 6. Verification and final deliverable

Run appropriate server/web tests, typecheck/build and Move tests if contract behavior changed. Add focused signing, manifest, recovery, duplicate payment and evidence-verifier checks. Do not rerun live payments to improve a screenshot or test count. Validate Home/Connect/Proof and network labels locally after related changes; no dashboard is reintroduced.

Save a new evidence directory for the Mainnet run with exact code revision, origin/network/package/vault/coin type, request IDs, transaction digests, expected and actual effects, gas costs, live merchant output, owner authorization/interface used, Walrus jobs/blobs and fresh-session transcript. No credentials or raw private keys. Preserve Testnet evidence unchanged.

Update Proof/README/SUBMISSION/HANDOFF/PROGRESS and recording instructions only to facts established. Keep the two runs visibly separate. Do not replace Testnet explorer URLs by changing the network path on old digests. If the new Mainnet namespace has fewer than 10 actual stored memories, say so; retain the valid Walrus evidence already available and make no artificial compliance claim.

The final report must distinguish **implemented locally**, **tested with isolated fixtures**, **simulated on Mainnet**, **broadcast and verified on Mainnet**, **deployed**, and **blocked on funding/credentials/approval**. Give exact commands and a concrete remaining blocker if execution cannot finish. If a transaction outcome is unknown, report it as unknown and stop additional spending until reconciled.

Do not finish with a plan-only answer or another unverified `mainnet ready` label. Complete the implementation and evidence available within authorization, then request only the specific remaining external action needed to carry the real proof through.
