/**
 * Shared utility: geocode-and-update for technicians with no map location.
 *
 * Used by both:
 *   - migrations/010-backfill-user-locations.ts  (one-time CLI script)
 *   - routes/admin.ts  POST /admin/technicians/backfill-locations
 *
 * Behaviour:
 *   - Processes only rows where role = 'technician', location IS NULL, and at
 *     least one of governorate / area is non-empty.
 *   - Calls geocodeArea() for each candidate; all Nominatim requests share the
 *     1-req/sec rate-limited queue in nominatim.ts.
 *   - Rows for which Nominatim returns no result are counted as "skipped".
 */

import { and, isNull, eq, sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { geocodeArea } from "./geocode";

export interface BackfillResult {
  total: number;
  updated: number;
  skipped: number;
  errors: number;
}

export async function backfillTechnicianLocations(
  onProgress?: (msg: string) => void,
): Promise<BackfillResult> {
  const log = onProgress ?? (() => undefined);

  const candidates = await db
    .select({
      id: usersTable.id,
      governorate: usersTable.governorate,
      area: usersTable.area,
    })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.role, "technician"),
        isNull(usersTable.location),
        sql`(TRIM(COALESCE(${usersTable.governorate}, '')) <> '' OR TRIM(COALESCE(${usersTable.area}, '')) <> '')`,
      ),
    );

  log(`Found ${candidates.length} technician(s) to process`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const tech of candidates) {
    try {
      const geoPoint = await geocodeArea(tech.area, tech.governorate);

      if (!geoPoint) {
        log(`SKIP  id=${tech.id} governorate=${tech.governorate ?? "null"} area=${tech.area ?? "null"} — Nominatim returned no result`);
        skipped++;
        continue;
      }

      await db
        .update(usersTable)
        .set({
          location: sql`ST_SetSRID(ST_MakePoint(${geoPoint.lon}, ${geoPoint.lat}), 4326)::geography`,
        })
        .where(eq(usersTable.id, tech.id));

      log(`OK    id=${tech.id} governorate=${tech.governorate ?? "null"} area=${tech.area ?? "null"} → (${geoPoint.lat}, ${geoPoint.lon})`);
      updated++;
    } catch (err) {
      log(`ERROR id=${tech.id} — ${err}`);
      errors++;
    }
  }

  log(`Done — total=${candidates.length} updated=${updated} skipped=${skipped} errors=${errors}`);

  return { total: candidates.length, updated, skipped, errors };
}
