import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, locationsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/locations/governorates", async (_req, res) => {
  const rows = await db
    .select({
      id: locationsTable.id,
      nameAr: locationsTable.nameAr,
      nameEn: locationsTable.nameEn,
      slug: locationsTable.slug,
    })
    .from(locationsTable)
    .where(eq(locationsTable.type, "governorate"))
    .orderBy(locationsTable.nameEn);

  res.json({ governorates: rows });
});

router.get("/locations/:govId/areas", async (req, res) => {
  const { govId } = req.params;

  const rows = await db
    .select({
      id: locationsTable.id,
      nameAr: locationsTable.nameAr,
      nameEn: locationsTable.nameEn,
      slug: locationsTable.slug,
      parentId: locationsTable.parentId,
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
});

router.get("/locations/:areaId/neighborhoods", async (req, res) => {
  const { areaId } = req.params;

  const rows = await db
    .select({
      id: locationsTable.id,
      nameAr: locationsTable.nameAr,
      nameEn: locationsTable.nameEn,
      slug: locationsTable.slug,
      parentId: locationsTable.parentId,
    })
    .from(locationsTable)
    .where(
      and(
        eq(locationsTable.type, "neighborhood"),
        eq(locationsTable.parentId, areaId),
      ),
    )
    .orderBy(locationsTable.nameEn);

  res.json({ neighborhoods: rows });
});

export default router;
