/**
 * Owner-signed vault transactions for the local owner signing path (Mainnet, or Testnet with
 * SISIH_OWNER_SIGNING=local).
 *
 * One pure builder, used on both sides of the signing boundary:
 * - The owner's local helper builds the transaction from the intent and its OWN local config, then
 *   signs it. It never signs transaction bytes supplied by the server.
 * - The server rebuilds the same transaction kind from the stored intent and requires the signed
 *   bytes to match it exactly: same package, module, function, type argument (the asset), vault,
 *   recipient/agent address and amounts. It also checks the sender, the gas owner and the gas cap.
 *
 * Only these vault calls can be built: no withdrawals, no transfers, no arbitrary targets.
 */
import { Transaction } from "@mysten/sui/transactions";
import { TransactionDataBuilder } from "@mysten/sui/transactions";
import { normalizeSuiAddress } from "@mysten/sui/utils";

export const ONCHAIN_OWNER_CALLS = ["set_obligation_target", "add_obligation", "set_agent_policy", "pause_agent", "resume_agent", "revoke_agent"] as const;
export type OwnerCall = (typeof ONCHAIN_OWNER_CALLS)[number];

/** What the builder needs, all of it from validated config on the side that builds. */
export interface OwnerTxTarget {
  network: "testnet" | "mainnet";
  packageId: string;
  vaultId: string;
  /** initialSharedVersion of the shared vault object (read through Tatum). */
  vaultSharedVersion: string;
  usdcType: string;
  ownerAddress: string;
}

export type OwnerCallArgs =
  | { call: "set_obligation_target"; obligation_id: string; target: string }
  | {
      call: "add_obligation";
      name: string;
      payee: string;
      target: string;
      kind: number;
      cycle_ms: string;
      first_due_ms: string;
      priority: number;
      cadence: string;
    }
  | { call: "set_agent_policy"; agent: string; max_per_request: string; max_per_day: string; expires_ms: string }
  | { call: "pause_agent" }
  | { call: "resume_agent" }
  | { call: "revoke_agent" };

export const CLOCK = { objectId: "0x6", initialSharedVersion: "1" } as const;
/** Default gas cap per owner transaction (MIST). The signed budget may be lower, never higher. */
export const OWNER_GAS_CAP_MIST = 50_000_000n;

/** The single vault call for an owner action, as an unsigned transaction kind. */
export function buildOwnerCall(t: OwnerTxTarget, a: OwnerCallArgs): Transaction {
  const tx = new Transaction();
  const vault = tx.sharedObjectRef({ objectId: t.vaultId, initialSharedVersion: t.vaultSharedVersion, mutable: true });
  const typeArguments = [t.usdcType];
  const target = `${t.packageId}::vault::${a.call}` as const;
  switch (a.call) {
    case "set_obligation_target":
      tx.moveCall({ target, typeArguments, arguments: [vault, tx.pure.u64(BigInt(a.obligation_id)), tx.pure.u64(BigInt(a.target))] });
      break;
    case "add_obligation":
      tx.moveCall({
        target,
        typeArguments,
        arguments: [
          vault,
          tx.pure.string(a.name),
          tx.pure.address(a.payee),
          tx.pure.u64(BigInt(a.target)),
          tx.pure.u8(a.kind),
          tx.pure.u64(BigInt(a.cycle_ms)),
          tx.pure.u64(BigInt(a.first_due_ms)),
          tx.pure.u8(a.priority),
          tx.pure.string(a.cadence),
        ],
      });
      break;
    case "set_agent_policy":
      tx.moveCall({
        target,
        typeArguments,
        arguments: [
          vault,
          tx.pure.address(a.agent),
          tx.pure.u64(BigInt(a.max_per_request)),
          tx.pure.u64(BigInt(a.max_per_day)),
          tx.pure.u64(BigInt(a.expires_ms)),
          tx.sharedObjectRef({ ...CLOCK, mutable: false }),
        ],
      });
      break;
    case "pause_agent":
    case "resume_agent":
    case "revoke_agent":
      tx.moveCall({ target, typeArguments, arguments: [vault] });
      break;
  }
  return tx;
}

const eqBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

export class OwnerTxMismatch extends Error {}

/**
 * Check signed transaction bytes against the intent (server side). Throws OwnerTxMismatch with the
 * first difference. The signature itself is verified separately (verifyTransactionSignature).
 */
export async function assertSignedTxMatches(txBytes: Uint8Array, t: OwnerTxTarget, a: OwnerCallArgs, gasCapMist: bigint = OWNER_GAS_CAP_MIST): Promise<void> {
  let data: TransactionDataBuilder;
  try {
    data = TransactionDataBuilder.fromBytes(txBytes);
  } catch {
    throw new OwnerTxMismatch("The signed bytes are not a Sui transaction.");
  }
  const owner = normalizeSuiAddress(t.ownerAddress);
  if (!data.sender || normalizeSuiAddress(data.sender) !== owner) throw new OwnerTxMismatch("The transaction sender is not the vault owner.");
  if (data.gasData.owner && normalizeSuiAddress(data.gasData.owner) !== owner) throw new OwnerTxMismatch("Gas must be paid by the owner (no sponsor).");
  if (!data.gasData.budget || BigInt(data.gasData.budget) > gasCapMist) throw new OwnerTxMismatch(`The gas budget exceeds the cap of ${gasCapMist} MIST.`);
  const actualKind = data.build({ onlyTransactionKind: true });
  const expectedKind = await buildOwnerCall(t, a).build({ onlyTransactionKind: true });
  if (!eqBytes(actualKind, expectedKind)) {
    throw new OwnerTxMismatch("The signed transaction does not match the approved intent (target, vault, asset, addresses or amounts differ).");
  }
}

export const txDigestFromBytes = (txBytes: Uint8Array) => TransactionDataBuilder.getDigestFromBytes(txBytes);
