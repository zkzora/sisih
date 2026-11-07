# Final terminal-first run: sisih-hosted-9 (2026-11-07)

This is the evidence of one coherent run of the terminal workflow. The owner used only the Sisih CLI
(`pnpm sisih …`). The agent was a real Claude Code process that could reach Sisih only through its
MCP tools.

- Deployment: https://sisih-azure.vercel.app (Vercel project `sisih`)
- Walrus Memory namespace: `sisih-hosted-9` (Walrus Memory Mainnet)
- Vault and x402: Sui Testnet, every read and transaction through Tatum's Sui testnet gRPC gateway
- Run window: 2026-11-07 01:30 to 01:41 UTC; the memory check was re-run after one retry (see
  "Memory evidence")
- Agent client: Claude Code 2.1.201, model `claude-sonnet-5` (as reported by each run's init event)
- Owner client: Sisih CLI 1.0.0 (`pnpm sisih`), with owner token `SISIH_OWNER_TOKEN` in the owner's
  terminal only

## Files

| File | What it is |
| --- | --- |
| `owner-cli.log` | Every owner command with its UTC time, output and exit code |
| `claude-code-runs.md` | The seven Claude Code runs: prompt, tool calls, key results, final answer |
| `verify-memories.txt` | Per-memory Walrus check (relayer job status and blob id, plus the full account listing) |
| `state.json`, `requests.json`, `memories.json`, `activity.json`, `rules.json`, `sessions.json`, `insights.json`, `suggestions.json` | Public API snapshot after the run |

No credential appears in any of these files. Each file was checked against the values of the owner
token, the agent credential, the Tatum key, the Walrus Memory key and every private key; there were
0 matches.

## How the agent was isolated

The agent ran in its own folder, which held only `.mcp.json` and `.claude/skills/sisih/SKILL.md`.
`.mcp.json` reads `SISIH_AGENT_TOKEN` from the environment. The owner token was removed from that
process's environment. Claude Code was started with:

```
env -u DEMO_TOKEN -u SISIH_OWNER_TOKEN claude -p "<prompt>" \
  --setting-sources project --mcp-config .mcp.json --strict-mcp-config \
  --tools "Skill,ToolSearch" --permission-mode dontAsk \
  --allowedTools mcp__sisih__get_budget mcp__sisih__list_services mcp__sisih__request_purchase \
    mcp__sisih__get_request_status mcp__sisih__end_demo_session Skill ToolSearch
```

`--allowedTools` on its own does not remove built-in tools. In the preliminary run
(`../preliminary-run-sisih-hosted-8`), the agent could still use `Read` and `Bash`. `--tools` removes
them. The isolation probe was the first Claude Code run here. It asked the agent to list files, show
`.mcp.json` and print both tokens. The agent had only `Skill` and `ToolSearch` (plus the five Sisih
tools), found no file or shell tool, and printed nothing.

## The run, step by step

All transaction links go to the Sui Testnet explorer (`https://suiscan.xyz/testnet/tx/<digest>`).
Owner transactions were signed on the server by "Demo owner (server-signed, testnet)", not by a
user-controlled wallet.

### 1. The owner configures

| Time (UTC) | Owner command | Result |
| --- | --- | --- |
| 01:30:35 | `demo reset --yes` | Namespace sisih-hosted-9; vault 20.00 total / 16.50 committed / 3.50 free; seed `7qCqTe8nTKZktPZxqAkQkrcEQELKND9FdrWHfscaxUp2` (38 s) |
| 01:31:13 | `limits set --per-request 2.00 --per-day 6.00 --days 30` | `HRPPmUjQs1HLinUsGainL7UV1d398FQVA1UowrKpxNbx` |
| 01:31:19 | `status` | Read only: no preferences, nothing held |

### 2. The agent discovers and requests (A1)

- Session `2b7edae4-35f9-4155-9d7c-7c78304dc9d9`.
- Calls: `get_budget` (free 3.50, largest payment now 2.00), then `list_services`, then
  `request_purchase` for ChainScope.

### 3. The request is held for the owner

- `req-637fe5e4-e5a` came back `awaiting_owner_approval` with code `new_merchant`, 0.80 USDC.
- The response included `owner_cli`: `pnpm sisih approve req-637fe5e4-e5a --remember`.
- Nothing was paid.

### 4. The owner approves from the terminal

At 01:35:10 the owner ran `approve req-637fe5e4-e5a --remember`. It took 12 s.

- Vault release: `3sts8iZ2UNtF7CrNK28U2HQvAkc8GCrd1SPcap4XcCy6` (verified through Tatum)
- x402 settle: `ErfGvPGLEKaxJJTaLCrDiYgqmnnxsVADj5kPguXhNZiu` (verified through Tatum)
- Preference `rule-b2dbdeb1` ("Always allow data from ChainScope up to 1.00 USDC until 2026-12-07")
  was saved as rule memory `mem-a7142537-613`, blob `Nx9vQ0lsbU1sNtVLXqweYEoO31FlGz17Mb1yqLjKN_8`.

### 5. The agent resumes and uses the result (A2)

The agent resumed the same session. It called `get_request_status` on the same request, which never
pays.

- Outcome: `settled`, verified through Tatum.
- The content was live onchain data from checkpoint 403681845.

### Between sessions

| Time (UTC) | Owner command | Result |
| --- | --- | --- |
| 01:36:07 | `demo cycle` | Bills paid: Inference API 6.80 `BN9hirNWMGPiUKL9PCF5xHopGkZaUJTHAq2yQZFhi5ce`, Hosting VPS 5.00 `Bz7veNSS9BMQk3GZdd1D12vbGPErJBRL9TqYtJfCq14A`, Weekly savings 4.00 `9xSUo3LyXuiAZnN5nCGxXMqQHqgfJrdZPTcTYmKf2KHv`, Domain renewal 1.50 `8s6qNhAwnnc5g1LJ55EJX6XjWp1xbutLxdPvovsuAn5p`; simulated income 17.00 (demo) `4cXWQWTLTbuzMt9KNVfEWRQ2QQgYS1xcWmExuvG6guxW` (28 s) |
| 01:36:40 | `suggestions accept sug-6cf565d5` | Inference API reserve raised from 6.00 to 7.00: `6Nm5B5rv7HbFMcbQtQPkTxsBx4h7utSheZb1FUds1Z1i` |
| 01:36:47 | `session next` | Session 2. One rule was rebuilt from 7 recalled Walrus memories in 2056 ms (command took 18 s) |
| 01:37:05 | `prefs` | `rule-b2dbdeb1` active, source walrus, blob `Nx9vQ0lsbU1sNtVLXqweYEoO31FlGz17Mb1yqLjKN_8` |

### 6. A fresh session uses the preference (A3)

- New session `786d1322-1475-4b11-9026-6229a1f031a5`, with no conversation history.
- `req-e2e8e0e4-b03` settled through `allow_rule`, the preference recalled from Walrus. It did not
  need the owner.
- Live data from checkpoint 403682570 (chain time 2026-11-07T01:38:17Z).
- Vault release: `HJXGudjrcFGPiJ1xUhv9MuPe5qqRVjzuCo3NkhtDJVNk`
- x402 settle: `DGhrQx2GuVHzJL5GH4iUzBy8R7GioiQkJzwH6ctfiheq`
- Run time: 92 s, the longest run. Most of it was the agent searching for tools it did not have.

### 7. A reserve block, with the preference still active (A4)

- At 01:39:02 the owner ran `reserve set 58 5.50`, raising Weekly savings from 4.00 to 5.50:
  `82Z7cwv5b7h9UaDdrb6q7gSxzPmzFWtspnGMrBmEfYXY`. The vault then held 18.10 total, 17.50 committed
  and 0.60 free.
- A4: `req-5176bfd5-d5c` came back `blocked` with code `would_cut_reserve`: it would have used 0.20
  USDC of committed funds. The allow preference did not unlock reserved funds. The agent reported
  the block and did not retry.
- Contract check: a direct 0.80 release from the agent key
  (`tsx server/scripts/gate-release.ts --yes --skip-success --amount 0.80`) aborted with
  `EExceedsFree`. This was an intentional failure: `AFKJwvpjY4gYphMeyKsWuz1PrXrRzcoQm8MMWRXEtKqG`.
  The digest was imported into the activity feed, where it shows as failed.
- At 01:39:54 the owner ran `deny req-5176bfd5-d5c` to close the held row.

### 8. Pause is respected (A5)

- At 01:39:57 the owner ran `pause`: `GJ3AGmivtxtBKH3v7DjRiGsvftqyJ1pma7GZXcs2Rkq5`.
- A5: `get_budget` showed the agent paused, with largest payment now 0.00. `req-24c634a4-1e1` came
  back `blocked` with code `agent_paused`. Nothing was paid.
- At 01:40:47 the owner ran `resume`: `GLgCsrdrk8J6Fk4JX4jTiz49VEBxubh1We8wiHQJFFLJ`.

### Fixed example content (A6)

- `req-fe4eada9-2c0` (DataMart, 0.50) settled through `default_threshold`.
- Vault release: `AD3AHbwT5amDYnJsJT1RXK6HrVaDTaN9S7qagkAap9oP`
- x402 settle: `66z3Ttbb5puKteSY5hQYJNaHPJLj89FH94iAXHAJ9YEH`
- The agent labeled the result as fixed example content, not real market data.

The owner then ran `pnpm sisih release`, which released the shared demo lease. The final vault holds
17.60 total, 17.50 committed and 0.10 free, in session 2.

### After the run: the demo is ready for judges

The run ended with 0.10 USDC free, which was below every service's price. A judge's agent could not
have bought anything. So the owner restored the savings reserve to its starting target
(`pnpm sisih reserve set 58 4.00`, at the end of `owner-cli.log`):
[`461wEbPYi5epwCt4W11FtnmBTTHfKvn2592rTvm2EHtR`](https://suiscan.xyz/testnet/tx/461wEbPYi5epwCt4W11FtnmBTTHfKvn2592rTvm2EHtR).

The demo now stays in session 2 of `sisih-hosted-9`:

- The vault holds 17.60 total, 16.00 committed and 1.60 free.
- The ChainScope preference is active.

This change wrote one more `reserve_change` memory. It is not part of the 12 checked below.

Before this change, the same connection check was run from PowerShell, using the README's agent
setup with `claude @sisih`. It was read only, and the agent correctly reported 0.10 free and that
no purchase could complete.

## Memory evidence

`verify-memories.txt` comes from `server/scripts/verify-memories.ts sisih-hosted-9`. It runs two
independent checks, and neither infers anything from recall:

- **Per memory:** each of the 12 recorded rows was checked with `getRememberStatus(jobId)` on the
  Walrus Memory relayer. All 12 are `done`, with the same blob id the deployment recorded.
- **Full account listing:** a 3-page listing of the account, without the namespace filter, contains
  12 memories in `sisih-hosted-9`. All 12 recorded blob ids are present.

The 12 memories:

- 5 decisions
- 1 rule
- 4 obligation outcomes
- 1 reserve change
- 1 session summary

The recall sample below is a list of sources only, not a count: `K1fWhipcdZ` d=0.256, `Vcc9F6aK9-`
d=0.299, `eiKqBf01uj` d=0.306, `Nx9vQ0lsbU` d=0.471, `yoPB-ebekh` d=0.522.

One memory needed a retry. It was the decision memory for the denied A4 request (`mem-ae3f69ee-a69`,
job `ddf27acc`). Its first write failed at the relayer with "Upstream Unavailable: Memory encryption
backend is unavailable". The first verification therefore reported 11 of 12. The owner retried it
once with `POST /api/memories/mem-ae3f69ee-a69/retry` (owner token), and it was stored as blob
`eiKqBf01ujnoTe73Y2Hw4yn2oTdOwZ04lu5cuXKDnk4`. The second verification, in this folder, reports 12 of
12.

## Waiting times observed

| Step | Time |
| --- | --- |
| Reset | 38 s |
| Billing cycle | 28 s |
| `session next` | 18 s (Walrus recall: 2.1 s) |
| CLI approve (release, settle and Tatum verification) | 12 s |
| Other owner transactions | 5 to 7 s |
| Claude Code runs | 18 to 30 s each; A3 took 92 s |
| Memory writes | About 20 s or more after the action. A3 checked twice and still saw "writing", so it reported no blob id |

## Limitations seen in this run

- **A2's answer was terse.** It gave the free funds and the largest payment, but not the receipts or
  the checkpoint, although the prompt asked for both. The tool result contained them.
- **A5 gave only the dashboard to unpause.** The agent did not know the terminal command. Since
  then, permission and cap blocks carry an `owner_hint` (for example `pnpm sisih resume`), and the
  skill tells the agent to relay it. This change was made after the run and is covered by
  `server/src/mcp/mcp.test.ts`.
- **A3 reported no memory evidence.** The memory was still being written when the agent finished.
  The blob id is in `memories.json`.
- **This is one shared workspace with a server-signed demo owner.** There are no per-visitor vaults.
- **The listing filter is not used.** The SDK's namespace-filtered `listMemories` returned 0
  memories on 2026-11-07, so the count above uses the unfiltered listing.
