/**
 * Generate the reviewable Mainnet funding and transaction manifest. READ ONLY: it never signs or
 * broadcasts.
 *
 *   pnpm --filter @sisih/server exec tsx scripts/mainnet/manifest.ts
 *
 * Inputs:
 * - docs/mainnet/preflight.json (from preflight.ts --estimate): Mainnet chain id, native USDC
 *   metadata, role addresses and balances, the current reference gas price, and the simulated
 *   publish cost.
 * - Measured gas of the same operations on Sui Testnet (real transactions from the recorded runs),
 *   read back through Tatum Testnet. Computation is rescaled to the Mainnet reference gas price;
 *   storage cost is kept as is. These are estimates from measurements, not quotes, and every cap
 *   below adds a 3x margin.
 * Output: docs/mainnet/MANIFEST.json and docs/mainnet/MANIFEST.md.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "../../src/lib/env";
import { referenceGasPrice, suiClient } from "../../src/lib/tatum";

const pre = JSON.parse(readFileSync(resolve(REPO_ROOT, "docs/mainnet/preflight.json"), "utf8"));
const mainPrice = BigInt(pre.reference_gas_price_mist);
const testPrice = await referenceGasPrice("testnet");
const testnet = suiClient("testnet");

/** Testnet reference transactions (recorded runs) for each operation the proof needs. */
const REF = {
  create_vault: "BPpnht7M5SKmzETvfYH11FhqkBCUsQqVxe7oZPEZPuDL",
  setup: "7qCqTe8nTKZktPZxqAkQkrcEQELKND9FdrWHfscaxUp2", // deposit + 4 commitments + policy (upper bound for 1 commitment)
  set_limits: "HRPPmUjQs1HLinUsGainL7UV1d398FQVA1UowrKpxNbx",
  release_to_agent: "3sts8iZ2UNtF7CrNK28U2HQvAkc8GCrd1SPcap4XcCy6",
  x402_settle: "ErfGvPGLEKaxJJTaLCrDiYgqmnnxsVADj5kPguXhNZiu",
  pause_agent: "GJ3AGmivtxtBKH3v7DjRiGsvftqyJ1pma7GZXcs2Rkq5",
} as const;

async function measured(digest: string) {
  const res = await testnet.core.getTransaction({ digest, include: { effects: true } });
  const t = res.Transaction ?? res.FailedTransaction;
  const g = t.effects.gasUsed;
  const computationMain = (BigInt(g.computationCost) * mainPrice) / testPrice;
  // Gross (computation + storage), ignoring rebates: a role must be able to pay before any rebate.
  const gross = computationMain + BigInt(g.storageCost);
  return { testnet_digest: digest, testnet_computation_mist: g.computationCost, storage_mist: g.storageCost, rebate_mist: g.storageRebate, mainnet_gross_estimate_mist: gross.toString() };
}

const m: Record<string, Awaited<ReturnType<typeof measured>>> = {};
for (const [k, d] of Object.entries(REF)) m[k] = await measured(d);
const publishMist = BigInt(Math.round(Number(pre.publish_estimate?.net_sui ?? "0") * 1e9));
const est = (k: keyof typeof REF) => BigInt(m[k]!.mainnet_gross_estimate_mist);
/** Gas budgets the code sets (a role must hold its largest budget at the time of that transaction). */
const BUDGET = { publish: 200_000_000n, owner_tx: 100_000_000n, operator_release: 50_000_000n, facilitator_settle: 2_000_000n };
const MARGIN = 3n;

// --- the proof scenario (prices from the merchant registry) ----------------------------------
const PRICE = 800_000n; // ChainScope live vault report, 0.80 USDC
const DEPOSIT = 3_200_000n;
const COMMITMENT = 1_000_000n;
const PER_REQUEST = 1_000_000n;
const PER_DAY = 3_000_000n;
const paid = 2n; // P1 held then owner-approved, P2 approved by the recalled preference; P3 refused by the reserve
const u = (b: bigint) => (Number(b) / 1e6).toFixed(2);
const s = (b: bigint) => (Number(b) / 1e9).toFixed(4);

const ownerOps = publishMist + est("create_vault") + est("setup") + est("pause_agent") * 2n; // publish, create, setup, pause+resume
const operatorOps = est("release_to_agent") * paid;
const facilitatorOps = est("x402_settle") * paid;
const caps = { owner: ownerOps * MARGIN + BUDGET.publish, operator: operatorOps * MARGIN + BUDGET.operator_release, facilitator: facilitatorOps * MARGIN + BUDGET.facilitator_settle };
const aggregate = caps.owner + caps.operator + caps.facilitator;

