import { Router, type IRouter } from "express";
import { db, usersTable, pool } from "@workspace/db";
import { and, eq, SQL } from "drizzle-orm";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.patch(
  "/technicians/:id/availability",
  authMiddleware,
  requireAuth,
  async (req, res) => {
    const { id } = req.params;

    if (req.user.id !== id) {
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
    } catch {
      // PostGIS may not be installed — fall through to text-based filter
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

export default router;
