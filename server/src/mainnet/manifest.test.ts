import { describe, expect, it } from "vitest";
import { validateMainnetManifest } from "./manifest";

const addr = (c: string) => `0x${c.repeat(64)}`;
const valid = () => ({
  schema_version: 1,
  plan_id: "sisih-mainnet-proof-20261107-v1",
  status: "proposed-awaiting-explicit-approval",
  generated_at: "2026-11-07T00:00:00.000Z",
  network: "sui:mainnet",
  chain_id: "mainnet-chain-id",
  primitive: { selected: "sisih-custom-vault", decision: "docs/mainnet/VAULT_DECISION.md", source_sha256: "a".repeat(64) },
  deployment: {
    execution_target: "local-isolated-runtime",
    execution_origin: "http://127.0.0.1:8788",
    execution_mcp_endpoint: "http://127.0.0.1:8788/api/mcp",
    public_target: "separate-vercel-project",
    public_project: "sisih-mainnet-proof",
    public_origin: "https://sisih-mainnet-proof.vercel.app",
    testnet_origin_unchanged: "https://sisih-azure.vercel.app",
    execution_database: "explicit-isolated-pglite",
    public_database: "separate-mainnet-postgres-required-before-deploy",
    memwal_namespace_prefix: "sisih-mainnet-proof-20261107",
  },
  asset: { coin_type: `${addr("a")}::usdc::USDC`, symbol: "USDC", decimals: 6 },
  roles: Object.fromEntries(["owner", "operator", "agent", "facilitator"].map((r, i) => [r, { address: addr(String(i + 1)), funding_sui_mist: r === "owner" ? "130000000" : r === "operator" ? "30000000" : "0", funding_usdc_base_units: r === "owner" ? "3000000" : "0", gas_authorization_mist: r === "owner" ? "130000000" : r === "operator" ? "30000000" : "0" }])),
  merchant: { slug: "chainscope", recipient: addr("b"), project_operated: true, price_base_units: "800000" },
  scenario: { deposit_base_units: "3000000", commitment_base_units: "800000", per_request_cap_base_units: "1000000", per_day_cap_base_units: "3000000", agent_policy_expires_ms: "1794647357715", commitment_cycle_ms: "2592000000", commitment_first_due_ms: "1796634557715", approved_purchase_count: 2, max_merchant_outflow_base_units: "1600000", expected_final_free_base_units: "600000", expected_final_reserved_base_units: "800000", expected_final_total_base_units: "1400000", permission_final_state: "revoked" },
  gas: { reference_price_mist: "100", publish_simulated_gross_mist: "76670000", authorized_per_role_mist: { owner: "130000000", operator: "30000000", agent: "0", facilitator: "0" }, aggregate_authorized_mist: "160000000", method: "Mainnet publish simulation plus measured Testnet upper bounds." },
  operations: [
    { id: "publish", signer: "owner", action: "publish package", gas_budget_mist: "100000000", max_usdc_base_units: "0", outcome: "package" },
    { id: "purchase-1", signer: "operator", action: "release", gas_budget_mist: "20000000", max_usdc_base_units: "800000", outcome: "settled" },
  ],
  approval: { approved: false, approved_at: null, approved_by: null },
});

describe("Mainnet manifest", () => {
  it("accepts the internally consistent bounded plan", () => expect(validateMainnetManifest(valid()).plan_id).toContain("mainnet"));
  it("rejects a recipient/address mutation", () => expect(() => validateMainnetManifest({ ...valid(), merchant: { ...valid().merchant, recipient: "0x12" } })).toThrow());
  it("rejects math that would make the reserve refusal false", () => expect(() => validateMainnetManifest({ ...valid(), scenario: { ...valid().scenario, deposit_base_units: "4000000", expected_final_free_base_units: "1600000", expected_final_total_base_units: "2400000" } })).toThrow(/third purchase/));
  it("rejects an operation over a role's gas authorization", () => {
    const m = valid();
    m.operations[1]!.gas_budget_mist = "30000001";
    expect(() => validateMainnetManifest(m)).toThrow(/exceeds/);
  });
});
