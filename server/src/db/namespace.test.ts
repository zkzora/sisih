import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
process.env.DATABASE_SCHEMA = "mainnet_isolation_fixture";
process.env.DATABASE_URL = "pglite::memory:";
const { initDb, db, schema, schemaExists } = await import("./index");
describe("real PostgreSQL schema isolation", () => {
  it("qualifies application reads/writes and leaves same-named legacy tables untouched", async () => {
    await initDb();
    await db().execute(sql.raw("CREATE TABLE public.sessions (n integer primary key)"));
    await db().execute(sql.raw("INSERT INTO public.sessions VALUES (99)"));
    await db().insert(schema.sessions).values({ n: 1, startedAt: 1 });
    const rows = await db().select().from(schema.sessions);
    expect(rows.map(row => row.n)).toEqual([1]);
    const legacy = await db().execute(sql.raw("SELECT n FROM public.sessions")) as unknown as { rows: { n: number }[] };
    expect(legacy.rows).toEqual([{ n: 99 }]);
    expect(await schemaExists()).toBe(true);
  });
});
