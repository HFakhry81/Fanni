/**
 * Migration: 012-add-admin-columns
 *
 * Adds four columns to the `admins` table that are defined in the Drizzle
 * schema (lib/db/src/schema/auth.ts → adminsTable) but were previously only
 * applied at runtime via inline ALTER TABLE statements in src/index.ts:
 *
 *   - must_change_password  BOOLEAN NOT NULL DEFAULT false
 *   - profile_image_url     VARCHAR (nullable)
 *   - is_super_admin        BOOLEAN NOT NULL DEFAULT false
 *   - permissions           JSONB   (nullable)
 *
 * All statements use ADD COLUMN IF NOT EXISTS so the migration is safe to
 * run against a database that already received these columns via the startup
 * inline migrations.
 *
 * Usage:
 *   pnpm tsx artifacts/api-server/migrations/012-add-admin-columns.ts
 */

import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";

async function run(): Promise<void> {
  console.log("[012-add-admin-columns] Adding missing columns to admins table…");

  await db.execute(
    sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false`
  );
  console.log("[012-add-admin-columns] must_change_password ensured.");

  await db.execute(
    sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS profile_image_url VARCHAR`
  );
  console.log("[012-add-admin-columns] profile_image_url ensured.");

  await db.execute(
    sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false`
  );
  console.log("[012-add-admin-columns] is_super_admin ensured.");

  await db.execute(
    sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS permissions JSONB`
  );
  console.log("[012-add-admin-columns] permissions ensured.");

  console.log("[012-add-admin-columns] Done.");
  await pool.end();
}

run().catch((err) => {
  console.error("[012-add-admin-columns] Fatal error:", err);
  process.exit(1);
});
