import { Router, type IRouter } from "express";
import { sql, desc, eq } from "drizzle-orm";
import { broadcastNewOrder, removeOrderFromPending } from "../lib/orderBroadcaster";
import { logger } from "../lib/logger";
import { db, ordersTable, pool } from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAuth } from "../middlewares/requireAuth";
import { normalizeToSlug } from "../lib/locationNormalizer";

const router: IRouter = Router();

function formatOrderNumber(serial: number): string {
  return `ORD-${String(serial).padStart(6, "0")}`;
}

type DbStatus = "pending" | "acknowledged" | "in_progress" | "completed" | "cancelled";
type MobileStatus = "pending" | "accepted" | "inProgress" | "completed" | "cancelled";

function toMobileStatus(dbStatus: DbStatus): MobileStatus {
  if (dbStatus === "acknowledged") return "accepted";
  if (dbStatus === "in_progress") return "inProgress";
  return dbStatus as MobileStatus;
}

router.get("/orders", authMiddleware, requireAuth, async (req, res) => {
  const userId = req.user!.id;

  try {
    const rows = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.clientId, userId))
      .orderBy(desc(ordersTable.createdAt));

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
        visitDate: data.visitDate,
        visitTime: data.visitTime,
        technicianId: row.technicianId ?? data.technicianId ?? null,
        technicianName: data.technicianName ?? null,
        technicianMobile: data.technicianMobile ?? null,
        technicianAvatar: data.technicianAvatar ?? null,
        technicianRating: data.technicianRating ?? null,
        problemDescription: data.problemDescription,
        deviceType: data.deviceType,
        building: data.building,
        apartment: data.apartment,
        landmark: data.landmark,
        governorate: row.governorate ?? data.governorate ?? null,
        area: row.area ?? data.area ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        clientId: row.clientId ?? data.clientId,
        clientName: data.clientName,
        clientMobile: data.clientMobile,
        photos: data.photos ?? [],
        materials: data.materials ?? null,
        solutionDescription: data.solutionDescription ?? null,
        invoice: data.invoice ?? null,
        clientRating: data.clientRating ?? null,
        clientComment: data.clientComment ?? null,
      };
    });

    res.json({ orders });
  } catch (err) {
    logger.error({ err, userId }, "Failed to fetch orders for client");
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

router.post("/orders", authMiddleware, requireAuth, async (req, res) => {
  const order = req.body;
  const user = req.user!;

  if (!order || !order.id || !order.category) {
    res.status(400).json({ error: "Invalid order payload: id and category are required" });
    return;
  }

  const rawGovernorate = (order.governorate as string | undefined) ?? null;
  const rawArea = (order.area as string | undefined) ?? null;

  const [normalizedGovernorate, normalizedArea] = await Promise.all([
    normalizeToSlug(rawGovernorate),
    normalizeToSlug(rawArea),
  ]);

  if (rawGovernorate && normalizedGovernorate !== rawGovernorate) {
    logger.info({ raw: rawGovernorate, normalized: normalizedGovernorate }, "Normalized order governorate to slug");
  }
  if (rawArea && normalizedArea !== rawArea) {
    logger.info({ raw: rawArea, normalized: normalizedArea }, "Normalized order area to slug");
  }

  const routingMeta = {
    category: order.category as string,
    governorate: normalizedGovernorate,
    area: normalizedArea,
  };

  try {
    const [inserted] = await db
      .insert(ordersTable)
      .values({
        id: order.id,
        orderNumber: String(order.orderNumber ?? ""),
        status: "pending",
        clientId: user.id,
        technicianId: null,
        category: order.category as string,
        governorate: routingMeta.governorate,
        area: routingMeta.area,
        data: order,
      })
      .onConflictDoNothing()
      .returning({ orderSerial: ordersTable.orderSerial, id: ordersTable.id });

    if (inserted) {
      const dbOrderNumber = formatOrderNumber(inserted.orderSerial);
      await db
        .update(ordersTable)
        .set({ orderNumber: dbOrderNumber, updatedAt: new Date() })
        .where(eq(ordersTable.id, order.id));

      const lat = parseFloat(order.latitude ?? order.data?.latitude);
      const lon = parseFloat(order.longitude ?? order.data?.longitude);
      if (!isNaN(lat) && !isNaN(lon)) {
        try {
          const client = await pool.connect();
          try {
            await client.query(
              `UPDATE orders SET location = ST_SetSRID(ST_MakePoint($1,$2),4326)::geography WHERE id = $3`,
              [lon, lat, String(order.id)],
            );
          } finally {
            client.release();
          }
        } catch {
          logger.warn({ orderId: order.id }, "PostGIS location update skipped (extension may not be installed)");
        }
      }

      const fullOrder = { ...order, orderNumber: dbOrderNumber, orderSerial: inserted.orderSerial };
      broadcastNewOrder(fullOrder);
      logger.info({ orderId: order.id, orderNumber: dbOrderNumber, orderSerial: inserted.orderSerial }, "Order saved to database");
      res.status(201).json({ success: true, orderId: order.id, orderNumber: dbOrderNumber });
    } else {
      broadcastNewOrder(order);
      res.status(201).json({ success: true, orderId: order.id });
    }
  } catch (err) {
    logger.error({ err, orderId: order.id }, "Failed to save order to database");
    res.status(500).json({ error: "Failed to persist order" });
  }
});

router.patch("/orders/:id/acknowledge", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  const id = req.params.id as string;

  if (user.role !== "technician" && user.role !== "admin") {
    res.status(403).json({ error: "Only technicians can acknowledge orders" });
    return;
  }

  const {
    technicianName,
    technicianMobile,
    technicianAvatar,
    technicianRating,
  } = req.body as {
    technicianName?: string;
    technicianMobile?: string;
    technicianAvatar?: string;
    technicianRating?: number;
  };

  const dataPatch: Record<string, unknown> = {
    status: "acknowledged",
    technicianId: user.id,
  };
  if (technicianName !== undefined) dataPatch.technicianName = technicianName;
  if (technicianMobile !== undefined) dataPatch.technicianMobile = technicianMobile;
  if (technicianAvatar !== undefined) dataPatch.technicianAvatar = technicianAvatar;
  if (technicianRating !== undefined) dataPatch.technicianRating = technicianRating;

  try {
    await db
      .update(ordersTable)
      .set({
        status: "acknowledged",
        technicianId: user.id,
        acknowledgedAt: new Date(),
        updatedAt: new Date(),
        data: sql`${ordersTable.data} || ${JSON.stringify(dataPatch)}::jsonb`,
      })
      .where(eq(ordersTable.id, id));

    removeOrderFromPending(id);
    logger.info({ id, technicianId: user.id }, "Order acknowledged and data JSONB updated");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err, id }, "Failed to acknowledge order");
    res.status(500).json({ error: "Failed to acknowledge order" });
  }
});

