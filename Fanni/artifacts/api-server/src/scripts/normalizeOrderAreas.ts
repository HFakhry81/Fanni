/**
 * One-time migration script: normalize area and governorate columns in all orders.
 *
 * Orders created before Task #147 may have raw Nominatim display names stored in
 * the `area` and `governorate` columns (e.g. "al montaza district") instead of the
 * canonical location slugs (e.g. "alex__montaza"). This script resolves each raw
 * value against the locations table and writes the correct slug back.
 *
 * Run with:
 *   pnpm --filter @workspace/api-server normalize-areas
 */

import { db, ordersTable, pool } from "@workspace/db";
import { eq, isNotNull, or } from "drizzle-orm";
import { warmLocationCache, normalizeToSlug } from "../lib/locationNormalizer";
import { logger } from "../lib/logger";

const SLUG_RE = /^[a-z0-9]+(__[a-z0-9_]+)?$/;

function isSlug(value: string | null | undefined): boolean {
  if (!value) return true;
  return SLUG_RE.test(value.trim());
}

async function run(): Promise<void> {
  logger.info("Starting order area/governorate normalization migration");

  await warmLocationCache();

  const orders = await db
    .select({
      id: ordersTable.id,
      orderNumber: ordersTable.orderNumber,
      governorate: ordersTable.governorate,
      area: ordersTable.area,
    })
    .from(ordersTable)
    .where(
      or(
        isNotNull(ordersTable.governorate),
        isNotNull(ordersTable.area),
      ),
    );

  logger.info({ total: orders.length }, "Orders fetched — scanning for non-slug values");

  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let unresolved = 0;

  for (const order of orders) {
    const govAlreadySlug = isSlug(order.governorate);
    const areaAlreadySlug = isSlug(order.area);

    if (govAlreadySlug && areaAlreadySlug) {
      skipped++;
      continue;
    }

    try {
      const normalizedGov = govAlreadySlug
        ? order.governorate
        : await normalizeToSlug(order.governorate, "governorate");

      const normalizedArea = areaAlreadySlug
        ? order.area
        : await normalizeToSlug(order.area, "area");

      const govResolved = govAlreadySlug || (normalizedGov !== null && isSlug(normalizedGov));
      const areaResolved = areaAlreadySlug || (normalizedArea !== null && isSlug(normalizedArea));

      if (!govResolved || !areaResolved) {
        logger.warn(
          {
            orderId: order.id,
            orderNumber: order.orderNumber,
            governorate: { raw: order.governorate, resolved: normalizedGov, ok: govResolved },
            area: { raw: order.area, resolved: normalizedArea, ok: areaResolved },
          },
          "Could not fully resolve location to a slug — row left unchanged",
        );
        unresolved++;
        continue;
      }

      const changed =
        normalizedGov !== order.governorate || normalizedArea !== order.area;

      if (changed) {
        await db
          .update(ordersTable)
          .set({
            governorate: normalizedGov,
            area: normalizedArea,
          })
          .where(eq(ordersTable.id, order.id));

        logger.info(
          {
            orderId: order.id,
            orderNumber: order.orderNumber,
            before: { governorate: order.governorate, area: order.area },
            after: { governorate: normalizedGov, area: normalizedArea },
          },
          "Order location normalized",
        );

        updated++;
      } else {
        skipped++;
      }
    } catch (err) {
      logger.error(
        { err, orderId: order.id, orderNumber: order.orderNumber },
        "Failed to normalize order — skipping",
      );
      errors++;
    }
  }

  logger.info(
    { total: orders.length, updated, skipped, unresolved, errors },
    "Migration complete",
  );

  if (unresolved > 0) {
    logger.warn(
      { unresolved },
      "Some orders could not be resolved to slug values — manual review required (see WARN entries above)",
    );
  }

  await pool.end();
}

run().catch((err) => {
  logger.error({ err }, "Migration failed with unhandled error");
  process.exit(1);
});
