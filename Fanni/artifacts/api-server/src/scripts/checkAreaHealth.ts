/**
 * Data health check: detect non-slug values in orders.area / orders.governorate.
 *
 * A slug must match /^[a-z0-9]+(__[a-z0-9_]+)?$/.  Any row whose area or
 * governorate column holds a value that does NOT match this pattern is
 * considered "bad data" and logged as a warning.
 *
 * Exit codes
 *   0  – all rows are clean (or no rows found)
 *   1  – one or more non-slug values detected
 *   2  – the script itself failed with an unhandled error
 *
 * Run on demand:
 *   pnpm --filter @workspace/api-server check-areas
 *
 * Run on a daily cron (e.g. 02:00 server time):
 *   0 2 * * * cd /path/to/project && pnpm --filter @workspace/api-server check-areas >> /var/log/fanni-area-health.log 2>&1
 */

import { db, ordersTable, pool } from "@workspace/db";
import { isNotNull, or } from "drizzle-orm";
import { logger } from "../lib/logger";

const SLUG_RE = /^[a-z0-9]+(__[a-z0-9_]+)?$/;

function isSlug(value: string | null | undefined): boolean {
  if (value === null || value === undefined || value === "") return true;
  return SLUG_RE.test(value.trim());
}

interface BadRow {
  id: string;
  orderNumber: string | null;
  governorate: string | null;
  area: string | null;
  badGovernorate: boolean;
  badArea: boolean;
}

async function run(): Promise<void> {
  logger.info("Area/governorate health check starting");

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

  logger.info({ scanned: orders.length }, "Orders scanned");

  const badRows: BadRow[] = [];

  for (const order of orders) {
    const badGovernorate = !isSlug(order.governorate);
    const badArea = !isSlug(order.area);

    if (badGovernorate || badArea) {
      badRows.push({
        id: order.id,
        orderNumber: order.orderNumber,
        governorate: order.governorate,
        area: order.area,
        badGovernorate,
        badArea,
      });
    }
  }

  if (badRows.length === 0) {
    logger.info(
      { scanned: orders.length, bad: 0 },
      "Health check passed — all area/governorate values are valid slugs",
    );
    await pool.end();
    process.exit(0);
  }

  logger.warn(
    { scanned: orders.length, bad: badRows.length },
    "Health check FAILED — non-slug area/governorate values detected",
  );

  for (const row of badRows) {
    logger.warn(
      {
        orderId: row.id,
        orderNumber: row.orderNumber,
        governorate: row.badGovernorate
          ? { value: row.governorate, status: "INVALID" }
          : { value: row.governorate, status: "ok" },
        area: row.badArea
          ? { value: row.area, status: "INVALID" }
          : { value: row.area, status: "ok" },
      },
      "Non-slug value found — run normalize-areas to fix",
    );
  }

  await pool.end();
  process.exit(1);
}

run().catch((err) => {
  logger.error({ err }, "Health check failed with unhandled error");
  process.exit(2);
});
