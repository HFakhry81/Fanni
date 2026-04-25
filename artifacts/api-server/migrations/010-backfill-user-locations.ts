/**
 * Migration: 010-backfill-user-locations
 *
 * Geocodes existing technicians who have `governorate` and/or `area` set but
 * whose `location` column is still NULL. These records were created before the
 * automatic geocoding was added to registration / profile-update flows, so they
 * will never appear in distance-based nearby-technician searches without this
 * one-time backfill.
 *
 * Behaviour:
 *   - Only processes rows where role = 'technician', location IS NULL, and at
 *     least one of governorate / area is non-empty.
 *   - Calls geocodeArea() for each candidate; that function already serialises
 *     all Nominatim requests through a 1-req/sec rate-limited queue, so the
 *     usage-policy limit is respected automatically.
 *   - Rows for which Nominatim returns no result are left unchanged and counted
 *     as "skipped".
 *   - Logs updated / skipped / errored counts on completion.
 *
 * Usage:
 *   pnpm --filter @workspace/api-server backfill-locations
 *
 *   Or directly:
 *   pnpm tsx artifacts/api-server/migrations/010-backfill-user-locations.ts
 */

import { and, isNull, eq, sql } from "drizzle-orm";
import { db, usersTable, pool } from "@workspace/db";
import { geocodeArea } from "../src/lib/geocode";

async function run(): Promise<void> {
  console.log("[010-backfill-user-locations] Starting backfill…");

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

  console.log(`[010-backfill-user-locations] Found ${candidates.length} technician(s) to process`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const tech of candidates) {
    try {
      const geoPoint = await geocodeArea(tech.area, tech.governorate);

      if (!geoPoint) {
        console.warn(
          `[010-backfill-user-locations] SKIP  id=${tech.id} governorate=${tech.governorate ?? "null"} area=${tech.area ?? "null"} — Nominatim returned no result`,
        );
        skipped++;
        continue;
      }

      await db
        .update(usersTable)
        .set({
          location: sql`ST_SetSRID(ST_MakePoint(${geoPoint.lon}, ${geoPoint.lat}), 4326)::geography`,
        })
        .where(eq(usersTable.id, tech.id));

      console.log(
        `[010-backfill-user-locations] OK    id=${tech.id} governorate=${tech.governorate ?? "null"} area=${tech.area ?? "null"} → (${geoPoint.lat}, ${geoPoint.lon})`,
      );
      updated++;
    } catch (err) {
      console.error(
        `[010-backfill-user-locations] ERROR id=${tech.id} —`,
        err,
      );
      errors++;
    }
  }

  console.log(
    `[010-backfill-user-locations] Done — total=${candidates.length} updated=${updated} skipped=${skipped} errors=${errors}`,
  );

  await pool.end();
}

run().catch((err) => {
  console.error("[010-backfill-user-locations] Fatal error:", err);
  process.exit(1);
});
