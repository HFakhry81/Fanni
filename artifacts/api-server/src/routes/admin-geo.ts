// artifacts/api-server/src/routes/admin-geo.ts
import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { sql, eq, desc } from "drizzle-orm";
import { usersTable, ordersTable, locationMissLogTable, locationAliasesTable } from "@workspace/db/schema";

const router = Router();

/**
 * 1. جلب مواقع الفنيين الحية والطلبات النشطة لخريطة المسئول
 */
router.get("/api/admin/map-data", async (req: Request, res: Response) => {
  try {
    const techs = await db
      .select({
        id: usersTable.id,
        name: sql<string>`CONCAT(${usersTable.firstName}, ' ', COALESCE(${usersTable.lastName}, ''))`,
        profession: usersTable.profession,
        isAvailable: usersTable.isAvailable,
        latitude: sql<number>`ST_Y(${usersTable.location}::geometry)`,
        longitude: sql<number>`ST_X(${usersTable.location}::geometry)`,
      })
      .from(usersTable)
      .where(
        sql`${usersTable.role} = 'technician' AND ${usersTable.location} IS NOT NULL`
      );

    const orders = await db
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

    return res.json({ success: true, techs, orders });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * 2. جلب سجلات العناوين المفقودة المراد تصحيحها
 */
router.get("/api/admin/location-miss-log", async (req: Request, res: Response) => {
  try {
    const logs = await db
      .select()
      .from(locationMissLogTable)
      .where(eq(locationMissLogTable.resolved, false)) // تم إرجاعها إلى resolved
      .orderBy(desc(locationMissLogTable.hitCount)); // تم إرجاعها إلى hitCount

    return res.json({ success: true, logs });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch miss logs" });
  }
});

/**
 * 3. دمج وحفظ الاسم البديل وحل السجل المرتبط به
 */
router.post("/api/admin/location-aliases", async (req: Request, res: Response) => {
  const { logId, governorateId, areaId, aliasAr, aliasEn } = req.body;

  if (!governorateId || !areaId || !aliasAr || !aliasEn) {
    return res.status(400).json({ error: "Missing required mapping fields" });
  }

  try {
    await db.transaction(async (tx) => {
      // إدخال الاسمين البديلين (العربي والإنجليزي) كقيود منفصلة مرتبطة بنفس الـ locationId
      await tx.insert(locationAliasesTable).values([
        { locationId: areaId, alias: aliasAr.toLowerCase().trim() },
        { locationId: areaId, alias: aliasEn.toLowerCase().trim() }
      ]);

      if (logId) {
        await tx
          .update(locationMissLogTable)
          .set({ resolved: true }) // تم تعديلها لـ resolved
          .where(eq(locationMissLogTable.id, logId));
      }
    });

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to resolve and save location alias" });
  }
});

export default router;