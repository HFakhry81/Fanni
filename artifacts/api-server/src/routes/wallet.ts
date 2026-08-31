import { Router, type IRouter, type Request } from "express";
import { eq, desc } from "drizzle-orm";
import { db, walletsTable, walletTransactionsTable, pointPackagesTable, unlockCostsTable, operationalExpensesTable, leadPricingRulesTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin, requirePermission } from "../middlewares/requireAdmin";
import { logger } from "../lib/logger";
import { resolveLeadCost } from "../lib/leadPricing";
import { listAdminAuditLogs, logAdminAudit } from "../lib/adminAudit";
import { creditPurchased, debitPromoFirst } from "../lib/walletBuckets";
import { getTrialBalance, listJournals, postOperatingExpense } from "../lib/generalLedger";
import {
  acknowledgeBonusGrant,
  createBonusGrant,
  listBonusGrantsForAdmin,
  listPendingBonusGrantsForTechnician,
} from "../lib/bonusGrants";
import {
  listAdminWalletStats,
  sumPendingBonusForTechnician,
  toWalletSummaryView,
} from "../lib/walletSummary";

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
    const pendingBonusPoints = await sumPendingBonusForTechnician(user.id);
    const summary = toWalletSummaryView(wallet, pendingBonusPoints);
    const transactions = await db
      .select()
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.walletId, wallet.id))
      .orderBy(desc(walletTransactionsTable.createdAt))
      .limit(50);
    res.json({ wallet: { ...wallet, ...summary }, summary, transactions });
  } catch (err) {
    logger.error({ err }, "Failed to fetch wallet");
    res.status(500).json({ error: "Failed to fetch wallet" });
  }
});

/** Lightweight balance refresh for mobile screens after credits/debits. */
router.get("/wallet/summary", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  if (user.role !== "technician") {
    res.status(403).json({ error: "Only technicians have a wallet" });
    return;
  }
  try {
    const wallet = await getOrCreateWallet(user.id);
    const pendingBonusPoints = await sumPendingBonusForTechnician(user.id);
    res.json({ summary: toWalletSummaryView(wallet, pendingBonusPoints) });
  } catch (err) {
    logger.error({ err }, "Failed to fetch wallet summary");
    res.status(500).json({ error: "Failed to fetch wallet summary" });
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
    const cost = await resolveLeadCost({ category: categorySlug, specialty: specialtySlug });
    res.json({ cost });
  } catch (err) {
    logger.error({ err }, "Failed to fetch unlock cost");
    res.status(500).json({ error: "Failed to fetch unlock cost" });
  }
});

// Admin: get all wallets with balances (for points liability)
router.get("/admin/wallet-stats", authMiddleware, requireAuth, requireAdmin, requirePermission("view_reports"), async (_req, res) => {
  try {
    const stats = await listAdminWalletStats();
    res.json(stats);
  } catch (err) {
    logger.error({ err }, "Failed to fetch wallet stats");
    res.status(500).json({ error: "Failed to fetch wallet stats" });
  }
});

// Admin: manual adjustment
router.post("/admin/wallet/adjust", authMiddleware, requireAuth, requireAdmin, requirePermission("manage_wallet"), async (req, res) => {
  const user = req.user!;
  const { technicianId, pointsAmount, description } = req.body as { technicianId?: string; pointsAmount?: number; description?: string };
  if (!technicianId || typeof pointsAmount !== "number") {
    res.status(400).json({ error: "technicianId and pointsAmount required" });
    return;
  }
  try {
    const wallet = await getOrCreateWallet(technicianId);
    const buckets = {
      pointsBalance: wallet.pointsBalance,
      promotionalBalance: wallet.promotionalBalance ?? 0,
      purchasedBalance: wallet.purchasedBalance ?? 0,
    };
    const next = pointsAmount >= 0
      ? creditPurchased(buckets, pointsAmount)
      : debitPromoFirst(buckets, -pointsAmount);
    if (next.pointsBalance < 0) { res.status(400).json({ error: "Balance would go negative" }); return; }
    await db.update(walletsTable).set({
      pointsBalance: next.pointsBalance,
      promotionalBalance: next.promotionalBalance,
      purchasedBalance: next.purchasedBalance,
      updatedAt: new Date(),
    }).where(eq(walletsTable.id, wallet.id));
    await db.insert(walletTransactionsTable).values({
      walletId: wallet.id,
      pointsAmount,
      type: "admin_adjustment",
      description: description ?? `Admin adjustment by ${user.id}`,
    });
    await logAdminAudit(req, {
      action: "wallet_adjust",
      targetType: "wallet",
      targetId: wallet.id,
      previousStatus: String(wallet.pointsBalance),
      newStatus: String(next.pointsBalance),
      reason: description ?? null,
      metadata: {
        technicianId,
        pointsAmount,
        before: buckets,
        after: next,
      },
    });
    res.json({ success: true, newBalance: next.pointsBalance });
  } catch (err) {
    logger.error({ err }, "Failed to adjust wallet");
    res.status(500).json({ error: "Failed to adjust wallet" });
  }
});

