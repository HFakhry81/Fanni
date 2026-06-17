/**
 * Migration: 011-add-user-address
 *
 * Adds an `address` varchar(500) column to the `users` table so that
 * a technician's street address can be persisted on the server and
 * restored across devices / reinstalls.
 *
 * The column is nullable — existing rows will have NULL, which is
 * treated as "no address set" by the application.
 *
 * Usage:
 *   pnpm tsx artifacts/api-server/migrations/011-add-user-address.ts
 */

import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";

async function run(): Promise<void> {
  console.log("[011-add-user-address] Adding address column to users table…");

  await db.execute(
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS address varchar(500)`
  );

  console.log("[011-add-user-address] Done.");
  await pool.end();
}

run().catch((err) => {
  console.error("[011-add-user-address] Fatal error:", err);
  process.exit(1);
});
