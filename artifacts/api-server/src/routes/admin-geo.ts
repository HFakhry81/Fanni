// artifacts/api-server/src/routes/admin-geo.ts
import { Router, Request, Response } from "express";
import { logger } from "../lib/logger";
import { db } from "@workspace/db";
import { sql, eq, desc } from "drizzle-orm";
import { usersTable, ordersTable, locationMissLogTable, locationAliasesTable } from "@workspace/db/schema";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin } from "../middlewares/requireAdmin";
import { queryString } from "../lib/queryParams";

const router = Router();

/**
 * Live / monitoring map data for admin dashboards.
 * Query: availableOnly=true (technicians map), includeOrders=false
 */
router.get("/api/admin/map-data", authMiddleware, requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const availableOnly = queryString(req.query.availableOnly) === "true";
    const includeOrders = queryString(req.query.includeOrders) !== "false";

    const techConditions = [
      sql`${usersTable.role} = 'technician'`,
      sql`${usersTable.location} IS NOT NULL`,
      sql`${usersTable.isApproved} = true`,
    ];
    if (availableOnly) {
      techConditions.push(sql`${usersTable.isAvailable} = true`);
    }

    const techs = await db
      .select({
        id: usersTable.id,
        name: sql<string>`CONCAT(${usersTable.firstName}, ' ', COALESCE(${usersTable.lastName}, ''))`,
        profession: usersTable.profession,
        specialty: usersTable.specialty,
        isAvailable: usersTable.isAvailable,
        latitude: sql<number>`ST_Y(${usersTable.location}::geometry)`,
        longitude: sql<number>`ST_X(${usersTable.location}::geometry)`,
      })
      .from(usersTable)
      .where(sql.join(techConditions, sql` AND `));

    let orders: Array<{
      id: string;
      orderNumber: string;
      category: string | null;
      subCategory: string | null;
      status: string;
      clientName: string;
      latitude: number;
      longitude: number;
    }> = [];

    if (includeOrders) {
      orders = await db
        .select({
          id: ordersTable.id,
          orderNumber: ordersTable.orderNumber,
          category: ordersTable.category,
          subCategory: sql<string | null>`orders.sub_category`,
          status: ordersTable.status,
          clientName: sql<string>`CONCAT(${usersTable.firstName}, ' ', COALESCE(${usersTable.lastName}, ''))`,
          latitude: sql<number>`ST_Y(${ordersTable.location}::geometry)`,
          longitude: sql<number>`ST_X(${ordersTable.location}::geometry)`,
        })
        .from(ordersTable)
        .leftJoin(usersTable, eq(ordersTable.clientId, usersTable.id))
        .where(
          sql`${ordersTable.status} IN ('pending', 'acknowledged', 'in_progress') AND ${ordersTable.location} IS NOT NULL`
        );
    }

    return res.json({ success: true, techs, orders });
  } catch (error) {
    logger.error({ err: error }, "GET /api/admin/map-data failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/admin/location-miss-log", authMiddleware, requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const logs = await db
      .select()
      .from(locationMissLogTable)
      .orderBy(desc(locationMissLogTable.seenCount));

    return res.json({ success: true, logs });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch miss logs" });
  }
});

router.post("/api/admin/location-aliases", authMiddleware, requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { logId, governorateId, areaId, aliasAr, aliasEn } = req.body;

  if (!governorateId || !areaId || !aliasAr || !aliasEn) {
    return res.status(400).json({ error: "Missing required mapping fields" });
  }

  try {
    await db.transaction(async (tx) => {
      await tx.insert(locationAliasesTable).values([
        { locationId: areaId, alias: aliasAr.toLowerCase().trim() },
        { locationId: areaId, alias: aliasEn.toLowerCase().trim() },
      ]);

      if (logId) {
        await tx
          .delete(locationMissLogTable)
          .where(eq(locationMissLogTable.id, logId));
      }
    });

    return res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "POST /api/admin/location-aliases failed");
    return res.status(500).json({ error: "Failed to resolve and save location alias" });
  }
});

export default router;