/** Super Admin: send a promotional bonus grant — credited after technician acknowledges. */
router.post(
  "/admin/wallet/bonus-grant",
  authMiddleware,
  requireAuth,
  requireAdmin,
  requirePermission("manage_wallet"),
  async (req, res) => {
    const user = req.user!;
    const { technicianId, pointsAmount, message } = req.body as {
      technicianId?: string;
      pointsAmount?: number;
      message?: string;
    };
    if (!technicianId || typeof pointsAmount !== "number" || !message?.trim()) {
      res.status(400).json({ error: "technicianId, pointsAmount, and message are required" });
      return;
    }
    try {
      const grant = await createBonusGrant({
        technicianId,
        adminId: user.id,
        pointsAmount,
        message: message.trim(),
      });
      await logAdminAudit(req, {
        action: "bonus_grant_send",
        targetType: "wallet_bonus_grant",
        targetId: grant.id,
        newStatus: "pending_ack",
        reason: message.trim(),
        metadata: {
          technicianId,
          pointsAmount: Math.round(pointsAmount),
          message: message.trim(),
        },
      });
      res.status(201).json({
        ok: true,
        grant,
        message: "Bonus sent — awaiting technician confirmation",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create bonus grant";
      logger.error({ err }, "Failed to create bonus grant");
      res.status(400).json({ error: msg });
    }
  },
);

router.get(
  "/admin/wallet/bonus-grants",
  authMiddleware,
  requireAuth,
  requireAdmin,
  requirePermission("manage_wallet"),
  async (req, res) => {
    const user = req.user!;
    try {
      const grants = await listBonusGrantsForAdmin(user.id);
      res.json({ grants });
    } catch (err) {
      logger.error({ err }, "Failed to list bonus grants");
      res.status(500).json({ error: "Failed to list bonus grants" });
    }
  },
);

router.get("/wallet/bonus-grants/pending", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  if (user.role !== "technician") {
    res.status(403).json({ error: "Only technicians can view bonus grants" });
    return;
  }
  try {
    const grants = await listPendingBonusGrantsForTechnician(user.id);
    res.json({ grants });
  } catch (err) {
    logger.error({ err }, "Failed to list pending bonus grants");
    res.status(500).json({ error: "Failed to list pending bonus grants" });
  }
});

router.post(
  "/wallet/bonus-grants/:id/acknowledge",
  authMiddleware,
  requireAuth,
  async (req: Request<{ id: string }>, res) => {
    const user = req.user!;
    if (user.role !== "technician") {
      res.status(403).json({ error: "Only technicians can acknowledge bonus grants" });
      return;
    }
    try {
      const result = await acknowledgeBonusGrant(user.id, req.params.id);
      res.json({
        ok: true,
        grant: result.grant,
        newBalance: result.newBalance,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to acknowledge bonus";
      logger.error({ err, grantId: req.params.id }, "Failed to acknowledge bonus grant");
      res.status(400).json({ error: msg });
    }
  },
);

// Admin: manage point packages
router.get("/admin/point-packages", authMiddleware, requireAuth, requireAdmin, async (_req, res) => {
  try {
    const packages = await db.select().from(pointPackagesTable).orderBy(pointPackagesTable.sortOrder);
    res.json({ packages });
  } catch (err) {
    logger.error({ err }, "Failed to fetch packages");
    res.status(500).json({ error: "Failed to fetch packages" });
  }
});

router.post("/admin/point-packages", authMiddleware, requireAuth, requireAdmin, requirePermission("manage_wallet"), async (req, res) => {
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
    await logAdminAudit(req, {
      action: "package_create",
      targetType: "point_package",
      targetId: pkg!.id,
      newStatus: "active",
      metadata: { after: pkg },
    });
    res.json({ package: pkg });
  } catch (err) {
    logger.error({ err }, "Failed to create package");
    res.status(500).json({ error: "Failed to create package" });
  }
});

router.patch("/admin/point-packages/:id", authMiddleware, requireAuth, requireAdmin, requirePermission("manage_wallet"), async (req: Request<{ id: string }>, res) => {
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
    const [before] = await db.select().from(pointPackagesTable).where(eq(pointPackagesTable.id, id!));
    const [pkg] = await db.update(pointPackagesTable).set(updates).where(eq(pointPackagesTable.id, id!)).returning();
    if (!pkg) { res.status(404).json({ error: "Package not found" }); return; }
    await logAdminAudit(req, {
      action: "package_update",
      targetType: "point_package",
      targetId: pkg.id,
      previousStatus: before?.isActive ? "active" : "inactive",
      newStatus: pkg.isActive ? "active" : "inactive",
      metadata: { before, after: pkg },
    });
    res.json({ package: pkg });
  } catch (err) {
    logger.error({ err }, "Failed to update package");
    res.status(500).json({ error: "Failed to update package" });
  }
});

router.delete("/admin/point-packages/:id", authMiddleware, requireAuth, requireAdmin, requirePermission("manage_wallet"), async (req: Request<{ id: string }>, res) => {
  try {
    await db.update(pointPackagesTable).set({ isActive: false }).where(eq(pointPackagesTable.id, req.params.id));
    await logAdminAudit(req, {
      action: "package_deactivate",
      targetType: "point_package",
      targetId: req.params.id,
      previousStatus: "active",
      newStatus: "inactive",
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to delete package");
    res.status(500).json({ error: "Failed to delete package" });
  }
});

// Admin: unlock costs management
router.get("/admin/unlock-costs", authMiddleware, requireAuth, requireAdmin, async (_req, res) => {
  try {
    const costs = await db.select().from(unlockCostsTable);
    res.json({ costs });
  } catch (err) {
    logger.error({ err }, "Failed to fetch unlock costs");
    res.status(500).json({ error: "Failed to fetch unlock costs" });
  }
});

router.post("/admin/unlock-costs", authMiddleware, requireAuth, requireAdmin, requirePermission("manage_pricing"), async (req, res) => {
  const { specialtySlug, categorySlug, pointsCost, label } = req.body as { specialtySlug?: string; categorySlug?: string; pointsCost?: number; label?: string };
  if (typeof pointsCost !== "number") { res.status(400).json({ error: "pointsCost required" }); return; }
  try {
    const [row] = await db.insert(unlockCostsTable).values({ specialtySlug: specialtySlug ?? null, categorySlug: categorySlug ?? null, pointsCost, label: label ?? null }).returning();
    await logAdminAudit(req, {
      action: "unlock_cost_create",
      targetType: "unlock_cost",
      targetId: row!.id,
      newStatus: String(pointsCost),
      metadata: { after: row },
    });
    res.json({ cost: row });
  } catch (err) {
    logger.error({ err }, "Failed to create unlock cost");
    res.status(500).json({ error: "Failed to create unlock cost" });
  }
});

router.get("/admin/lead-pricing-rules", authMiddleware, requireAuth, requireAdmin, async (_req, res) => {
  try {
    const rules = await db.select().from(leadPricingRulesTable).orderBy(desc(leadPricingRulesTable.priority), desc(leadPricingRulesTable.createdAt));
    res.json({ rules, defaultCost: 20 });
  } catch (err) {
    logger.error({ err }, "Failed to fetch lead pricing rules");
    res.status(500).json({ error: "Failed to fetch lead pricing rules" });
  }
});

router.post("/admin/lead-pricing-rules", authMiddleware, requireAuth, requireAdmin, requirePermission("manage_pricing"), async (req, res) => {
  const body = req.body as {
    serviceCategory?: string | null;
    serviceSpecialization?: string | null;
    dayOfWeek?: number | null;
    startTime?: string | null;
    endTime?: string | null;
    pointsCost?: number;
    isActive?: boolean;
    priority?: number;
    description?: string | null;
  };
  if (typeof body.pointsCost !== "number" || !Number.isFinite(body.pointsCost) || body.pointsCost < 1) {
    res.status(400).json({ error: "pointsCost must be a positive number" });
    return;
  }
  if (body.dayOfWeek != null && (body.dayOfWeek < 0 || body.dayOfWeek > 6)) {
    res.status(400).json({ error: "dayOfWeek must be 0-6 or null" });
    return;
  }
  try {
    const [rule] = await db.insert(leadPricingRulesTable).values({
      serviceCategory: body.serviceCategory?.trim() || null,
      serviceSpecialization: body.serviceSpecialization?.trim() || null,
      dayOfWeek: body.dayOfWeek ?? null,
      startTime: body.startTime?.trim() || null,
      endTime: body.endTime?.trim() || null,
      pointsCost: Math.round(body.pointsCost),
      isActive: body.isActive !== false,
      priority: typeof body.priority === "number" ? Math.round(body.priority) : 0,
      description: body.description?.trim() || null,
    }).returning();
    await logAdminAudit(req, {
      action: "lead_pricing_create",
      targetType: "lead_pricing_rule",
      targetId: rule!.id,
      newStatus: String(rule!.pointsCost),
      metadata: { after: rule },
    });
    res.status(201).json({ rule });
  } catch (err) {
    logger.error({ err }, "Failed to create lead pricing rule");
    res.status(500).json({ error: "Failed to create lead pricing rule" });
  }
});

router.patch("/admin/lead-pricing-rules/:id", authMiddleware, requireAuth, requireAdmin, requirePermission("manage_pricing"), async (req: Request<{ id: string }>, res) => {
  const body = req.body as {
    serviceCategory?: string | null;
    serviceSpecialization?: string | null;
    dayOfWeek?: number | null;
    startTime?: string | null;
    endTime?: string | null;
    pointsCost?: number;
    isActive?: boolean;
    priority?: number;
    description?: string | null;
  };
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.serviceCategory !== undefined) updates.serviceCategory = body.serviceCategory?.trim() || null;
  if (body.serviceSpecialization !== undefined) updates.serviceSpecialization = body.serviceSpecialization?.trim() || null;
  if (body.dayOfWeek !== undefined) updates.dayOfWeek = body.dayOfWeek;
  if (body.startTime !== undefined) updates.startTime = body.startTime?.trim() || null;
  if (body.endTime !== undefined) updates.endTime = body.endTime?.trim() || null;
  if (typeof body.pointsCost === "number" && body.pointsCost >= 1) updates.pointsCost = Math.round(body.pointsCost);
  if (typeof body.isActive === "boolean") updates.isActive = body.isActive;
  if (typeof body.priority === "number") updates.priority = Math.round(body.priority);
  if (body.description !== undefined) updates.description = body.description?.trim() || null;
  try {
    const [before] = await db.select().from(leadPricingRulesTable).where(eq(leadPricingRulesTable.id, req.params.id));
    const [rule] = await db.update(leadPricingRulesTable).set(updates).where(eq(leadPricingRulesTable.id, req.params.id)).returning();
    if (!rule) { res.status(404).json({ error: "Not found" }); return; }
    await logAdminAudit(req, {
      action: "lead_pricing_update",
      targetType: "lead_pricing_rule",
      targetId: rule.id,
      previousStatus: before ? String(before.pointsCost) : null,
      newStatus: String(rule.pointsCost),
      metadata: { before, after: rule },
    });
    res.json({ rule });
  } catch (err) {
    logger.error({ err }, "Failed to update lead pricing rule");
    res.status(500).json({ error: "Failed to update lead pricing rule" });
  }
});

router.patch("/admin/unlock-costs/:id", authMiddleware, requireAuth, requireAdmin, requirePermission("manage_pricing"), async (req: Request<{ id: string }>, res) => {
  const { pointsCost, label } = req.body as { pointsCost?: number; label?: string };
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof pointsCost === "number") updates.pointsCost = pointsCost;
  if (label !== undefined) updates.label = label;
  try {
    const [before] = await db.select().from(unlockCostsTable).where(eq(unlockCostsTable.id, req.params.id));
    const [row] = await db.update(unlockCostsTable).set(updates).where(eq(unlockCostsTable.id, req.params.id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    await logAdminAudit(req, {
      action: "unlock_cost_update",
      targetType: "unlock_cost",
      targetId: row.id,
      previousStatus: before ? String(before.pointsCost) : null,
      newStatus: String(row.pointsCost),
      metadata: { before, after: row },
    });
    res.json({ cost: row });
  } catch (err) {
    logger.error({ err }, "Failed to update unlock cost");
    res.status(500).json({ error: "Failed to update unlock cost" });
  }
});

router.get("/admin/operational-expenses", authMiddleware, requireAuth, requireAdmin, requirePermission("view_reports"), async (_req, res) => {
  try {
    const expenses = await db.select().from(operationalExpensesTable).orderBy(desc(operationalExpensesTable.createdAt));
    res.json({ expenses });
  } catch (err) {
    logger.error({ err }, "Failed to fetch operational expenses");
    res.status(500).json({ error: "Failed to fetch operational expenses" });
  }
});

router.post("/admin/operational-expenses", authMiddleware, requireAuth, requireAdmin, requirePermission("manage_expenses"), async (req, res) => {
  const { category, provider, amountEgp, invoiceUrl, notes } = req.body as {
    category?: string; provider?: string; amountEgp?: number; invoiceUrl?: string; notes?: string;
  };
  const validCategories = ["hosting", "sms_otp", "maps_api", "marketing", "payment_gateway", "salaries", "other"] as const;
  if (!category || !validCategories.includes(category as typeof validCategories[number]) || !provider?.trim() || typeof amountEgp !== "number" || amountEgp < 0) {
    res.status(400).json({ error: "category, provider, and a non-negative amountEgp are required" });
    return;
  }
  try {
    const expense = await db.transaction(async (tx) => {
      const [row] = await tx.insert(operationalExpensesTable).values({
        category: category as typeof validCategories[number],
        provider: provider.trim().slice(0, 100),
        amountEgp: amountEgp.toFixed(2),
        invoiceUrl: invoiceUrl?.trim() || null,
        notes: notes?.trim() || null,
      }).returning();
      await postOperatingExpense(row!.id, amountEgp, `${category} / ${provider}`, tx);
      return row;
    });
    await logAdminAudit(req, {
      action: "expense_create",
      targetType: "operational_expense",
      targetId: expense!.id,
      newStatus: String(amountEgp),
      reason: notes ?? null,
      metadata: { after: expense },
    });
    res.status(201).json({ expense });
  } catch (err) {
    logger.error({ err }, "Failed to create operational expense");
    res.status(500).json({ error: "Failed to create operational expense" });
  }
});

router.get("/admin/gl/trial-balance", authMiddleware, requireAuth, requireAdmin, requirePermission("view_reports"), async (_req, res) => {
  try {
    const trial = await getTrialBalance();
    res.json(trial);
  } catch (err) {
    logger.error({ err }, "Failed to load trial balance");
    res.status(500).json({ error: "Failed to load trial balance" });
  }
});

router.get("/admin/gl/journals", authMiddleware, requireAuth, requireAdmin, requirePermission("view_reports"), async (req, res) => {
  try {
    const raw = typeof req.query.limit === "string" ? Number(req.query.limit) : 50;
    const { journals } = await listJournals(raw);
    res.json({ journals });
  } catch (err) {
    logger.error({ err }, "Failed to list GL journals");
    res.status(500).json({ error: "Failed to list journals" });
  }
});

router.get("/admin/audit-logs", authMiddleware, requireAuth, requireAdmin, requirePermission("view_reports"), async (req, res) => {
  try {
    const targetType = typeof req.query.targetType === "string" ? req.query.targetType : undefined;
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : 100;
    const logs = await listAdminAuditLogs({ targetType, limit });
    res.json({ logs });
  } catch (err) {
    logger.error({ err }, "Failed to list admin audit logs");
    res.status(500).json({ error: "Failed to list audit logs" });
  }
});

export { getOrCreateWallet };
export default router;
