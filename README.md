# Sisih

**Your AI agent can only spend money you haven't promised.**

**Live demo:** https://sisih-azure.vercel.app. It needs no setup, and visitors can only read. Judges
receive the owner token through the submission form.

- **[Home](https://sisih-azure.vercel.app/)** (`/`) explains the core invariant: Move contracts enforce
  commitments before any agent purchase can happen, contrasting raw agent wallets with Sisih.
- **[Connect your agent](https://sisih-azure.vercel.app/connect)** (`/connect`) provides ready-to-run
  recipes for Claude Code (and client-agnostic MCP configurations), owner assistant over MCP, and the
  companion owner CLI.
- **[Recorded Proof](https://sisih-azure.vercel.app/proof)** (`/proof`) presents the full step-by-step
  cryptographic trace from the recorded run (`sisih-hosted-9`) with verified Suiscan testnet transactions
  and Walruscan mainnet memory blobs.

**What Sisih is.** A USDC vault for people who give an AI agent a spending budget.

- Committed money is reserved first, in a Move contract on Sui. That covers hosting, inference bills,
  savings, and renewals.
- The agent is paid only from what is left in the free pool.
- The owner's decisions about purchases are remembered in Walrus Memory. The next session needs
  fewer manual reviews.
- No memory can ever unlock reserved funds.

This is our entry for Tatum x Walrus "Total Recall", in the Consumer Finance Apps track.

## Who it is for, and the problem

The target user is a builder or power user who lets an AI agent pay for APIs and data with x402
micropayments, out of the same USDC balance they use for recurring commitments. Three problems follow:

- **The balance misleads.** A wallet balance looks spendable, but most of it is already promised to
  next week's bills. An agent with a simple spending limit can still drain the hosting money.
- **Manual review does not scale.** Approving every small purchase by hand defeats the point of an
  agent, but approving nothing by hand is risky.
- **Past decisions are lost.** The agent and its tools forget the owner's decisions between
  sessions.

Sisih separates two kinds of rules:

- **Hard rules** live onchain and cannot be talked around: a reserve for each commitment, a
  per-request cap, a daily cap, and a permission expiry.
- **Soft rules** are learned from the owner: trusted merchants, automatic categories, and
  per-merchant limits. They are stored in Walrus Memory and rebuilt every session. They only ever
  decide among payments the vault would already allow.

## Architecture & Interfaces

Sisih exposes **one canonical MCP endpoint** (`/api/mcp`) that serves both roles via header-based
authentication, alongside the companion **Owner CLI**:

```mermaid
flowchart TD
  subgraph Agent["Spending Agent (e.g. Claude Code)"]
    A[Agent Process] -->|Bearer: SISIH_AGENT_TOKEN| MCP[/api/mcp]
  end

  subgraph Owner["Owner (Human or Assistant)"]
    OA[Owner Assistant via MCP] -->|Bearer: SISIH_OWNER_TOKEN| MCP
    CLI[Owner CLI: pnpm sisih] -->|Authorization / local signing| API[/api/owner or local]
  end

  subgraph SisihCore["Sisih Core Platform"]
    MCP --> PE[Policy Engine]
    PE -->|1. Hard Rules Check| SUI[(Sui Move Vault)]
    PE -->|2. Soft Rules Recall| WAL[(Walrus Memory)]
    PE -->|3. Idempotent Settle| X402[x402 Facilitator]
  end
```

### 1. Spending Agent over MCP (`SISIH_AGENT_TOKEN`)

The agent receives a scoped credential restricted strictly to:
- `get_budget`: Inspect spendable free funds vs reserved commitments.
- `list_services`: List available demo merchants (live onchain ChainScope or fixed fixtures).
- `request_purchase`: Submit purchase requests; held if unfamiliar or over limits.
- `get_request_status`: Poll purchase progress or retrieve live results without re-charging.
- `end_demo_session`: Close the demo session cleanly.

### 2. Owner Assistant over MCP (`SISIH_OWNER_TOKEN`)

When authenticated with the owner token, `/api/mcp` unlocks owner tools:
- `owner_status`, `list_requests`, `get_request`: Inspect funds, commitments, preferences, limits, and purchase requests.
- `decide_request`: Approve or deny a held request; `remember: true` stores a preference in Walrus.
- `add_preference`, `set_preference_enabled`, `set_threshold`: Configure remembered preferences and automatic approval.
- `set_limits`, `set_reserve`, `add_commitment`: Configure the agent's caps and the owner's commitments.
- `list_suggestions`, `decide_suggestion`: Inspect and accept or reject reserve suggestions.
- `set_agent_permission`: Pause, resume, or revoke the spending agent.
- `start_next_session`: Rebuild preferences from Walrus recall for the next session.
- `get_evidence`, `get_owner_intent`, `release_demo_run`: Inspect receipts and signing intents, and release the shared run.

Testnet owner sessions also expose `demo_reset` and `demo_advance_cycle`.

### 3. Owner Companion CLI (`pnpm sisih`)

The owner CLI operates as a companion terminal tool and offline/local transaction signer.
Run `pnpm sisih help` for full syntax.

| Group | Commands |
| --- | --- |
| Inspect | `status`, `commitments`, `requests [--held]`, `request <id>`, `prefs`, `limits`, `suggestions` |
| Configure | `commitment add`, `reserve set <id> <usdc>`, `limits set`, `threshold set`, `prefs add <allow\|deny> <merchant> --max <usdc>`, `prefs disable\|enable <rule-id>` |
| Decide | `approve <id> [--remember]`, `deny <id> [--remember]`, `suggestions accept\|reject <id>` |
| Agent permission | `pause`, `resume`, `revoke` |
| Session and evidence | `session next`, `release`, `evidence`, `evidence tx`, `evidence memories`, `tx <digest>` |
| Demo (testnet plumbing) | `demo reset --yes`, `demo cycle`, `demo deposit <usdc>` |

## Quickstart: Agent & Owner in Two Terminals

### Step 1: Owner Terminal

Run these from your clone of this repository:

```powershell
$env:SISIH_URL = "https://sisih-azure.vercel.app"
$env:SISIH_OWNER_TOKEN = "<owner token>"
pnpm sisih status
pnpm sisih limits set --per-request 2.00 --per-day 6.00 --days 30
pnpm sisih prefs
```

### Step 2: Agent Terminal (Claude Code)

Set up an isolated directory with only the agent configuration:

```powershell
New-Item -ItemType Directory -Force sisih-agent | Out-Null; Set-Location sisih-agent
New-Item -ItemType Directory -Force .claude/skills/sisih | Out-Null
Invoke-WebRequest https://sisih-azure.vercel.app/skills/sisih/SKILL.md -OutFile .claude/skills/sisih/SKILL.md
$mcp = @'
{ "mcpServers": { "sisih": { "type": "http", "url": "https://sisih-azure.vercel.app/api/mcp",
  "headers": { "Authorization": "Bearer ${SISIH_AGENT_TOKEN}" } } } }
'@
[IO.File]::WriteAllText("$PWD\.mcp.json", $mcp)
$env:SISIH_AGENT_TOKEN = "<agent credential>"
Remove-Item Env:SISIH_OWNER_TOKEN, Env:DEMO_TOKEN -ErrorAction SilentlyContinue
```

Launch Claude Code with only the Sisih agent tools:

```powershell
$sisih = @('--setting-sources','project','--mcp-config','.mcp.json','--strict-mcp-config',
  '--tools','Skill,ToolSearch','--permission-mode','dontAsk','--allowedTools',
  'mcp__sisih__get_budget','mcp__sisih__list_services','mcp__sisih__request_purchase',
  'mcp__sisih__get_request_status','mcp__sisih__end_demo_session','Skill','ToolSearch')
claude -p "Use the sisih MCP server to show me my budget, my limits and the services I can buy. Do not buy anything." @sisih
```

### Step 3: Run a Task with Live Data

Prompt Claude:
> "Check whether my Sisih vault is healthy. Use the sisih MCP server to buy the ChainScope live vault report, then tell me how much is committed versus free, whether any commitment is underfunded, and the largest payment you could make right now. If Sisih holds the purchase for my approval, give me the terminal command and wait."

When the agent reaches the new merchant (ChainScope), Sisih holds the request. In the owner terminal:

```powershell
pnpm sisih requests --held
pnpm sisih approve <request-id> --remember
```

Tell Claude: *"I approved it from my terminal. Check the request status and finish."* Claude calls `get_request_status` (which never re-bills) and uses the live onchain report.

## Networks & Evidence

| Part | Network | Details |
| --- | --- | --- |
| Move vault (reserves, caps, policy) | **Sui Testnet** | Package `0x37a5513a911110d00b9c795390d1af5b04a3873e6df4856b54ede7e74ba886e9`, Vault [`0xbfb0…e962`](https://suiscan.xyz/testnet/object/0xbfb09999511c994267cc79aa4d28de859004a0ff3b91de30155c8ee205fae962) |
| x402 settlement | **Sui Testnet** | Network `sui:testnet`, testnet USDC |
| Sui Gateway | **Tatum Sui Testnet gRPC** | `sui-testnet-grpc.gateway.tatum.io:443`, throttled server-side |
| Memory Storage | **Walrus Mainnet** | Relayer `https://relayer.memory.walrus.xyz`, server-side delegate key |

See full verifiable execution evidence on the **[Proof page](https://sisih-azure.vercel.app/proof)** or browse `docs/evidence/final-run-sisih-hosted-9`.

## Sui Mainnet Readiness

Sisih includes an end-to-end prepared package and manifest for Sui Mainnet:
- **Status:** **prepared · not deployed · not funded · not executed**.
- **Manifest:** `docs/mainnet/MANIFEST.json` and `docs/mainnet/MANIFEST.md`.
- **Readiness Guide:** [docs/MAINNET_READINESS.md](docs/MAINNET_READINESS.md).
- **Environment Isolation:** Zero modifications to the testnet `.env`. Mainnet operations require dedicated `.env.mainnet` with local-only owner signing (`pnpm sisih sign`).

## Local Development & Testing

```powershell
# Clone and install
git clone <repo-url> Sisih; cd Sisih
pnpm install

# Run unit and integration suites
pnpm test
pnpm typecheck

# Build and start web application
cd web
.\node_modules\.bin\next.cmd build
.\node_modules\.bin\next.cmd start -p 3000
```

## Repo Layout

| Path | Purpose |
| --- | --- |
| `contracts/sisih` | Move smart contract (`sisih::vault`) and formal unit tests |
| `server/src` | Hono backend: policy engine, Tatum gRPC client, Walrus Memory client, role-scoped MCP (`/api/mcp`), Owner CLI (`cli/`), x402 facilitator |
| `web/src` | Next.js 3-page application: `/` (Home), `/connect` (Connect), `/proof` (Proof), plus API route delegation |
| `docs/evidence` | Verified run transcripts, Walrus memory checks, and onchain digests |
| `docs/mainnet` | Sui Mainnet preflight verification, execution manifest, and runbook |

## License

MIT, see [LICENSE](LICENSE).
