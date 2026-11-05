/**
 * Owner transactions, built server-side through Tatum and only SIGNED by the browser wallet.
 * build(): fully resolved transaction JSON (gas price, budget, object refs, expiration), so
 *          the wallet signs without needing its own RPC.
 * validate(): before executing signed bytes, the sender must be the vault owner and every
 *          Move call must be sisih::vault (plus the framework calls coinWithBalance emits).
 */
import "server-only";
import { Transaction, coinWithBalance } from "@mysten/sui/transactions";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { requireEnv, tatum } from "./sui";

export const CLOCK_ID = "0x6";

export type OwnerKind =
  | "deposit"
  | "withdraw_free"
  | "emergency_withdraw_all"
  | "add_obligation"
  | "set_obligation_target"
  | "remove_obligation"
  | "pay_obligation"
  | "set_agent_policy"
  | "pause_agent"
  | "resume_agent"
  | "revoke_agent";

export interface OwnerArgs {
  amount?: string;
  id?: number;
  target?: string;
  bill?: string;
  name?: string;
  payee?: string;
  kind?: 0 | 1;
  cycleMs?: string;
  firstDueMs?: string;
  priority?: 0 | 1;
  cadenceLabel?: string;
  agent?: string;
  maxPerRequest?: string;
  maxPerDay?: string;
  expiresMs?: string;
}

const pkg = () => requireEnv("SISIH_PACKAGE_ID");
const usdcType = () => requireEnv("USDC_COIN_TYPE");
const vaultId = () => requireEnv("VAULT_ID");
const fn = (name: string) => `${pkg()}::vault::${name}` as const;

const big = (v: string | undefined, field: string) => {
  if (v === undefined || !/^\d+$/.test(v)) throw new Error(`${field} must be a base-unit integer string`);
  return BigInt(v);
};

let ownerCache: { at: number; owner: string } | undefined;
export async function vaultOwner(): Promise<string> {
  if (ownerCache && Date.now() - ownerCache.at < 60_000) return ownerCache.owner;
  const { object } = await tatum().getObject({ objectId: vaultId(), include: { json: true } });
  const owner = String((object.json as Record<string, unknown>).owner);
  ownerCache = { at: Date.now(), owner };
  return owner;
}

