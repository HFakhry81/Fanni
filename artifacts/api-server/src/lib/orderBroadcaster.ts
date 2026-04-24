import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "node:http";
import { logger } from "./logger";
import { db, ordersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getSession } from "./auth";
import { locationsMatchSync, warmLocationCache } from "./locationNormalizer";

interface TechnicianMeta {
  registered: boolean;
  isAvailable: boolean;
  categories?: string[];
  governorate?: string;
  area?: string;
}

function hasRoutingConstraints(meta: TechnicianMeta): boolean {
  return !!(
    (meta.categories && meta.categories.length > 0) ||
    meta.governorate ||
    meta.area
  );
}

function orderMatchesTech(order: Record<string, unknown>, meta: TechnicianMeta): boolean {
  if (!meta.registered) {
    return false;
  }

  if (!hasRoutingConstraints(meta)) {
    return false;
  }

  if (meta.categories && meta.categories.length > 0) {
    const orderCategory = (order.category as string | undefined)?.toLowerCase();
    if (!orderCategory || !meta.categories.includes(orderCategory)) {
      return false;
    }
  }

  if (meta.governorate) {
    const orderGovernorate = (order.governorate as string | undefined) ?? null;
    if (!orderGovernorate || !locationsMatchSync(orderGovernorate, meta.governorate, "governorate")) {
      return false;
    }
  }

  if (meta.area) {
    const orderArea = (order.area as string | undefined) ?? null;
    if (!orderArea || !locationsMatchSync(orderArea, meta.area, "area")) {
      return false;
    }
  }

  return true;
}

const wss = new WebSocketServer({ noServer: true });

const clients = new Map<WebSocket, TechnicianMeta>();

const clientSessions = new Map<string, Set<WebSocket>>();
const wsToClientId = new Map<WebSocket, string>();

let pendingOrders: unknown[] = [];

