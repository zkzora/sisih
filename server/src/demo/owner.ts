/**
 * Owner-signed vault operations used by demo plumbing only: seeding, reset and the headless
 * demo run (which stands in for the browser wallet). OWNER_PRIVATE_KEY is a scripts/demo key;
 * in the dashboard every owner action is signed by the connected browser wallet.
 */
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { coinWithBalance } from "@mysten/sui/transactions";
import { CLOCK_ID, KIND, PRIORITY, target, usdc, usdcType, vaultId } from "../chain/sisih.js";
import { cachedVault, signedWrite, vaultState, type WriteResult } from "../chain/vault.js";
import { env } from "../lib/env.js";
import { upsertEnv } from "../lib/env-file.js";
import { address, keypair } from "../lib/wallets.js";

export const SEED_DEPOSIT = usdc("20.00");

export const SEED_OBLIGATIONS = [
  { key: "PAYEE_INFERENCE_PRIVATE_KEY", name: "Inference API", target: "6.00", kind: KIND.usage, priority: PRIORITY.must, cadence: "Monthly", recurring: true },
  { key: "PAYEE_HOSTING_PRIVATE_KEY", name: "Hosting VPS", target: "5.00", kind: KIND.fixed, priority: PRIORITY.must, cadence: "Monthly", recurring: true },
  { key: "PAYEE_SAVINGS_PRIVATE_KEY", name: "Weekly savings", target: "4.00", kind: KIND.fixed, priority: PRIORITY.important, cadence: "Weekly", recurring: true },
  { key: "PAYEE_DOMAIN_PRIVATE_KEY", name: "Domain renewal", target: "1.50", kind: KIND.fixed, priority: PRIORITY.important, cadence: "One-time", recurring: false },
] as const;

export function demoCycleMs(): bigint {
  return BigInt(env("DEMO_CYCLE_MS") ?? "120000");
}

/** Demo payee addresses; keys are generated once into .env (demo plumbing for recycle). */
export function payeeAddresses(): Record<string, string> {
  const generated: Record<string, string> = {};
  const out: Record<string, string> = {};
  for (const o of SEED_OBLIGATIONS) {
    let k = env(o.key);
    if (!k) {
      k = Ed25519Keypair.generate().getSecretKey();
      generated[o.key] = k;
    }
    out[o.name] = Ed25519Keypair.fromSecretKey(k).toSuiAddress();
  }
  if (Object.keys(generated).length) upsertEnv(generated);
  return out;
}

const owner = () => keypair("owner");
const T = () => [usdcType()];

/**
 * SPEC starting state in one transaction: deposit 20.00, the 4 obligations, agent policy
 * 5.00 / request, 10.00 / day, 30 days. If a policy already exists it is revoked first, so the
 * new policy starts a fresh daily window (set_agent_policy keeps the window for the same agent).
 */
export async function seedVault(opts: { firstDueInMs?: bigint } = {}): Promise<WriteResult> {
  const payees = payeeAddresses();
  const now = BigInt(Date.now());
  const cycle = demoCycleMs();
  const firstDue = now + (opts.firstDueInMs ?? cycle);
  const hadPolicy = (cachedVault() ?? (await vaultState())).policy !== null;
  return signedWrite(
    owner(),
    "Seed vault (demo)",
    (tx) => {
      const vault = tx.object(vaultId());
      tx.moveCall({ target: target("deposit"), typeArguments: T(), arguments: [vault, coinWithBalance({ type: usdcType(), balance: SEED_DEPOSIT })] });
      for (const o of SEED_OBLIGATIONS) {
        tx.moveCall({
          target: target("add_obligation"),
          typeArguments: T(),
          arguments: [
            vault,
            tx.pure.string(o.name),
            tx.pure.address(payees[o.name]!),
            tx.pure.u64(usdc(o.target)),
            tx.pure.u8(o.kind),
            tx.pure.u64(o.recurring ? cycle : 0n),
            tx.pure.u64(firstDue),
            tx.pure.u8(o.priority),
            tx.pure.string(o.cadence),
          ],
        });
      }
      if (hadPolicy) tx.moveCall({ target: target("revoke_agent"), typeArguments: T(), arguments: [vault] });
      tx.moveCall({
        target: target("set_agent_policy"),
        typeArguments: T(),
        arguments: [vault, tx.pure.address(address("agent")), tx.pure.u64(usdc("5.00")), tx.pure.u64(usdc("10.00")), tx.pure.u64(now + 30n * 86_400_000n), tx.object(CLOCK_ID)],
      });
    },
    { source: "owner", budget: 100_000_000n },
  );
}

export function emergencyWithdrawAll(): Promise<WriteResult> {
  return signedWrite(owner(), "Emergency withdraw all (demo reset)", (tx) =>
    tx.moveCall({ target: target("emergency_withdraw_all"), typeArguments: T(), arguments: [tx.object(vaultId())] }),
  { source: "owner" });
}

/** What the browser wallet signs when the owner accepts a reserve suggestion. */
export function setObligationTarget(id: number, newTarget: bigint): Promise<WriteResult> {
  return signedWrite(owner(), "Change reserve (owner)", (tx) =>
    tx.moveCall({ target: target("set_obligation_target"), typeArguments: T(), arguments: [tx.object(vaultId()), tx.pure.u64(BigInt(id)), tx.pure.u64(newTarget)] }),
  { source: "owner" });
}
