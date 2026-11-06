/**
 * Owner-signed vault operations used by demo plumbing only: seeding, reset and the headless
 * demo run (which stands in for the browser wallet), and on testnet the "Demo owner
 * (server-signed, testnet)" actions a judge can run without the owner wallet. OWNER_PRIVATE_KEY
 * is a testnet demo key; when the owner wallet is connected it signs instead.
 */
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { coinWithBalance } from "@mysten/sui/transactions";
import { eq } from "drizzle-orm";
import { CLOCK_ID, KIND, PRIORITY, target, usdc, usdcType, vaultId } from "../chain/sisih";
import { cachedVault, signedWrite, vaultState, type WriteResult } from "../chain/vault";
import { db, schema } from "../db/index";
import { env, formatUsdc } from "../lib/env";
import { acceptSuggestion, onVaultEvents } from "../services/chainEvents";
import { ApiError } from "../services/requests";
import { assertTestnet } from "./recycle";
import { upsertEnv } from "../lib/env-file";
import { address, keypair } from "../lib/wallets";

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
  const hadPolicy = ((await cachedVault()) ?? (await vaultState())).policy !== null;
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
export function setObligationTarget(id: number, newTarget: bigint, source: "owner" | "demo_owner" = "owner"): Promise<WriteResult> {
  return signedWrite(owner(), source === "demo_owner" ? `Change reserve · ${DEMO_OWNER_LABEL}` : "Change reserve (owner)", (tx) =>
    tx.moveCall({ target: target("set_obligation_target"), typeArguments: T(), arguments: [tx.object(vaultId()), tx.pure.u64(BigInt(id)), tx.pure.u64(newTarget)] }),
  { source });
}

// --- demo owner for judges (testnet only) ----------------------------------------------

/** Shown wherever the server signs as the owner, so nobody mistakes it for the owner wallet. */
export const DEMO_OWNER_LABEL = "Demo owner (server-signed, testnet)";

const DEMO_OWNER_ACTIONS = ["deposit", "accept_suggestion", "pause_agent", "resume_agent"] as const;
export type DemoOwnerAction = (typeof DEMO_OWNER_ACTIONS)[number];
export const isDemoOwnerAction = (a: unknown): a is DemoOwnerAction => DEMO_OWNER_ACTIONS.includes(a as DemoOwnerAction);

/** Largest demo deposit: the reset leaves the owner a 0.50 float (OWNER_DEPOSIT_FLOAT). */
const DEMO_DEPOSIT_MAX = usdc("1.00");

/**
 * The owner actions a judge can run without the owner wallet, signed with the demo owner key.
 * Refused on mainnet: there every owner action comes from the owner's own wallet.
 */
export async function demoOwnerAction(action: DemoOwnerAction, body: { amount?: string; suggestionId?: string }) {
  assertTestnet(`${DEMO_OWNER_LABEL} signing`);
  const fail = (w: WriteResult): never => {
    throw new ApiError(422, w.ok ? "unexpected" : `${w.reason}`, w.ok ? "rejected" : w.code);
  };
  let w: WriteResult;
  switch (action) {
    case "deposit": {
      if (!/^\d+$/.test(body.amount ?? "")) throw new ApiError(400, "amount must be a base-unit integer string");
      const amount = BigInt(body.amount!);
      if (amount <= 0n || amount > DEMO_DEPOSIT_MAX) throw new ApiError(400, `Demo deposits are up to ${formatUsdc(DEMO_DEPOSIT_MAX)} USDC`);
      w = await signedWrite(owner(), `Deposit ${formatUsdc(amount)} USDC · ${DEMO_OWNER_LABEL}`, (tx) =>
        tx.moveCall({ target: target("deposit"), typeArguments: T(), arguments: [tx.object(vaultId()), coinWithBalance({ type: usdcType(), balance: amount })] }),
      { source: "demo_owner" });
      break;
    }
    case "accept_suggestion": {
      const [s] = await db().select().from(schema.suggestions).where(eq(schema.suggestions.id, body.suggestionId ?? ""));
      if (!s) throw new ApiError(404, `No suggestion ${body.suggestionId}`, "not_found");
      if (s.status !== "open") throw new ApiError(409, `Suggestion is ${s.status}`, "not_open");
      w = await setObligationTarget(s.obligationId, BigInt(s.suggestedTarget), "demo_owner");
      if (!w.ok) fail(w);
      // Same path as a wallet-signed accept: verify the event, write the reserve_change memory.
      const accepted = await acceptSuggestion(s.id, w.digest!, "demo_owner");
      return { ...accepted, action, signer: DEMO_OWNER_LABEL, verification: w.ok ? w.tx?.status : null };
    }
    case "pause_agent":
    case "resume_agent":
      w = await signedWrite(owner(), `${action === "pause_agent" ? "Pause" : "Resume"} agent · ${DEMO_OWNER_LABEL}`, (tx) =>
        tx.moveCall({ target: target(action), typeArguments: T(), arguments: [tx.object(vaultId())] }),
      { source: "demo_owner" });
      break;
  }
  if (!w.ok) fail(w);
  if (w.ok && w.tx) await onVaultEvents(w.tx);
  return { action, digest: w.digest, signer: DEMO_OWNER_LABEL, verification: w.ok ? w.tx?.status : null };
}

// --- reset: owner deposit float -----------------------------------------------------------

/** After a reset the owner keeps this much testnet USDC so a Deposit works right away. */
export const OWNER_DEPOSIT_FLOAT = usdc("0.50");
