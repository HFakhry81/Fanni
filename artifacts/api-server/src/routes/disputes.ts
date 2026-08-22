import { Router, type IRouter, type Request } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, disputesTable, leadUnlocksTable, walletsTable, walletTransactionsTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAuth } from "../middlewares/requireAuth";
import { requireAdmin, requirePermission } from "../middlewares/requireAdmin";
import { logger } from "../lib/logger";
import { getOrCreateWallet } from "./wallet";
import { refundToBuckets } from "../lib/walletBuckets";

const router: IRouter = Router();

// Technician: submit a dispute for a lead unlock
router.post("/disputes", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  if (user.role !== "technician") {
    res.status(403).json({ error: "Only technicians can submit disputes" });
    return;
  }
  const { leadUnlockId, reason } = req.body as { leadUnlockId?: string; reason?: string };
  if (!leadUnlockId || !reason?.trim()) {
    res.status(400).json({ error: "leadUnlockId and reason are required" });
    return;
  }
  try {
    const [unlock] = await db.select().from(leadUnlocksTable).where(eq(leadUnlocksTable.id, leadUnlockId));
    if (!unlock || unlock.technicianId !== user.id) {
      res.status(404).json({ error: "Lead unlock not found or not yours" });
      return;
    }
    const [existing] = await db.select().from(disputesTable).where(eq(disputesTable.leadUnlockId, leadUnlockId));
    if (existing) {
      res.status(409).json({ error: "A dispute already exists for this unlock", dispute: existing });
      return;
    }
    const [dispute] = await db.insert(disputesTable).values({
      leadUnlockId,
      technicianId: user.id,
      orderId: unlock.orderId,
      reason: reason.trim(),
    }).returning();
    res.status(201).json({ dispute });
  } catch (err) {
    logger.error({ err }, "Failed to create dispute");
    res.status(500).json({ error: "Failed to create dispute" });
  }
});

// Technician: list own disputes
router.get("/disputes", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  if (user.role !== "technician") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const disputes = await db.select().from(disputesTable).where(eq(disputesTable.technicianId, user.id)).orderBy(desc(disputesTable.createdAt));
    res.json({ disputes });
  } catch (err) {
    logger.error({ err }, "Failed to list disputes");
    res.status(500).json({ error: "Failed to list disputes" });
  }
});

// Admin: list all disputes
router.get("/admin/disputes", authMiddleware, requireAuth, requireAdmin, async (_req, res) => {
  try {
    const rows = await db.execute<{
      id: string; lead_unlock_id: string; technician_id: string; order_id: string;
      reason: string; status: string; admin_notes: string | null; points_refunded: boolean;
      resolved_at: string | null; created_at: string;
      tech_first_name: string | null; tech_last_name: string | null; tech_mobile: string | null;
      points_deducted: number; clicked_call: boolean; clicked_whatsapp: boolean; unlocked_at: string;
    }>(`
      SELECT d.*, u.first_name AS tech_first_name, u.last_name AS tech_last_name, u.mobile AS tech_mobile,
             lu.points_deducted, lu.clicked_call, lu.clicked_whatsapp, lu.unlocked_at
      FROM disputes d
      JOIN users u ON u.id = d.technician_id
      JOIN lead_unlocks lu ON lu.id = d.lead_unlock_id
      ORDER BY d.created_at DESC
    `);
    res.json({ disputes: rows.rows });
  } catch (err) {
    logger.error({ err }, "Failed to list admin disputes");
    res.status(500).json({ error: "Failed to list disputes" });
  }
});

