import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Lazily-created database client. Pages that need data import `db` from here;
 * nothing at request time ever calls an outside API (see PLAN.md, architecture).
 */
let client: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function db() {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set; see web/.env.example");
  }
  const sql = postgres(url, { prepare: false, max: 1 });
  client = drizzle(sql, { schema });
  return client;
}

export { schema };
