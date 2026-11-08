import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { REPO_ROOT } from "../lib/env";

const decimal = z.string().regex(/^\d+$/, "must be an unsigned integer string");
const address = z.string().regex(/^0x[0-9a-f]{64}$/i, "must be a full Sui address");

const role = z.object({ address, funding_sui_mist: decimal, funding_usdc_base_units: decimal, gas_authorization_mist: decimal }).strict();
const operation = z
  .object({
    id: z.string().min(1),
    signer: z.enum(["owner", "operator", "agent", "facilitator", "none"]),
    action: z.string().min(1),
    gas_budget_mist: decimal,
    max_usdc_base_units: decimal,
    outcome: z.string().min(1),
  })
  .strict();

export const mainnetManifestSchema = z
  .object({
    schema_version: z.literal(1),
    plan_id: z.string().regex(/^sisih-mainnet-proof-[a-z0-9-]+$/),
    status: z.literal("proposed-awaiting-explicit-approval"),
    generated_at: z.string().datetime(),
    network: z.literal("sui:mainnet"),
    chain_id: z.string().min(10),
    primitive: z.object({ selected: z.literal("sisih-custom-vault"), decision: z.literal("docs/mainnet/VAULT_DECISION.md"), source_sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
    deployment: z
      .object({
        execution_target: z.literal("local-isolated-runtime"),
        execution_origin: z.string().url(),
        execution_mcp_endpoint: z.string().url(),
        public_target: z.literal("separate-vercel-project"),
        public_project: z.string().min(1),
        public_origin: z.string().url(),
        testnet_origin_unchanged: z.string().url(),
        execution_database: z.literal("explicit-isolated-pglite"),
        public_database: z.literal("separate-mainnet-postgres-required-before-deploy"),
        memwal_namespace_prefix: z.string().regex(/^sisih-mainnet-proof-[a-z0-9-]+$/),
      })
      .strict(),
    asset: z.object({ coin_type: z.string().regex(/^0x[0-9a-f]{64}::usdc::USDC$/i), symbol: z.literal("USDC"), decimals: z.literal(6) }).strict(),
    roles: z.object({ owner: role, operator: role, agent: role, facilitator: role }).strict(),
    merchant: z
      .object({ slug: z.literal("chainscope"), recipient: address, project_operated: z.literal(true), price_base_units: decimal })
      .strict(),
    scenario: z
      .object({
        deposit_base_units: decimal,
        commitment_base_units: decimal,
        per_request_cap_base_units: decimal,
        per_day_cap_base_units: decimal,
        agent_policy_expires_ms: decimal,
        commitment_cycle_ms: decimal,
        commitment_first_due_ms: decimal,
        approved_purchase_count: z.literal(2),
        max_merchant_outflow_base_units: decimal,
        expected_final_free_base_units: decimal,
        expected_final_reserved_base_units: decimal,
        expected_final_total_base_units: decimal,
        permission_final_state: z.literal("revoked"),
      })
      .strict(),
    gas: z
      .object({
        reference_price_mist: decimal,
        publish_simulated_gross_mist: decimal,
        authorized_per_role_mist: z.object({ owner: decimal, operator: decimal, agent: decimal, facilitator: decimal }).strict(),
        aggregate_authorized_mist: decimal,
        method: z.string().min(1),
      })
      .strict(),
    operations: z.array(operation).min(1),
    approval: z.object({ approved: z.literal(false), approved_at: z.null(), approved_by: z.null() }).strict(),
  })
  .strict();

export type MainnetManifest = z.infer<typeof mainnetManifestSchema>;

const n = (value: string) => BigInt(value);
const sum = (values: bigint[]) => values.reduce((a, b) => a + b, 0n);

/** Structural and financial invariants shared by every live-capable command. */
export function validateMainnetManifest(input: unknown): MainnetManifest {
  const m = mainnetManifestSchema.parse(input);
  const price = n(m.merchant.price_base_units);
  const deposit = n(m.scenario.deposit_base_units);
  const commitment = n(m.scenario.commitment_base_units);
  const outflow = price * BigInt(m.scenario.approved_purchase_count);
  if (n(m.scenario.max_merchant_outflow_base_units) !== outflow) throw new Error("manifest merchant outflow does not equal price x approved purchase count");
  if (n(m.scenario.expected_final_free_base_units) !== deposit - commitment - outflow) throw new Error("manifest final free balance is inconsistent");
  if (n(m.scenario.expected_final_reserved_base_units) !== commitment) throw new Error("manifest final reserve is inconsistent");
  if (n(m.scenario.expected_final_total_base_units) !== deposit - outflow) throw new Error("manifest final total is inconsistent");
  if (n(m.scenario.per_request_cap_base_units) < price) throw new Error("per-request cap cannot pay the reviewed purchase");
  if (n(m.scenario.per_day_cap_base_units) < price * 3n) throw new Error("daily cap would mask the intended third reserve refusal");
  if (n(m.scenario.agent_policy_expires_ms) <= BigInt(Date.parse(m.generated_at))) throw new Error("agent policy expiry must be after manifest generation");
  if (deposit - commitment - outflow >= price) throw new Error("third purchase would not cut the reviewed reserve");
  const roleGas = m.gas.authorized_per_role_mist;
  const aggregate = sum(Object.values(roleGas).map(n));
  if (aggregate !== n(m.gas.aggregate_authorized_mist)) throw new Error("aggregate gas authorization is inconsistent");
  for (const [name, r] of Object.entries(m.roles)) {
    if (n(r.gas_authorization_mist) !== n(roleGas[name as keyof typeof roleGas])) throw new Error(`${name} gas authorization differs between roles and gas section`);
    if (n(r.funding_sui_mist) < n(r.gas_authorization_mist)) throw new Error(`${name} funding is below its gas authorization`);
  }
  if (sum(Object.values(m.roles).map((r) => n(r.funding_usdc_base_units))) !== deposit) throw new Error("role USDC funding does not equal the reviewed deposit");
  const ids = new Set<string>();
  for (const op of m.operations) {
    if (ids.has(op.id)) throw new Error(`duplicate operation id ${op.id}`);
    ids.add(op.id);
    if (n(op.max_usdc_base_units) > deposit) throw new Error(`${op.id} exceeds the maximum USDC allocation`);
    if (op.signer !== "none" && n(op.gas_budget_mist) > n(roleGas[op.signer])) throw new Error(`${op.id} gas budget exceeds the ${op.signer} authorization`);
  }
  for (const name of ["owner", "operator", "agent", "facilitator"] as const) {
    const total = sum(m.operations.filter((op) => op.signer === name).map((op) => n(op.gas_budget_mist)));
    if (total > n(roleGas[name])) throw new Error(`${name} operation gas limits exceed aggregate authorization`);
  }
  return m;
}

export function loadMainnetManifest(path: string): MainnetManifest {
  return validateMainnetManifest(JSON.parse(readFileSync(resolve(REPO_ROOT, path), "utf8")));
}

export function assertManifestIdentity(m: MainnetManifest, actual: { owner: string; operator: string; agent: string; facilitator: string; asset: string }): void {
  for (const roleName of ["owner", "operator", "agent", "facilitator"] as const) {
    if (m.roles[roleName].address.toLowerCase() !== actual[roleName].toLowerCase()) throw new Error(`manifest ${roleName} does not match selected credentials`);
  }
  if (m.asset.coin_type.toLowerCase() !== actual.asset.toLowerCase()) throw new Error("manifest asset does not match selected configuration");
}
