import { Router, type IRouter } from "express";
import { sql, desc, eq } from "drizzle-orm";
import { broadcastNewOrder } from "../lib/orderBroadcaster";
import { logger } from "../lib/logger";
import { db, ordersTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

function formatOrderNumber(serial: number): string {
  return `ORD-${String(serial).padStart(6, "0")}`;
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
        status: row.status,
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

  const routingMeta = {
    category: order.category as string,
    governorate: (order.governorate as string | undefined) ?? null,
    area: (order.area as string | undefined) ?? null,
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
  const { id } = req.params;

  if (user.role !== "technician" && user.role !== "admin") {
    res.status(403).json({ error: "Only technicians can acknowledge orders" });
    return;
  }

  try {
    await db
      .update(ordersTable)
      .set({
        status: "acknowledged",
        technicianId: user.id,
        acknowledgedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(ordersTable.id, id));

    res.json({ success: true });
  } catch (err) {
    logger.error({ err, id }, "Failed to acknowledge order");
    res.status(500).json({ error: "Failed to acknowledge order" });
  }
});

router.patch("/orders/:id/complete", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  const { id } = req.params;

  if (user.role !== "technician" && user.role !== "admin") {
    res.status(403).json({ error: "Only technicians can complete orders" });
    return;
  }

  try {
    await db
      .update(ordersTable)
      .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(ordersTable.id, id));

    res.json({ success: true });
  } catch (err) {
    logger.error({ err, id }, "Failed to complete order");
    res.status(500).json({ error: "Failed to complete order" });
  }
});

router.patch("/orders/:id/cancel", authMiddleware, requireAuth, async (req, res) => {
  const { id } = req.params;
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
