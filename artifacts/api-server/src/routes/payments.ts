import { Router, type IRouter, type Request } from "express";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import {
  db,
  paymentRequestsTable,
  paymentAccountConfigTable,
  pointPackagesTable,
  walletsTable,
  walletTransactionsTable,
  usersTable,
} from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import { getOrCreateWallet } from "./wallet";

const router: IRouter = Router();

// ── GET /api/payment-config — public: show account details to clients ──────────
router.get("/payment-config", authMiddleware, async (_req, res) => {
  try {
    const [config] = await db
      .select()
      .from(paymentAccountConfigTable)
      .where(eq(paymentAccountConfigTable.isActive, true))
      .limit(1);
    res.json({ config: config ?? null });
  } catch (err) {
    logger.error({ err }, "Failed to fetch payment config");
    res.status(500).json({ error: "Failed to fetch payment config" });
  }
});

// ── POST /api/payments/request — technician submits a payment proof ────────────
router.post("/payments/request", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  if (user.role !== "technician") {
    res.status(403).json({ error: "Only technicians can request payments" });
    return;
  }
  const { packageId, amountEgp, pointsRequested, paymentMethod, referenceNumber, transferNote } =
    req.body as {
      packageId?: string;
      amountEgp?: number;
      pointsRequested?: number;
      paymentMethod?: string;
      referenceNumber?: string;
      transferNote?: string;
    };

  if (!amountEgp || !pointsRequested) {
    res.status(400).json({ error: "amountEgp and pointsRequested are required" });
    return;
  }
  const method = (["bank_transfer", "instapay", "e_wallet"].includes(paymentMethod ?? "")
    ? paymentMethod
    : "bank_transfer") as "bank_transfer" | "instapay" | "e_wallet";

  try {
    const [request] = await db
      .insert(paymentRequestsTable)
      .values({
        userId: user.id,
        packageId: packageId ?? null,
        amountEgp: String(amountEgp),
        pointsRequested,
        paymentMethod: method,
        referenceNumber: referenceNumber ?? null,
        transferNote: transferNote ?? null,
      })
      .returning();
    res.json({ request });
  } catch (err) {
    logger.error({ err }, "Failed to create payment request");
    res.status(500).json({ error: "Failed to create payment request" });
  }
});

// ── GET /api/payments/my-requests — technician views their own requests ────────
router.get("/payments/my-requests", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  if (user.role !== "technician") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const requests = await db
      .select()
      .from(paymentRequestsTable)
      .where(eq(paymentRequestsTable.userId, user.id))
      .orderBy(desc(paymentRequestsTable.createdAt))
      .limit(50);
    res.json({ requests });
  } catch (err) {
    logger.error({ err }, "Failed to fetch payment requests");
    res.status(500).json({ error: "Failed to fetch payment requests" });
  }
});

// ── GET /api/admin/payments — admin lists all payment requests ─────────────────
router.get("/admin/payments", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  if (user.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }

  const { status, from, to } = req.query as Record<string, string>;
  try {
    const rows = await db.execute(sql`
      SELECT
        pr.id,
        pr.amount_egp,
        pr.points_requested,
        pr.payment_method,
        pr.reference_number,
        pr.transfer_note,
        pr.status,
        pr.admin_notes,
        pr.confirmed_at,
        pr.created_at,
        pr.updated_at,
        u.id          AS user_id,
        u.first_name  AS user_first_name,
        u.last_name   AS user_last_name,
        u.mobile      AS user_mobile,
        pp.name_en    AS package_name_en,
        pp.name_ar    AS package_name_ar
      FROM payment_requests pr
      JOIN users u ON u.id = pr.user_id
      LEFT JOIN point_packages pp ON pp.id = pr.package_id
      WHERE (${status ? sql`pr.status = ${status}` : sql`1=1`})
        AND (${from ? sql`pr.created_at >= ${from}::date` : sql`1=1`})
        AND (${to ? sql`pr.created_at < (${to}::date + INTERVAL '1 day')` : sql`1=1`})
      ORDER BY
        CASE pr.status WHEN 'pending' THEN 0 ELSE 1 END,
        pr.created_at DESC
      LIMIT 200
    `);
    res.json({ requests: rows.rows });
  } catch (err) {
    logger.error({ err }, "Failed to fetch admin payments");
    res.status(500).json({ error: "Failed to fetch admin payments" });
  }
});

