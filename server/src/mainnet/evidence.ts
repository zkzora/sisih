import { z } from "zod";

const address = z.string().regex(/^0x[0-9a-f]{64}$/i);
const integer = z.string().regex(/^-?\d+$/);
const call = z.object({ package: address, module: z.string(), function: z.string(), type_arguments: z.array(z.string()).default([]) }).strict();
const balance = z.object({ address, coin_type: z.string(), amount: integer }).strict();
const event = z.object({ type: z.string(), json_contains: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}) }).strict();

export const evidenceSpecSchema = z.object({
  schema_version: z.literal(1),
  network: z.enum(["testnet", "mainnet"]),
  chain_id: z.string(),
  package_id: address,
  vault_id: address,
  asset: z.string(),
  transactions: z.array(z.object({
    id: z.string(), digest: z.string().min(20), expected_success: z.boolean(), expected_error_contains: z.string().optional(),
    sender: address, gas_owner: address.optional(), max_gas_budget_mist: integer,
    move_calls: z.array(call), balance_changes: z.array(balance), events: z.array(event), created_type_contains: z.array(z.string()).default([]),
  }).strict()),
  simulations: z.array(z.object({ id: z.string(), broadcast: z.literal(false), expected_abort: z.string(), artifact: z.string() }).strict()).default([]),
}).strict();

export type EvidenceSpec = z.infer<typeof evidenceSpecSchema>;
export type TransactionExpectation = EvidenceSpec["transactions"][number];

export interface ObservedEvidence {
  digest: string; success: boolean; error: string | null; sender: string; gasOwner: string; gasBudget: bigint;
  calls: Array<{ package: string; module: string; function: string; typeArguments: string[] }>;
  balanceChanges: Array<{ address: string; coinType: string; amount: string }>;
  events: Array<{ type: string; json: Record<string, unknown> | null }>;
  createdTypes: string[];
}

export function validateEvidenceBindings(spec: EvidenceSpec): void {
  if (!spec.transactions.length) throw new Error("Evidence must include at least one real transaction");
  const ids = new Set<string>();
  for (const expected of spec.transactions) {
    if (ids.has(expected.digest)) throw new Error("A transaction digest cannot count as two receipts");
    ids.add(expected.digest);
    if (!expected.move_calls.length && !expected.events.length && !expected.balance_changes.length && !expected.created_type_contains.length) throw new Error(`${expected.id} has no consequential effect expectation`);
    for (const call of expected.move_calls.filter((c) => c.module === "vault")) {
      if (norm(call.package) !== norm(spec.package_id) || !call.type_arguments.some((t) => norm(t) === norm(spec.asset))) throw new Error(`${expected.id} vault call differs from the reviewed package or asset`);
      const anchor = expected.events.some((e) => norm(e.type).startsWith(`${norm(spec.package_id)}::vault::`) && norm(String(e.json_contains.vault_id ?? "")) === norm(spec.vault_id));
      if (expected.expected_success && !anchor) throw new Error(`${expected.id} requires an event bound to the exact vault`);
    }
  }
}

const norm = (value: string) => value.toLowerCase().replace(/^0x0+/, "0x");
const same = (a: string, b: string) => norm(a) === norm(b);

/** Variable gas/rebate changes may be extra; every reviewed transfer/call/event must match exactly. */
export function evaluateTransactionEvidence(expected: TransactionExpectation, actual: ObservedEvidence): string[] {
  const errors: string[] = [];
  if (actual.digest !== expected.digest) errors.push(`digest mismatch: ${actual.digest}`);
  if (actual.success !== expected.expected_success) errors.push(`success mismatch: expected ${expected.expected_success}, got ${actual.success}`);
  if (!expected.expected_success && expected.expected_error_contains && !actual.error?.includes(expected.expected_error_contains)) errors.push(`failure does not contain ${expected.expected_error_contains}`);
  if (!same(actual.sender, expected.sender)) errors.push(`sender mismatch: ${actual.sender}`);
  if (expected.gas_owner && !same(actual.gasOwner, expected.gas_owner)) errors.push(`gas owner mismatch: ${actual.gasOwner}`);
  if (actual.gasBudget > BigInt(expected.max_gas_budget_mist)) errors.push(`gas budget ${actual.gasBudget} exceeds ${expected.max_gas_budget_mist}`);
  for (const wanted of expected.move_calls) {
    if (!actual.calls.some((got) => same(got.package, wanted.package) && got.module === wanted.module && got.function === wanted.function && JSON.stringify(got.typeArguments.map(norm)) === JSON.stringify(wanted.type_arguments.map(norm)))) errors.push(`missing exact call ${wanted.package}::${wanted.module}::${wanted.function}`);
  }
  for (const wanted of expected.balance_changes) {
    if (!actual.balanceChanges.some((got) => same(got.address, wanted.address) && norm(got.coinType) === norm(wanted.coin_type) && got.amount === wanted.amount)) errors.push(`missing balance change ${wanted.address} ${wanted.amount} ${wanted.coin_type}`);
  }
  for (const wanted of expected.events) {
    const found = actual.events.some((got) => norm(got.type) === norm(wanted.type) && Object.entries(wanted.json_contains).every(([key, value]) => String(got.json?.[key]) === String(value)));
    if (!found) errors.push(`missing event ${wanted.type} with reviewed fields`);
  }
  for (const type of expected.created_type_contains) if (!actual.createdTypes.some((got) => got.includes(type))) errors.push(`missing created type containing ${type}`);
  return errors;
}
