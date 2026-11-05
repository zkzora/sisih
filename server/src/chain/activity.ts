/**
 * Activity feed: our tx_log (digests we know about) + the events Tatum returned for each.
 * Tatum blocks ListEvents, so nothing here queries the chain; it only reads tx_log.
 */
import { desc } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { suiNetwork } from "../lib/env.js";
import type { TxEvent } from "../lib/tatum.js";
import { vaultAbortName } from "./sisih.js";

export type ActivityKind =
  | "Deposit"
  | "Reserve"
  | "Pay obligation"
  | "Release to agent"
  | "x402 settle"
  | "Change reserve"
  | "Withdraw"
  | "Agent permission"
  | "Vault created"
  | "Other";

export interface ActivityRow {
  id: string;
  digest: string;
  kind: ActivityKind;
  amount: string | null; // base units
  from: string;
  to: string;
  timestampMs: number | null;
  checkpoint: string | null;
  verification: "verified" | "pending" | "failed" | "error";
  failureReason: string | null;
  explorerUrl: string;
  label: string | null;
  memoryId: string | null;
  requestId: string | null;
  eventType: string | null;
}

export function explorerTxUrl(digest: string, network = suiNetwork()): string {
  return `https://suiscan.xyz/${network}/tx/${digest}`;
}

export function explorerObjectUrl(id: string, network = suiNetwork()): string {
  return `https://suiscan.xyz/${network}/object/${id}`;
}

const s = (v: unknown) => (v === undefined || v === null ? "" : String(v));

/** Map one vault event to an activity row body. Unknown events -> null. */
export function mapVaultEvent(e: TxEvent): Pick<ActivityRow, "kind" | "amount" | "from" | "to"> | null {
  const name = e.type.split("::").pop()?.split("<")[0] ?? "";
  const j = e.json ?? {};
  switch (name) {
    case "Deposited":
      return { kind: "Deposit", amount: s(j.amount), from: s(j.from) || e.sender, to: "Vault" };
    case "Withdrawn":
      return { kind: "Withdraw", amount: s(j.amount), from: "Vault (free)", to: s(j.to) };
    case "EmergencyWithdrawn":
      return { kind: "Withdraw", amount: s(j.amount), from: "Vault (all reserves)", to: s(j.to) };
    case "ObligationAdded":
      return { kind: "Reserve", amount: s(j.reserved), from: "Vault (free)", to: s(j.name) };
    case "ReservesFunded":
      return { kind: "Reserve", amount: s(j.moved), from: "Vault (free)", to: "Underfunded reserves" };
    case "ObligationTargetChanged":
      return { kind: "Change reserve", amount: s(j.new_target), from: `Target ${s(j.old_target)}`, to: `Obligation #${s(j.id)}` };
    case "ObligationRemoved":
      return { kind: "Change reserve", amount: s(j.released), from: s(j.name), to: "Vault (free)" };
    case "ObligationPaid":
      return { kind: "Pay obligation", amount: s(j.bill), from: "Vault", to: s(j.name) };
    case "ReleasedToAgent":
      return { kind: "Release to agent", amount: s(j.amount), from: "Vault (free)", to: "Research Agent" };
    case "AgentPolicySet":
      return { kind: "Agent permission", amount: null, from: "Owner", to: "Agent permission set" };
    case "AgentPaused":
      return { kind: "Agent permission", amount: null, from: "Owner", to: "Agent paused" };
    case "AgentResumed":
      return { kind: "Agent permission", amount: null, from: "Owner", to: "Agent resumed" };
    case "AgentRevoked":
      return { kind: "Agent permission", amount: null, from: "Owner", to: "Agent permission revoked" };
    case "VaultCreated":
      return { kind: "Vault created", amount: null, from: "Owner", to: "Vault" };
    case "OperatorRotated":
      return { kind: "Agent permission", amount: null, from: "Owner", to: "Operator rotated" };
    default:
      return null;
  }
}

function kindFromLabel(label: string | null): ActivityKind {
  const l = (label ?? "").toLowerCase();
  if (l.includes("x402")) return "x402 settle";
  if (l.includes("release")) return "Release to agent";
  if (l.includes("deposit")) return "Deposit";
  if (l.includes("withdraw")) return "Withdraw";
  if (l.includes("pay obligation")) return "Pay obligation";
  if (l.includes("publish") || l.includes("create vault")) return "Vault created";
  if (l.includes("reserve")) return "Change reserve";
  return "Other";
}

export function activityRows(limit = 200): ActivityRow[] {
  const rows = db().select().from(schema.txLog).orderBy(desc(schema.txLog.timestampMs), desc(schema.txLog.recordedAt)).limit(limit).all();
  const out: ActivityRow[] = [];
  for (const r of rows) {
    const events = (r.events ? JSON.parse(r.events) : []) as TxEvent[];
    const vaultEvents = events.filter((e) => e.type.includes("::vault::"));
    const base = {
      digest: r.digest,
      timestampMs: r.timestampMs ?? null,
      checkpoint: r.checkpoint ?? null,
      verification: r.status as ActivityRow["verification"],
      failureReason: r.status === "failed" && r.error ? vaultAbortName(r.error) : r.status === "error" ? r.error : null,
      explorerUrl: explorerTxUrl(r.digest),
      label: r.label,
      memoryId: r.memoryId,
      requestId: r.requestId,
    };
    if (vaultEvents.length === 0) {
      out.push({ ...base, id: r.digest, kind: kindFromLabel(r.label), amount: null, from: "", to: "", eventType: null });
      continue;
    }
    vaultEvents.forEach((e, i) => {
      const m = mapVaultEvent(e);
      if (!m) return;
      out.push({ ...base, id: `${r.digest}#${i}`, ...m, eventType: e.type.split("::").pop() ?? null });
    });
  }
  return out;
}
