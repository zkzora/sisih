# Public product and submission review — 8 November 2026

Audience: an owner funding paid agent tasks from money also promised to bills/savings, and judges inspecting the mechanism without risking another real payment. Product stage: demonstrated hackathon build, not an audited production wallet service. Target outcome: one useful purchase, remembered owner decision, a changed fresh-session decision and a hard reserve refusal with inspectable evidence.

## Findings and implemented corrections

The global header originally labeled the entire product with the public legacy runtime's network even though Mainnet payment proof existed. Connect then mixed that endpoint with Mainnet client claims, old signing assumptions, long tool catalogs and internal file/command references. The owner's subsequent instruction explicitly retires that public legacy runtime.

- Home/header/metadata now lead with verified Sui Mainnet payments. Removed “zero-key”, “any MCP client”, instant-control and unqualified review-improvement claims. The role boundary and server signer in the actual spending run are stated accurately.
- Connect uses the canonical Mainnet MCP URL and current Mainnet credentials. First action is a harmless read; second action retrieves completed request `req-7dd90263-75e` and refusal `req-f37bacb5-c6a`. The publication is closed to new spending, has no signing keys and keeps permission revoked. Owner role stays separate; a token is not a wallet signature.
- Removed sandbox setup/reset/buy instructions and historical network flows from public pages. Archived receipts retain original networks in the repository. The served skill describes the current completed Mainnet deployment.
- Proof now tells one coherent Mainnet story with useful report output, payment and memory source links, then reserve refusal and final revoke. Full hashes, all eight receipts and debugging caveats are available under technical disclosure rather than dominating the first screen. Four current memories are reported separately from historical inventories.
- `/api/state` on the public Mainnet mode reads the actual configured vault through Tatum. Unknown or wrong-network UI responses fail unavailable rather than being labeled Mainnet. The stale legacy snapshot is not presented as current Mainnet state.
- `/dev/states` previously returned 200 with internal fixtures. The route now uses a server-side production guard returning 404, irrespective of a former public debug flag.
- The completed local database was copied to dedicated PostgreSQL schema `sisih_mainnet_proof_20261107` on the existing managed instance. Schema-qualified tables avoid pooled-session search path leakage. Original tables are neither copied as Mainnet nor overwritten. Spent budgets, request idempotency and memory provenance are preserved. Read-only origin authorization is separate from the immutable local financial manifest.

## What belongs on each page

| Page | Primary content | Detail / excluded content |
| --- | --- | --- |
| Home | Specific failure, reserve-first mechanism, Mainnet proof CTA, strongest simple alternative | No invented traction, bank guarantees, generic “any client” claims or developer key setup |
| Connect | Actual Mainnet URL, credential role, read-only status, copyable harmless client setup and recorded-request prompt | Owner configuration model in disclosure; no keys/tokens, fake public access, reset or instructions to spend again |
| Proof | Two real 0.80-USDC purchases, first held, local owner approval, stored rule, fresh-session change, reserve refusal and revoke | Receipt hashes and verifier methodology disclosed; original transcripts kept; simulation distinguished from broadcast |
| Repository | Exact implementation, limitations, transaction/memory archives, setup and review reports | Secrets, serialized local signing journal, local env and live database remain excluded |

## Scorecard

Scores are review judgments for this bounded demonstration, not a market or security certification.

| Dimension | Score / 10 | Evidence and remaining limit |
| --- | ---: | --- |
| Onboarding | 8 | Mainnet proof first; no wallet needed to inspect. MCP credential still supplied privately. |
| Core experience | 8 | Actual Codex purchases and delivered live reports; current public publication is read-only. |
| Error handling | 8 | Wrong-network/unavailable state fails clearly; unknown payment recovery and publication guards tested. |
| Information architecture | 8 | Three pages, single Mainnet narrative, protocol detail behind disclosures. |
| Visual design | 8 | Approved brand preserved; 375–1440 px checks, both themes, expanded disclosures. |
| Performance | 7 | Static proof survives API outage; current vault reads depend on Tatum/hosted Postgres latency. |
| Accessibility | 8 | Keyboard/copy/focus/contrast and native disclosures checked; no full assistive-technology audit. |
| Completeness | 7 | Core mechanism demonstrated; broad owner onboarding, independent merchants and demand validation remain outside this proof. |

Overall: **7.8 / 10**. Strongest points: real Mainnet effects, stored provenance with changed next decision, hard refusal despite preference. Highest-impact remaining work: entrant-facing submission links/access, a clear recording of the actual run, and later validation with real owners/independent merchants.

## Evidence rechecked without spending

All eight Mainnet receipts passed exact read-back again: [report](mainnet-pre-submit-recheck.json). The vault remained 1.40 USDC = 0.80 reserved + 0.60 free with policy absent. [Four current memory jobs/blobs](mainnet-memory-pre-submit-recheck.txt) matched both the relayer and full account inventory. [Historical 13-memory inventory](historical-memory-pre-submit-recheck.txt) was also independently rechecked; those are Walrus Mainnet memories from the earlier project run, not 13 memories in the new payment namespace. No artificial writes or new payment were made.

Server suite: 194 tests passed; after HTTP publication assertions, the affected MCP/publication/runtime suites passed 33 tests. Web: 26 passed, including rejection of mismatched network state. Both typechecks and production build passed. Browser reports cover four viewports, both themes, collapsed/expanded disclosures, API errors/retry, network mismatch, copy, shell tabs, focus, redirects, hidden dev fixtures and text contrast. PowerShell and Bash snippets were parsed without executing purchase commands. Deployment and a real hosted Codex read check are recorded alongside the final production report. Secret scanning includes the new ignored public-runtime/previous-production configs, with values never printed.

## Before submitting

Official [event checklist](https://recall-tatum-walrus.vercel.app/) and [event rules](https://thewalrussessions.wal.app/tatum-total-recall) were re-read on 8 November. Deadline: **10 November 2026, 17:00 UTC = 11 November, 00:00 WIB**. Requirements include Mainnet Walrus writes, at least ten stored memories, Tatum where relevant, published blog, working demo and public repository; the form also requests a 2–3 minute video. Sui Mainnet payment proof is established here; it is not a substitute for those other deliverables.

Still requiring an entrant decision or external artifact:

1. Repository `zkzora/sisih` was still private at review. Git push is authorized; making it public remains a separate action.
2. `docs/BLOG.md` is a complete draft, but a published blog URL is missing.
3. `docs/RECORDING.md` is a feasible capture script, but an uploaded 2–3 minute video URL is missing. Do not rerun payments to improve footage.
4. Supply current Mainnet role credentials only in private judge instructions, plus entrant identity/account fields and the verified earlier 13-memory inventory. The new payment namespace itself has four memories.
5. Submit the actual form only with the entrant's authorization. No form, social post, repo visibility change or blog/video publication has been performed in this review.
