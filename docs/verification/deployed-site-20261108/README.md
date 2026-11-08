# Production page update — 8 November 2026

The owner requested updating/checking the pages originally built by Gemini after the Mainnet milestone was pushed to GitHub. The existing production site had still been serving the 7 November build. Home, Connect and Proof are now deployed from source commit `bcee8eeeb04810c3367c0f65008272078fb5ee32`.

- Canonical site: https://sisih-azure.vercel.app
- Deployment: https://sisih-ppjfuk6p7-zkzoras-projects.vercel.app
- Vercel ID: `dpl_4Qs6uyAQ5zbYzZLC4EnSGMEWujFb`; production status Ready.
- Root directory: `web`; pnpm 11.28.6, Next.js 16.4.5, Node 24. Remote production build and TypeScript passed.
- Uploaded a clean `git archive` checkout, with only public `.vercel/project.json` added. No local env, wallet journal or database was copied. The Vercel ignore rules also explicitly exclude local Mainnet journals and nested env files. Existing production environment settings were retained.

The hosted pages now display the recorded Codex Mainnet task, native-USDC x402 receipts, stored Walrus rule and final reserve refusal/revocation. Historical Testnet receipts remain separate. **This deploy did not migrate the interactive runtime to Mainnet.** `/api/state` still reports Testnet vault `0xbfb09999511c994267cc79aa4d28de859004a0ff3b91de30155c8ee205fae962`, session 2, namespace `sisih-hosted-9`, matching the pre-deployment observation. Mainnet owner keys stayed local; no new purchase or chain transaction was initiated.

`report.json` records Chromium checks against the canonical production domain: Home/Connect/Proof at 375/768/1280/1440 px, light/dark captures, no overflow, keyboard focus, shell tabs, copy success/failure, state-API outage/retry, theme persistence, legacy redirects and served skill. All 778 text contrast checks passed, with no page errors. These browser checks intercepted `/api/state` with a 503 fixture to avoid changing mutable demo state.

`deployment.json` separately records live HTTP checks: all three pages returned 200, Mainnet Proof text and verified Codex recipe appeared, unauthenticated MCP and owner requests returned 401, and the actual ChainScope endpoint `/merchants/chainscope/vault-report` returned x402 v2 HTTP 402 with its payment-required header, `sui:testnet`, amount 800000. No payment signature was sent. `/api/health` responded with x402 executor and Walrus health OK; its Tatum indicator reflects a cached prior read, not a new independent chain verification.

The initial merchant probe accidentally used the incomplete `/merchants/chainscope` path and got 404. `initial-probe.json` preserves that result; the registered `/vault-report` route then passed without an application change.

Later Git commits update deployment documentation and the browser verification script's output/revision parameters; they do not change deployed application code. The original Mainnet execution evidence remains unchanged and identifies its own earlier dirty source revision. No repository visibility change, blog/social publication or hackathon submission was performed.
