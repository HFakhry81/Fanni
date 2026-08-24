/**
 * Combined idempotent seed: locations (if empty) then Nominatim aliases.
 *
 *   pnpm --filter @workspace/db run seed
 */

import "./loadEnv";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const dbRoot = path.resolve(here, "..");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

function runTsx(relativeFile: string): void {
  const result = spawnSync(
    "pnpm",
    ["exec", "tsx", relativeFile],
    {
      cwd: dbRoot,
      env: process.env,
      stdio: "inherit",
      shell: true,
    },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  const { rows } = await client.query<{ exists: boolean }>(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'locations'
    ) AS exists
  `);
  if (!rows[0]?.exists) {
    console.error("locations table is missing — run migrate first.");
    process.exit(1);
  }

  const countResult = await client.query<{ c: number }>(
    "SELECT COUNT(*)::int AS c FROM locations",
  );
  const count = countResult.rows[0]?.c ?? 0;
  if (count === 0) {
    console.log("locations is empty — seeding governorates/areas/neighborhoods…");
    client.release();
    await pool.end();
    runTsx("src/seed-locations.ts");
  } else {
    console.log(`locations already has ${count} row(s) — skipping location seed.`);
    client.release();
    await pool.end();
  }
} catch (err) {
  try {
    client.release();
  } catch {
    /* already released */
  }
  await pool.end().catch(() => undefined);
  console.error("Seed pre-check failed:", err);
  process.exit(1);
}

console.log("Seeding location aliases (idempotent)…");
runTsx("src/seed-location-aliases.ts");
console.log("Seed complete.");
