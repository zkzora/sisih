# Handoff

## Network decision (2026-11-06, replaces the mainnet migration)

| Integration | Network | Endpoint |
| --- | --- | --- |
| Move vault (reserves, caps, permission), agent releases, bill payments | **Sui Testnet** | package `0x37a5513a911110d00b9c795390d1af5b04a3873e6df4856b54ede7e74ba886e9`, vault `0xbfb09999511c994267cc79aa4d28de859004a0ff3b91de30155c8ee205fae962` |
| x402 settlement (demo merchants, facilitator) | **Sui Testnet** | network id `sui:testnet`, testnet USDC |
| Every Sui read and write | **Tatum Sui Testnet gRPC** | `sui-testnet-grpc.gateway.tatum.io:443` |
| Walrus Memory (decisions, rules, outcomes, summaries) | **Walrus Mainnet** | relayer `https://relayer.memory.walrus.xyz`, server-side delegate key |

Basis: the hackathon rules (https://thewalrussessions.wal.app/tatum-total-recall and
https://recall-tatum-walrus.vercel.app/) require Walrus Memory writing on Mainnet, at least 10 memories
on Mainnet, Tatum RPC for onchain data where relevant, a published blog post, a working demo, a public
repo and a 2 to 3 minute video. Neither page names a Sui network; the Best Use of Agent Payments bonus
says "settled on Sui". No eligibility or bonus is claimed beyond that text.

The judge never switches wallet networks for memory: the server writes Walrus Memory with its own
delegate key.

## Cancelled: mainnet funding and migration (historical, do not act on it)

The earlier Phase 5 plan moved the vault and x402 to Sui mainnet and asked for 23.50 USDC + 1.50 SUI
on the mainnet owner address. **Cancelled on 2026-11-06. Do not send mainnet funds.** No mainnet
transaction, deployment or funding was made. The fresh mainnet keys generated for it are kept,
unused, in `.env.mainnet` (gitignored, never on Vercel). A 20.00 USDC transfer to that owner
address landed on testnet and is untouched.

## Status

See docs/PROGRESS.md (Phase 5: testnet demo finalization) for the evidence of this run.
