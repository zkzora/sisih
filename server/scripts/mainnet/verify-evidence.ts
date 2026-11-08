/** Exact, read-only evidence verifier. A valid unrelated transaction must fail. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "../../src/lib/env";
import { suiClient } from "../../src/lib/tatum";
import { evidenceSpecSchema, evaluateTransactionEvidence, validateEvidenceBindings, type ObservedEvidence } from "../../src/mainnet/evidence";

const argv = process.argv.slice(2);
const path = argv.includes("--spec") ? argv[argv.indexOf("--spec") + 1] : undefined;
if (!path || argv.includes("--help")) {
  console.log("verify-evidence.ts --spec <evidence.json>. Reads through Tatum only; exits nonzero on any mismatch.");
  process.exit(argv.includes("--help") ? 0 : 2);
}
const spec = evidenceSpecSchema.parse(JSON.parse(readFileSync(resolve(REPO_ROOT, path), "utf8")));
if (argv.includes("--negative-control")) {
  if (spec.network !== "testnet") throw new Error("The known unrelated-transaction control is Testnet only");
  spec.transactions[0]!.digest = "BPpnht7M5SKmzETvfYH11FhqkBCUsQqVxe7oZPEZPuDL";
}
validateEvidenceBindings(spec);
const client = suiClient(spec.network);
const service = await client.ledgerService.getServiceInfo({});
const failures: string[] = [];
const observations: unknown[] = [];
if (service.response.chainId !== spec.chain_id) failures.push(`chain id mismatch: ${service.response.chainId}`);
for (const expected of spec.transactions) {
  try {
    const result = await client.core.getTransaction({ digest: expected.digest, include: { transaction: true, effects: true, events: true, objectTypes: true, balanceChanges: true } });
    const tx = result.Transaction ?? result.FailedTransaction;
    const data = tx.transaction;
    const commands = data.commands as unknown as Array<{ $kind?: string; MoveCall?: { package: string; module: string; function: string; typeArguments: string[] } }>;
    const actual: ObservedEvidence = {
      digest: tx.digest,
      success: tx.status.success,
      error: tx.status.success ? null : JSON.stringify(tx.status.error),
      sender: data.sender ?? "",
      gasOwner: data.gasData.owner ?? "",
      gasBudget: BigInt(data.gasData.budget ?? "0"),
      calls: commands.filter((command) => command.$kind === "MoveCall" && command.MoveCall).map((command) => ({ package: command.MoveCall!.package, module: command.MoveCall!.module, function: command.MoveCall!.function, typeArguments: command.MoveCall!.typeArguments })),
      balanceChanges: tx.balanceChanges.map((change) => ({ address: change.address, coinType: change.coinType, amount: change.amount })),
      events: tx.events.map((event) => ({ type: event.eventType, json: event.json })),
      createdTypes: tx.effects.changedObjects.filter((object) => object.idOperation === "Created").map((object) => object.outputState === "PackageWrite" ? "package" : (tx.objectTypes[object.objectId] ?? "unknown")),
    };
    const errors = evaluateTransactionEvidence(expected, actual);
    const gas = tx.effects.gasUsed;
    observations.push({ id: expected.id, expected, actual, checkpoint: tx.checkpoint, timestamp_ms: tx.timestampMs, errors, gas: { computation_mist: String(gas.computationCost), storage_mist: String(gas.storageCost), storage_rebate_mist: String(gas.storageRebate), net_mist: (BigInt(gas.computationCost) + BigInt(gas.storageCost) - BigInt(gas.storageRebate)).toString() } });
    if (errors.length) failures.push(...errors.map((error) => `${expected.id}: ${error}`));
    else console.log(`PASS ${expected.id} ${expected.digest} checkpoint=${tx.checkpoint}`);
  } catch (err) {
    failures.push(`${expected.id}: ${(err as Error).message}`);
  }
}
for (const simulation of spec.simulations) {
  try {
    const artifact = JSON.parse(readFileSync(resolve(REPO_ROOT, simulation.artifact), "utf8"));
    if (artifact.broadcast !== false || artifact.signed !== false || artifact.actual_abort !== simulation.expected_abort || artifact.vault !== spec.vault_id || artifact.package !== spec.package_id || artifact.network !== `sui:${spec.network}`) throw new Error("simulation artifact differs from expected context or abort");
    console.log(`SIMULATION ${simulation.id}: ${simulation.expected_abort}; artifact checked; broadcast=false`);
  } catch (err) { failures.push(`${simulation.id}: ${(err as Error).message}`); }
}
if (argv.includes("--write")) {
  const out = argv[argv.indexOf("--write") + 1];
  if (!out) throw new Error("--write requires a path");
  writeFileSync(resolve(REPO_ROOT, out), JSON.stringify({ checked_at: new Date().toISOString(), network: spec.network, chain_id: service.response.chainId, observations, simulations: spec.simulations, failures, passed: failures.length === 0 }, (_key, value) => typeof value === "bigint" ? value.toString() : value, 2) + "\n");
}
if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}
console.log(`PASS exact evidence: ${spec.transactions.length} transaction(s), ${spec.simulations.length} labeled simulation(s)`);
