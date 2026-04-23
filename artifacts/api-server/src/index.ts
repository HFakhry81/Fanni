import http from "node:http";
import crypto from "node:crypto";
import app from "./app";
import { handleUpgrade, recoverPendingOrders } from "./lib/orderBroadcaster";
import { logger } from "./lib/logger";
import { db, adminsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
}

function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

async function seedDefaultAdmin(): Promise<void> {
  try {
    const [existing] = await db
      .select({ id: adminsTable.id })
      .from(adminsTable)
      .where(eq(adminsTable.email, "admin@fanni.app"));

    if (existing) {
      logger.info("Default admin already exists in admins table, skipping seed");
      return;
    }

    const salt = generateSalt();
    const hash = hashPassword("admin", salt);
    const passwordHash = `${salt}:${hash}`;

    await db.insert(adminsTable).values({
      email: "admin@fanni.app",
      mobile: "admin",
      firstName: "Admin",
      lastName: null,
      passwordHash,
    });

    logger.info("Default admin seeded in admins table (email: admin@fanni.app, mobile: admin)");
  } catch (err) {
    logger.error({ err }, "Failed to seed default admin user");
  }
}

const server = http.createServer(app);

// PUBLIC WebSocket endpoint (/api/ws): intentionally allows unauthenticated connections.
// Technician clients connect here to receive new-order broadcasts. Authentication is
// handled at the application layer via the "register" message sent after connection.
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
  seedDefaultAdmin().catch((err) => {
    logger.error({ err }, "Startup admin seed failed");
  });
});
