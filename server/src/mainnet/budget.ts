/**
 * Durable execution budgets for Mainnet. A manifest is a review artifact; these rows are the
 * runtime enforcement. Reservations are atomic across serverless instances and an unknown
 * broadcast keeps its full maximum reserved until a read-back resolves it.
 */
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "../db/index";

export type OperationStatus = "reserved" | "spent" | "released" | "unknown";

export interface BudgetSnapshot {
  key: string;
  authorized: bigint;
  reserved: bigint;
  spent: bigint;
  remaining: bigint;
}

export interface BudgetOperation {
  id: string;
  budgetKey: string;
  maximum: bigint;
  actual: bigint | null;
  status: OperationStatus;
  digest: string | null;
}

function positive(name: string, value: bigint): void {
  if (value <= 0n) throw new Error(`${name} must be a positive integer`);
}

/** Initialize once. Changing an authorization requires a new plan/budget key. */
export async function initializeBudget(key: string, authorized: bigint): Promise<BudgetSnapshot> {
  positive("authorized budget", authorized);
  await db().insert(schema.executionBudgets).values({ key, authorized, reserved: 0n, spent: 0n }).onConflictDoNothing();
  const current = await budgetSnapshot(key);
  if (!current) throw new Error(`could not initialize budget ${key}`);
  if (current.authorized !== authorized) {
    throw new Error(`budget ${key} already exists with a different authorization; use a new plan id`);
  }
  return current;
}

export async function budgetSnapshot(key: string): Promise<BudgetSnapshot | null> {
  const [row] = await db().select().from(schema.executionBudgets).where(eq(schema.executionBudgets.key, key));
  return row ? { ...row, remaining: row.authorized - row.reserved - row.spent } : null;
}

function operation(row: typeof schema.executionOperations.$inferSelect): BudgetOperation {
  return { id: row.id, budgetKey: row.budgetKey, maximum: row.maximum, actual: row.actual, status: row.status as OperationStatus, digest: row.digest };
}

/** Reserve before signing. Reusing the same id is idempotent; changing its terms is refused. */
export async function reserveOperation(id: string, budgetKey: string, maximum: bigint): Promise<BudgetOperation> {
  positive("operation maximum", maximum);
  return db().transaction(async (tx) => {
    const now = Date.now();
    const inserted = await tx
      .insert(schema.executionOperations)
      .values({ id, budgetKey, maximum, actual: null, status: "reserved", digest: null, createdAt: now, updatedAt: now })
      .onConflictDoNothing()
      .returning();
    if (!inserted.length) {
      const [existing] = await tx.select().from(schema.executionOperations).where(eq(schema.executionOperations.id, id));
      if (!existing) throw new Error(`operation ${id} disappeared while reserving`);
      if (existing.budgetKey !== budgetKey || existing.maximum !== maximum) throw new Error(`operation ${id} already exists with different terms`);
      return operation(existing);
    }
    const b = schema.executionBudgets;
    const moved = await tx
      .update(b)
      .set({ reserved: sql`${b.reserved} + ${maximum}` })
      .where(and(eq(b.key, budgetKey), sql`${b.authorized} - ${b.reserved} - ${b.spent} >= ${maximum}`))
      .returning({ key: b.key });
    if (!moved.length) throw new Error(`budget ${budgetKey} is missing or has insufficient remaining authorization`);
    return operation(inserted[0]!);
  });
}

async function resolveOperation(id: string, from: "reserved" | "unknown", to: "spent" | "released", actual: bigint, digest?: string): Promise<BudgetOperation> {
  if (actual < 0n) throw new Error("actual amount cannot be negative");
  return db().transaction(async (tx) => {
    const [cur] = await tx.select().from(schema.executionOperations).where(eq(schema.executionOperations.id, id));
    if (!cur) throw new Error(`unknown operation ${id}`);
    if (cur.status === to) return operation(cur);
    if (cur.status !== from) throw new Error(`operation ${id} is ${cur.status}, not ${from}`);
    if (actual > cur.maximum) throw new Error(`actual amount for ${id} exceeds its reserved maximum`);
    const now = Date.now();
    const changed = await tx
      .update(schema.executionOperations)
      .set({ status: to, actual, digest: digest ?? cur.digest, updatedAt: now })
      .where(and(eq(schema.executionOperations.id, id), eq(schema.executionOperations.status, from)))
      .returning();
    if (!changed.length) throw new Error(`operation ${id} changed concurrently; read it back before retrying`);
    const b = schema.executionBudgets;
    const spentDelta = to === "spent" ? actual : 0n;
    await tx
      .update(b)
      .set({ reserved: sql`${b.reserved} - ${cur.maximum}`, spent: sql`${b.spent} + ${spentDelta}` })
      .where(eq(b.key, cur.budgetKey));
    return operation(changed[0]!);
  });
}

export const recordSpent = (id: string, actual: bigint, digest?: string) => resolveOperation(id, "reserved", "spent", actual, digest);
export const releaseReservation = (id: string) => resolveOperation(id, "reserved", "released", 0n);
export const resolveUnknownSpent = (id: string, actual: bigint, digest?: string) => resolveOperation(id, "unknown", "spent", actual, digest);
export const resolveUnknownReleased = (id: string) => resolveOperation(id, "unknown", "released", 0n);

/** Transport timeout after a possible broadcast: retain the whole reservation and stop retries. */
export async function markUnknown(id: string, digest?: string): Promise<BudgetOperation> {
  const changed = await db()
    .update(schema.executionOperations)
    .set({ status: "unknown", digest: digest ?? null, updatedAt: Date.now() })
    .where(and(eq(schema.executionOperations.id, id), eq(schema.executionOperations.status, "reserved")))
    .returning();
  if (changed.length) return operation(changed[0]!);
  const [cur] = await db().select().from(schema.executionOperations).where(eq(schema.executionOperations.id, id));
  if (!cur) throw new Error(`unknown operation ${id}`);
  if (cur.status !== "unknown") throw new Error(`operation ${id} is ${cur.status}, not reserved`);
  return operation(cur);
}

export async function getOperation(id: string): Promise<BudgetOperation | null> {
  const [row] = await db().select().from(schema.executionOperations).where(eq(schema.executionOperations.id, id));
  return row ? operation(row) : null;
}