export async function buildOwnerTx(kind: OwnerKind, args: OwnerArgs, sender: string): Promise<string> {
  const owner = await vaultOwner();
  if (normalizeSuiAddress(sender) !== normalizeSuiAddress(owner)) {
    throw new Error("Only the vault owner can sign this. Connect the owner wallet.");
  }
  const tx = new Transaction();
  tx.setSender(sender);
  const client = tatum();
  const { referenceGasPrice } = await client.core.getReferenceGasPrice();
  tx.setGasPrice(BigInt(referenceGasPrice));
  tx.setGasBudget(50_000_000n);
  const T = [usdcType()];
  const vault = tx.object(vaultId());
  switch (kind) {
    case "deposit":
      tx.moveCall({ target: fn("deposit"), typeArguments: T, arguments: [vault, coinWithBalance({ type: usdcType(), balance: big(args.amount, "amount") })] });
      break;
    case "withdraw_free":
      tx.moveCall({ target: fn("withdraw_free"), typeArguments: T, arguments: [vault, tx.pure.u64(big(args.amount, "amount"))] });
      break;
    case "emergency_withdraw_all":
      tx.moveCall({ target: fn("emergency_withdraw_all"), typeArguments: T, arguments: [vault] });
      break;
    case "add_obligation":
      if (!args.name || !args.payee || !args.cadenceLabel) throw new Error("name, payee and cadenceLabel are required");
      tx.moveCall({
        target: fn("add_obligation"),
        typeArguments: T,
        arguments: [
          vault,
          tx.pure.string(args.name.slice(0, 60)),
          tx.pure.address(args.payee),
          tx.pure.u64(big(args.target, "target")),
          tx.pure.u8(args.kind ?? 0),
          tx.pure.u64(big(args.cycleMs ?? "0", "cycleMs")),
          tx.pure.u64(big(args.firstDueMs, "firstDueMs")),
          tx.pure.u8(args.priority ?? 0),
          tx.pure.string(args.cadenceLabel.slice(0, 20)),
        ],
      });
      break;
    case "set_obligation_target":
      tx.moveCall({ target: fn("set_obligation_target"), typeArguments: T, arguments: [vault, tx.pure.u64(BigInt(args.id ?? -1)), tx.pure.u64(big(args.target, "target"))] });
      break;
    case "remove_obligation":
      tx.moveCall({ target: fn("remove_obligation"), typeArguments: T, arguments: [vault, tx.pure.u64(BigInt(args.id ?? -1))] });
      break;
    case "pay_obligation":
      tx.moveCall({ target: fn("pay_obligation"), typeArguments: T, arguments: [vault, tx.pure.u64(BigInt(args.id ?? -1)), tx.pure.u64(big(args.bill, "bill")), tx.object(CLOCK_ID)] });
      break;
    case "set_agent_policy":
      tx.moveCall({
        target: fn("set_agent_policy"),
        typeArguments: T,
        arguments: [
          vault,
          tx.pure.address(args.agent ?? ""),
          tx.pure.u64(big(args.maxPerRequest, "maxPerRequest")),
          tx.pure.u64(big(args.maxPerDay, "maxPerDay")),
          tx.pure.u64(big(args.expiresMs, "expiresMs")),
          tx.object(CLOCK_ID),
        ],
      });
      break;
    case "pause_agent":
    case "resume_agent":
    case "revoke_agent":
      tx.moveCall({ target: fn(kind), typeArguments: T, arguments: [vault] });
      break;
    default:
      throw new Error(`unknown owner action ${String(kind)}`);
  }
  // Resolve everything now (through Tatum) so the wallet only has to sign.
  await tx.build({ client });
  return tx.toJSON();
}

const FRAMEWORK = normalizeSuiAddress("0x2");

/** Throws unless the signed transaction is an owner-sent sisih::vault transaction. */
export async function validateSigned(bytesB64: string): Promise<void> {
  const data = Transaction.from(bytesB64).getData();
  const owner = await vaultOwner();
  if (!data.sender || normalizeSuiAddress(data.sender) !== normalizeSuiAddress(owner)) throw new Error("Sender is not the vault owner");
  let vaultCalls = 0;
  for (const cmd of data.commands) {
    if (cmd.$kind === "MoveCall") {
      const p = normalizeSuiAddress(cmd.MoveCall.package);
      if (p === normalizeSuiAddress(pkg()) && cmd.MoveCall.module === "vault") vaultCalls++;
      else if (!(p === FRAMEWORK && (cmd.MoveCall.module === "coin" || cmd.MoveCall.module === "balance"))) {
        throw new Error(`Move call ${cmd.MoveCall.package}::${cmd.MoveCall.module}::${cmd.MoveCall.function} is not allowed`);
      }
    } else if (cmd.$kind === "TransferObjects" || cmd.$kind === "Publish" || cmd.$kind === "Upgrade") {
      throw new Error(`${cmd.$kind} is not allowed through this proxy`);
    }
  }
  if (vaultCalls === 0) throw new Error("Transaction does not call the Sisih vault");
}

export async function executeSigned(bytesB64: string, signature: string): Promise<{ digest: string; success: boolean; error: string | null }> {
  await validateSigned(bytesB64);
  const res = await tatum().executeTransaction({ transaction: Uint8Array.from(Buffer.from(bytesB64, "base64")), signatures: [signature] });
  const t = res.Transaction ?? res.FailedTransaction;
  return { digest: t.digest, success: t.status.success, error: t.status.success ? null : JSON.stringify(t.status.error).slice(0, 300) };
}
