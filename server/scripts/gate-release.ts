/**
 * Phase 1 gate: operator releases 0.50 to the agent (must succeed), then 5.00 (must abort
 * with EExceedsFree: within the 5.00 per-request cap, but only 3.00 is free).
 * The failing transaction is executed on-chain with a small explicit gas budget, so the
 * abort has a digest as evidence.
 */
import { Transaction } from "@mysten/sui/transactions";
import { CLOCK_ID, VAULT_ERRORS, operatorCapId, target, usdc, usdcType, vaultId } from "../src/chain/sisih.js";
import { formatUsdc } from "../src/lib/env.js";
import { setGas, signAndExecuteDetailed, suiClient, verifyTransaction } from "../src/lib/tatum.js";
import { address, keypair } from "../src/lib/wallets.js";

const operator = keypair("operator");
const agent = address("agent");
const agentUsdc = async () => BigInt((await suiClient().core.getBalance({ owner: agent, coinType: usdcType() })).balance.balance);

async function release(amount: bigint, requestId: string) {
  const tx = new Transaction();
  tx.setSender(operator.toSuiAddress());
  await setGas(tx, { budget: 20_000_000n });
  tx.moveCall({
    target: target("release_to_agent"),
    typeArguments: [usdcType()],
    arguments: [
      tx.object(vaultId()),
      tx.object(operatorCapId()),
      tx.pure.u64(amount),
      tx.pure.vector("u8", [...new TextEncoder().encode(requestId)]),
      tx.object(CLOCK_ID),
    ],
  });
  return signAndExecuteDetailed(tx, operator);
}

function abortName(error: string | null): string {
  const code = error?.match(/abort_code"?:\s*"?(\d+)/i)?.[1] ?? error?.match(/MoveAbort.*?(\d+)/)?.[1];
  if (!code) return error ?? "none";
  const n = BigInt(code);
  // Clever errors pack the #[error(code)] into the low 16 bits... and the line in higher bits.
  const small = Number(n & 0xffffn);
  return VAULT_ERRORS[small] ?? VAULT_ERRORS[Number(n)] ?? `code ${code}`;
}

const before = await agentUsdc();
const ok = await release(usdc("0.50"), "gate-0.50");
const okV = await verifyTransaction(ok.digest);
const after = await agentUsdc();
console.log(`release 0.50: ${ok.digest} success=${ok.success} verified=${okV.success} agent USDC ${formatUsdc(before)} -> ${formatUsdc(after)}`);

const bad = await release(usdc("5.00"), "gate-5.00");
const badV = await verifyTransaction(bad.digest);
console.log(`release 5.00: ${bad.digest} success=${bad.success} verified-on-chain=${!badV.success ? "failed as expected" : "UNEXPECTED SUCCESS"}`);
console.log(`  abort: ${abortName(bad.error)}  raw: ${bad.error?.slice(0, 300)}`);

const pass = ok.success && okV.success && after - before === usdc("0.50") && !bad.success && abortName(bad.error) === "EExceedsFree";
console.log(pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
