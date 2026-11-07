# Sisih Mainnet proof: funding and transaction manifest

Status: **prepared · not deployed · not funded · not executed**. Generated 2026-11-07T08:17:12.365Z by `server/scripts/mainnet/manifest.ts` from
`docs/mainnet/preflight.json` (read-only, through Tatum). Nothing in this file has been executed.

- Network: sui:mainnet (chain id `4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S`), every call through Tatum.
- Asset: native USDC `0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC` (USDC, 6 decimals, read from chain metadata).
- Current role balances: all 0 SUI and 0 USDC (unfunded).

## Funding request

| Role | Address | USDC | SUI gas cap |
| --- | --- | --- | --- |
| owner (local key) | `0xebd63d9b61f6a9a4f2e46954adb70c66c42e98f127a84a30071c336d63b98990` | 3.20 | 0.4901 |
| operator | `0x3728736836d2ffc9380cd7f1d4c17afc2838a74967e552344e6345bdf7de0fcc` | 0 | 0.1024 |
| facilitator | `0x9ccb348898d029c559913609cdd262ecad0f11afd0e17ceb24dae3bf9f2c3664` | 0 | 0.0028 |

Aggregate SUI gas cap: **0.5954 SUI** (3x the gross estimates plus each role's largest gas budget; budgets are caps, not charges).
Maximum USDC allocation: **3.20 USDC**. To the project-operated merchant: 1.60 USDC
(our own funds coming back to us, not revenue). Expected to remain in the vault: 1.60 USDC
(0.60 free).

## Operations

1. **owner (local)**: publish contracts/sisih (UpgradeCap to owner) (gas estimate 0.0767 SUI, Mainnet simulation (mocked gas), preflight.json)
2. **owner (local)**: create_vault<USDC>(operator) (gas estimate 0.0039 SUI, Testnet measurement BPpnht7M5SKmzETvfYH11FhqkBCUsQqVxe7oZPEZPuDL)
3. **owner (local)**: setup: deposit 3.20 USDC, one commitment 1.00 USDC to the owner's own address, set_agent_policy 1.00 per request / 3.00 per day / 7 days (gas estimate 0.0059 SUI, Testnet measurement 7qCqTe8nTKZktPZxqAkQkrcEQELKND9FdrWHfscaxUp2 (4 commitments: upper bound))
4. **spending agent + owner**: P1: ChainScope 0.80 held (new merchant) -> owner approves and remembers via pnpm sisih approve <id> --remember --yes (local signature) (gas estimate 0.0089 SUI)
5. **owner**: start_next_session (offchain, owner-signed): rules rebuilt from Walrus recall
6. **spending agent (fresh session)**: P2: ChainScope 0.80 approved by the recalled preference (gas estimate 0.0089 SUI)
7. **spending agent**: P3: ChainScope 0.80 refused: free 0.60 < 0.80 despite the allow preference (would_cut_reserve). Refused by the policy engine before any transaction; the contract boundary is shown by simulation only (labeled simulated), no gas spent.
8. **owner (optional)**: pause_agent then resume_agent (owner intents) (gas estimate 0.0102 SUI)
9. **anyone**: verify-memories.ts <namespace> and mainnet/verify-evidence.ts (read only)

## Gas method

Gross gas (computation + storage, rebates ignored). Computation is rescaled from Testnet measurements to the Mainnet reference gas price; storage is unchanged; publish is simulated on Mainnet. Per-role cap = 3x the gross estimates + the largest single gas budget that role sets (it must hold that budget when signing). Budgets are caps, not charges. Mainnet reference gas price 100 MIST; Testnet 1000 MIST.

## Key custody (trust model)

- **owner**: Local only (.env.mainnet on the owner's machine). Signs publish, create_vault, setup and every owner intent via pnpm sisih sign. Never on the server or Vercel.
- **operator**: Server (deployment env). Can only call release_to_agent through the OperatorCap, from free funds, within the agent's caps.
- **agent**: Server (deployment env): the x402 payer for released coins. The spending agent process (Claude Code) never holds it; it has only SISIH_AGENT_TOKEN.
- **facilitator**: Server (deployment env): co-signs x402 settlements as gas owner.
- **note**: Sisih is not fully non-custodial: the operator, agent and facilitator keys are held by the deployment. The owner key stays local, and the contract limits what the others can do.

## Decisions required before any live step

- Approve the funding request above (amounts and addresses).
- Choose the Mainnet deployment origin (separate from the Testnet demo).
- Provide a Mainnet DATABASE_URL (separate database).
- Confirm the project-operated ChainScope recipient address for Mainnet.
- Confirm the Walrus Memory Mainnet proof namespace prefix (current: sisih-rehearsal).