router.patch("/orders/:id/start", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  const id = req.params.id as string;

  if (user.role !== "technician" && user.role !== "admin") {
    res.status(403).json({ error: "Only technicians can start orders" });
    return;
  }

  try {
    await db
      .update(ordersTable)
      .set({
        status: "in_progress",
        updatedAt: new Date(),
        data: sql`${ordersTable.data} || '{"status":"inProgress"}'::jsonb`,
      })
      .where(eq(ordersTable.id, id));

    logger.info({ id, technicianId: user.id }, "Order started (in_progress)");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err, id }, "Failed to start order");
    res.status(500).json({ error: "Failed to start order" });
  }
});

router.patch("/orders/:id/complete", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  const id = req.params.id as string;

  if (user.role !== "technician" && user.role !== "admin") {
    res.status(403).json({ error: "Only technicians can complete orders" });
    return;
  }

  const { solutionDescription, clientSatisfaction, materials, invoice } = req.body as {
    solutionDescription?: string;
    clientSatisfaction?: string;
    materials?: unknown[];
    invoice?: unknown;
  };

  const dataPatch: Record<string, unknown> = { status: "completed" };
  if (solutionDescription !== undefined) dataPatch.solutionDescription = solutionDescription;
  if (clientSatisfaction !== undefined) dataPatch.clientSatisfaction = clientSatisfaction;
  if (materials !== undefined) dataPatch.materials = materials;
  if (invoice !== undefined) dataPatch.invoice = invoice;

  try {
    await db
      .update(ordersTable)
      .set({
        status: "completed",
        completedAt: new Date(),
        updatedAt: new Date(),
        data: sql`${ordersTable.data} || ${JSON.stringify(dataPatch)}::jsonb`,
      })
      .where(eq(ordersTable.id, id));

    logger.info({ id, technicianId: user.id }, "Order completed and data JSONB updated");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err, id }, "Failed to complete order");
    res.status(500).json({ error: "Failed to complete order" });
  }
});

router.patch("/orders/:id/location", authMiddleware, requireAuth, async (req, res) => {
  const id = req.params.id as string;
  const user = req.user!;
  const { latitude, longitude } = req.body as { latitude?: unknown; longitude?: unknown };
  const lat = parseFloat(String(latitude));
  const lon = parseFloat(String(longitude));

  if (isNaN(lat) || isNaN(lon)) {
    res.status(400).json({ error: "latitude and longitude are required numbers" });
    return;
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    res.status(400).json({ error: "Coordinates out of range" });
    return;
  }

  try {
    const [existing] = await db
      .select({ clientId: ordersTable.clientId, technicianId: ordersTable.technicianId })
      .from(ordersTable)
      .where(eq(ordersTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const isOwner = existing.clientId === user.id || existing.technicianId === user.id;
    if (user.role !== "admin" && !isOwner) {
      res.status(403).json({ error: "Forbidden: only the order owner or an admin can update this order's location" });
      return;
    }

    await db
      .update(ordersTable)
      .set({
        updatedAt: new Date(),
        data: sql`${ordersTable.data} || ${JSON.stringify({ latitude: lat, longitude: lon })}::jsonb`,
      })
      .where(eq(ordersTable.id, id));

    try {
      const client = await pool.connect();
      try {
        await client.query(
          `UPDATE orders SET location = ST_SetSRID(ST_MakePoint($1,$2),4326)::geography WHERE id = $3`,
          [lon, lat, id],
        );
      } finally {
        client.release();
      }
    } catch {
      logger.warn({ orderId: id }, "PostGIS location update skipped on order location patch");
    }

    logger.info({ id, lat, lon }, "Order location updated");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err, id }, "Failed to update order location");
    res.status(500).json({ error: "Failed to update order location" });
  }
});

router.patch("/orders/:id/cancel", authMiddleware, requireAuth, async (req, res) => {
  const id = req.params.id as string;
  try {
    await db
      .update(ordersTable)
      .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
      .where(eq(ordersTable.id, id));

    res.json({ success: true });
  } catch (err) {
    logger.error({ err, id }, "Failed to cancel order");
    res.status(500).json({ error: "Failed to cancel order" });
  }
});

export default router;
