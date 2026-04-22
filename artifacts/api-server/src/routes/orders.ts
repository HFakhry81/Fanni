import { Router, type IRouter } from "express";
import { sql, desc } from "drizzle-orm";
import { broadcastNewOrder } from "../lib/orderBroadcaster";
import { logger } from "../lib/logger";
import { db, ordersTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/orders", authMiddleware, requireAuth, async (req, res) => {
  const userId = req.user!.id;

  try {
    const rows = await db
      .select()
      .from(ordersTable)
      .where(sql`${ordersTable.data}->>'clientId' = ${userId}`)
      .orderBy(desc(ordersTable.createdAt));

    const orders = rows.map((row) => {
      const data = row.data as Record<string, unknown>;
      return {
        id: row.id,
        orderNumber: row.orderNumber,
        status: (data.status as string) ?? row.status,
        createdAt: row.createdAt,
        category: data.category,
        subCategory: data.subCategory,
        street: data.street,
        floor: data.floor,
        visitDate: data.visitDate,
        visitTime: data.visitTime,
        technicianId: data.technicianId ?? null,
        technicianName: data.technicianName ?? null,
        technicianMobile: data.technicianMobile ?? null,
        technicianAvatar: data.technicianAvatar ?? null,
        technicianRating: data.technicianRating ?? null,
        problemDescription: data.problemDescription,
        deviceType: data.deviceType,
        building: data.building,
        apartment: data.apartment,
        landmark: data.landmark,
        governorate: data.governorate ?? null,
        area: data.area ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        clientId: data.clientId,
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

  if (!order || !order.id || !order.orderNumber || !order.category) {
    res.status(400).json({ error: "Invalid order payload: id, orderNumber, and category are required" });
    return;
  }

  const routingMeta = {
    category: order.category as string,
    governorate: (order.governorate as string | undefined) ?? null,
    area: (order.area as string | undefined) ?? null,
  };

  try {
    await db.insert(ordersTable).values({
      id: order.id,
      orderNumber: String(order.orderNumber),
      status: "pending",
      data: order,
    }).onConflictDoNothing();

    logger.info({ orderId: order.id, orderNumber: order.orderNumber }, "Order saved to database");
  } catch (err) {
    logger.error({ err, orderId: order.id }, "Failed to save order to database");
    res.status(500).json({ error: "Failed to persist order" });
    return;
  }

  logger.info({ orderId: order.id, orderNumber: order.orderNumber, ...routingMeta }, "Received new order, routing to matched technicians");

  broadcastNewOrder(order);

  res.status(201).json({ success: true, orderId: order.id });
});

export default router;
