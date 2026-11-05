/**
 * Event bus behind the dashboard's live updates. Every event is stored in Postgres (events
 * table), so any serverless instance can serve GET /api/events?after=<id>. In a long-running
 * process, in-process subscribers (SSE) are notified too.
 * Event names: request.*, x402.*, memory.*, tx.*, state.*, suggestion.*, rule.*, session.*, demo.*
 */
import { EventEmitter } from "node:events";
import { asc, desc, gt, lt } from "drizzle-orm";
import { db, schema } from "../db/index";
import { background } from "./background";

export interface BusEvent {
  id: number;
  type: string;
  at: number;
  data: unknown;
}

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

/** JSON with bigint as base-unit strings. */
export function jsonSafe<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}

export function publish(type: string, data: unknown): void {
  const at = Date.now();
  const safe = jsonSafe(data);
  background(async () => {
    const [row] = await db().insert(schema.events).values({ type, at, data: JSON.stringify(safe) }).returning({ id: schema.events.id });
    emitter.emit("event", { id: row!.id, type, at, data: safe } satisfies BusEvent);
  });
}

export function subscribe(fn: (ev: BusEvent) => void): () => void {
  emitter.on("event", fn);
  return () => emitter.off("event", fn);
}

/** Events after `lastId` (polling and SSE reconnects). */
export async function since(lastId: number, limit = 200): Promise<BusEvent[]> {
  const rows = await db().select().from(schema.events).where(gt(schema.events.id, lastId)).orderBy(asc(schema.events.id)).limit(limit);
  return rows.map((r) => ({ id: r.id, type: r.type, at: r.at, data: JSON.parse(r.data) }));
}

/** Id of the newest stored event (0 when empty), so a client can start from "now". */
export async function latestEventId(): Promise<number> {
  const [r] = await db().select({ id: schema.events.id }).from(schema.events).orderBy(desc(schema.events.id)).limit(1);
  return r?.id ?? 0;
}

/** Keep the feed small: drop events older than a day. */
export async function pruneEvents(): Promise<void> {
  await db().delete(schema.events).where(lt(schema.events.at, Date.now() - 86_400_000));
}