const manifest = {
  status: "prepared · not deployed · not funded · not executed",
  generated_at: new Date().toISOString(),
  network: "sui:mainnet",
  chain_id: pre.chain.chain_id,
  rpc: "Tatum Sui Mainnet gRPC (every read, simulation and broadcast)",
  target_origin: { decision_required: true, note: "A separate deployment (new Vercel project or local `next start`), never the Testnet demo at sisih-azure.vercel.app." },
  asset: { coin_type: pre.usdc.coin_type, symbol: pre.usdc.symbol, decimals: pre.usdc.decimals, verified_via: "GetCoinMetadata through Tatum (preflight)" },
  roles: Object.fromEntries(Object.entries(pre.balances).map(([k, v]) => [k, { address: (v as { address: string }).address, balance_sui: (v as { sui: string }).sui, balance_usdc: (v as { usdc: string }).usdc }])),
  key_custody: {
    owner: "Local only (.env.mainnet on the owner's machine). Signs publish, create_vault, setup and every owner intent via pnpm sisih sign. Never on the server or Vercel.",
    operator: "Server (deployment env). Can only call release_to_agent through the OperatorCap, from free funds, within the agent's caps.",
    agent: "Server (deployment env): the x402 payer for released coins. The spending agent process (Claude Code) never holds it; it has only SISIH_AGENT_TOKEN.",
    facilitator: "Server (deployment env): co-signs x402 settlements as gas owner.",
    note: "Sisih is not fully non-custodial: the operator, agent and facilitator keys are held by the deployment. The owner key stays local, and the contract limits what the others can do.",
  },
  operations: [
    { step: 1, by: "owner (local)", what: "publish contracts/sisih (UpgradeCap to owner)", command: "publish.ts --execute --manifest docs/mainnet/MANIFEST.json --out .env.mainnet.deployment", effects: "package + UpgradeCap; IDs written to .env.mainnet.deployment (never .env or .env.mainnet)", gas_estimate_sui: s(publishMist), estimate_source: "Mainnet simulation (mocked gas), preflight.json" },
    { step: 2, by: "owner (local)", what: "create_vault<USDC>(operator)", effects: "shared Vault + OperatorCap to the operator", gas_estimate_sui: s(est("create_vault")), estimate_source: `Testnet measurement ${REF.create_vault}` },
    { step: 3, by: "owner (local)", what: `setup: deposit ${u(DEPOSIT)} USDC, one commitment ${u(COMMITMENT)} USDC to the owner's own address, set_agent_policy ${u(PER_REQUEST)} per request / ${u(PER_DAY)} per day / 7 days`, command: "mainnet/setup.ts --execute --manifest docs/mainnet/MANIFEST.json", gas_estimate_sui: s(est("setup")), estimate_source: `Testnet measurement ${REF.setup} (4 commitments: upper bound)` },
    { step: 4, by: "spending agent + owner", what: "P1: ChainScope 0.80 held (new merchant) -> owner approves and remembers via pnpm sisih approve <id> --remember --yes (local signature)", effects: "release (operator) + x402 settle (facilitator) + decision and rule memories on Walrus Mainnet", gas_estimate_sui: s(est("release_to_agent") + est("x402_settle")) },
    { step: 5, by: "owner", what: "start_next_session (offchain, owner-signed): rules rebuilt from Walrus recall" },
    { step: 6, by: "spending agent (fresh session)", what: "P2: ChainScope 0.80 approved by the recalled preference", gas_estimate_sui: s(est("release_to_agent") + est("x402_settle")) },
    { step: 7, by: "spending agent", what: "P3: ChainScope 0.80 refused: free 0.60 < 0.80 despite the allow preference (would_cut_reserve). Refused by the policy engine before any transaction; the contract boundary is shown by simulation only (labeled simulated), no gas spent." },
    { step: 8, by: "owner (optional)", what: "pause_agent then resume_agent (owner intents)", gas_estimate_sui: s(est("pause_agent") * 2n) },
    { step: 9, by: "anyone", what: "verify-memories.ts <namespace> and mainnet/verify-evidence.ts (read only)" },
  ],
  usdc: {
    max_allocation_usdc: u(DEPOSIT),
    deposit_usdc: u(DEPOSIT),
    commitment_usdc: u(COMMITMENT),
    per_purchase_usdc: u(PRICE),
    per_request_cap_usdc: u(PER_REQUEST),
    per_day_cap_usdc: u(PER_DAY),
    paid_to_merchant_usdc: u(PRICE * paid),
    merchant_recipient: { decision_required: true, note: "Project-operated ChainScope address (MERCHANT_CHAINSCOPE_ADDRESS in .env.mainnet.deployment). Its proceeds are ours, recorded as returned funds, not revenue." },
    expected_remaining_in_vault_usdc: u(DEPOSIT - PRICE * paid),
    expected_remaining_free_usdc: u(DEPOSIT - COMMITMENT - PRICE * paid),
  },
  gas: {
    mainnet_reference_gas_price_mist: mainPrice.toString(),
    testnet_reference_gas_price_mist: testPrice.toString(),
    method: "Gross gas (computation + storage, rebates ignored). Computation is rescaled from Testnet measurements to the Mainnet reference gas price; storage is unchanged; publish is simulated on Mainnet. Per-role cap = 3x the gross estimates + the largest single gas budget that role sets (it must hold that budget when signing). Budgets are caps, not charges.",
    budgets_set_by_code_mist: Object.fromEntries(Object.entries(BUDGET).map(([k, v]) => [k, v.toString()])),
    per_role_cap_sui: { owner: s(caps.owner), operator: s(caps.operator), facilitator: s(caps.facilitator), agent: "0 (the facilitator pays settlement gas)" },
    aggregate_cap_sui: s(aggregate),
    measurements: m,
  },
  funding_request: {
    owner: { usdc: u(DEPOSIT), sui: s(caps.owner) },
    operator: { sui: s(caps.operator) },
    facilitator: { sui: s(caps.facilitator) },
  },
  expected_receipts: ["publish digest", "create_vault digest", "setup digest", "P1 release + settle", "P2 release + settle", "P3 refusal (no transaction; simulation output labeled simulated)", "owner intent ids and digests", "Walrus job ids and blob ids (decision, rule, session summary)"],
  decisions_required: [
    "Approve the funding request above (amounts and addresses).",
    "Choose the Mainnet deployment origin (separate from the Testnet demo).",
    "Provide a Mainnet DATABASE_URL (separate database).",
    "Confirm the project-operated ChainScope recipient address for Mainnet.",
    "Confirm the Walrus Memory Mainnet proof namespace prefix (current: sisih-rehearsal).",
  ],
};
writeFileSync(resolve(REPO_ROOT, "docs/mainnet/MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const md = `# Sisih Mainnet proof: funding and transaction manifest

Status: **${manifest.status}**. Generated ${manifest.generated_at} by \`server/scripts/mainnet/manifest.ts\` from
\`docs/mainnet/preflight.json\` (read-only, through Tatum). Nothing in this file has been executed.

- Network: sui:mainnet (chain id \`${manifest.chain_id}\`), every call through Tatum.
- Asset: native USDC \`${manifest.asset.coin_type}\` (${manifest.asset.symbol}, ${manifest.asset.decimals} decimals, read from chain metadata).
- Current role balances: all ${Object.values(manifest.roles).every((r) => (r as { balance_sui: string }).balance_sui === "0.000000") ? "0 SUI and 0 USDC (unfunded)" : "see MANIFEST.json"}.

## Funding request

| Role | Address | USDC | SUI gas cap |
| --- | --- | --- | --- |
| owner (local key) | \`${(manifest.roles as Record<string, { address: string }>).owner?.address}\` | ${manifest.funding_request.owner.usdc} | ${manifest.funding_request.owner.sui} |
| operator | \`${(manifest.roles as Record<string, { address: string }>).operator?.address}\` | 0 | ${manifest.funding_request.operator.sui} |
| facilitator | \`${(manifest.roles as Record<string, { address: string }>).facilitator?.address}\` | 0 | ${manifest.funding_request.facilitator.sui} |

Aggregate SUI gas cap: **${manifest.gas.aggregate_cap_sui} SUI** (3x the gross estimates plus each role's largest gas budget; budgets are caps, not charges).
Maximum USDC allocation: **${manifest.usdc.max_allocation_usdc} USDC**. To the project-operated merchant: ${manifest.usdc.paid_to_merchant_usdc} USDC
(our own funds coming back to us, not revenue). Expected to remain in the vault: ${manifest.usdc.expected_remaining_in_vault_usdc} USDC
(${manifest.usdc.expected_remaining_free_usdc} free).

## Operations

${manifest.operations.map((o) => `${o.step}. **${o.by}**: ${o.what}${"gas_estimate_sui" in o && o.gas_estimate_sui ? ` (gas estimate ${o.gas_estimate_sui} SUI${"estimate_source" in o && o.estimate_source ? `, ${o.estimate_source}` : ""})` : ""}`).join("\n")}

## Gas method

${manifest.gas.method} Mainnet reference gas price ${manifest.gas.mainnet_reference_gas_price_mist} MIST; Testnet ${manifest.gas.testnet_reference_gas_price_mist} MIST.

## Key custody (trust model)

${Object.entries(manifest.key_custody).map(([k, v]) => `- **${k}**: ${v}`).join("\n")}

## Decisions required before any live step

${manifest.decisions_required.map((d) => `- ${d}`).join("\n")}
`;
writeFileSync(resolve(REPO_ROOT, "docs/mainnet/MANIFEST.md"), md);
console.log(`wrote docs/mainnet/MANIFEST.json and MANIFEST.md · aggregate gas cap ${manifest.gas.aggregate_cap_sui} SUI · USDC ${manifest.usdc.max_allocation_usdc}`);
