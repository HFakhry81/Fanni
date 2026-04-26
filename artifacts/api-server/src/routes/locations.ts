import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, locationsTable, pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { matchLocation } from "../lib/locationNormalizer";
import { queryString } from "../lib/queryParams";

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
  const suburbEn = (queryString(req.query.suburb_en) ?? queryString(req.query.suburb) ?? "").trim();
  const suburbAr = (queryString(req.query.suburb_ar) ?? "").trim();
  const cityEn   = (queryString(req.query.city_en)   ?? queryString(req.query.city)   ?? "").trim();
  const cityAr   = (queryString(req.query.city_ar)   ?? "").trim();

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

    const governorateId = govMatch?.id ?? null;
    const areaId = areaMatch?.id ?? null;

    logger.debug(
      { suburbEn, suburbAr, cityEn, cityAr, governorateId, areaId },
      "Location match result",
    );

    if (!governorateId && !areaId) {
      logger.warn(
        { suburbEn, suburbAr, cityEn, cityAr },
        "Location miss: no governorate or area matched — logging for review",
      );
      const lat = queryString(req.query.lat)?.trim() || null;
      const lng = queryString(req.query.lng)?.trim() || null;
      pool.query(
        `INSERT INTO location_miss_log
           (suburb_en, suburb_ar, city_en, city_ar, lat, lng)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (
           COALESCE(suburb_en,''), COALESCE(suburb_ar,''),
           COALESCE(city_en,''),   COALESCE(city_ar,'')
         )
         DO UPDATE SET
           seen_count   = location_miss_log.seen_count + 1,
           last_seen_at = now()`,
        [suburbEn || null, suburbAr || null, cityEn || null, cityAr || null, lat, lng],
      ).catch((err: unknown) => {
        logger.error({ err }, "Failed to write location miss log row");
      });
    }

    return res.json({ governorateId, areaId });
  } catch (err) {
    logger.error({ err, suburbEn, suburbAr, cityEn, cityAr }, "Failed to match location");
    return res.status(500).json({ error: "Location match failed" });
  }
});

export default router;