// Admin: resolve a dispute (approve = refund points / reject)
router.patch("/admin/disputes/:id", authMiddleware, requireAuth, requireAdmin, requirePermission("manage_disputes"), async (req: Request<{ id: string }>, res) => {
  const id = req.params.id;
  const { action, adminNotes } = req.body as { action?: "approve" | "reject"; adminNotes?: string };
  if (action !== "approve" && action !== "reject") {
    res.status(400).json({ error: "action must be 'approve' or 'reject'" });
    return;
  }
  try {
    const result = await db.transaction(async (tx) => {
      const disputeRows = await tx.execute(sql`SELECT * FROM disputes WHERE id = ${id} FOR UPDATE`);
      const dispute = disputeRows.rows[0] as typeof disputesTable.$inferSelect | undefined;
      if (!dispute) return { kind: "not_found" as const };
      if (dispute.status === "approved" || dispute.status === "rejected") {
        return { kind: "resolved" as const };
      }

      if (action === "approve" && !dispute.pointsRefunded) {
        const unlockRows = await tx.execute(sql`SELECT * FROM lead_unlocks WHERE id = ${dispute.leadUnlockId} FOR UPDATE`);
        const unlock = unlockRows.rows[0] as typeof leadUnlocksTable.$inferSelect | undefined;
        if (!unlock) throw new Error("LEAD_UNLOCK_NOT_FOUND");

        const walletRows = await tx.execute(sql`SELECT * FROM wallets WHERE user_id = ${dispute.technicianId} FOR UPDATE`);
        const wallet = walletRows.rows[0] as typeof walletsTable.$inferSelect | undefined;
        if (!wallet) throw new Error("WALLET_NOT_FOUND");

        const unlockRow = unlock as typeof unlock & {
          promotional_points_used?: number;
          purchased_points_used?: number;
          points_deducted?: number;
        };
        const walletRow = wallet as typeof wallet & {
          points_balance?: number;
          promotional_balance?: number;
          purchased_balance?: number;
        };
        const promoUsedRaw = Number(unlockRow.promotionalPointsUsed ?? unlockRow.promotional_points_used ?? 0);
        const purchasedUsedRaw = Number(unlockRow.purchasedPointsUsed ?? unlockRow.purchased_points_used ?? 0);
        const deducted = Number(unlockRow.pointsDeducted ?? unlockRow.points_deducted ?? 0);
        const recorded = promoUsedRaw + purchasedUsedRaw;
        const promoUsed = recorded > 0 ? promoUsedRaw : 0;
        const purchasedUsed = recorded > 0 ? purchasedUsedRaw : deducted;
        const restored = refundToBuckets({
          pointsBalance: Number(walletRow.pointsBalance ?? walletRow.points_balance ?? 0),
          promotionalBalance: Number(walletRow.promotionalBalance ?? walletRow.promotional_balance ?? 0),
          purchasedBalance: Number(walletRow.purchasedBalance ?? walletRow.purchased_balance ?? 0),
        }, promoUsed, purchasedUsed);
        await tx.update(walletsTable)
          .set({
            pointsBalance: restored.pointsBalance,
            promotionalBalance: restored.promotionalBalance,
            purchasedBalance: restored.purchasedBalance,
            updatedAt: new Date(),
          })
          .where(eq(walletsTable.id, wallet.id));
        await tx.insert(walletTransactionsTable).values({
          walletId: wallet.id,
          pointsAmount: unlock.pointsDeducted,
          type: "dispute_refund",
          description: `Dispute refund for order ${dispute.orderId}`,
          orderId: dispute.orderId,
          paymentStatus: "completed",
        });
      }

      const [updated] = await tx.update(disputesTable)
        .set({
          status: action === "approve" ? "approved" : "rejected",
          pointsRefunded: action === "approve",
          adminNotes: adminNotes?.trim() || null,
          resolvedAt: new Date(),
        })
        .where(eq(disputesTable.id, id!))
        .returning();
      return { kind: "updated" as const, dispute: updated };
    });

    if (result.kind === "not_found") { res.status(404).json({ error: "Dispute not found" }); return; }
    if (result.kind === "resolved") { res.status(409).json({ error: "Dispute already resolved" }); return; }
    res.json({ dispute: result.dispute });
  } catch (err) {
    logger.error({ err }, "Failed to resolve dispute");
    res.status(500).json({ error: "Failed to resolve dispute" });
  }
});

export default router;
