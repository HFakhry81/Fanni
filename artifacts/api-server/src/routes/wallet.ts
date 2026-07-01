import { Router, type IRouter, type Request } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db, walletsTable, walletTransactionsTable, pointPackagesTable, leadUnlocksTable, unlockCostsTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function getOrCreateWallet(userId: string) {
  const [existing] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
  if (existing) return existing;
  const [created] = await db.insert(walletsTable).values({ userId }).returning();
  return created!;
}

router.get("/wallet", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  if (user.role !== "technician") {
    res.status(403).json({ error: "Only technicians have a wallet" });
    return;
  }
  try {
    const wallet = await getOrCreateWallet(user.id);
    const transactions = await db
      .select()
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.walletId, wallet.id))
      .orderBy(desc(walletTransactionsTable.createdAt))
      .limit(50);
    res.json({ wallet, transactions });
  } catch (err) {
    logger.error({ err }, "Failed to fetch wallet");
    res.status(500).json({ error: "Failed to fetch wallet" });
  }
});

router.get("/wallet/packages", authMiddleware, async (_req, res) => {
  try {
    const packages = await db
      .select()
      .from(pointPackagesTable)
      .where(eq(pointPackagesTable.isActive, true))
      .orderBy(pointPackagesTable.sortOrder);
    res.json({ packages });
  } catch (err) {
    logger.error({ err }, "Failed to fetch packages");
    res.status(500).json({ error: "Failed to fetch packages" });
  }
});

router.get("/wallet/unlock-cost", authMiddleware, async (req, res) => {
  try {
    const categorySlug = typeof req.query.category === "string" ? req.query.category : null;
    const specialtySlug = typeof req.query.specialty === "string" ? req.query.specialty : null;
    let cost = 15;
    if (specialtySlug) {
      const [row] = await db.select().from(unlockCostsTable).where(eq(unlockCostsTable.specialtySlug, specialtySlug));
      if (row) { cost = row.pointsCost; res.json({ cost }); return; }
    }
    if (categorySlug) {
      const [row] = await db.select().from(unlockCostsTable).where(eq(unlockCostsTable.categorySlug, categorySlug));
      if (row) { cost = row.pointsCost; res.json({ cost }); return; }
    }
    const [def] = await db.select().from(unlockCostsTable).where(and(sql`specialty_slug IS NULL`, sql`category_slug IS NULL`));
    cost = def?.pointsCost ?? 15;
    res.json({ cost });
  } catch (err) {
    logger.error({ err }, "Failed to fetch unlock cost");
    res.status(500).json({ error: "Failed to fetch unlock cost" });
  }
});

// Admin: get all wallets with balances (for points liability)
router.get("/admin/wallet-stats", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  if (user.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const rows = await db.execute(sql`
      SELECT w.id, w.user_id, w.points_balance, u.first_name, u.last_name, u.mobile
      FROM wallets w
      JOIN users u ON u.id = w.user_id
      ORDER BY w.points_balance DESC
    `);
    const totalLiability = (rows.rows as Array<{ points_balance: number }>).reduce((sum, r) => sum + (r.points_balance ?? 0), 0);
    res.json({ wallets: rows.rows, totalLiabilityPoints: totalLiability });
  } catch (err) {
    logger.error({ err }, "Failed to fetch wallet stats");
    res.status(500).json({ error: "Failed to fetch wallet stats" });
  }
});

// Admin: manual adjustment
router.post("/admin/wallet/adjust", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  if (user.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
  const { technicianId, pointsAmount, description } = req.body as { technicianId?: string; pointsAmount?: number; description?: string };
  if (!technicianId || typeof pointsAmount !== "number") {
    res.status(400).json({ error: "technicianId and pointsAmount required" });
    return;
  }
  try {
    const wallet = await getOrCreateWallet(technicianId);
    const newBalance = wallet.pointsBalance + pointsAmount;
    if (newBalance < 0) { res.status(400).json({ error: "Balance would go negative" }); return; }
    await db.update(walletsTable).set({ pointsBalance: newBalance, updatedAt: new Date() }).where(eq(walletsTable.id, wallet.id));
    await db.insert(walletTransactionsTable).values({
      walletId: wallet.id,
      pointsAmount,
      type: "admin_adjustment",
      description: description ?? `Admin adjustment by ${user.id}`,
    });
    res.json({ success: true, newBalance });
  } catch (err) {
    logger.error({ err }, "Failed to adjust wallet");
    res.status(500).json({ error: "Failed to adjust wallet" });
  }
});

