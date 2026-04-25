import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "node:http";
import { logger } from "./logger";
import { db, ordersTable, pool } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getSession } from "./auth";
import { locationsMatchSync, warmLocationCache } from "./locationNormalizer";

interface TechnicianMeta {
  registered: boolean;
  isAvailable: boolean;
  technicianId?: string;
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

const technicianSockets = new Map<string, Set<WebSocket>>();

const wsLastPong = new Map<WebSocket, number>();

let pendingOrders: unknown[] = [];

const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 60_000;
const BROADCAST_RADIUS_KM = parseInt(process.env.BROADCAST_RADIUS_KM ?? "50", 10) || 50;

setInterval(() => {
  const now = Date.now();
  for (const [ws] of clients) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    const lastPong = wsLastPong.get(ws) ?? now;
    if (now - lastPong > HEARTBEAT_TIMEOUT_MS) {
      logger.warn("WebSocket heartbeat timeout — terminating stale connection");
      ws.terminate();
      continue;
    }
    ws.send(JSON.stringify({ type: "ping" }));
  }
}, HEARTBEAT_INTERVAL_MS);

wss.on("connection", (ws: WebSocket) => {
  clients.set(ws, { registered: false, isAvailable: true });
  wsLastPong.set(ws, Date.now());
  logger.info({ total: clients.size }, "WebSocket connected");

  ws.send(JSON.stringify({ type: "connected", message: "Connected to Fanni order stream" }));

  ws.on("message", async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === "pong") {
        wsLastPong.set(ws, Date.now());
        return;
      }

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
        const meta: TechnicianMeta = { registered: true, isAvailable, technicianId: session.user.id };

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

        const techId = session.user.id;
        const techSet = technicianSockets.get(techId) ?? new Set<WebSocket>();
        techSet.add(ws);
        technicianSockets.set(techId, techSet);

        const hasConstraints = hasRoutingConstraints(meta);
        logger.info({ categories: meta.categories, governorate: meta.governorate, area: meta.area, hasConstraints }, "Technician registered with metadata");

        deliverPendingNotifications(session.user.id, ws).catch(() => {});

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
    const meta = clients.get(ws);
    clients.delete(ws);
    wsLastPong.delete(ws);
    if (meta?.technicianId) {
      const sockets = technicianSockets.get(meta.technicianId);
      if (sockets) {
        sockets.delete(ws);
        if (sockets.size === 0) technicianSockets.delete(meta.technicianId);
      }
    }
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
    const meta = clients.get(ws);
    clients.delete(ws);
    wsLastPong.delete(ws);
    if (meta?.technicianId) {
      const sockets = technicianSockets.get(meta.technicianId);
      if (sockets) {
        sockets.delete(ws);
        if (sockets.size === 0) technicianSockets.delete(meta.technicianId);
      }
    }
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

export function broadcastOrderCancelledToTechnicians(orderId: string): void {
  const payload = JSON.stringify({ type: "order_cancelled", orderId });
  let sent = 0;
  for (const [ws, meta] of clients) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    if (!meta.registered) continue;
    if (wsToClientId.has(ws)) continue;
    ws.send(payload);
    sent++;
  }
  logger.info({ orderId, sent }, "Broadcast order cancellation to connected technicians");
}

async function resolveOrderCoordinates(
  orderId: string | undefined,
  payloadLat: number,
  payloadLon: number,
): Promise<{ lat: number; lon: number } | null> {
  if (orderId) {
    try {
      const client = await pool.connect();
      try {
        const { rows } = await client.query<{ lat: number; lon: number }>(
          `SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lon
           FROM orders
           WHERE id = $1 AND location IS NOT NULL
           LIMIT 1`,
          [orderId],
        );
        if (rows.length > 0 && rows[0].lat != null && rows[0].lon != null) {
          return { lat: rows[0].lat, lon: rows[0].lon };
        }
      } finally {
        client.release();
      }
    } catch {
    }
  }
  const validPayload =
    !isNaN(payloadLat) && !isNaN(payloadLon) &&
    payloadLat >= -90 && payloadLat <= 90 &&
    payloadLon >= -180 && payloadLon <= 180;
  return validPayload ? { lat: payloadLat, lon: payloadLon } : null;
}

export async function broadcastNewOrder(order: unknown): Promise<void> {
  pendingOrders.push(order);

  const o = order as Record<string, unknown>;
  const payload = JSON.stringify({ type: "new_order", order });

  const payloadLat = parseFloat(String(o["latitude"] ?? ""));
  const payloadLon = parseFloat(String(o["longitude"] ?? ""));
  const orderId = typeof o["id"] === "string" ? o["id"] : undefined;

  const coords = await resolveOrderCoordinates(orderId, payloadLat, payloadLon);

  if (coords) {
    const { lat, lon } = coords;
    try {
      const radiusM = BROADCAST_RADIUS_KM * 1000;
      const client = await pool.connect();
      let spatialRows: Array<{ id: string; distance_m: number }> = [];
      try {
        const { rows } = await client.query<{ id: string; distance_m: number }>(
          `SELECT u.id,
                  ST_Distance(
                    u.location,
                    ST_SetSRID(ST_MakePoint($1,$2),4326)::geography
                  ) AS distance_m
           FROM users u
           WHERE u.role = 'technician'
             AND u.is_available = true
             AND u.location IS NOT NULL
             AND ST_DWithin(
               u.location,
               ST_SetSRID(ST_MakePoint($1,$2),4326)::geography,
               $3
             )
           ORDER BY distance_m ASC`,
          [lon, lat, radiusM],
        );
        spatialRows = rows;
      } finally {
        client.release();
      }

      if (spatialRows.length > 0) {
        const orderCategory = (o["category"] as string | undefined)?.toLowerCase();
        let sent = 0;
        let skipped = 0;

        for (const row of spatialRows) {
          const sockets = technicianSockets.get(row.id);
          if (!sockets) continue;

          for (const ws of sockets) {
            if (ws.readyState !== WebSocket.OPEN) continue;
            const meta = clients.get(ws);
            if (!meta?.registered || !meta.isAvailable) {
              skipped++;
              continue;
            }
            if (!hasRoutingConstraints(meta)) {
              skipped++;
              continue;
            }
            if (meta.categories && meta.categories.length > 0) {
              if (!orderCategory || !meta.categories.includes(orderCategory)) {
                skipped++;
                continue;
              }
            }
            ws.send(payload);
            sent++;
          }
        }

        logger.info(
          {
            connectedClients: clients.size,
            spatialCandidates: spatialRows.length,
            sent,
            skipped,
            lat,
            lon,
            radiusKm: radiusM / 1000,
            orderCategory: o["category"],
          },
          "Routed new order to nearest technicians (spatial)"
        );

        if (sent > 0) {
          return;
        }

        logger.info(
          { spatialCandidates: spatialRows.length, lat, lon },
          "Spatial candidates found but none were connected — falling back to text-based matching"
        );
      } else {
        logger.info({ lat, lon, radiusKm: BROADCAST_RADIUS_KM }, "No spatially-indexed technicians within radius — falling back to text-based matching");
      }
    } catch (err) {
      logger.warn({ err, lat, lon }, "Spatial technician lookup failed — falling back to text-based matching");
    }
  }

  let sent = 0;
  let skipped = 0;
  let unregistered = 0;
  let unconstrained = 0;

  for (const [ws, meta] of clients) {
    if (ws.readyState !== WebSocket.OPEN) continue;
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
      ws.send(payload);
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
    "Routed new order to matching technicians (text-based)"
  );
}

async function saveTechnicianNotification(technicianId: string, type: string, payload: Record<string, unknown>): Promise<string | null> {
  try {
    const client = await pool.connect();
    try {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO technician_notifications (technician_id, type, payload)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [technicianId, type, JSON.stringify(payload)],
      );
      return rows[0]?.id ?? null;
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error({ err, technicianId, type }, "Failed to persist technician notification");
    return null;
  }
}

async function markNotificationsDelivered(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE technician_notifications SET delivered_at = now() WHERE id = ANY($1)`,
        [ids],
      );
    } finally {
      client.release();
    }
  } catch (err) {
    logger.warn({ err, ids }, "Failed to mark technician notifications as delivered");
  }
}

async function deliverPendingNotifications(technicianId: string, ws: WebSocket): Promise<void> {
  try {
    const client = await pool.connect();
    let rows: Array<{ id: string; type: string; payload: unknown }> = [];
    try {
      const result = await client.query<{ id: string; type: string; payload: unknown }>(
        `SELECT id, type, payload FROM technician_notifications
         WHERE technician_id = $1 AND delivered_at IS NULL
         ORDER BY created_at ASC`,
        [technicianId],
      );
      rows = result.rows;
    } finally {
      client.release();
    }

    if (rows.length === 0) return;

    const delivered: string[] = [];
    for (const row of rows) {
      if (ws.readyState !== WebSocket.OPEN) break;
      const msg = JSON.stringify({ type: row.type, ...(row.payload as Record<string, unknown>) });
      ws.send(msg);
      delivered.push(row.id);
    }

    if (delivered.length > 0) {
      logger.info({ technicianId, count: delivered.length }, "Delivered pending notifications to technician on connect");
      await markNotificationsDelivered(delivered);
    }
  } catch (err) {
    logger.warn({ err, technicianId }, "Failed to deliver pending notifications on technician connect");
  }
}

export async function broadcastAvailabilityChangedToTechnician(technicianId: string, isAvailable: boolean): Promise<void> {
  const notificationPayload = { isAvailable };

  const notificationId = await saveTechnicianNotification(technicianId, "availability_changed_by_admin", notificationPayload);

  const sockets = technicianSockets.get(technicianId);
  if (!sockets || sockets.size === 0) {
    logger.info({ technicianId }, "Technician not connected — admin availability change notification persisted for next login");
    return;
  }
  const wirePayload = JSON.stringify({ type: "availability_changed_by_admin", isAvailable });
  let sent = 0;
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(wirePayload);
      sent++;
    }
  }

  if (sent > 0 && notificationId) {
    await markNotificationsDelivered([notificationId]);
  }

  logger.info({ technicianId, isAvailable, sent }, "Sent admin availability change notification to technician");
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
