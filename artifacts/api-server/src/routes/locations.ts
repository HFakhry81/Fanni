import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, locationsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/locations/governorates", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: locationsTable.id,
        nameAr: locationsTable.nameAr,
        nameEn: locationsTable.nameEn,
        slug: locationsTable.slug,
        centroid: locationsTable.centroid,
      })
      .from(locationsTable)
      .where(eq(locationsTable.type, "governorate"))
      .orderBy(locationsTable.nameEn);

    res.json({ governorates: rows });
  } catch (err) {
    logger.error({ err }, "Failed to fetch governorates");
    res.status(500).json({ error: "Failed to fetch governorates" });
  }
});

router.get("/locations/:govId/areas", async (req, res) => {
  const { govId } = req.params;

  try {
    const rows = await db
      .select({
        id: locationsTable.id,
        nameAr: locationsTable.nameAr,
        nameEn: locationsTable.nameEn,
        slug: locationsTable.slug,
        parentId: locationsTable.parentId,
        centroid: locationsTable.centroid,
      })
      .from(locationsTable)
      .where(
        and(
          eq(locationsTable.type, "area"),
          eq(locationsTable.parentId, govId),
        ),
      )
      .orderBy(locationsTable.nameEn);

    res.json({ areas: rows });
  } catch (err) {
    logger.error({ err, govId }, "Failed to fetch areas for governorate");
    res.status(500).json({ error: "Failed to fetch areas" });
  }
});

export default router;
