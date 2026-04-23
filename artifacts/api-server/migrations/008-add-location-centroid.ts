/**
 * Migration: 008-add-location-centroid
 *
 * Adds a GEOGRAPHY(POINT, 4326) centroid column to the `locations` table.
 * This enables future proximity features (e.g. nearest technician to a city).
 *
 * - Column is nullable (centroids can be populated by a future batch Nominatim job).
 * - A GIST spatial index is added for fast ST_DWithin lookups.
 * - Idempotent: uses IF NOT EXISTS — safe to re-run.
 *
 * Usage: pnpm tsx artifacts/api-server/migrations/008-add-location-centroid.ts
 */

import pg from "pg";

const { Pool } = pg;

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      ALTER TABLE locations
        ADD COLUMN IF NOT EXISTS centroid GEOGRAPHY(POINT, 4326)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "IDX_locations_centroid"
        ON locations USING GIST (centroid)
        WHERE centroid IS NOT NULL
    `);

    await client.query("COMMIT");
    console.log("Migration 008-add-location-centroid applied successfully.");
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
