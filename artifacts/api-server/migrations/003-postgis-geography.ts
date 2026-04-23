/**
 * Migration: 003-postgis-geography
 *
 * 1. Enables the PostGIS extension (requires superuser or pg_extension role).
 * 2. Adds a GEOGRAPHY(POINT, 4326) column `location` to the `orders` table
 *    so that order pin coordinates are stored as a proper spatial type.
 * 3. Backfills any existing rows that already have latitude/longitude in their
 *    JSONB `data` column.
 *
 * Usage: pnpm tsx artifacts/api-server/migrations/003-postgis-geography.ts
 */

import pg from "pg";

const { Pool } = pg;

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`CREATE EXTENSION IF NOT EXISTS postgis`);

    await client.query(`
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS location GEOGRAPHY(POINT, 4326)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "IDX_orders_location"
        ON orders USING GIST (location)
    `);

    await client.query(`
      UPDATE orders
      SET location = ST_SetSRID(
        ST_MakePoint(
          (data->>'longitude')::float,
          (data->>'latitude')::float
        ),
        4326
      )::geography
      WHERE
        location IS NULL
        AND data->>'latitude'  IS NOT NULL
        AND data->>'longitude' IS NOT NULL
        AND (data->>'latitude')::float  BETWEEN -90  AND  90
        AND (data->>'longitude')::float BETWEEN -180 AND 180
    `);

    await client.query("COMMIT");
    console.log("Migration 003-postgis-geography applied successfully.");
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
