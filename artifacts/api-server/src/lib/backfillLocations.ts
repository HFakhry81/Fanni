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
  remaining: number;
  hasMore: boolean;
}

export async function backfillTechnicianLocations(
  onProgress?: (msg: string) => void,
  options?: { limit?: number },
): Promise<BackfillResult> {
  const log = onProgress ?? (() => undefined);
  const limit = Math.max(1, Math.min(options?.limit ?? 20, 50));

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

  const batch = candidates.slice(0, limit);
  const remaining = Math.max(0, candidates.length - batch.length);
  log(`Found ${candidates.length} technician(s); processing ${batch.length} this run (${remaining} remaining)`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const tech of batch) {
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

  log(`Done — batch=${batch.length} updated=${updated} skipped=${skipped} errors=${errors} remaining=${remaining}`);

  return {
    total: batch.length,
    updated,
    skipped,
    errors,
    remaining,
    hasMore: remaining > 0,
  };
}
