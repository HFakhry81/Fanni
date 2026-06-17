/**
 * Migration: 013-backfill-location-centroids
 *
 * Geocodes every row in `locations` where `centroid IS NULL` and writes the
 * result back as a GEOGRAPHY(POINT, 4326) value. The `centroid` column was
 * created by migration 008 but was never populated; this backfill unlocks any
 * proximity feature that computes distances against a known city/area centroid.
 *
 * Behaviour:
 *   - Processes all location types (governorate, area, neighborhood).
 *   - For areas / neighborhoods, the parent's nameEn is included in the
 *     Nominatim query to narrow the search (e.g. "Maadi, Cairo, Egypt").
 *   - All Nominatim requests flow through the shared nominatimFetch queue,
 *     which enforces the 1 req/sec usage-policy limit automatically.
 *   - Rows for which Nominatim returns no result are left unchanged and
 *     counted as "skipped".
 *   - Logs updated / skipped / errored counts on completion.
 *   - Idempotent: only touches rows where centroid IS NULL, so it is safe
 *     to re-run after partial failures.
 *
 * Usage:
 *   pnpm --filter @workspace/api-server backfill-centroids
 *
 *   Or directly:
 *   pnpm tsx artifacts/api-server/migrations/013-backfill-location-centroids.ts
 */

import { isNull, sql } from "drizzle-orm";
import { db, locationsTable, pool } from "@workspace/db";
import { nominatimFetch, getCached, setCache, NOMINATIM_BASE } from "../src/lib/nominatim";

interface LocationRow {
  id: string;
  nameEn: string;
  type: string;
  parentId: string | null;
}

async function run(): Promise<void> {
  console.log("[013-backfill-location-centroids] Starting backfill…");

  const candidates: LocationRow[] = await db
    .select({
      id: locationsTable.id,
      nameEn: locationsTable.nameEn,
      type: locationsTable.type,
      parentId: locationsTable.parentId,
    })
    .from(locationsTable)
    .where(isNull(sql`centroid`));

  console.log(
    `[013-backfill-location-centroids] Found ${candidates.length} location(s) to process`,
  );

  const nameCache = new Map<string, string>();
  async function getNameEn(id: string): Promise<string> {
    if (nameCache.has(id)) return nameCache.get(id)!;
    const [row] = await db
      .select({ nameEn: locationsTable.nameEn })
      .from(locationsTable)
      .where(sql`${locationsTable.id} = ${id}`)
      .limit(1);
    const name = row?.nameEn ?? id;
    nameCache.set(id, name);
    return name;
  }

  candidates.forEach((loc) => nameCache.set(loc.id, loc.nameEn));

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const loc of candidates) {
    try {
      const parts: string[] = [loc.nameEn];

      if (loc.parentId) {
        const parentName = await getNameEn(loc.parentId);
        parts.push(parentName);
      }

      parts.push("Egypt");

      const q = parts.join(", ");
      const cacheKey = `geocode:en:${q.toLowerCase()}`;

      let results: Array<{ lat: string; lon: string }>;
      const cached = await getCached(cacheKey);

      if (cached) {
        results = cached as Array<{ lat: string; lon: string }>;
      } else {
        const url =
          `${NOMINATIM_BASE}/search` +
          `?q=${encodeURIComponent(q)}` +
          `&countrycodes=eg` +
          `&format=json` +
          `&limit=1`;
        results = (await nominatimFetch(url)) as Array<{ lat: string; lon: string }>;
        await setCache(cacheKey, "en", results);
      }

      if (!Array.isArray(results) || results.length === 0) {
        console.warn(
          `[013-backfill-location-centroids] SKIP  id=${loc.id} query="${q}" — Nominatim returned no result`,
        );
        skipped++;
        continue;
      }

      const lat = parseFloat(results[0].lat);
      const lon = parseFloat(results[0].lon);

      if (isNaN(lat) || isNaN(lon)) {
        console.warn(
          `[013-backfill-location-centroids] SKIP  id=${loc.id} — invalid coordinates (lat=${results[0].lat}, lon=${results[0].lon})`,
        );
        skipped++;
        continue;
      }

      await db.execute(
        sql`UPDATE locations SET centroid = ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography WHERE id = ${loc.id}`,
      );

      console.log(
        `[013-backfill-location-centroids] OK    id=${loc.id} "${q}" → (${lat}, ${lon})`,
      );
      updated++;
    } catch (err) {
      console.error(
        `[013-backfill-location-centroids] ERROR id=${loc.id} —`,
        err,
      );
      errors++;
    }
  }

  console.log(
    `[013-backfill-location-centroids] Done — total=${candidates.length} updated=${updated} skipped=${skipped} errors=${errors}`,
  );

  await pool.end();
}

run().catch((err) => {
  console.error("[013-backfill-location-centroids] Fatal error:", err);
  process.exit(1);
});
