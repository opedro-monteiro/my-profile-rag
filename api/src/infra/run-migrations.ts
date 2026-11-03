import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getConfig } from "../config/index.ts";
import { getDatabase } from "./database.ts";

export async function runMigrations(): Promise<void> {
  const { migrationsFolder } = getConfig().database;
  await migrate(getDatabase(), { migrationsFolder });
}
