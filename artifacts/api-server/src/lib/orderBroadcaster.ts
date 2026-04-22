import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "node:http";
import { logger } from "./logger";

const wss = new WebSocketServer({ noServer: true });

const clients = new Set<WebSocket>();

wss.on("connection", (ws: WebSocket) => {
  clients.add(ws);
  logger.info({ total: clients.size }, "Technician WebSocket connected");

  ws.on("close", () => {
    clients.delete(ws);
    logger.info({ total: clients.size }, "Technician WebSocket disconnected");
  });

  ws.on("error", (err) => {
    logger.error({ err }, "WebSocket error");
    clients.delete(ws);
  });

  ws.send(JSON.stringify({ type: "connected", message: "Connected to Fanni order stream" }));
});

export function broadcastNewOrder(order: unknown): void {
  const payload = JSON.stringify({ type: "new_order", order });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
  logger.info({ connectedClients: clients.size }, "Broadcasted new order to technicians");
}

export function handleUpgrade(req: IncomingMessage, socket: import("node:net").Socket, head: Buffer): void {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
}
