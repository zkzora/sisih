/**
 * Reactions to vault events we have proven through Tatum:
 *  - ObligationPaid with bill > target -> obligation_outcome memory + reserve suggestion
 *  - owner-signed set_obligation_target (accept) -> reserve_change memory
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { cachedVault, recordTx, type RecordedTx } from "../chain/vault";
import { db, schema } from "../db/index";
import { jsonSafe, publish } from "../lib/bus";
import { formatUsdc } from "../lib/env";
import { remember } from "../memory/memwal";
import { parseMemory } from "../memory/format";
import { suggestTarget } from "../policy/suggestions";
import { ApiError } from "./requests";
import { currentSession } from "./state";

const eventName = (type: string) => type.split("::").pop()?.split("<")[0] ?? "";

/** Past bills for an obligation, from our stored outcome memories. */
async function pastBills(name: string): Promise<bigint[]> {
  return (await db().select().from(schema.memories).where(eq(schema.memories.type, "obligation_outcome")))
    .map((m) => parseMemory(m.text))
    .filter((m) => m && m.payload.name === name)
    .map((m) => BigInt(String(m!.payload.bill)));
}

/** Call after recordTx for any transaction that may contain vault events. */
export async function onVaultEvents(rec: RecordedTx): Promise<void> {
  if (rec.status !== "verified") return;
  const vault = await cachedVault();
  for (const e of rec.events) {
    if (eventName(e.type) !== "ObligationPaid" || !e.json) continue;
    const j = e.json;
    const id = Number(j.id);
    const name = String(j.name);
    const bill = BigInt(String(j.bill));
    const fromReserve = BigInt(String(j.from_reserve));
    const fromFree = BigInt(String(j.from_free));
    const uncovered = BigInt(String(j.uncovered));
    const target = vault?.obligations.find((o) => o.id === id)?.target ?? fromReserve;
    const short = bill > target ? bill - target : 0n;
    const session = await currentSession();
    const outcome = await remember(
      "obligation_outcome",
      `${name}: bill ${formatUsdc(bill)}, reserve ${formatUsdc(fromReserve)}` +
        (short > 0n ? `, short ${formatUsdc(short)} (covered ${formatUsdc(fromFree)} from free, ${formatUsdc(uncovered)} uncovered).` : ", fully covered."),
      { obligationId: id, name, bill: bill.toString(), target: target.toString(), fromReserve: fromReserve.toString(), fromFree: fromFree.toString(), uncovered: uncovered.toString(), digest: rec.digest },
      { session },
    );
    const draft = suggestTarget(name, target, bill, await pastBills(name));
    if (!draft || !vault?.obligations.some((o) => o.id === id)) continue;
    const sid = `sug-${randomUUID().slice(0, 8)}`;
    await db().insert(schema.suggestions)
      .values({ id: sid, obligationId: id, obligationName: name, currentTarget: target.toString(), suggestedTarget: draft.suggestedTarget.toString(), reason: draft.reason, sourceMemoryId: outcome.id, sourceDigest: rec.digest, status: "open", createdAt: Date.now() });
    publish("suggestion.created", { id: sid, obligationId: id, name, currentTarget: target.toString(), suggestedTarget: draft.suggestedTarget.toString(), reason: draft.reason, sourceMemoryId: outcome.id });
  }
}

export async function listSuggestions() {
  return db().select().from(schema.suggestions).orderBy(desc(schema.suggestions.createdAt));
}

/**
 * The owner signed set_obligation_target in the browser and posts the digest. We prove it
 * through Tatum (the target change must match the suggestion) and remember the change.
 */
export async function acceptSuggestion(id: string, digest: string) {
  const [s] = await db().select().from(schema.suggestions).where(eq(schema.suggestions.id, id));
  if (!s) throw new ApiError(404, `No suggestion ${id}`, "not_found");
  if (s.status !== "open") throw new ApiError(409, `Suggestion is ${s.status}`, "not_open");
  const rec = await recordTx(digest, { source: "owner", label: `Change reserve: ${s.obligationName}` });
  if (rec.status !== "verified") throw new ApiError(409, `Transaction ${digest} is ${rec.status}: ${rec.error ?? ""}`, "tx_not_verified");
  const change = rec.events.find((e) => eventName(e.type) === "ObligationTargetChanged" && Number(e.json?.id) === s.obligationId);
  if (!change) throw new ApiError(409, "That transaction did not change this obligation's target", "tx_mismatch");
  const newTarget = BigInt(String(change.json!.new_target));
  const mem = await remember(
    "reserve_change",
    `${s.obligationName} reserve ${formatUsdc(BigInt(s.currentTarget))} to ${formatUsdc(newTarget)} USDC, approved by the owner.`,
    { suggestionId: id, obligationId: s.obligationId, name: s.obligationName, oldTarget: s.currentTarget, newTarget: newTarget.toString(), accepted: true, digest },
    { session: await currentSession() },
  );
  await db().update(schema.suggestions).set({ status: "accepted", digest }).where(and(eq(schema.suggestions.id, id)));
  await db().update(schema.txLog).set({ memoryId: mem.id }).where(eq(schema.txLog.digest, digest));
  publish("suggestion.accepted", jsonSafe({ id, digest, newTarget, memoryId: mem.id }));
  return { id, digest, newTarget: newTarget.toString(), memoryId: mem.id };
}

export async function rejectSuggestion(id: string) {
  const [s] = await db().select().from(schema.suggestions).where(eq(schema.suggestions.id, id));
  if (!s) throw new ApiError(404, `No suggestion ${id}`, "not_found");
  if (s.status !== "open") throw new ApiError(409, `Suggestion is ${s.status}`, "not_open");
  const mem = await remember(
    "reserve_change",
    `${s.obligationName} reserve suggestion ${formatUsdc(BigInt(s.currentTarget))} to ${formatUsdc(BigInt(s.suggestedTarget))} USDC, rejected by the owner.`,
    { suggestionId: id, obligationId: s.obligationId, name: s.obligationName, oldTarget: s.currentTarget, newTarget: s.suggestedTarget, accepted: false },
    { session: await currentSession() },
  );
  await db().update(schema.suggestions).set({ status: "rejected" }).where(eq(schema.suggestions.id, id));
  publish("suggestion.rejected", { id, memoryId: mem.id });
  return { id, memoryId: mem.id };
}
