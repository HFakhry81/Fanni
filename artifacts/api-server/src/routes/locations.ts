import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, locationsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { matchLocation } from "../lib/locationNormalizer";

const router: IRouter = Router();

router.get("/locations/governorates", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: locationsTable.id,
        nameAr: locationsTable.nameAr,
        nameEn: locationsTable.nameEn,
        slug: locationsTable.slug,
        centroid: sql<string | null>`ST_AsGeoJSON(centroid)`.as("centroid"),
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
        centroid: sql<string | null>`ST_AsGeoJSON(centroid)`.as("centroid"),
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

/**
 * GET /locations/match?suburb=...&city=...
 *
 * Server-side fuzzy location matching using the same alias map + scored strategy
 * as the internal locationNormalizer. Accepts up to two Nominatim-style terms
 * (suburb / city) and returns the best-matching governorate and area IDs.
 *
 * Response: { governorateId: string | null, areaId: string | null }
 */
router.get("/locations/match", async (req, res) => {
  const suburbEn = ((req.query.suburb_en as string) ?? (req.query.suburb as string) ?? "").trim();
  const suburbAr = ((req.query.suburb_ar as string) ?? "").trim();
  const cityEn   = ((req.query.city_en   as string) ?? (req.query.city   as string) ?? "").trim();
  const cityAr   = ((req.query.city_ar   as string) ?? "").trim();

  if (!suburbEn && !suburbAr && !cityEn && !cityAr) {
    return res.json({ governorateId: null, areaId: null });
  }

  try {
    const cityTerms   = [cityEn,   cityAr,   suburbEn, suburbAr].filter(Boolean);
    const suburbTerms = [suburbEn, suburbAr, cityEn,   cityAr  ].filter(Boolean);

    const govMatch = await matchLocation(cityTerms, "governorate");

    let areaMatch: Awaited<ReturnType<typeof matchLocation>> = null;
    if (govMatch) {
      areaMatch = await matchLocation(suburbTerms, "area", govMatch.id);
      if (!areaMatch) {
        areaMatch = await matchLocation(cityTerms, "area", govMatch.id);
      }
    }

    logger.debug(
      { suburbEn, suburbAr, cityEn, cityAr, govMatch: govMatch?.id, areaMatch: areaMatch?.id },
      "Location match result",
    );

    return res.json({
      governorateId: govMatch?.id ?? null,
      areaId: areaMatch?.id ?? null,
    });
  } catch (err) {
    logger.error({ err, suburbEn, suburbAr, cityEn, cityAr }, "Failed to match location");
    return res.status(500).json({ error: "Location match failed" });
  }
});

export default router;
