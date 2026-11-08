# Sisih current handoff

Updated 8 November 2026. The user explicitly requested retiring the public legacy runtime and publishing Mainnet only. Execution-time source hashes remain in the immutable evidence archive; Git history identifies later presentation/publication changes.

## Current state

- Public product: Home / Connect / Proof, one role-scoped MCP endpoint, CLI companion/local signer.
- Current target: `https://sisih-azure.vercel.app`, Mainnet-only public pages and MCP. The earlier `bcee8ee` deployment verification is historical and superseded by this migration.
- Mainnet: two real Codex x402 purchases, stored Walrus recall, reserve refusal and revoke. Completed state is copied to dedicated hosted PostgreSQL schema `sisih_mainnet_proof_20261107`. Read-only public-origin binding preserves the immutable local financial manifest; all signing keys are excluded from production. [Publication config](mainnet/PUBLIC_DEPLOYMENT.json).
- Original earlier-network evidence remains in repository archives with its exact receipt networks. It is removed from public page flows, not destroyed or relabeled. The 13 earlier memories remain verified Walrus Mainnet storage evidence.
- Selected primitive: existing tested Sisih custom vault; [decision and sources](mainnet/VAULT_DECISION.md).

## Mainnet implementation

Validated manifest binds identities, native asset, scenario math, per-operation and aggregate gas authorizations. Publish/setup are explicit-execute commands with pre-submission journaled bytes/digests and immediate public-ID persistence. Setup refuses an unjournaled nonempty vault. Unknown results stop replacement transactions.

Database budgets use atomic reservations across instances, stable operation IDs and conservative unknown-outcome accounting. Runtime purchase outflow is limited to the reviewed two reports. Owner final revoke has its own remaining gas ledger. Mainnet owner intents bind environment/action/asset, require a local signature, reject stale targets and enforce the proof's approved scope. Agent and owner authentication remain separate.

The server-only env generator excludes owner keys and preserves generated role tokens. `.env.mainnet` is untouched. Runtime/deployment/server env files and transaction journals are ignored. Start the server with `.env.mainnet.server`, never the owner-key file.

## Executed financial checkpoint

See [MANIFEST.md](mainnet/MANIFEST.md) and [authorization](mainnet/EXECUTION_AUTHORIZATION.md). Approved deposit: 3.000000 native USDC; gas ceiling: 0.205000000 SUI. Actual merchant outflow: 1.600000 USDC; actual net gas: 0.083418818 SUI. Verified final vault: 0.600000 free + 0.800000 reserved; permission revoked. Owner wallet retains 0.015780 USDC and 0.089427012 SUI; operator 0.057154170 SUI. No funds were withdrawn/refunded.

Original execution target: `http://127.0.0.1:8788/api/mcp`, isolated PGlite. The later explicit Mainnet-only request authorizes the existing canonical domain to publish completed state read-only. A dedicated PostgreSQL schema on the existing managed instance provides isolation; old public tables are not used or overwritten. No new blockchain action is enabled, and the historical proposed second Vercel project is unused.

The exact checkpoint was presented before spending; the owner then said “lanjut udh gw kirim semua”. Funding was verified through Tatum before execution. Do not rerun purchases: the two-report allocation is consumed. Four memory jobs/blobs are stored and independently checked. MCP rule-source links were added after payment and validated by a read-only Codex follow-up. Its initial refusal summary confused the default threshold with a remembered rule; the follow-up corrected that distinction. A model owner-assistant session remains unverified.

## External actions still separate

No Git push, repository visibility change, public Mainnet deployment, blog/social publication, video upload or hackathon submission is authorized merely by finishing local implementation. Drafts are under `docs/`. Personal identity fields and private judge credentials belong in private submission channels.
