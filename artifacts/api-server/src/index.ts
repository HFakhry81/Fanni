import http from "node:http";
import app from "./app";
import { handleUpgrade, recoverPendingOrders } from "./lib/orderBroadcaster";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);

server.on("upgrade", (req, socket, head) => {
  if (req.url === "/api/ws") {
    handleUpgrade(req, socket as import("node:net").Socket, head);
  } else {
    socket.destroy();
  }
});

server.listen(port, () => {
  logger.info({ port }, "Server listening");
  recoverPendingOrders().catch((err) => {
    logger.error({ err }, "Startup order recovery failed");
  });
});
