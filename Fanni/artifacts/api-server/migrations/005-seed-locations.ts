/**
 * Migration / Seed: 005-seed-locations
 *
 * Seeds the `locations` table with Egypt governorates, areas, and neighborhoods
 * sourced from the mobile app's egyptLocations.ts constants file.
 * Requires 004-create-locations-tables to have been run first.
 *
 * Idempotent — uses INSERT … ON CONFLICT DO NOTHING so it is safe to re-run.
 *
 * Usage: pnpm tsx artifacts/api-server/migrations/005-seed-locations.ts
 */

import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { EGYPT_LOCATIONS } = await import(
  path.resolve(__dirname, "../../../artifacts/mobile/constants/egyptLocations.ts")
);

const { Pool } = pg;

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let govCount = 0, areaCount = 0, nbhCount = 0;

    for (const gov of EGYPT_LOCATIONS) {
      await client.query(
        `INSERT INTO locations (id, type, name_ar, name_en, parent_id, slug)
         VALUES ($1, 'governorate', $2, $3, NULL, $4)
         ON CONFLICT (id) DO NOTHING`,
        [gov.id, gov.ar, gov.en, gov.id],
      );
      govCount++;

      for (const area of gov.areas ?? []) {
        await client.query(
          `INSERT INTO locations (id, type, name_ar, name_en, parent_id, slug)
           VALUES ($1, 'area', $2, $3, $4, $5)
           ON CONFLICT (id) DO NOTHING`,
          [area.id, area.ar, area.en, gov.id, area.id],
        );
        areaCount++;

        for (const nbh of area.neighborhoods ?? []) {
          await client.query(
            `INSERT INTO locations (id, type, name_ar, name_en, parent_id, slug)
             VALUES ($1, 'neighborhood', $2, $3, $4, $5)
             ON CONFLICT (id) DO NOTHING`,
            [nbh.id, nbh.ar, nbh.en, area.id, nbh.id],
          );
          nbhCount++;
        }
      }
    }

    await client.query("COMMIT");
    console.log(
      `Seeded: ${govCount} governorates, ${areaCount} areas, ${nbhCount} neighborhoods.`,
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", err);
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
