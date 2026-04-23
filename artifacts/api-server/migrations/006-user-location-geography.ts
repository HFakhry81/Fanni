/**
 * Migration: 006-user-location-geography
 *
 * Adds a GEOGRAPHY(POINT, 4326) column `location` to the `users` table.
 * This enables ST_DWithin spatial queries in the technicians/available endpoint
 * to find nearby technicians based on their GPS coordinates.
 *
 * - Null by default (technicians opt-in by updating their location via mobile).
 * - A GIST spatial index is added for fast ST_DWithin lookups.
 * - Idempotent: column / index creation uses IF NOT EXISTS.
 *
 * Usage: pnpm tsx artifacts/api-server/migrations/006-user-location-geography.ts
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
        ADD COLUMN IF NOT EXISTS location GEOGRAPHY(POINT, 4326)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_location"
        ON users USING GIST (location)
        WHERE location IS NOT NULL
    `);

    await client.query("COMMIT");
    console.log("Migration 006-user-location-geography applied successfully.");
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
