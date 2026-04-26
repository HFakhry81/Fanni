/**
 * Simple sequential SQL migration runner.
 *
 * Reads every *.sql file from ../migrations/ in lexicographic order and
 * executes each one against DATABASE_URL. All statements within a file are
 * wrapped in a single transaction; any failure rolls back that file and
 * aborts the run.
 *
 * Usage:
 *   pnpm --filter @workspace/db run migrate
 *
 * Files must be named with a numeric prefix so they sort deterministically:
 *   001_location_aliases.sql
 *   002_next_migration.sql
 *   …
 *
 * Individual statements within a file are separated by a semicolon followed
 * by a newline. Empty statements are skipped.
 */

import { readdir, readFile } from "fs/promises";
import path from "path";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

const migrationsDir = path.join(import.meta.dirname, "..", "migrations");
const files = (await readdir(migrationsDir))
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (!files.length) {
  console.log("No migration files found.");
  await pool.end();
  process.exit(0);
}

let applied = 0;
for (const file of files) {
  const filePath = path.join(migrationsDir, file);
  const sql = await readFile(filePath, "utf8");

  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    await client.query("BEGIN");
    for (const stmt of statements) {
      await client.query(stmt);
    }
    await client.query("COMMIT");
    console.log(`✓ Applied: ${file}`);
    applied++;
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`✗ Failed: ${file}`, err);
    client.release();
    await pool.end();
    process.exit(1);
  }
}

client.release();
await pool.end();
console.log(`Migration complete: ${applied}/${files.length} file(s) applied.`);
