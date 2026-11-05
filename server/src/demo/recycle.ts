/**
 * Demo plumbing (labeled as such in code, API and README): sweep USDC from the demo payees,
 * demo merchants and any agent leftovers back to the operator, so simulated income reuses
 * the same funds. Holders have no SUI, so each sweep is the same "gasless" USDC transfer the
 * x402 facilitator uses: sender = holder, gas owner = operator (sponsor), price/budget 0.
 * Works whether the USDC sits in coin objects or the address balance (tx.balance draws from both).
 */
import type { Keypair } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction, coinWithBalance } from "@mysten/sui/transactions";
import { usdcType } from "../chain/sisih.js";
import { env, formatUsdc, suiNetwork } from "../lib/env.js";
import { setGas, signAndExecute, suiClient, verifyTransaction } from "../lib/tatum.js";
import { keypair } from "../lib/wallets.js";

export interface Holder {
  label: string;
  keypair: Keypair;
}

/** Every demo address whose USDC belongs back with the operator. */
export function demoHolders(opts: { includeAgent?: boolean } = {}): Holder[] {
  const keys: [string, string][] = [
    ["Inference API payee (demo)", "PAYEE_INFERENCE_PRIVATE_KEY"],
    ["Hosting VPS payee (demo)", "PAYEE_HOSTING_PRIVATE_KEY"],
    ["Weekly savings payee (demo)", "PAYEE_SAVINGS_PRIVATE_KEY"],
    ["Domain renewal payee (demo)", "PAYEE_DOMAIN_PRIVATE_KEY"],
    ["DataMart (demo merchant)", "MERCHANT_DATAMART_PRIVATE_KEY"],
    ["SearchBox (demo merchant)", "MERCHANT_SEARCHBOX_PRIVATE_KEY"],
    ["ReportLab (demo merchant)", "MERCHANT_REPORTLAB_PRIVATE_KEY"],
  ];
  const holders = keys.filter(([, k]) => env(k)).map(([label, k]) => ({ label, keypair: Ed25519Keypair.fromSecretKey(env(k)!) }));
  if (opts.includeAgent !== false) holders.push({ label: "Research Agent leftovers", keypair: keypair("agent") });
  return holders;
}

export interface SweepRecord {
  label: string;
  from: string;
  amount: string;
  digest: string | null;
  verified: boolean;
  error: string | null;
}

export async function usdcBalance(owner: string): Promise<bigint> {
  return BigInt((await suiClient().core.getBalance({ owner, coinType: usdcType() })).balance.balance);
}

/** One sponsored, gasless USDC send_funds from `holder` to `to`. */
export async function sponsoredSend(holder: Keypair, to: string, amount: bigint, sponsor: Keypair = keypair("operator")): Promise<string> {
  const client = suiClient();
  const tx = new Transaction();
  tx.setSender(holder.toSuiAddress());
  tx.setGasOwner(sponsor.toSuiAddress());
  tx.setGasPayment([]);
  tx.moveCall({
    target: "0x2::balance::send_funds",
    typeArguments: [usdcType()],
    arguments: [tx.balance({ type: usdcType(), balance: amount, useGasCoin: false }), tx.pure.address(to)],
  });
  const bytes = await tx.build({ client });
  const [{ signature: s1 }, { signature: s2 }] = await Promise.all([holder.signTransaction(bytes), sponsor.signTransaction(bytes)]);
  const res = await client.executeTransaction({ transaction: bytes, signatures: [s1, s2] });
  const t = res.Transaction ?? res.FailedTransaction;
  if (!t.status.success) throw new Error(`sweep failed: ${JSON.stringify(t.status.error).slice(0, 200)}`);
  return t.digest;
}

/** Sweep every demo holder to the operator. Logs and returns one record per transfer. */
export async function recycle(opts: { includeAgent?: boolean; log?: (line: string) => void } = {}): Promise<SweepRecord[]> {
  const log = opts.log ?? ((l: string) => console.log(l));
  const operator = keypair("operator").toSuiAddress();
  const out: SweepRecord[] = [];
  for (const h of demoHolders(opts)) {
    const from = h.keypair.toSuiAddress();
    const amount = await usdcBalance(from);
    if (amount === 0n) continue;
    try {
      const digest = await sponsoredSend(h.keypair, operator, amount);
      const v = await verifyTransaction(digest);
      out.push({ label: h.label, from, amount: amount.toString(), digest, verified: v.success, error: null });
      log(`[recycle, demo plumbing] ${h.label}: ${formatUsdc(amount)} USDC -> operator ${digest} verified=${v.success}`);
    } catch (err) {
      out.push({ label: h.label, from, amount: amount.toString(), digest: null, verified: false, error: (err as Error).message.slice(0, 200) });
      log(`[recycle, demo plumbing] ${h.label}: ${formatUsdc(amount)} USDC FAILED ${(err as Error).message.slice(0, 160)}`);
    }
  }
  if (out.length === 0) log("[recycle, demo plumbing] nothing to sweep");
  return out;
}

/** Operator -> address USDC (operator pays its own gas). Used to top up the owner before seeding. */
export async function operatorSendUsdc(to: string, amount: bigint): Promise<string> {
  const operator = keypair("operator");
  const tx = new Transaction();
  tx.setSender(operator.toSuiAddress());
  await setGas(tx, { budget: 10_000_000n });
  tx.transferObjects([coinWithBalance({ type: usdcType(), balance: amount })], to);
  const res = await signAndExecute(tx, operator);
  if (!res.success) throw new Error(`operator send failed: ${res.error}`);
  return res.digest;
}

/**
 * Wait until a balance read through Tatum shows at least `min`. Right after a transfer the
 * gateway can serve getBalance from a node that has not caught up, while listCoins already
 * sees the new coin; coinWithBalance then fails with "Insufficient balance". Poll first.
 */
export async function waitForBalance(owner: string, min: bigint, timeoutMs = 30_000): Promise<bigint> {
  const t0 = Date.now();
  for (;;) {
    const b = await usdcBalance(owner);
    if (b >= min) return b;
    if (Date.now() - t0 > timeoutMs) throw new Error(`balance of ${owner} stayed at ${formatUsdc(b)} USDC, expected at least ${formatUsdc(min)}`);
    await new Promise((res) => setTimeout(res, 1500));
  }
}

export function assertTestnet(what: string): void {
  if (suiNetwork() !== "testnet") throw new Error(`${what} is testnet-only demo plumbing`);
}