// ── PATCH /api/admin/payments/:id/confirm ─────────────────────────────────────
router.patch(
  "/admin/payments/:id/confirm",
  authMiddleware,
  requireAuth,
  async (req: Request<{ id: string }>, res) => {
    const user = req.user!;
    if (user.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
    const id = req.params.id;
    const { adminNotes } = req.body as { adminNotes?: string };

    try {
      const [existing] = await db
        .select()
        .from(paymentRequestsTable)
        .where(eq(paymentRequestsTable.id, id));

      if (!existing) { res.status(404).json({ error: "Payment request not found" }); return; }
      if (existing.status !== "pending") {
        res.status(409).json({ error: `Already ${existing.status}` });
        return;
      }

      // Credit wallet
      const wallet = await getOrCreateWallet(existing.userId);
      const newBalance = wallet.pointsBalance + existing.pointsRequested;
      await db
        .update(walletsTable)
        .set({ pointsBalance: newBalance, updatedAt: new Date() })
        .where(eq(walletsTable.id, wallet.id));

      const [tx] = await db
        .insert(walletTransactionsTable)
        .values({
          walletId: wallet.id,
          pointsAmount: existing.pointsRequested,
          type: "package_purchase",
          cashAmountPaid: existing.amountEgp,
          paymentStatus: "completed",
          description: `تحويل بنكي مؤكد — Confirmed transfer (ref: ${existing.referenceNumber ?? "—"})`,
        })
        .returning();

      // Mark request as confirmed
      const [updated] = await db
        .update(paymentRequestsTable)
        .set({
          status: "confirmed",
          adminId: user.id,
          adminNotes: adminNotes ?? null,
          confirmedAt: new Date(),
          walletTxId: tx!.id,
          updatedAt: new Date(),
        })
        .where(eq(paymentRequestsTable.id, id))
        .returning();

      res.json({ request: updated, newBalance });
    } catch (err) {
      logger.error({ err }, "Failed to confirm payment");
      res.status(500).json({ error: "Failed to confirm payment" });
    }
  }
);

// ── PATCH /api/admin/payments/:id/reject ──────────────────────────────────────
router.patch(
  "/admin/payments/:id/reject",
  authMiddleware,
  requireAuth,
  async (req: Request<{ id: string }>, res) => {
    const user = req.user!;
    if (user.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
    const id = req.params.id;
    const { adminNotes } = req.body as { adminNotes?: string };

    try {
      const [existing] = await db
        .select()
        .from(paymentRequestsTable)
        .where(eq(paymentRequestsTable.id, id));
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }
      if (existing.status !== "pending") {
        res.status(409).json({ error: `Already ${existing.status}` });
        return;
      }

      const [updated] = await db
        .update(paymentRequestsTable)
        .set({
          status: "rejected",
          adminId: user.id,
          adminNotes: adminNotes ?? null,
          updatedAt: new Date(),
        })
        .where(eq(paymentRequestsTable.id, id))
        .returning();

      res.json({ request: updated });
    } catch (err) {
      logger.error({ err }, "Failed to reject payment");
      res.status(500).json({ error: "Failed to reject payment" });
    }
  }
);

// ── GET /api/admin/accounting/points — points revenue report ──────────────────
router.get("/admin/accounting/points", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  if (user.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }

  const { from, to } = req.query as Record<string, string>;
  const fromDate = from ?? new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const toDate = to ?? new Date().toISOString().slice(0, 10);

  try {
    // Summary
    const summary = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE pr.status = 'confirmed')                           AS confirmed_count,
        COUNT(*) FILTER (WHERE pr.status = 'pending')                             AS pending_count,
        COUNT(*) FILTER (WHERE pr.status = 'rejected')                            AS rejected_count,
        COALESCE(SUM(pr.amount_egp) FILTER (WHERE pr.status = 'confirmed'), 0)    AS total_cash_egp,
        COALESCE(SUM(pr.points_requested) FILTER (WHERE pr.status = 'confirmed'), 0) AS total_points_issued
      FROM payment_requests pr
      WHERE pr.created_at >= ${fromDate}::date
        AND pr.created_at <  (${toDate}::date + INTERVAL '1 day')
    `);

    // Wallet transaction totals (gateway fees, purchase revenue)
    const txSummary = await db.execute(sql`
      SELECT
        COALESCE(SUM(wt.cash_amount_paid), 0)      AS total_cash_from_transactions,
        COALESCE(SUM(wt.gateway_fee_charged), 0)   AS total_gateway_fees,
        COALESCE(SUM(wt.points_amount) FILTER (WHERE wt.type = 'package_purchase'), 0)  AS pts_purchased,
        COALESCE(SUM(wt.points_amount) FILTER (WHERE wt.type = 'lead_unlock'), 0)       AS pts_unlocked,
        COALESCE(SUM(wt.points_amount) FILTER (WHERE wt.type = 'dispute_refund'), 0)    AS pts_refunded,
        COALESCE(SUM(wt.points_amount) FILTER (WHERE wt.type = 'welcome_bonus'), 0)     AS pts_bonus,
        COALESCE(SUM(wt.points_amount) FILTER (WHERE wt.type = 'admin_adjustment'), 0)  AS pts_adjusted
      FROM wallet_transactions wt
      WHERE wt.created_at >= ${fromDate}::date
        AND wt.created_at <  (${toDate}::date + INTERVAL '1 day')
    `);

    // Daily breakdown
    const daily = await db.execute(sql`
      SELECT
        DATE(pr.created_at)                                                         AS day,
        COUNT(*) FILTER (WHERE pr.status = 'confirmed')                             AS confirmed,
        COALESCE(SUM(pr.amount_egp) FILTER (WHERE pr.status = 'confirmed'), 0)      AS cash_egp,
        COALESCE(SUM(pr.points_requested) FILTER (WHERE pr.status = 'confirmed'), 0) AS points_issued
      FROM payment_requests pr
      WHERE pr.created_at >= ${fromDate}::date
        AND pr.created_at <  (${toDate}::date + INTERVAL '1 day')
      GROUP BY DATE(pr.created_at)
      ORDER BY day DESC
    `);

    // Payment method breakdown
    const byMethod = await db.execute(sql`
      SELECT
        pr.payment_method,
        COUNT(*)                                                          AS total_requests,
        COUNT(*) FILTER (WHERE pr.status = 'confirmed')                   AS confirmed,
        COALESCE(SUM(pr.amount_egp) FILTER (WHERE pr.status = 'confirmed'), 0) AS cash_egp
      FROM payment_requests pr
      WHERE pr.created_at >= ${fromDate}::date
        AND pr.created_at <  (${toDate}::date + INTERVAL '1 day')
      GROUP BY pr.payment_method
    `);

    res.json({
      period: { from: fromDate, to: toDate },
      summary: summary.rows[0],
      txSummary: txSummary.rows[0],
      daily: daily.rows,
      byMethod: byMethod.rows,
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch accounting report");
    res.status(500).json({ error: "Failed to fetch accounting report" });
  }
});

// ── GET/PUT /api/admin/payment-config — manage account details ─────────────────
router.get("/admin/payment-config", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  if (user.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const [config] = await db.select().from(paymentAccountConfigTable).limit(1);
    res.json({ config: config ?? null });
  } catch (err) {
    logger.error({ err }, "Failed to fetch payment config");
    res.status(500).json({ error: "Failed" });
  }
});

router.put("/admin/payment-config", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  if (user.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
  const { bankName, accountName, accountNumber, iban, instapayId, ewalletNumber, notes } =
    req.body as Record<string, string | undefined>;
  try {
    const [existing] = await db.select().from(paymentAccountConfigTable).limit(1);
    const updates = {
      bankName: bankName ?? null,
      accountName: accountName ?? null,
      accountNumber: accountNumber ?? null,
      iban: iban ?? null,
      instapayId: instapayId ?? null,
      ewalletNumber: ewalletNumber ?? null,
      notes: notes ?? null,
      updatedAt: new Date(),
    };
    if (existing) {
      const [updated] = await db
        .update(paymentAccountConfigTable)
        .set(updates)
        .where(eq(paymentAccountConfigTable.id, existing.id))
        .returning();
      res.json({ config: updated });
    } else {
      const [created] = await db.insert(paymentAccountConfigTable).values(updates).returning();
      res.json({ config: created });
    }
  } catch (err) {
    logger.error({ err }, "Failed to update payment config");
    res.status(500).json({ error: "Failed" });
  }
});

export default router;
