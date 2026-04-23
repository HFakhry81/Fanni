/**
 * Migration: 002-phone-verifications
 *
 * Adds the `phone_verifications` table used by the OTP registration flow.
 * Stores HMAC/SHA-256 hashed OTP codes with expiry so the plain-text code is
 * never persisted.
 *
 * Status: ALREADY APPLIED to the current development database via drizzle-kit push.
 * Run this script on any fresh/production database that does not yet have this table.
 *
 * Usage: pnpm tsx artifacts/api-server/migrations/002-phone-verifications.ts
 */

import pg from "pg";

const { Pool } = pg;

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS phone_verifications (
        id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        mobile       VARCHAR(20)  NOT NULL,
        code_hash    VARCHAR      NOT NULL,
        expires_at   TIMESTAMPTZ  NOT NULL,
        used_at      TIMESTAMPTZ,
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "IDX_phone_verif_mobile"
        ON phone_verifications (mobile)
    `);

    await client.query("COMMIT");
    console.log("Migration 002-phone-verifications applied successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => { console.error(err); process.exit(1); });
