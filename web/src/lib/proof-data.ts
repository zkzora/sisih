/**
 * The recorded proof shown on /proof: the terminal-first run on 2026-11-07, Walrus namespace
 * sisih-hosted-9. Every value is copied from docs/evidence/final-run-sisih-hosted-9 (owner CLI log,
 * Claude Code transcripts, API snapshot, per-job Walrus verification). It is a Sui Testnet +
 * Walrus Memory Mainnet recorded run: the owner used the CLI with server-signed testnet owner
 * transactions, and the agent was Claude Code. It is NOT a run of the owner MCP tools, local owner
 * signing or Sui Mainnet; those are listed separately as local checks.
 */
export const RUN = {
  namespace: "sisih-hosted-9",
  date: "2026-11-07",
  window: "01:30 to 01:41 UTC",
  networks: "Sui Testnet (vault, x402, testnet USDC, through Tatum) · Walrus Memory Mainnet",
  agent: "Claude Code 2.1.201 (model claude-sonnet-5), restricted to the five Sisih agent tools",
  owner: 'Sisih CLI; owner transactions signed on the server by "Demo owner (server-signed, testnet)"',
  evidencePath: "docs/evidence/final-run-sisih-hosted-9",
} as const;

export const suiscanTx = (d: string) => `https://suiscan.xyz/testnet/tx/${d}`;
export const walruscanBlob = (b: string) => `https://walruscan.com/mainnet/blob/${b}`;

export interface Receipt {
  label: string;
  digest: string;
  /** what the chain reports when read back through Tatum */
  outcome: "success" | "aborted (intended)";
}
export interface MemoryRef {
  type: string;
  job: string;
  blob: string;
}
export interface Step {
  id: string;
  title: string;
  who: "agent" | "owner" | "contract";
  happened: string;
  requestId?: string;
  outcome?: string;
  receipts?: Receipt[];
  memories?: MemoryRef[];
  note?: string;
}

export const TRACE: Step[] = [
  {
    id: "task",
    title: "The agent gets a task",
    who: "agent",
    happened:
      "Asked to check the vault's health, Claude Code read its budget (3.50 free of 20.00, largest payment 2.00) and the services, then asked Sisih to buy the ChainScope live vault report (0.80 USDC).",
  },
  {
    id: "hold",
    title: "Unknown merchant: held, nothing paid",
    who: "agent",
    requestId: "req-637fe5e4-e5a",
    outcome: "awaiting_owner_approval (new_merchant)",
    happened: "ChainScope had no preference yet, so Sisih held the purchase and returned the owner's exact command. Nothing left the vault.",
  },
  {
    id: "decide",
    title: "The owner approves and remembers",
    who: "owner",
    requestId: "req-637fe5e4-e5a",
    happened:
      "The owner ran pnpm sisih approve req-637fe5e4-e5a --remember (12 s). Sisih paid that same request once and saved the preference \"Always allow data from ChainScope up to 1.00 USDC until 2026-12-07\" to Walrus Memory.",
    receipts: [
      { label: "Vault release (free funds only)", digest: "3sts8iZ2UNtF7CrNK28U2HQvAkc8GCrd1SPcap4XcCy6", outcome: "success" },
      { label: "x402 settlement", digest: "ErfGvPGLEKaxJJTaLCrDiYgqmnnxsVADj5kPguXhNZiu", outcome: "success" },
    ],
    memories: [
      { type: "rule", job: "3f5c4a40-40d4-414b-9bd1-11d861aa8526", blob: "Nx9vQ0lsbU1sNtVLXqweYEoO31FlGz17Mb1yqLjKN_8" },
      { type: "decision", job: "6efb2f90-e1bf-4cce-a164-0952c420d9bb", blob: "Vcc9F6aK9-I9YOgNwlDCF-7tsgBCgr1-cAMF4IoqVXc" },
    ],
  },
  {
    id: "result",
    title: "The agent uses the paid result",
    who: "agent",
    requestId: "req-637fe5e4-e5a",
    outcome: "settled · live onchain data, Sui Testnet checkpoint 403681845",
    happened: "Claude checked the same request (a status call never pays), received the live report and answered from it.",
  },
  {
    id: "recall",
    title: "A fresh session recalls the preference",
    who: "agent",
    requestId: "req-e2e8e0e4-b03",
    outcome: "settled by allow_rule · checkpoint 403682570",
    happened:
      "After pnpm sisih session next, the rules were rebuilt from Walrus recall (1 rule from 7 recalled memories, 2056 ms). A new Claude session with no history asked again; the purchase went through without the owner.",
    receipts: [
      { label: "Vault release", digest: "HJXGudjrcFGPiJ1xUhv9MuPe5qqRVjzuCo3NkhtDJVNk", outcome: "success" },
      { label: "x402 settlement", digest: "DGhrQx2GuVHzJL5GH4iUzBy8R7GioiQkJzwH6ctfiheq", outcome: "success" },
    ],
    memories: [{ type: "decision", job: "82942c8d-24f6-4c83-b047-1d82823c41ce", blob: "K1fWhipcdZ5d2YqJl5DBSMSLvprXV28GojwhgFt4jcA" }],
  },
  {
    id: "reserve",
    title: "Reserves still win over the preference",
    who: "contract",
    requestId: "req-5176bfd5-d5c",
    outcome: "blocked (would_cut_reserve: 0.20 of committed funds)",
    happened:
      "The owner raised the savings reserve (pnpm sisih reserve set 58 5.50), leaving 0.60 free. With the allow preference still active, Sisih blocked the 0.80 purchase. The same 0.80 sent straight to the vault was refused by the contract.",
    receipts: [
      { label: "Reserve raised", digest: "82Z7cwv5b7h9UaDdrb6q7gSxzPmzFWtspnGMrBmEfYXY", outcome: "success" },
      { label: "Direct release attempt (EExceedsFree)", digest: "AFKJwvpjY4gYphMeyKsWuz1PrXrRzcoQm8MMWRXEtKqG", outcome: "aborted (intended)" },
    ],
  },
  {
    id: "pause",
    title: "Pause stops everything",
    who: "owner",
    requestId: "req-24c634a4-1e1",
    outcome: "blocked (agent_paused)",
    happened: "The owner paused the agent from the terminal; the next purchase was refused and nothing was paid. Resume restored it.",
    receipts: [
      { label: "Pause", digest: "GJ3AGmivtxtBKH3v7DjRiGsvftqyJ1pma7GZXcs2Rkq5", outcome: "success" },
      { label: "Resume", digest: "GLgCsrdrk8J6Fk4JX4jTiz49VEBxubh1We8wiHQJFFLJ", outcome: "success" },
    ],
  },
];

