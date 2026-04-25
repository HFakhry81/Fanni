import http from "node:http";
import crypto from "node:crypto";
import app from "./app";
import { handleUpgrade, recoverPendingOrders } from "./lib/orderBroadcaster";
import { logger } from "./lib/logger";
import { db, adminsTable, pool } from "@workspace/db";
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

async function runMigrations(): Promise<void> {
  try {
    await pool.query(
      `ALTER TABLE admins ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false`
    );
    logger.info("DB migration: admins.must_change_password ensured");
  } catch (err) {
    logger.error({ err }, "DB migration failed for admins.must_change_password");
  }
  try {
    await pool.query(
      `ALTER TABLE admins ADD COLUMN IF NOT EXISTS profile_image_url VARCHAR`
    );
    logger.info("DB migration: admins.profile_image_url ensured");
  } catch (err) {
    logger.error({ err }, "DB migration failed for admins.profile_image_url");
  }
  try {
    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(500)`
    );
    logger.info("DB migration: users.address ensured");
  } catch (err) {
    logger.error({ err }, "DB migration failed for users.address");
  }
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const candidate = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(hash, "hex"));
}

async function seedDefaultAdmin(): Promise<void> {
  try {
    const [existing] = await db
      .select()
      .from(adminsTable)
      .where(eq(adminsTable.email, "admin@fanni.app"));

    if (existing) {
      if (!existing.mustChangePassword && existing.passwordHash && verifyPassword("admin", existing.passwordHash)) {
        await db
          .update(adminsTable)
          .set({ mustChangePassword: true })
          .where(eq(adminsTable.id, existing.id));
        logger.info("Default admin still using default password — flagged mustChangePassword=true");
      } else {
        logger.info("Default admin already exists in admins table, skipping seed");
      }
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
      mustChangePassword: true,
    });

    logger.info("Default admin seeded in admins table (email: admin@fanni.app, mobile: admin)");
  } catch (err) {
    logger.error({ err }, "Failed to seed default admin user");
  }
}

const server = http.createServer(app);

// WebSocket endpoint (/api/ws): connections are accepted but not trusted until the
// "register" message is received with a valid session token. Unauthenticated or
// invalid-token register attempts receive an auth_error message and are closed.
server.on("upgrade", (req, socket, head) => {
  if (req.url === "/api/ws") {
    handleUpgrade(req, socket as import("node:net").Socket, head);
  } else {
    socket.destroy();
  }
});

runMigrations()
  .then(() => seedDefaultAdmin())
  .catch((err) => {
    logger.error({ err }, "Startup migration/seed failed — server will still start");
  })
  .finally(() => {
    server.listen(port, () => {
      logger.info({ port }, "Server listening");
      recoverPendingOrders().catch((err) => {
        logger.error({ err }, "Startup order recovery failed");
      });
    });
  });
