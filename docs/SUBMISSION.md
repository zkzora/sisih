# Total Recall submission draft

Unsubmitted; no credentials in this file. Rules checked 8 November 2026 at the [official event page](https://recall-tatum-walrus.vercel.app/) and [Event Rules](https://thewalrussessions.wal.app/tatum-total-recall). Deadline shown: 10 November 2026, 17:00 UTC (11 November 00:00 Jakarta).

## Requirements and current evidence

| Requirement | Evidence / outstanding action |
| --- | --- |
| Walrus Memory writes on Mainnet, at least ten stored memories | Historical `sisih-hosted-9`: 13 stored, per-job/blob checks; earlier `sisih-hosted-6`: 35. New Sui Mainnet proof has four verified memories; do not claim it alone meets ten. |
| Tatum onchain data where relevant | Application Sui reads, builds, simulations, submissions and receipt checks use Tatum gRPC. Eight actual Mainnet receipts verified, including two x402 settlements. Public runtime reads the actual Mainnet vault and completed state. |
| Working demo and public repository | Demo: https://sisih-azure.vercel.app. Repository https://github.com/zkzora/sisih was verified private on 8 November; public visibility still needs authorization. |
| Published blog | `BLOG.md` is a draft; publication URL still required. |
| Short video | Rules list two to three minutes; `RECORDING.md` is the capture script. Uploaded URL still required. |

Track: Consumer Finance Apps. Potential bonuses cover x402 or MPP settled on Sui, visibly changed memory behavior, and optional social sharing. Tatum AI Builder's dedicated bonus is not claimed: it was not used. Neither the official checklist nor this project guarantees a prize; Sui Mainnet payments are our milestone, whereas Mainnet Walrus writes are the stated requirement.

## Project description

Sisih protects bills and savings when an owner delegates paid API/data tasks. Its Sui Move vault keeps commitment reserves separate and releases only the current free pool within agent caps, expiry and pause/revoke controls. Owner preferences persisted in Walrus Memory can remove a repeated review, but cannot override the vault.

The current demonstrated task uses Codex CLI over a restricted MCP credential and local owner CLI signing. It bought two 0.80-USDC live ChainScope reports through native-USDC x402 on Sui Mainnet. A stored Walrus preference changed a fresh-session decision; a third request was refused with the preference active, independently supported by an unsigned contract simulation. Final permission is revoked. [Exact receipts and transcripts](evidence/mainnet-20261108/README.md). The public product is Home/Connect/Proof with no operational dashboard. Owner-assistant tools have protocol coverage, not a recorded model-owner-assistant run.

Tatum provides every Sui read, simulation, transaction submission and read-back. Walrus Memory Mainnet stores decisions/rules/outcomes/summaries and supplies provenance for the changed next-session decision. Async jobs are tracked to stored status. Manual reviews in the older five-session run were 2, 1, 1, 2, 2; persistence is demonstrated, monotonic improvement is not.

Home/Connect/Proof and the public MCP runtime are Mainnet-only. The completed proof is read-only with revoked permission, consumed spending allocation, no deployed signing keys and isolated hosted state. Earlier-network evidence stays in the repository archive with original labels. Merchants are project-operated, so 1.60 USDC paid is not customer revenue. Net gas was 0.083418818 SUI; 1.40 USDC remains in the revoked vault. No broad audit, production-readiness or fully non-custodial claim is made.

## Personal fields requiring the entrant

The rules list email, Discord, LinkedIn, discovery source, first-Web3-project answer, Tatum account ID, SUI address, “Account ID (SUI)”, MEMWAL_AGENT_ID, project description, video, GitHub repository and personal building-experience answers. Confirm the live form's meaning of the ambiguous account field; never substitute a demo key without intent. MEMWAL_AGENT_ID is the delegate public key shown in Walrus Memory, not its private credential.

## Private judge access

Supply the current Mainnet credentials privately, with separate owner/agent roles. Public path: Home → Proof → actual receipts and Walrus memory. MCP path: Connect → harmless Mainnet budget/services check → status of `req-7dd90263-75e` and `req-f37bacb5-c6a`. The publication is read-only; no judge should be told to initiate another payment or change owner policy. Do not use old shared-demo credentials. No dashboard unlock is needed.

Do not submit, change repository visibility, deploy or publish this draft without the user's separate authorization.
