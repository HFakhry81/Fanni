import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "node:http";
import { logger } from "./logger";
import { db, ordersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const wss = new WebSocketServer({ noServer: true });

const clients = new Set<WebSocket>();

let pendingOrders: unknown[] = [];

wss.on("connection", (ws: WebSocket) => {
  clients.add(ws);
  logger.info({ total: clients.size }, "Technician WebSocket connected");

  ws.send(JSON.stringify({ type: "connected", message: "Connected to Fanni order stream" }));

  if (pendingOrders.length > 0) {
    logger.info({ count: pendingOrders.length }, "Replaying pending orders to newly connected technician");
    for (const order of pendingOrders) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "new_order", order }));
      }
    }
  }

  ws.on("close", () => {
    clients.delete(ws);
    logger.info({ total: clients.size }, "Technician WebSocket disconnected");
  });

  ws.on("error", (err) => {
    logger.error({ err }, "WebSocket error");
    clients.delete(ws);
  });
});

export function broadcastNewOrder(order: unknown): void {
  pendingOrders.push(order);

  const payload = JSON.stringify({ type: "new_order", order });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
  logger.info({ connectedClients: clients.size }, "Broadcasted new order to technicians");
}

export async function recoverPendingOrders(): Promise<void> {
  try {
    const rows = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.status, "pending"));

    if (rows.length === 0) {
      logger.info("No pending orders to recover on startup");
      return;
    }

    pendingOrders = rows.map((row) => row.data);
    logger.info({ count: pendingOrders.length }, "Recovered pending orders from database for rebroadcast");

    if (clients.size > 0) {
      for (const order of pendingOrders) {
        const payload = JSON.stringify({ type: "new_order", order });
        for (const client of clients) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
          }
        }
      }
      logger.info({ count: pendingOrders.length, clients: clients.size }, "Rebroadcasted recovered orders to already-connected technicians");
    }
  } catch (err) {
    logger.error({ err }, "Failed to recover pending orders from database");
  }
}

export function handleUpgrade(req: IncomingMessage, socket: import("node:net").Socket, head: Buffer): void {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
}
