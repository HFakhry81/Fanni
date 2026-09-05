import { Router, type IRouter, type Request } from "express";
import { db, usersTable, ordersTable, availabilityAuditLogsTable, pool, leadUnlocksTable, unlockCostsTable } from "@workspace/db";
import { and, eq, ne, sql, SQL, inArray } from "drizzle-orm";
import { maskPhoneDisplay } from "../lib/phone";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import { locationsMatch } from "../lib/locationNormalizer";
import { queryFloat, queryInt, queryString } from "../lib/queryParams";
import { broadcastAvailabilityChangedToTechnician } from "../lib/orderBroadcaster";
import { DEFAULT_LEAD_COST, loadActiveLeadPricingRules, pickLeadCostFromRules } from "../lib/leadPricing";
import { professionMatchesOrder } from "../lib/categoryMatch";
import {
  loadTechnicianServiceLocation,
  needsDailyServiceLocationPrompt,
  resolveTechnicianServiceLocation,
  setTechnicianServiceLocation,
  type ServiceLocationMode,
} from "../lib/serviceLocation";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const router: IRouter = Router();

router.patch(
  "/technicians/:id/availability",
  authMiddleware,
  requireAuth,
  async (req: Request<{ id: string }>, res) => {
    const { id } = req.params;
    const requestingUser = req.user!;

    if (requestingUser.id !== id && requestingUser.role !== "admin") {
      res.status(403).json({ error: "Forbidden: cannot update another technician's availability" });
      return;
    }

    const { isAvailable } = req.body as { isAvailable?: unknown };
    if (typeof isAvailable !== "boolean") {
      res.status(400).json({ error: "Invalid body: isAvailable (boolean) is required" });
      return;
    }

    let updatedId: string;
    let updatedAvailable: boolean;

    try {
      const result = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ id: usersTable.id, isAvailable: usersTable.isAvailable })
          .from(usersTable)
          .where(and(eq(usersTable.id, id), eq(usersTable.role, "technician")));

        if (!existing) return null;

        const oldValue = existing.isAvailable;

        const [updated] = await tx
          .update(usersTable)
          .set({ isAvailable, updatedAt: new Date() })
          .where(and(eq(usersTable.id, id), eq(usersTable.role, "technician")))
          .returning({ id: usersTable.id, isAvailable: usersTable.isAvailable });

        if (!updated) return null;

        await tx.insert(availabilityAuditLogsTable).values({
          technicianId: updated.id,
          changedById: requestingUser.id,
          changedByRole: requestingUser.role ?? "technician",
          oldValue,
          newValue: updated.isAvailable,
        });

        return updated;
      });

      if (!result) {
        res.status(404).json({ error: "Technician not found" });
        return;
      }

      updatedId = result.id;
      updatedAvailable = result.isAvailable;
    } catch (err) {
      logger.error({ err, technicianId: id }, "Availability update transaction failed");
      res.status(500).json({ error: "Failed to update availability" });
      return;
    }

    if (requestingUser.id !== id && requestingUser.role === "admin") {
      broadcastAvailabilityChangedToTechnician(updatedId, updatedAvailable).catch(() => {});
    }

    res.json({ success: true, id: updatedId, isAvailable: updatedAvailable });
  },
);

