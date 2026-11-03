import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getConfig } from "../config/index.ts";
import * as schema from "../db/schema.ts";

export type Database = NodePgDatabase<typeof schema>;

let pool: Pool | undefined;
let database: Database | undefined;

/** Per-process singleton. Connects lazily on the first query. */
export function getDatabase(): Database {
  if (database) return database;

  const { url, maxConnections } = getConfig().database;
  pool = new Pool({ connectionString: url, max: maxConnections });
  database = drizzle(pool, { schema });
  return database;
}

/** Fails fast when Postgres is down or the migrations were not applied. */
export async function checkDatabase(): Promise<void> {
  await getDatabase().execute(sql`select 1 from chat_replies limit 1`);
}

export async function closeDatabase(): Promise<void> {
  await pool?.end();
  pool = undefined;
  database = undefined;
}
