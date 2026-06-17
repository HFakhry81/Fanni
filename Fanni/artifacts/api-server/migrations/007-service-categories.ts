/**
 * Migration: 007-service-categories
 *
 * Adds a JSONB column `service_categories` to the `users` table so that
 * technicians' selected service category keys (e.g. "electricity", "plumbing")
 * are persisted on the server and survive device changes or reinstalls.
 *
 * - Null by default (existing technicians retain an empty selection).
 * - Idempotent: column creation uses IF NOT EXISTS.
 *
 * Usage: pnpm tsx artifacts/api-server/migrations/007-service-categories.ts
 */

import pg from "pg";

const { Pool } = pg;

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS service_categories JSONB
    `);

    await client.query("COMMIT");
    console.log("Migration 007-service-categories applied successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
