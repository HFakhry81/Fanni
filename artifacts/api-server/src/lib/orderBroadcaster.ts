import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "node:http";
import { logger } from "./logger";
import { db, ordersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

interface TechnicianMeta {
  registered: boolean;
  category?: string;
  governorate?: string;
  area?: string;
}

function hasRoutingConstraints(meta: TechnicianMeta): boolean {
  return !!(meta.category || meta.governorate || meta.area);
}

function orderMatchesTech(order: Record<string, unknown>, meta: TechnicianMeta): boolean {
  if (!meta.registered) {
    return false;
  }

  if (!hasRoutingConstraints(meta)) {
    return false;
  }

  if (meta.category) {
    const orderCategory = (order.category as string | undefined)?.toLowerCase();
    if (!orderCategory || orderCategory !== meta.category.toLowerCase()) {
      return false;
    }
  }

  if (meta.governorate) {
    const orderGovernorate = (order.governorate as string | undefined)?.toLowerCase();
    if (!orderGovernorate || orderGovernorate !== meta.governorate.toLowerCase()) {
      return false;
    }
  }

  if (meta.area) {
    const orderArea = (order.area as string | undefined)?.toLowerCase();
    if (!orderArea || orderArea !== meta.area.toLowerCase()) {
      return false;
    }
  }

  return true;
}

const wss = new WebSocketServer({ noServer: true });

const clients = new Map<WebSocket, TechnicianMeta>();

let pendingOrders: unknown[] = [];

wss.on("connection", (ws: WebSocket) => {
  clients.set(ws, { registered: false });
  logger.info({ total: clients.size }, "Technician WebSocket connected");

  ws.send(JSON.stringify({ type: "connected", message: "Connected to Fanni order stream" }));

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "register") {
        const meta: TechnicianMeta = { registered: true };

        if (msg.category && typeof msg.category === "string" && msg.category.trim()) {
          meta.category = msg.category.trim().toLowerCase();
        }

        if (msg.governorate && typeof msg.governorate === "string" && msg.governorate.trim()) {
          meta.governorate = msg.governorate.trim().toLowerCase();
        }

        if (msg.area && typeof msg.area === "string" && msg.area.trim()) {
          meta.area = msg.area.trim().toLowerCase();
        }

        clients.set(ws, meta);

        const hasConstraints = hasRoutingConstraints(meta);
        logger.info({ meta, hasConstraints }, "Technician registered with metadata");

        if (!hasConstraints) {
          logger.info("Technician registered with no routing constraints — no orders will be delivered");
          return;
        }

        const matchingPending = pendingOrders.filter((order) =>
          orderMatchesTech(order as Record<string, unknown>, meta)
        );

        if (matchingPending.length > 0) {
          logger.info({ count: matchingPending.length }, "Replaying matching pending orders after registration");
          for (const order of matchingPending) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "new_order", order }));
            }
          }
        }
      }
    } catch (_) {}
  });

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

  const o = order as Record<string, unknown>;

  let sent = 0;
  let skipped = 0;
  let unregistered = 0;
  let unconstrained = 0;

  for (const [client, meta] of clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    if (!meta.registered) {
      unregistered++;
      continue;
    }
    if (!hasRoutingConstraints(meta)) {
      unconstrained++;
      continue;
    }
    if (orderMatchesTech(o, meta)) {
      client.send(JSON.stringify({ type: "new_order", order }));
      sent++;
    } else {
      skipped++;
    }
  }

  logger.info(
    {
      connectedClients: clients.size,
      sent,
      skipped,
      unregistered,
      unconstrained,
      orderCategory: o.category,
      orderGovernorate: o.governorate,
      orderArea: o.area,
    },
    "Routed new order to matching technicians"
  );
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
      for (const [client, meta] of clients) {
        if (client.readyState !== WebSocket.OPEN) continue;
        for (const order of pendingOrders) {
          if (orderMatchesTech(order as Record<string, unknown>, meta)) {
            client.send(JSON.stringify({ type: "new_order", order }));
          }
        }
      }
      logger.info({ count: pendingOrders.length, clients: clients.size }, "Rebroadcasted recovered orders to matched technicians");
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