router.get("/technician/notifications", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  if (user.role !== "technician") {
    res.status(403).json({ error: "Only technicians can access this endpoint" });
    return;
  }

  try {
    const client = await pool.connect();
    let rows: Array<{ id: string; type: string; payload: unknown; created_at: Date }> = [];
    try {
      const result = await client.query<{ id: string; type: string; payload: unknown; created_at: Date }>(
        `SELECT id, type, payload, created_at
         FROM technician_notifications
         WHERE technician_id = $1 AND delivered_at IS NULL
         ORDER BY created_at ASC`,
        [user.id],
      );
      rows = result.rows;
    } finally {
      client.release();
    }

    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const markClient = await pool.connect();
      try {
        await markClient.query(
          `UPDATE technician_notifications SET delivered_at = now() WHERE id = ANY($1)`,
          [ids],
        );
      } finally {
        markClient.release();
      }
      logger.info({ techId: user.id, count: rows.length }, "Delivered pending notifications to technician via HTTP");
    }

    const notifications = rows.map((r) => ({
      id: r.id,
      type: r.type,
      payload: r.payload,
      createdAt: r.created_at,
    }));

    res.json({ notifications });
  } catch (err) {
    logger.error({ err, techId: user.id }, "Failed to fetch technician notifications");
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

router.get("/technicians/available", authMiddleware, requireAuth, async (req, res) => {
  if (req.user?.role === "client") {
    res.status(403).json({ error: "Clients cannot browse technician availability" });
    return;
  }
  const lat = queryFloat(req.query.lat);
  const lon = queryFloat(req.query.lon);
  const radiusKmRaw = queryFloat(req.query.radiusKm);
  const radiusKm = isNaN(radiusKmRaw) || radiusKmRaw <= 0 ? 15 : Math.min(radiusKmRaw, 200);
  const hasSpatial =
    !isNaN(lat) && !isNaN(lon) &&
    lat >= -90 && lat <= 90 &&
    lon >= -180 && lon <= 180;
  const govFilter = queryString(req.query.governorate)?.trim() ?? null;
  const areaFilter = queryString(req.query.area)?.trim() ?? null;
  const domainFilter = queryString(req.query.domainId)?.trim() ?? null;

  if (hasSpatial) {
    try {
      const client = await pool.connect();
      try {
        const radiusM = radiusKm * 1000;
        const params: (string | number)[] = [lon, lat, radiusM];
        let domainClause = "";
        if (domainFilter) {
          params.push(domainFilter);
          domainClause = `AND (u.profession = $${params.length} OR u.service_categories @> jsonb_build_array($${params.length}::text))`;
        }
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
             ${domainClause}
           ORDER BY distance_m ASC`,
          params,
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

        res.json({ technicians, spatialFilter: true, radiusKm, domainFilter });
        return;
      } finally {
        client.release();
      }
    } catch (err) {
      logger.warn({ err, lat, lon, radiusKm }, "ST_DWithin spatial query failed — falling back to text filter");
    }
  }

  // Text-based fallback: filter by governorate + area + domainId if provided,
  // otherwise return all available technicians.
  const conditions: SQL[] = [
    eq(usersTable.role, "technician"),
    eq(usersTable.isAvailable, true),
  ];
  if (govFilter) conditions.push(eq(usersTable.governorate, govFilter));
  if (areaFilter) conditions.push(eq(usersTable.area, areaFilter));
  if (domainFilter) {
    conditions.push(
      sql`(${usersTable.profession} = ${domainFilter} OR ${usersTable.serviceCategories} @> jsonb_build_array(${domainFilter}::text))`,
    );
  }

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

  res.json({ technicians, spatialFilter: false, governorateFilter: govFilter, areaFilter, domainFilter });
});

/** Haversine distance in metres between two lat/lon points. */
function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

router.get("/technician/pending-orders", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  if (user.role !== "technician") {
    res.status(403).json({ error: "Only technicians can access this endpoint" });
    return;
  }

  try {
    // Fetch technician profile including their stored location coordinates.
    const client = await pool.connect();
    let techRow: {
      profession: string | null;
      governorate: string | null;
      area: string | null;
      techLat: number | null;
      techLon: number | null;
    } | null = null;
    try {
      const serviceRow = await loadTechnicianServiceLocation(client, user.id);
      if (serviceRow) {
        const { rows } = await client.query<{ profession: string | null }>(
          `SELECT profession FROM users WHERE id = $1 LIMIT 1`,
          [user.id],
        );
        const resolved = resolveTechnicianServiceLocation(serviceRow);
        techRow = {
          profession: rows[0]?.profession ?? null,
          governorate: resolved.governorate,
          area: resolved.area,
          techLat: resolved.latitude,
          techLon: resolved.longitude,
        };
      }
    } finally {
      client.release();
    }

    if (!techRow) {
      res.status(404).json({ error: "Technician profile not found" });
      return;
    }

    const limitRaw = queryInt(req.query.limit, DEFAULT_PAGE_SIZE);
    const limit = limitRaw < 1 ? DEFAULT_PAGE_SIZE : Math.min(limitRaw, MAX_PAGE_SIZE);
    const pageRaw = queryInt(req.query.page, 1);
    const page = pageRaw < 1 ? 1 : pageRaw;

    // Declines only dismiss push/modal notifications — they must NOT hide pending leads.
    const pendingRows = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.status, "pending"))
      .orderBy(ordersTable.createdAt);

    // Routing filter: profession (مهنة) + geography only — not specialty / serviceCategories.
    const techProfession = techRow.profession ?? null;
    const techGov = techRow.governorate ?? null;
    const techArea = techRow.area ?? null;
    const techLat = techRow.techLat;
    const techLon = techRow.techLon;

    const matchPromises = pendingRows.map(async (row) => {
      const data = row.data as Record<string, unknown>;
      const orderCategory = row.category ?? data.category;
      if (!(await professionMatchesOrder(orderCategory, techProfession))) return null;

      // Governorate is the hard geography gate; area is preference-only (sort boost).
      const orderGov =
        row.governorate ??
        (typeof data.governorate === "string" ? data.governorate : null) ??
        (typeof data.governorateName === "string" ? data.governorateName : null);
      const orderArea =
        row.area ??
        (typeof data.area === "string" ? data.area : null) ??
        (typeof data.areaName === "string" ? data.areaName : null);

      if (techGov && orderGov) {
        const govMatch = await locationsMatch(orderGov, techGov, "governorate");
        if (!govMatch) return null;
      }

      let areaBoost = 0;
      if (techArea && orderArea) {
        const areaMatch = await locationsMatch(orderArea, techArea, "area");
        if (areaMatch) areaBoost = 1;
      }

      const orderLat = typeof data.latitude === "number" ? data.latitude : null;
      const orderLon = typeof data.longitude === "number" ? data.longitude : null;

      let distanceM: number | null = null;
      if (orderLat !== null && orderLon !== null && techLat !== null && techLon !== null) {
        distanceM = Math.round(haversineMetres(techLat, techLon, orderLat, orderLon));
      }

      return {
        id: row.id,
        orderNumber: row.orderNumber,
        orderSerial: row.orderSerial,
        status: row.status,
        category: row.category ?? data.category,
        subCategory: data.subCategory ?? null,
        governorate: row.governorate ?? orderGov,
        area: row.area ?? orderArea,
        street: data.street ?? null,
        floor: data.floor ?? null,
        building: data.building ?? null,
        landmark: data.landmark ?? null,
        visitDate: data.visitDate ?? null,
        visitTime: data.visitTime ?? null,
        problemDescription: data.problemDescription ?? null,
        deviceType: data.deviceType ?? null,
        latitude: orderLat,
        longitude: orderLon,
        distanceM,
        areaBoost,
        createdAt: row.createdAt,
      };
    });

    type MatchedOrder = Exclude<Awaited<(typeof matchPromises)[0]>, null>;
    const allMatched = (await Promise.all(matchPromises)).filter((o): o is MatchedOrder => o !== null);

    // Prefer same-area leads, then nearer distance.
    allMatched.sort((a, b) => {
      if (a.areaBoost !== b.areaBoost) return b.areaBoost - a.areaBoost;
      if (a.distanceM === null && b.distanceM === null) return 0;
      if (a.distanceM === null) return 1;
      if (b.distanceM === null) return -1;
      return a.distanceM - b.distanceM;
    });

    const total = allMatched.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const pageOrders = allMatched.slice(offset, offset + limit);

    // ── Points system: determine which orders this tech has already unlocked ──
    const pricingRules = await loadActiveLeadPricingRules();
    let defaultCost = DEFAULT_LEAD_COST;
    try {
      const [defCost] = await db.select().from(unlockCostsTable)
        .where(and(sql`specialty_slug IS NULL`, sql`category_slug IS NULL`));
      if (defCost) defaultCost = defCost.pointsCost;
    } catch { /* fall back to DEFAULT_LEAD_COST */ }

    const orderIds = pageOrders.map((o) => o.id);
    const unlockedSet = new Set<string>();
    if (orderIds.length > 0) {
      try {
        const unlocks = await db.select({ orderId: leadUnlocksTable.orderId })
          .from(leadUnlocksTable)
          .where(and(eq(leadUnlocksTable.technicianId, user.id), inArray(leadUnlocksTable.orderId, orderIds)));
        for (const u of unlocks) unlockedSet.add(u.orderId);
      } catch { /* non-fatal */ }
    }

    const results = pageOrders.map((o) => {
      const { areaBoost: _areaBoost, ...orderFields } = o;
      const isUnlocked = unlockedSet.has(o.id);
      const unlockCost = pickLeadCostFromRules(pricingRules, {
        category: typeof o.category === "string" ? o.category : null,
        specialty: typeof o.subCategory === "string" ? o.subCategory : null,
      }) ?? defaultCost;
      if (isUnlocked) return { ...orderFields, isUnlocked: true, unlockCost };
      return {
        ...orderFields,
        isUnlocked: false,
        unlockCost,
        street: null,
        building: null,
        floor: null,
        landmark: null,
        // Keep approximate coords for map distance/pins; exact address stays locked.
      };
    });

    logger.info({ techId: user.id, total: pendingRows.length, matched: total, page, limit }, "Technician fetched pending orders");
    res.json({ orders: results, meta: { total, page, limit, totalPages } });
  } catch (err) {
    logger.error({ err, techId: user.id }, "Failed to fetch pending orders for technician");
    res.status(500).json({ error: "Failed to fetch pending orders" });
  }
});

type DbStatus = "pending" | "acknowledged" | "en_route" | "arrived" | "in_progress" | "completed" | "cancelled";
type MobileStatus = "pending" | "accepted" | "inProgress" | "completed" | "cancelled";

function toMobileStatus(dbStatus: DbStatus): MobileStatus {
  switch (dbStatus) {
    case "acknowledged":
    case "en_route":
    case "arrived":
      return "accepted";
    case "in_progress":
      return "inProgress";
    default:
      return dbStatus as MobileStatus;
  }
}

router.get("/technician/orders", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  if (user.role !== "technician") {
    res.status(403).json({ error: "Only technicians can access this endpoint" });
    return;
  }

  try {
    const rows = await db
      .select()
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.technicianId, user.id),
          ne(ordersTable.status, "pending")
        )
      )
      .orderBy(ordersTable.createdAt);

    const orders = rows.map((row) => {
      const data = row.data as Record<string, unknown>;
      return {
        id: row.id,
        orderNumber: row.orderNumber,
        orderSerial: row.orderSerial,
        status: toMobileStatus(row.status as DbStatus),
        createdAt: row.createdAt,
        category: row.category ?? data.category,
        subCategory: data.subCategory,
        street: data.street,
        floor: data.floor,
        building: data.building,
        apartment: data.apartment,
        landmark: data.landmark,
        visitDate: data.visitDate,
        visitTime: data.visitTime,
        technicianId: row.technicianId ?? data.technicianId ?? null,
        technicianName: data.technicianName ?? null,
        technicianMobile: data.technicianMobile ?? null,
        technicianAvatar: data.technicianAvatar ?? null,
        technicianRating: data.technicianRating ?? null,
        problemDescription: data.problemDescription,
        deviceType: data.deviceType,
        governorate: row.governorate ?? data.governorate ?? null,
        area: row.area ?? data.area ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        clientId: row.clientId ?? data.clientId,
        clientName: data.clientName,
        clientMobile: maskPhoneDisplay(typeof data.clientMobile === "string" ? data.clientMobile : null),
        photos: data.photos ?? [],
        materials: data.materials ?? null,
        solutionDescription: data.solutionDescription ?? null,
        invoice: data.invoice ?? null,
        clientRating: data.clientRating ?? null,
        clientComment: data.clientComment ?? null,
      };
    });

    logger.info({ techId: user.id, count: orders.length }, "Technician fetched assigned orders");
    res.json({ orders });
  } catch (err) {
    logger.error({ err, techId: user.id }, "Failed to fetch assigned orders for technician");
    res.status(500).json({ error: "Failed to fetch assigned orders" });
  }
});

router.get("/technician/service-location", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  if (user.role !== "technician") {
    res.status(403).json({ error: "Only technicians can access this endpoint" });
    return;
  }
  const client = await pool.connect();
  try {
    const row = await loadTechnicianServiceLocation(client, user.id);
    if (!row) {
      res.status(404).json({ error: "Technician not found" });
      return;
    }
    const resolved = resolveTechnicianServiceLocation(row);
    res.json({
      needsDailyPrompt: needsDailyServiceLocationPrompt(row),
      mode: row.serviceLocationMode,
      resolved,
      hasRegisteredCoords: row.registeredLat != null && row.registeredLon != null,
      hasLastWorkCoords: row.lastWorkLat != null && row.lastWorkLon != null,
    });
  } catch (err) {
    logger.error({ err, techId: user.id }, "Failed to load service location");
    res.status(500).json({ error: "Failed to load service location" });
  } finally {
    client.release();
  }
});

router.put("/technician/service-location", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  if (user.role !== "technician") {
    res.status(403).json({ error: "Only technicians can access this endpoint" });
    return;
  }
  const { mode, latitude, longitude } = req.body as {
    mode?: ServiceLocationMode;
    latitude?: number;
    longitude?: number;
  };
  if (mode !== "registered" && mode !== "last_work" && mode !== "current") {
    res.status(400).json({ error: "Invalid mode" });
    return;
  }
  const client = await pool.connect();
  try {
    await setTechnicianServiceLocation(
      client,
      user.id,
      mode,
      mode === "current" && typeof latitude === "number" && typeof longitude === "number"
        ? { latitude, longitude }
        : undefined,
    );
    const row = await loadTechnicianServiceLocation(client, user.id);
    const resolved = row ? resolveTechnicianServiceLocation(row) : null;
    res.json({ success: true, resolved, needsDailyPrompt: row ? needsDailyServiceLocationPrompt(row) : false });
  } catch (err) {
    if (err instanceof Error && err.message === "CURRENT_COORDS_REQUIRED") {
      res.status(400).json({ error: "Current GPS coordinates are required for mode=current" });
      return;
    }
    logger.error({ err, techId: user.id }, "Failed to set service location");
    res.status(500).json({ error: "Failed to set service location" });
  } finally {
    client.release();
  }
});

export default router;