export const MEMORY_VERIFICATION = {
  checked: 13,
  stored: 13,
  method: "Each memory's Walrus relayer job checked one by one (getRememberStatus: done, same blob id), and every blob found in the unfiltered account listing. Not inferred from top-k recall.",
  retry: "One decision memory first failed at the relayer (\"Memory encryption backend is unavailable\") and was stored after one owner retry.",
  file: "docs/evidence/final-run-sisih-hosted-9/verify-memories-final.txt",
} as const;

export const LIMITATIONS = [
  "One shared Testnet workspace with a server-signed demo owner; no per-visitor vaults.",
  "All merchants are operated by the Sisih project. ChainScope returns live Testnet data; the others return labeled fixed examples.",
  "One agent answer omitted the receipts it was asked to list; another finished while its memory was still writing.",
  "The agent runs used claude -p (headless); interactive mode was not separately recorded.",
];

/** Earlier recorded runs, kept as history (not part of the trace above). */
export const HISTORY = [
  { namespace: "sisih-hosted-7", date: "2026-11-06", what: "First real Claude Code runs over MCP, owner approval in the former dashboard. 4 of 4 memories verified per job.", path: "docs/evidence/agent-run-sisih-hosted-7" },
  { namespace: "sisih-hosted-6", date: "2026-11-06", what: "Five sessions with the built-in Research Agent; manual reviews per session 2, 1, 1, 2, 2. 35 of 35 memories verified per job.", path: "docs/evidence/sisih-hosted-6" },
];

/** New boundaries checked locally, in isolated fixtures (no live transactions). Not recorded runs. */
export const LOCAL_CHECKS = [
  "One MCP URL, two roles: a real MCP SDK client sees only its role's tools; direct agent calls to owner tools fail with zero signing, payment, configuration or reset effects (server/src/mcp/roles.test.ts).",
  "Owner assistant over MCP: decide_request approves a held request once and the agent resumes the same request; repeats never charge twice.",
  "Local owner signing: real ed25519 signatures over real Sui transaction bytes; changed amount, recipient, package, vault, asset, signer, gas cap, replay, expiry and wrong network are rejected (server/src/owner/intents.test.ts).",
  "Payments: a merchant refusal or lost response after the vault release is reported as released-not-settled or unknown, never as \"nothing paid\", and never releases twice (server/src/services/payments.test.ts).",
  "Mainnet guards: legacy demo-token routes, server-side owner signing, reset, recycle and simulated income refuse on Mainnet (server/src/api/mainnet-guard.test.ts).",
];
