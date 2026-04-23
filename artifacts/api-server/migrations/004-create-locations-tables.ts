/**
 * Migration: 005-create-locations-tables
 *
 * Creates the `locations` and `nominatim_cache` tables needed by the
 * geolocation API routes.
 *
 * - `locations` stores the Egypt administrative hierarchy
 *   (governorates → areas → neighborhoods) seeded from migration 004.
 * - `nominatim_cache` stores reverse/forward geocode responses so the app
 *   respects Nominatim's 1 req/sec rate limit.
 *
 * This migration is idempotent (uses IF NOT EXISTS) and safe to re-run.
 * The development database already has these tables from `drizzle-kit push`.
 *
 * Usage: pnpm tsx artifacts/api-server/migrations/005-create-locations-tables.ts
 */

import pg from "pg";

const { Pool } = pg;

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'location_type') THEN
          CREATE TYPE location_type AS ENUM ('governorate', 'area', 'neighborhood');
        END IF;
      END $$
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS locations (
        id         VARCHAR PRIMARY KEY,
        type       location_type NOT NULL,
        name_ar    VARCHAR(200)  NOT NULL,
        name_en    VARCHAR(200)  NOT NULL,
        parent_id  VARCHAR,
        slug       VARCHAR(200)  NOT NULL
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "IDX_locations_type"
        ON locations (type)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS "IDX_locations_parent"
        ON locations (parent_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS "IDX_locations_slug"
        ON locations (slug)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS nominatim_cache (
        id            VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        cache_key     VARCHAR(500) NOT NULL UNIQUE,
        lang          VARCHAR(5)   NOT NULL DEFAULT 'ar',
        response_json JSONB        NOT NULL,
        cached_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        expires_at    TIMESTAMPTZ  NOT NULL
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nominatim_key"
        ON nominatim_cache (cache_key)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nominatim_expires"
        ON nominatim_cache (expires_at)
    `);

    await client.query("COMMIT");
    console.log("Migration 005-create-locations-tables applied successfully.");
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
