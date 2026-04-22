import { Router, type IRouter } from "express";
import { broadcastNewOrder } from "../lib/orderBroadcaster";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/orders", (req, res) => {
  const order = req.body;

  if (!order || !order.id || !order.orderNumber) {
    res.status(400).json({ error: "Invalid order payload" });
    return;
  }

  logger.info({ orderId: order.id, orderNumber: order.orderNumber }, "Received new order, broadcasting to technicians");

  broadcastNewOrder(order);

  res.status(201).json({ success: true, orderId: order.id });
});

export default router;
