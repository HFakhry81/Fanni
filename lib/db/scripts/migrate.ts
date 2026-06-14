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
      // Check for the start of a dollar-quoted block: $tag$ or $$
      const dollarMatch = sql.slice(i).match(/^\$[^$\s]*\$/);
      if (dollarMatch) {
        dollarTag = dollarMatch[0];
        current += dollarTag;
        i += dollarTag.length;
        continue;
      }
      // Check for statement separator: semicolon followed by optional whitespace then newline
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
      // Inside a dollar-quoted block — look for the closing tag
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

  // Handle a trailing statement that doesn't end with ";\n"
  const last = current.trim();
  if (last) results.push(last);

  return results;
}

let applied = 0;
for (const file of files) {
  const filePath = path.join(migrationsDir, file);
  const sql = await readFile(filePath, "utf8");

  const statements = splitStatements(sql);

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
