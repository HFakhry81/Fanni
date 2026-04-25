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

async function runMigrations(): Promise<void> {
  try {
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_type') THEN CREATE TYPE invoice_type AS ENUM ('technician', 'client', 'admin'); END IF; END $$`);
    logger.info("DB migration: invoice_type enum ensured");
  } catch (err) {
    logger.error({ err }, "DB migration failed for invoice_type enum");
  }
  try {
    await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type invoice_type`);
    await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS materials_photos JSONB`);
    await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ocr_line_items JSONB`);
    await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ocr_materials_total NUMERIC(10,2)`);
    await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS labour_fee NUMERIC(10,2)`);
    await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS transport_fee NUMERIC(10,2)`);
    await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS service_fee_rate NUMERIC(5,2) DEFAULT 15`);
    await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS service_fee_amount NUMERIC(10,2)`);
    await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2) DEFAULT 14`);
    await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(10,2)`);
    await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS net_total NUMERIC(10,2)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_invoices_type" ON invoices (invoice_type)`);
    logger.info("DB migration: invoices three-party columns ensured");
  } catch (err) {
    logger.error({ err }, "DB migration failed for invoices three-party columns");
  }
  try {
    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(500)`
    );
    logger.info("DB migration: users.address ensured");
  } catch (err) {
    logger.error({ err }, "DB migration failed for users.address");
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS service_domains (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name_en VARCHAR(100) NOT NULL,
        name_ar VARCHAR(100) NOT NULL,
        icon VARCHAR(50),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    logger.info("DB migration: service_domains table ensured");
  } catch (err) {
    logger.error({ err }, "DB migration failed for service_domains");
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS service_specializations (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        domain_id VARCHAR NOT NULL REFERENCES service_domains(id) ON DELETE CASCADE,
        name_en VARCHAR(100) NOT NULL,
        name_ar VARCHAR(100) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS service_specializations_domain_id_idx
      ON service_specializations (domain_id)
    `);
    logger.info("DB migration: service_specializations table ensured");
  } catch (err) {
    logger.error({ err }, "DB migration failed for service_specializations");
  }
  try {
    await pool.query(`ALTER TABLE service_domains ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE service_specializations ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0`);
    logger.info("DB migration: sort_order columns on service tables ensured");
  } catch (err) {
    logger.error({ err }, "DB migration failed for sort_order columns");
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS technician_notifications (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        technician_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(100) NOT NULL,
        payload JSONB NOT NULL,
        delivered_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS technician_notifications_technician_id_idx
      ON technician_notifications (technician_id)
      WHERE delivered_at IS NULL
    `);
    logger.info("DB migration: technician_notifications table ensured");
  } catch (err) {
    logger.error({ err }, "DB migration failed for technician_notifications");
  }
  await seedDefaultCategories();
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
