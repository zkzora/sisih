# Two-to-three-minute recording

Draft. Use the completed local Mainnet run in `evidence/mainnet-20261108`: real Codex MCP task, owner CLI/local signing, two verified x402 payments, Walrus recall and reserve refusal. Do not reset Testnet or execute extra Mainnet payments for a cleaner take. The video has not been recorded/uploaded.

## Capture sequence

| Edited video time | Screen and narration | Evidence label |
| --- | --- | --- |
| 0:00–0:20 | Home: an agent can spend useful API money while leaving bills short. Reserves make only the free pool available. | Product explanation |
| 0:20–0:45 | Connect: same MCP URL, different credentials. Agent task requests a ChainScope vault-health report; display the held request ID. | Actual external-agent transcript; show client/version and network |
| 0:45–1:10 | Owner CLI approval with remember; exact intent and local signature. Show release and x402 settlement, then the report used by Codex. | Recorded Mainnet task; owner key stays local |
| 1:10–1:35 | Walrus job becomes stored with blob provenance. Fresh application/model session recalls the rule; second report is allowed. | Real stored status, fresh-session transcript; cuts do not imply transaction latency |
| 1:35–2:00 | Preference remains active but the third 0.80 report exceeds 0.60 free. Show refusal and `EExceedsFree`. | Actual application refusal plus unsigned Mainnet simulation; no refusal broadcast |
| 2:00–2:30 | Proof: receipt links, memory provenance and limits. Close on what was established and the current network. | Read-only proof, not current mutable state |

Suggested closing: “One remembered approval changed a later decision. It did not unlock the owner's commitments. These payments, memories and public connection are on Mainnet. Permission is now revoked, with 1.40 USDC left in the vault.” Show 0.083418818 SUI net gas and four verified memories. The public connection is read-only; do not imply that another purchase is currently enabled.

## Preserve the completed Mainnet run

Use the real transcripts and read-only Proof page; the approved two-purchase budget is consumed. The full run took 13:03–13:10 UTC; edited timestamps are narrative timing, not claimed chain latency. Source links were improved after payment and checked read-only; do not imply the original response already included them. The initial agent summary confused the default threshold with a remembered rule; later verification corrected this. Claude Code was quota-blocked; identify Codex as the Mainnet client. Owner-assistant model behavior was not recorded.

Before sharing: remove tokens, private keys, `.env` contents and signing payloads from the capture. Keep public addresses/request IDs/digests. Show waiting time honestly or mark a time cut. Publishing/uploading the video requires separate authorization.