wss.on("connection", (ws: WebSocket) => {
  clients.set(ws, { registered: false, isAvailable: true });
  logger.info({ total: clients.size }, "WebSocket connected");

  ws.send(JSON.stringify({ type: "connected", message: "Connected to Fanni order stream" }));

  ws.on("message", async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === "register" && msg.role === "client") {
        const token = typeof msg.token === "string" ? msg.token.trim() : "";
        if (!token) {
          ws.send(JSON.stringify({ type: "auth_error", message: "Authentication required: no token provided" }));
          ws.close();
          return;
        }

        const session = await getSession(token);
        if (!session) {
          ws.send(JSON.stringify({ type: "auth_error", message: "Authentication required: invalid or expired session" }));
          ws.close();
          return;
        }

        if (session.user.role !== "client") {
          ws.send(JSON.stringify({ type: "auth_error", message: "Client account required" }));
          ws.close();
          return;
        }

        const clientId = session.user.id;
        const existing = clientSessions.get(clientId) ?? new Set<WebSocket>();
        existing.add(ws);
        clientSessions.set(clientId, existing);
        wsToClientId.set(ws, clientId);
        clients.set(ws, { registered: true, isAvailable: true });

        logger.info({ clientId }, "Client WebSocket authenticated and registered");
        ws.send(JSON.stringify({ type: "registered", message: "Client registered for order updates" }));
        return;
      }

      if (msg.type === "set_availability") {
        const current = clients.get(ws);
        if (current) {
          const isAvailable = msg.isAvailable === true;
          clients.set(ws, { ...current, isAvailable });
          logger.info({ isAvailable }, "Technician updated availability via WebSocket");
        }
        return;
      }

      if (msg.type === "register") {
        const token = typeof msg.token === "string" ? msg.token.trim() : "";
        if (!token) {
          logger.warn("WebSocket register rejected: no token provided");
          ws.send(JSON.stringify({ type: "auth_error", message: "Authentication required: no token provided" }));
          ws.close();
          return;
        }

        const session = await getSession(token);
        if (!session) {
          logger.warn("WebSocket register rejected: invalid or expired token");
          ws.send(JSON.stringify({ type: "auth_error", message: "Authentication required: invalid or expired session" }));
          ws.close();
          return;
        }

        if (session.user.role !== "technician") {
          logger.warn({ userId: session.user.id, role: session.user.role }, "WebSocket register rejected: not a technician");
          ws.send(JSON.stringify({ type: "auth_error", message: "Authentication required: technician account required" }));
          ws.close();
          return;
        }

        logger.info({ userId: session.user.id, role: session.user.role }, "WebSocket technician authenticated");

        const isAvailable = msg.isAvailable !== false;
        const meta: TechnicianMeta = { registered: true, isAvailable };

        if (Array.isArray(msg.categories) && msg.categories.length > 0) {
          meta.categories = (msg.categories as unknown[])
            .filter((c): c is string => typeof c === "string" && c.trim() !== "")
            .map((c) => c.trim().toLowerCase());
        } else if (msg.category && typeof msg.category === "string" && msg.category.trim()) {
          meta.categories = [msg.category.trim().toLowerCase()];
        }

        if (msg.governorate && typeof msg.governorate === "string" && msg.governorate.trim()) {
          meta.governorate = msg.governorate.trim().toLowerCase();
        }

        if (msg.area && typeof msg.area === "string" && msg.area.trim()) {
          meta.area = msg.area.trim().toLowerCase();
        }

        clients.set(ws, meta);

        const hasConstraints = hasRoutingConstraints(meta);
        logger.info({ categories: meta.categories, governorate: meta.governorate, area: meta.area, hasConstraints }, "Technician registered with metadata");

        if (!hasConstraints) {
          logger.info("Technician registered with no routing constraints — no orders will be delivered");
          return;
        }

        if (!isAvailable) {
          logger.info("Technician registered as offline — pending orders will not be replayed");
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
    const clientId = wsToClientId.get(ws);
    if (clientId) {
      wsToClientId.delete(ws);
      const sockets = clientSessions.get(clientId);
      if (sockets) {
        sockets.delete(ws);
        if (sockets.size === 0) {
          clientSessions.delete(clientId);
        }
      }
      logger.info({ clientId, total: clients.size }, "Client WebSocket disconnected");
    } else {
      logger.info({ total: clients.size }, "WebSocket disconnected");
    }
  });

  ws.on("error", (err) => {
    logger.error({ err }, "WebSocket error");
    clients.delete(ws);
    const clientId = wsToClientId.get(ws);
    if (clientId) {
      wsToClientId.delete(ws);
      const sockets = clientSessions.get(clientId);
      if (sockets) {
        sockets.delete(ws);
        if (sockets.size === 0) {
          clientSessions.delete(clientId);
        }
      }
    }
  });
});

export function removeOrderFromPending(orderId: string): void {
  pendingOrders = pendingOrders.filter((o) => {
    const rec = o as Record<string, unknown>;
    return rec["id"] !== orderId;
  });
  logger.info({ orderId }, "Removed order from pending broadcast list");
}

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
    if (!meta.isAvailable) {
      skipped++;
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
      orderCategory: o["category"],
      orderGovernorate: o["governorate"],
      orderArea: o["area"],
    },
    "Routed new order to matching technicians"
  );
}

export function broadcastOrderStatusToClient(clientId: string, update: Record<string, unknown>): void {
  const sockets = clientSessions.get(clientId);
  if (!sockets || sockets.size === 0) {
    logger.info({ clientId }, "No connected client sessions for order status broadcast — client will see update on next fetch");
    return;
  }
  const payload = JSON.stringify({ type: "order_status_update", update });
  let sent = 0;
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
      sent++;
    }
  }
  logger.info({ clientId, orderId: update["id"], status: update["status"], sent }, "Broadcast order status update to client sessions");
}

export async function recoverPendingOrders(): Promise<void> {
  await warmLocationCache();
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
