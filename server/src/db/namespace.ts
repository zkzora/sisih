import { env } from "../lib/env";

export const databaseSchema = env("DATABASE_SCHEMA") ?? "public";
if (!/^[a-z][a-z0-9_]{0,62}$/.test(databaseSchema)) throw new Error("Invalid DATABASE_SCHEMA identifier");
export const qualifiedTable = (name: string) => `"${databaseSchema}"."${name}"`;
export function namespacedDdl(statement: string): string {
  return statement.replace(/(CREATE TABLE IF NOT EXISTS|ON) ([a-z_]+)/g, (_all, operation, name) => `${operation} ${qualifiedTable(name)}`);
}
