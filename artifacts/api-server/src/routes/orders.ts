import { Router, type IRouter } from "express";
import { broadcastNewOrder } from "../lib/orderBroadcaster";
import { logger } from "../lib/logger";
import { db, ordersTable } from "@workspace/db";

const router: IRouter = Router();

router.post("/orders", async (req, res) => {
  const order = req.body;

  if (!order || !order.id || !order.orderNumber) {
    res.status(400).json({ error: "Invalid order payload" });
    return;
  }

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

  logger.info({ orderId: order.id, orderNumber: order.orderNumber }, "Received new order, broadcasting to technicians");

  broadcastNewOrder(order);

  res.status(201).json({ success: true, orderId: order.id });
});

export default router;