// Admin: manage point packages
router.get("/admin/point-packages", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  if (user.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const packages = await db.select().from(pointPackagesTable).orderBy(pointPackagesTable.sortOrder);
    res.json({ packages });
  } catch (err) {
    logger.error({ err }, "Failed to fetch packages");
    res.status(500).json({ error: "Failed to fetch packages" });
  }
});

router.post("/admin/point-packages", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  if (user.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
  const { nameEn, nameAr, pointsAmount, priceEgp, originalPriceEgp } = req.body as { nameEn?: string; nameAr?: string; pointsAmount?: number; priceEgp?: number; originalPriceEgp?: number };
  if (!nameEn || !nameAr || !pointsAmount || !priceEgp) {
    res.status(400).json({ error: "nameEn, nameAr, pointsAmount, priceEgp required" });
    return;
  }
  try {
    const [pkg] = await db.insert(pointPackagesTable).values({
      nameEn, nameAr,
      pointsAmount,
      priceEgp: String(priceEgp),
      originalPriceEgp: originalPriceEgp ? String(originalPriceEgp) : null,
    }).returning();
    res.json({ package: pkg });
  } catch (err) {
    logger.error({ err }, "Failed to create package");
    res.status(500).json({ error: "Failed to create package" });
  }
});

router.patch("/admin/point-packages/:id", authMiddleware, requireAuth, async (req: Request<{ id: string }>, res) => {
  const user = req.user!;
  if (user.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
  const id = req.params.id;
  const { nameEn, nameAr, pointsAmount, priceEgp, originalPriceEgp, isActive, sortOrder } = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  if (nameEn !== undefined) updates.nameEn = nameEn;
  if (nameAr !== undefined) updates.nameAr = nameAr;
  if (pointsAmount !== undefined) updates.pointsAmount = pointsAmount;
  if (priceEgp !== undefined) updates.priceEgp = String(priceEgp);
  if (originalPriceEgp !== undefined) updates.originalPriceEgp = originalPriceEgp ? String(originalPriceEgp) : null;
  if (isActive !== undefined) updates.isActive = isActive;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  try {
    const [pkg] = await db.update(pointPackagesTable).set(updates).where(eq(pointPackagesTable.id, id!)).returning();
    if (!pkg) { res.status(404).json({ error: "Package not found" }); return; }
    res.json({ package: pkg });
  } catch (err) {
    logger.error({ err }, "Failed to update package");
    res.status(500).json({ error: "Failed to update package" });
  }
});

router.delete("/admin/point-packages/:id", authMiddleware, requireAuth, async (req: Request<{ id: string }>, res) => {
  const user = req.user!;
  if (user.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    await db.update(pointPackagesTable).set({ isActive: false }).where(eq(pointPackagesTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to delete package");
    res.status(500).json({ error: "Failed to delete package" });
  }
});

// Admin: unlock costs management
router.get("/admin/unlock-costs", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  if (user.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const costs = await db.select().from(unlockCostsTable);
    res.json({ costs });
  } catch (err) {
    logger.error({ err }, "Failed to fetch unlock costs");
    res.status(500).json({ error: "Failed to fetch unlock costs" });
  }
});

router.post("/admin/unlock-costs", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  if (user.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
  const { specialtySlug, categorySlug, pointsCost, label } = req.body as { specialtySlug?: string; categorySlug?: string; pointsCost?: number; label?: string };
  if (typeof pointsCost !== "number") { res.status(400).json({ error: "pointsCost required" }); return; }
  try {
    const [row] = await db.insert(unlockCostsTable).values({ specialtySlug: specialtySlug ?? null, categorySlug: categorySlug ?? null, pointsCost, label: label ?? null }).returning();
    res.json({ cost: row });
  } catch (err) {
    logger.error({ err }, "Failed to create unlock cost");
    res.status(500).json({ error: "Failed to create unlock cost" });
  }
});

router.patch("/admin/unlock-costs/:id", authMiddleware, requireAuth, async (req: Request<{ id: string }>, res) => {
  const user = req.user!;
  if (user.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
  const { pointsCost, label } = req.body as { pointsCost?: number; label?: string };
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof pointsCost === "number") updates.pointsCost = pointsCost;
  if (label !== undefined) updates.label = label;
  try {
    const [row] = await db.update(unlockCostsTable).set(updates).where(eq(unlockCostsTable.id, req.params.id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ cost: row });
  } catch (err) {
    logger.error({ err }, "Failed to update unlock cost");
    res.status(500).json({ error: "Failed to update unlock cost" });
  }
});

export { getOrCreateWallet };
export default router;
