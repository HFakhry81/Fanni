/**
 * Migration / Seed: 009-reseed-locations
 *
 * Performs a full canonical reseed of the `locations` table:
 *   1. DELETEs all neighborhood rows (removed in v2 schema).
 *   2. UPSERTs the authoritative 27-governorate / 396-city dataset via ON CONFLICT DO UPDATE.
 *      Existing rows with the same canonical ID are updated to match the dataset.
 *      Stale old-format rows whose IDs no longer exist in the dataset must be cleaned up
 *      separately (see migration 007 for the initial neighborhoods cleanup).
 *
 * Safe to re-run (idempotent): INSERT ... ON CONFLICT (id) DO UPDATE guarantees
 * that re-runs update existing rows rather than failing on duplicate keys.
 *
 * Requires 004-create-locations-tables and 008-add-location-centroid to run first.
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

    const currentIds = new Set(
      EGYPT_LOCATIONS.flatMap((g: { id: string; areas: Array<{ id: string }> }) => [
        g.id,
        ...g.areas.map((a: { id: string }) => a.id),
      ])
    );

    const { rows: stale } = await client.query(
      `SELECT id FROM locations WHERE type IN ('governorate', 'area')`
    );
    const staleIds = stale.map((r: { id: string }) => r.id).filter((id: string) => !currentIds.has(id));
    if (staleIds.length > 0) {
      await client.query(
        `DELETE FROM locations WHERE id = ANY($1::text[])`,
        [staleIds]
      );
    }

    let govCount = 0;
    let areaCount = 0;

    for (const gov of EGYPT_LOCATIONS) {
      await client.query(
        `INSERT INTO locations (id, type, name_ar, name_en, parent_id, slug)
         VALUES ($1, 'governorate', $2, $3, NULL, $4)
         ON CONFLICT (id) DO UPDATE
           SET type      = 'governorate',
               name_ar   = EXCLUDED.name_ar,
               name_en   = EXCLUDED.name_en,
               slug      = EXCLUDED.slug,
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
      `Reseeded: ${govCount} governorates, ${areaCount} areas. ` +
      `Removed ${staleIds.length} stale legacy rows and all neighborhood rows.`
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
