import http from "node:http";
import crypto from "node:crypto";
import app from "./app";
import { logger } from "./lib/logger";
import { handleUpgrade, recoverPendingOrders } from "./lib/orderBroadcaster";
import { startArrivalTimeoutWorker } from "./lib/orderLifecycle";
import { db, adminsTable, serviceDomainsTable, pool } from "@workspace/db";
import { eq } from "drizzle-orm";
import adminGeoRouter from "./routes/admin-geo";
app.use(adminGeoRouter);

pool.on("error", (err) => {
  logger.error({ err }, "Unexpected PostgreSQL pool error on idle client");
});

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

// ── Seed points demo data for technicians ─────────────────────────────────────
async function seedPointsDemo(): Promise<void> {
  try {
    // Ensure default packages exist
    const pkgCheck = await pool.query(`SELECT id FROM point_packages LIMIT 1`);
    if (pkgCheck.rows.length === 0) {
      await pool.query(`
        INSERT INTO point_packages (name_en, name_ar, points_amount, price_egp, original_price_egp, sort_order)
        VALUES
          ('Starter 100', 'باقة 100 جنيه', 120, 100.00, NULL, 1),
          ('Plus 250',    'باقة 250 جنيه', 300, 250.00, NULL, 2),
          ('Pro 500',     'باقة 500 جنيه', 600, 500.00, NULL, 3),
          ('Max 750',     'باقة 750 جنيه', 900, 750.00, NULL, 4),
          ('Elite 1000',  'باقة 1000 جنيه', 1200, 1000.00, NULL, 5)
        ON CONFLICT DO NOTHING
      `);
      logger.info("DB seed: default point packages seeded");
    }
    // Ensure default unlock cost exists
    const costCheck = await pool.query(
      `SELECT id FROM unlock_costs WHERE specialty_slug IS NULL AND category_slug IS NULL LIMIT 1`
    );
    if (costCheck.rows.length === 0) {
      await pool.query(`
        INSERT INTO unlock_costs (specialty_slug, category_slug, points_cost, label)
        VALUES (NULL, NULL, 20, 'Default unlock cost')
        ON CONFLICT DO NOTHING
      `);
      logger.info("DB seed: default unlock cost (20 pts) seeded");
    }
    // Ensure default payment account config exists
    const configCheck = await pool.query(`SELECT id FROM payment_account_config LIMIT 1`);
    if (configCheck.rows.length === 0) {
      await pool.query(`
        INSERT INTO payment_account_config (bank_name, account_name, account_number, instapay_id, notes)
        VALUES (
          'البنك الأهلي المصري',
          'شركة أنظمة ذكية وحلول رقمية متكاملة — UpNexa',
          '1234567890',
          'fanni@instapay',
          'يرجى كتابة رقم الهاتف المسجل في التطبيق كمرجع للتحويل'
        ) ON CONFLICT DO NOTHING
      `);
      logger.info("DB seed: default payment account config seeded");
    }
    // Seed welcome bonus wallets for all technicians (idempotent)
    const techs = await pool.query<{ id: string; first_name: string | null }>(
      `SELECT id, first_name FROM users WHERE role = 'technician' LIMIT 30`
    );
    for (const tech of techs.rows) {
      const walletRow = await pool.query<{ id: string; points_balance: number }>(
        `SELECT id, points_balance FROM wallets WHERE user_id = $1`, [tech.id]
      );
      let walletId: string;
      if (walletRow.rows[0]) {
        walletId = walletRow.rows[0].id;
      } else {
        const created = await pool.query<{ id: string }>(
          `INSERT INTO wallets (user_id, points_balance) VALUES ($1, 0)
           ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
           RETURNING id`, [tech.id]
        );
        walletId = created.rows[0]!.id;
      }
      const alreadySeeded = await pool.query(
        `SELECT id FROM wallet_transactions WHERE wallet_id = $1 AND type = 'welcome_bonus' LIMIT 1`, [walletId]
      );
      if (alreadySeeded.rows.length === 0) {
        await pool.query(
          `INSERT INTO wallet_transactions (wallet_id, points_amount, type, description) VALUES ($1, 60, 'welcome_bonus', 'مكافأة ترحيبية — Welcome bonus')`,
          [walletId]
        );
        await pool.query(
          `UPDATE wallets SET points_balance = points_balance + 60, promotional_balance = promotional_balance + 60, updated_at = NOW() WHERE id = $1`, [walletId]
        );
        logger.info({ techId: tech.id }, "DB seed: welcome bonus added to technician wallet");
      }
    }
  } catch (err) {
    logger.error({ err }, "Points demo seed failed (non-fatal)");
  }
}

seedDefaultCategories()
  .then(() => seedDefaultAdmin())
  .then(() => seedPointsDemo())
  .catch((err) => {
    logger.error({ err }, "Startup seed failed — server will still start");
  })
  .finally(() => {
    server.listen(port, () => {
      logger.info({ port }, "Server listening");
      startArrivalTimeoutWorker();
      recoverPendingOrders().catch((err) => {
        logger.error({ err }, "Startup order recovery failed");
      });
    });
  });
