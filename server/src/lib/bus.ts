/**
 * In-process event bus behind GET /api/events (SSE). Event names follow the dashboard:
 * request.*, memory.*, tx.*, state.changed, session.*.
 */
import { EventEmitter } from "node:events";

export interface BusEvent {
  id: number;
  type: string;
  at: number;
  data: unknown;
}

const emitter = new EventEmitter();
emitter.setMaxListeners(100);
let seq = 0;
const recent: BusEvent[] = [];

export function publish(type: string, data: unknown): BusEvent {
  const ev: BusEvent = { id: ++seq, type, at: Date.now(), data };
  recent.push(ev);
  if (recent.length > 200) recent.shift();
  emitter.emit("event", ev);
  return ev;
}

export function subscribe(fn: (ev: BusEvent) => void): () => void {
  emitter.on("event", fn);
  return () => emitter.off("event", fn);
}

/** Events after `lastId`, for SSE reconnects (Last-Event-ID). */
export function since(lastId: number): BusEvent[] {
  return recent.filter((e) => e.id > lastId);
}

/** JSON with bigint as base-unit strings. */
export function jsonSafe<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}
