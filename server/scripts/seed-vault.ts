/**
 * Seed the vault with the SPEC starting state (OWNER signs; scripts only):
 *   deposit 20.00 USDC (coinWithBalance: works from coin objects or the address balance),
 *   add the 4 sample obligations, set the agent policy (5.00 / request, 10.00 / day, 30 days).
 * Demo payees get generated keypairs in .env (PAYEE_*_PRIVATE_KEY) so recycle.ts can sweep
 * them later. One demo cycle = DEMO_CYCLE_MS; the human cadence lives in cadence_label.
 */
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction, coinWithBalance } from "@mysten/sui/transactions";
import { CLOCK_ID, KIND, PRIORITY, target, usdc, usdcType, vaultId } from "../src/chain/sisih.js";
import { env, formatUsdc } from "../src/lib/env.js";
import { upsertEnv } from "../src/lib/env-file.js";
import { setGas, signAndExecuteDetailed, suiClient, verifyTransaction } from "../src/lib/tatum.js";
import { address, keypair } from "../src/lib/wallets.js";

const DEPOSIT = usdc("20.00");
const cycleMs = BigInt(env("DEMO_CYCLE_MS") ?? "120000");

const payees = [
  { key: "PAYEE_INFERENCE_PRIVATE_KEY", name: "Inference API", target: "6.00", kind: KIND.usage, priority: PRIORITY.must, cadence: "Monthly", recurring: true },
  { key: "PAYEE_HOSTING_PRIVATE_KEY", name: "Hosting VPS", target: "5.00", kind: KIND.fixed, priority: PRIORITY.must, cadence: "Monthly", recurring: true },
  { key: "PAYEE_SAVINGS_PRIVATE_KEY", name: "Weekly savings", target: "4.00", kind: KIND.fixed, priority: PRIORITY.important, cadence: "Weekly", recurring: true },
  { key: "PAYEE_DOMAIN_PRIVATE_KEY", name: "Domain renewal", target: "1.50", kind: KIND.fixed, priority: PRIORITY.important, cadence: "One-time", recurring: false },
] as const;

// Demo payee keypairs (demo plumbing): reuse when present so reseeding keeps the same payees.
const generated: Record<string, string> = {};
const payeeAddress = (key: string) => {
  const existing = env(key);
  if (existing) return Ed25519Keypair.fromSecretKey(existing).toSuiAddress();
  const kp = Ed25519Keypair.generate();
  generated[key] = kp.getSecretKey();
  return kp.toSuiAddress();
};
const resolved = payees.map((p) => ({ ...p, payee: payeeAddress(p.key) }));
if (Object.keys(generated).length) upsertEnv(generated);

const owner = keypair("owner");
const ownerAddr = owner.toSuiAddress();
const have = BigInt((await suiClient().core.getBalance({ owner: ownerAddr, coinType: usdcType() })).balance.balance);
if (have < DEPOSIT) throw new Error(`owner has ${formatUsdc(have)} USDC, needs ${formatUsdc(DEPOSIT)}`);

const now = BigInt(Date.now());
const firstDue = now + cycleMs;
const tx = new Transaction();
tx.setSender(ownerAddr);
await setGas(tx, { budget: 100_000_000n });
const vault = tx.object(vaultId());
const T = [usdcType()];
tx.moveCall({ target: target("deposit"), typeArguments: T, arguments: [vault, coinWithBalance({ type: usdcType(), balance: DEPOSIT })] });
for (const p of resolved) {
  tx.moveCall({
    target: target("add_obligation"),
    typeArguments: T,
    arguments: [
      vault,
      tx.pure.string(p.name),
      tx.pure.address(p.payee),
      tx.pure.u64(usdc(p.target)),
      tx.pure.u8(p.kind),
      tx.pure.u64(p.recurring ? cycleMs : 0n),
      tx.pure.u64(firstDue),
      tx.pure.u8(p.priority),
      tx.pure.string(p.cadence),
    ],
  });
}
tx.moveCall({
  target: target("set_agent_policy"),
  typeArguments: T,
  arguments: [
    vault,
    tx.pure.address(address("agent")),
    tx.pure.u64(usdc("5.00")),
    tx.pure.u64(usdc("10.00")),
    tx.pure.u64(now + 30n * 86_400_000n),
    tx.object(CLOCK_ID),
  ],
});

const res = await signAndExecuteDetailed(tx, owner);
if (!res.success) throw new Error(`seed failed: ${res.error}`);
const v = await verifyTransaction(res.digest);
console.log(`seed ${res.digest} success=${v.success} checkpoint=${v.checkpoint} events=${v.events} (read back through Tatum)`);
for (const p of resolved) console.log(`  ${p.name.padEnd(15)} ${p.target.padStart(5)} -> payee ${p.payee}`);
process.exit(0);
