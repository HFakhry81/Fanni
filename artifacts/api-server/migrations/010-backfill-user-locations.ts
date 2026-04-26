/**
 * Migration: 010-backfill-user-locations
 *
 * Geocodes existing technicians who have `governorate` and/or `area` set but
 * whose `location` column is still NULL. These records were created before the
 * automatic geocoding was added to registration / profile-update flows, so they
 * will never appear in distance-based nearby-technician searches without this
 * one-time backfill.
 *
 * Shared logic lives in src/lib/backfillLocations.ts so the same geocode-and-
 * update routine can also be triggered at runtime via the admin API route
 * POST /admin/technicians/backfill-locations.
 *
 * Usage:
 *   pnpm --filter @workspace/api-server backfill-locations
 *
 *   Or directly:
 *   pnpm tsx artifacts/api-server/migrations/010-backfill-user-locations.ts
 */

import { pool } from "@workspace/db";
import { backfillTechnicianLocations } from "../src/lib/backfillLocations";

const PREFIX = "[010-backfill-user-locations]";

async function run(): Promise<void> {
  console.log(`${PREFIX} Starting backfill…`);

  const result = await backfillTechnicianLocations((msg) => console.log(`${PREFIX} ${msg}`));

  console.log(
    `${PREFIX} Done — total=${result.total} updated=${result.updated} skipped=${result.skipped} errors=${result.errors}`,
  );

  await pool.end();
}

run().catch((err) => {
  console.error(`${PREFIX} Fatal error:`, err);
  process.exit(1);
});
