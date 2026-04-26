import http from "node:http";
import crypto from "node:crypto";
import app from "./app";
import { handleUpgrade, recoverPendingOrders } from "./lib/orderBroadcaster";
import { logger } from "./lib/logger";
import { db, adminsTable, serviceDomainsTable, pool } from "@workspace/db";
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

const DEFAULT_DOMAINS = [
  { nameEn: "Electricity", nameAr: "كهرباء", icon: "zap", specializations: [
    { nameEn: "Wiring & Circuits", nameAr: "أسلاك ودوائر كهربائية" },
    { nameEn: "Sockets & Switches", nameAr: "مقابس ومفاتيح" },
    { nameEn: "Lighting", nameAr: "إضاءة" },
    { nameEn: "Electrical Panel", nameAr: "لوحة كهربائية" },
  ]},
  { nameEn: "Plumbing", nameAr: "سباكة", icon: "droplet", specializations: [
    { nameEn: "Pipes & Leaks", nameAr: "مواسير وتسربات" },
    { nameEn: "Water Heaters", nameAr: "سخانات" },
    { nameEn: "Toilets & Sanitary", nameAr: "حمامات وصحي" },
    { nameEn: "Water Pumps", nameAr: "طلمبات مياه" },
  ]},
  { nameEn: "Air Conditioning", nameAr: "تكييف", icon: "wind", specializations: [
    { nameEn: "Installation", nameAr: "تركيب" },
    { nameEn: "Maintenance", nameAr: "صيانة" },
    { nameEn: "Gas Recharge", nameAr: "شحن غاز" },
    { nameEn: "Cleaning", nameAr: "تنظيف" },
  ]},
  { nameEn: "Carpentry", nameAr: "نجارة", icon: "tool", specializations: [
    { nameEn: "Doors & Windows", nameAr: "أبواب ونوافذ" },
    { nameEn: "Furniture Assembly", nameAr: "تجميع أثاث" },
    { nameEn: "Cabinets & Wardrobes", nameAr: "خزائن ودواليب" },
  ]},
  { nameEn: "Appliances", nameAr: "أجهزة منزلية", icon: "monitor", specializations: [
    { nameEn: "Washing Machines", nameAr: "غسالات" },
    { nameEn: "Refrigerators", nameAr: "ثلاجات" },
    { nameEn: "Ovens & Cookers", nameAr: "أفران وطباخات" },
    { nameEn: "Dishwashers", nameAr: "غسالات أطباق" },
  ]},
  { nameEn: "Painting", nameAr: "دهانات", icon: "pen-tool", specializations: [
    { nameEn: "Interior Walls", nameAr: "جدران داخلية" },
    { nameEn: "Exterior Walls", nameAr: "جدران خارجية" },
    { nameEn: "Waterproofing", nameAr: "عزل مائي" },
  ]},
  { nameEn: "Pest Control", nameAr: "مكافحة حشرات", icon: "shield", specializations: [
    { nameEn: "Cockroaches", nameAr: "صراصير" },
    { nameEn: "Rodents", nameAr: "قوارض" },
    { nameEn: "Bedbugs", nameAr: "بق الفراش" },
    { nameEn: "General Fumigation", nameAr: "تدخين عام" },
  ]},
  { nameEn: "Flooring", nameAr: "أرضيات", icon: "grid", specializations: [
    { nameEn: "Tiles", nameAr: "بلاط" },
    { nameEn: "Marble", nameAr: "رخام" },
    { nameEn: "Parquet", nameAr: "باركيه" },
    { nameEn: "Epoxy", nameAr: "إيبوكسي" },
  ]},
];

async function seedDefaultCategories(): Promise<void> {
  try {
    const existing = await db.select({ id: serviceDomainsTable.id }).from(serviceDomainsTable).limit(1);
    if (existing.length > 0) return;

    for (const domain of DEFAULT_DOMAINS) {
      const [inserted] = await db
        .insert(serviceDomainsTable)
        .values({ nameEn: domain.nameEn, nameAr: domain.nameAr, icon: domain.icon })
        .returning({ id: serviceDomainsTable.id });
      if (inserted) {
        for (const spec of domain.specializations) {
          await pool.query(
            `INSERT INTO service_specializations (domain_id, name_en, name_ar) VALUES ($1, $2, $3)`,
            [inserted.id, spec.nameEn, spec.nameAr]
          );
        }
      }
    }
    logger.info("DB seed: default service domains and specializations seeded");
  } catch (err) {
    logger.error({ err }, "DB seed failed for default categories");
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
      const updates: Record<string, unknown> = {};
      if (!existing.isSuperAdmin) updates.isSuperAdmin = true;
      if (!existing.mustChangePassword && existing.passwordHash && verifyPassword("admin", existing.passwordHash)) {
        updates.mustChangePassword = true;
        logger.info("Default admin still using default password — flagged mustChangePassword=true");
      }
      if (Object.keys(updates).length > 0) {
        await db.update(adminsTable).set(updates).where(eq(adminsTable.id, existing.id));
        logger.info({ updates }, "Default admin record updated");
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
      isSuperAdmin: true,
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

seedDefaultCategories()
  .then(() => seedDefaultAdmin())
  .catch((err) => {
    logger.error({ err }, "Startup seed failed — server will still start");
  })
  .finally(() => {
    server.listen(port, () => {
      logger.info({ port }, "Server listening");
      recoverPendingOrders().catch((err) => {
        logger.error({ err }, "Startup order recovery failed");
      });
    });
  });
