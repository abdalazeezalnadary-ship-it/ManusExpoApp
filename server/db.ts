import { drizzle } from "drizzle-orm/mysql2";

let database: ReturnType<typeof drizzle> | null = null;
let failed = false;

export async function getDb() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) return null;
  if (database) return database;
  if (failed) return null;
  try {
    database = drizzle(connectionString);
    return database;
  } catch {
    failed = true;
    console.error("[Database] Unable to initialize the database connection.");
    return null;
  }
}
