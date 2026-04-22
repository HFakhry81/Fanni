import { Router, type IRouter } from "express";
import { broadcastNewOrder } from "../lib/orderBroadcaster";
import { logger } from "../lib/logger";
import { db, ordersTable } from "@workspace/db";

const router: IRouter = Router();

router.post("/orders", async (req, res) => {
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
