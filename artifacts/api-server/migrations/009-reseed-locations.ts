/**
 * Migration / Seed: 009-reseed-locations
 *
 * TRUNCATEs the `locations` table and re-inserts from the new 27-governorate /
 * 396-city egyptLocations.ts constant (2-level only — no neighborhoods).
 *
 * Uses ON CONFLICT DO UPDATE so re-runs are fully idempotent.
 * Requires 004-create-locations-tables and 008-add-location-centroid to have been run first.
 *
 * Usage: pnpm tsx artifacts/api-server/migrations/009-reseed-locations.ts
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

    await client.query(`DELETE FROM locations WHERE type = 'neighborhood'`);

    let govCount = 0;
    let areaCount = 0;

    for (const gov of EGYPT_LOCATIONS) {
      await client.query(
        `INSERT INTO locations (id, type, name_ar, name_en, parent_id, slug)
         VALUES ($1, 'governorate', $2, $3, NULL, $4)
         ON CONFLICT (id) DO UPDATE
           SET type    = 'governorate',
               name_ar = EXCLUDED.name_ar,
               name_en = EXCLUDED.name_en,
               slug    = EXCLUDED.slug,
               parent_id = NULL`,
        [gov.id, gov.ar, gov.en, gov.id],
      );
      govCount++;

      for (const area of gov.areas ?? []) {
        await client.query(
          `INSERT INTO locations (id, type, name_ar, name_en, parent_id, slug)
           VALUES ($1, 'area', $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE
             SET type      = 'area',
                 name_ar   = EXCLUDED.name_ar,
                 name_en   = EXCLUDED.name_en,
                 parent_id = EXCLUDED.parent_id,
                 slug      = EXCLUDED.slug`,
          [area.id, area.ar, area.en, gov.id, area.id],
        );
        areaCount++;
      }
    }

    await client.query("COMMIT");
    console.log(
      `Reseeded: ${govCount} governorates, ${areaCount} areas. Old neighborhood rows removed; ` +
      `legacy area/gov rows preserved for backward compat.`,
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
