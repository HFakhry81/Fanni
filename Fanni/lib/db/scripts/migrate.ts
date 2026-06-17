/**
 * Idempotent sequential SQL migration runner with tracking.
 *
 * On every run it:
 *  1. Checks if `schema_migrations` tracking table already exists.
 *  2. Creates it (IF NOT EXISTS).
 *  3. If the table was JUST created (first time this system is used), it
 *     pre-seeds all currently-known migration files as already applied —
 *     the old runner had no tracking and re-ran everything with IF NOT EXISTS
 *     guards on every startup, so all existing files are guaranteed applied.
 *  4. Skips files that are recorded in `schema_migrations`.
 *  5. Applies new (unrecorded) files one at a time inside a transaction and
 *     records each success.
 *
 * This makes the runner safe to call on every application startup.
 *
 * Files must be named with a numeric prefix so they sort deterministically:
 *   001_location_aliases.sql
 *   002_next_migration.sql
 *   …
 *
 * Individual statements within a file are separated by a semicolon followed
 * by a newline. Empty statements are skipped.  Dollar-quoted blocks (DO $$
 * … $$) are handled correctly so semicolons inside them are not treated as
 * separators.
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

// ── Discover migration files first (needed for seeding below) ─────────────────
const migrationsDir = path.join(import.meta.dirname, "..", "migrations");
const files = (await readdir(migrationsDir))
  .filter((f) => f.endsWith(".sql"))
  .sort();

// ── Check if the tracking table already exists ────────────────────────────────
const { rows: existsCheck } = await client.query<{ exists: boolean }>(`
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'schema_migrations'
  ) AS exists
`);
const trackingTableExisted = existsCheck[0]?.exists === true;

// ── Bootstrap: create the tracking table (idempotent) ────────────────────────
await client.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ  NOT NULL DEFAULT now()
  )
`);

// ── Seed pre-tracking migrations on first use ─────────────────────────────────
//
// If the tracking table didn't exist before this run, all currently-known
// migration files were already applied by the old runner (which ran everything
// on every startup with IF NOT EXISTS guards). Record them all as pre-applied
// so the new runner doesn't re-execute them.
//
if (!trackingTableExisted && files.length > 0) {
  await client.query("BEGIN");
  try {
    for (const file of files) {
      await client.query(
        `INSERT INTO schema_migrations (filename, applied_at)
         VALUES ($1, now())
         ON CONFLICT (filename) DO NOTHING`,
        [file],
      );
    }
    await client.query("COMMIT");
    console.log(
      `📋 First use of migration tracking — pre-seeded ${files.length} existing file(s) as already applied.`,
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to seed schema_migrations tracking table:", err);
    client.release();
    await pool.end();
    process.exit(1);
  }
}

// ── Load the set of already-applied migration filenames ───────────────────────
const { rows: appliedRows } = await client.query<{ filename: string }>(
  `SELECT filename FROM schema_migrations`,
);
const applied = new Set(appliedRows.map((r) => r.filename));

if (!files.length) {
  console.log("No migration files found.");
  client.release();
  await pool.end();
  process.exit(0);
}

/**
 * Split a SQL file into individual statements, correctly handling dollar-quoted
 * strings (DO $$ ... $$, DO $body$ ... $body$, etc.) so that semicolons inside
 * those blocks are not treated as statement separators.
 */
function splitStatements(sql: string): string[] {
  const results: string[] = [];
  let current = "";
  let i = 0;
  let dollarTag: string | null = null;

  while (i < sql.length) {
    if (dollarTag === null) {
      const dollarMatch = sql.slice(i).match(/^\$[^$\s]*\$/);
      if (dollarMatch) {
        dollarTag = dollarMatch[0];
        current += dollarTag;
        i += dollarTag.length;
        continue;
      }
      if (sql[i] === ";") {
        const rest = sql.slice(i + 1);
        const wsNl = rest.match(/^[ \t]*\n/);
        if (wsNl) {
          const stmt = current.trim();
          if (stmt) results.push(stmt);
          current = "";
          i += 1 + wsNl[0].length;
          continue;
        }
      }
    } else {
      if (sql.slice(i).startsWith(dollarTag)) {
        current += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
    }

    current += sql[i];
    i++;
  }

  const last = current.trim();
  if (last) results.push(last);

  return results;
}

// ── Apply pending migrations ──────────────────────────────────────────────────
let newlyApplied = 0;
let skipped = 0;

for (const file of files) {
  if (applied.has(file)) {
    skipped++;
    continue;
  }

  const filePath = path.join(migrationsDir, file);
  const sql = await readFile(filePath, "utf8");
  const statements = splitStatements(sql);

  try {
    await client.query("BEGIN");
    for (const stmt of statements) {
      await client.query(stmt);
    }
    await client.query(
      `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING`,
      [file],
    );
    await client.query("COMMIT");
    console.log(`✓ Applied: ${file}`);
    newlyApplied++;
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

if (newlyApplied === 0 && skipped > 0) {
  console.log(`Migration complete: all ${skipped} file(s) already applied — nothing to do.`);
} else {
  console.log(
    `Migration complete: ${newlyApplied} new applied, ${skipped} skipped (${files.length} total).`,
  );
}
