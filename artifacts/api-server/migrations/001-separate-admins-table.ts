/**
 * Migration: 001-separate-admins-table
 * 
 * Separates admin users from the unified `users` table into a dedicated `admins` table.
 * This migration:
 *   1. Copies all rows where role='admin' from `users` into `admins` (preserving IDs and password hashes)
 *   2. Deletes those rows from `users`
 *   3. Removes 'admin' from the `user_role` enum (client, technician only)
 *
 * Status: ALREADY APPLIED to the current database.
 * Run this script only on a fresh database that still has admin rows in `users`.
 *
 * Usage: pnpm tsx artifacts/api-server/migrations/001-separate-admins-table.ts
 */

import pg from "pg";
import crypto from "node:crypto";

const { Pool } = pg;

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Step 1: Create admins table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR UNIQUE,
        first_name VARCHAR,
        last_name VARCHAR,
        mobile VARCHAR(20) UNIQUE,
        password_hash VARCHAR,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ admins table ready");

    // Step 2: Copy admin rows from users → admins
    const { rows: adminUsers } = await client.query(
      "SELECT id, first_name, last_name, email, mobile, password_hash, is_active, created_at, updated_at FROM users WHERE role = 'admin'"
    );
    console.log(`Found ${adminUsers.length} admin row(s) in users table`);

    for (const row of adminUsers) {
      await client.query(
        `INSERT INTO admins (id, first_name, last_name, email, mobile, password_hash, is_active, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO NOTHING`,
        [row.id, row.first_name, row.last_name, row.email, row.mobile,
         row.password_hash, row.is_active, row.created_at, row.updated_at]
      );
    }
    console.log(`✅ Copied ${adminUsers.length} admin(s) to admins table`);

    // Step 3: Delete admin rows from users
    const { rowCount } = await client.query("DELETE FROM users WHERE role = 'admin'");
    console.log(`✅ Deleted ${rowCount} admin row(s) from users table`);

    // Step 4: Update user_role enum to remove 'admin'
    // (Only do this if the enum still has 'admin' — safe to skip if already updated)
    const { rows: enumVals } = await client.query(
      "SELECT unnest(enum_range(NULL::user_role))::text AS val"
    );
    if (enumVals.some((r: { val: string }) => r.val === "admin")) {
      await client.query("CREATE TYPE user_role_new AS ENUM ('client', 'technician')");
      await client.query("ALTER TABLE users ALTER COLUMN role TYPE user_role_new USING role::text::user_role_new");
      await client.query("DROP TYPE user_role");
      await client.query("ALTER TYPE user_role_new RENAME TO user_role");
      console.log("✅ Removed 'admin' from user_role enum");
    } else {
      console.log("ℹ️  user_role enum already updated (skipping enum change)");
    }

    await client.query("COMMIT");
    console.log("✅ Migration complete");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Migration failed:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
