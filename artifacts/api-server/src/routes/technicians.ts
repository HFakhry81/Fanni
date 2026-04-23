import { Router, type IRouter } from "express";
import { db, usersTable, ordersTable, pool } from "@workspace/db";
import { and, eq, SQL } from "drizzle-orm";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import { locationsMatch } from "../lib/locationNormalizer";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const router: IRouter = Router();

router.patch(
  "/technicians/:id/availability",
  authMiddleware,
  requireAuth,
  async (req, res) => {
    const { id } = req.params;

    if (req.user!.id !== id) {
      res.status(403).json({ error: "Forbidden: cannot update another technician's availability" });
      return;
    }

    const { isAvailable } = req.body as { isAvailable?: unknown };
    if (typeof isAvailable !== "boolean") {
      res.status(400).json({ error: "Invalid body: isAvailable (boolean) is required" });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set({ isAvailable, updatedAt: new Date() })
      .where(eq(usersTable.id, id))
      .returning({ id: usersTable.id, isAvailable: usersTable.isAvailable });

    if (!updated) {
      res.status(404).json({ error: "Technician not found" });
      return;
    }

    res.json({ success: true, id: updated.id, isAvailable: updated.isAvailable });
  },
);

router.get("/technicians/available", authMiddleware, requireAuth, async (req, res) => {
  const lat = parseFloat(req.query.lat as string);
  const lon = parseFloat(req.query.lon as string);
  const radiusKmRaw = parseFloat((req.query.radiusKm as string) ?? "15");
  const radiusKm = isNaN(radiusKmRaw) || radiusKmRaw <= 0 ? 15 : Math.min(radiusKmRaw, 200);
  const hasSpatial =
    !isNaN(lat) && !isNaN(lon) &&
    lat >= -90 && lat <= 90 &&
    lon >= -180 && lon <= 180;
  const govFilter = (req.query.governorate as string | undefined)?.trim() ?? null;
  const areaFilter = (req.query.area as string | undefined)?.trim() ?? null;

  if (hasSpatial) {
    try {
      const client = await pool.connect();
      try {
        const radiusM = radiusKm * 1000;
        const { rows } = await client.query<{
          id: string;
          first_name: string;
          last_name: string;
          profile_image_url: string | null;
          governorate: string | null;
          area: string | null;
          profession: string | null;
          specialty: string | null;
          is_available: boolean;
          distance_m: number;
        }>(
          `SELECT
             u.id,
             u.first_name,
             u.last_name,
             u.profile_image_url,
             u.governorate,
             u.area,
             u.profession,
             u.specialty,
             u.is_available,
             ST_Distance(
               u.location,
               ST_SetSRID(ST_MakePoint($1,$2),4326)::geography
             ) AS distance_m
           FROM users u
           WHERE
             u.role = 'technician'
             AND u.is_available = true
             AND u.location IS NOT NULL
             AND ST_DWithin(
               u.location,
               ST_SetSRID(ST_MakePoint($1,$2),4326)::geography,
               $3
             )
           ORDER BY distance_m ASC`,
          [lon, lat, radiusM],
        );

        const technicians = rows.map((r) => ({
          id: r.id,
          firstName: r.first_name,
          lastName: r.last_name,
          profileImageUrl: r.profile_image_url,
          governorate: r.governorate,
          area: r.area,
          profession: r.profession,
          specialty: r.specialty,
          isAvailable: r.is_available,
          distanceM: Math.round(r.distance_m),
        }));

        res.json({ technicians, spatialFilter: true, radiusKm });
        return;
      } finally {
        client.release();
      }
    } catch (err) {
      logger.warn({ err, lat, lon, radiusKm }, "ST_DWithin spatial query failed — falling back to text filter");
    }
  }

  // Text-based fallback: filter by governorate + area if provided,
  // otherwise return all available technicians.
  const conditions: SQL[] = [
    eq(usersTable.role, "technician"),
    eq(usersTable.isAvailable, true),
  ];
  if (govFilter) conditions.push(eq(usersTable.governorate, govFilter));
  if (areaFilter) conditions.push(eq(usersTable.area, areaFilter));

  const technicians = await db
    .select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      profileImageUrl: usersTable.profileImageUrl,
      governorate: usersTable.governorate,
      area: usersTable.area,
      profession: usersTable.profession,
      specialty: usersTable.specialty,
      isAvailable: usersTable.isAvailable,
    })
    .from(usersTable)
    .where(and(...conditions));

  res.json({ technicians, spatialFilter: false, governorateFilter: govFilter, areaFilter });
});

router.get("/technician/pending-orders", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  if (user.role !== "technician") {
    res.status(403).json({ error: "Only technicians can access this endpoint" });
    return;
  }

  try {
    const techRow = await db
      .select({
        serviceCategories: usersTable.serviceCategories,
        governorate: usersTable.governorate,
        area: usersTable.area,
      })
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!techRow) {
      res.status(404).json({ error: "Technician profile not found" });
      return;
    }

    const limitRaw = parseInt(String(req.query.limit ?? DEFAULT_PAGE_SIZE), 10);
    const limit = isNaN(limitRaw) || limitRaw < 1 ? DEFAULT_PAGE_SIZE : Math.min(limitRaw, MAX_PAGE_SIZE);
    const pageRaw = parseInt(String(req.query.page ?? 1), 10);
    const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;

    const pendingRows = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.status, "pending"))
      .orderBy(ordersTable.createdAt);

    const techCategories: string[] = (techRow.serviceCategories as string[] | null) ?? [];
    const techGov = techRow.governorate ?? null;
    const techArea = techRow.area ?? null;

    const matchPromises = pendingRows.map(async (row) => {
      if (techCategories.length > 0) {
        const orderCategory = (row.category ?? "").toLowerCase();
        if (!techCategories.map((c) => c.toLowerCase()).includes(orderCategory)) return null;
      }
      if (techGov) {
        const govMatch = await locationsMatch(row.governorate, techGov, "governorate");
        if (!govMatch) return null;
      }
      if (techArea) {
        const areaMatch = await locationsMatch(row.area, techArea, "area");
        if (!areaMatch) return null;
      }
      const data = row.data as Record<string, unknown>;
      return {
        id: row.id,
        orderNumber: row.orderNumber,
        orderSerial: row.orderSerial,
        status: row.status,
        category: row.category ?? data.category,
        subCategory: data.subCategory ?? null,
        governorate: row.governorate ?? null,
        area: row.area ?? null,
        street: data.street ?? null,
        floor: data.floor ?? null,
        building: data.building ?? null,
        landmark: data.landmark ?? null,
        visitDate: data.visitDate ?? null,
        visitTime: data.visitTime ?? null,
        problemDescription: data.problemDescription ?? null,
        deviceType: data.deviceType ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        createdAt: row.createdAt,
      };
    });

    const allMatched = (await Promise.all(matchPromises)).filter(Boolean);
    const total = allMatched.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const results = allMatched.slice(offset, offset + limit);

    logger.info({ techId: user.id, total: pendingRows.length, matched: total, page, limit }, "Technician fetched pending orders");
    res.json({ orders: results, meta: { total, page, limit, totalPages } });
  } catch (err) {
    logger.error({ err, techId: user.id }, "Failed to fetch pending orders for technician");
    res.status(500).json({ error: "Failed to fetch pending orders" });
  }
});

export default router;
