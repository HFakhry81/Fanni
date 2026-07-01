import { Router, type IRouter, type Request } from "express";
import { eq, desc } from "drizzle-orm";
import { db, disputesTable, leadUnlocksTable, walletsTable, walletTransactionsTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import { getOrCreateWallet } from "./wallet";

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
router.get("/admin/disputes", authMiddleware, requireAuth, async (req, res) => {
  const user = req.user!;
  if (user.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
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
router.patch("/admin/disputes/:id", authMiddleware, requireAuth, async (req: Request<{ id: string }>, res) => {
  const user = req.user!;
  if (user.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
  const id = req.params.id;
  const { action, adminNotes } = req.body as { action?: "approve" | "reject"; adminNotes?: string };
  if (action !== "approve" && action !== "reject") {
    res.status(400).json({ error: "action must be 'approve' or 'reject'" });
    return;
  }
  try {
    const [dispute] = await db.select().from(disputesTable).where(eq(disputesTable.id, id!));
    if (!dispute) { res.status(404).json({ error: "Dispute not found" }); return; }
    if (dispute.status === "approved" || dispute.status === "rejected") {
      res.status(409).json({ error: "Dispute already resolved" }); return;
    }
    if (action === "approve") {
      const [unlock] = await db.select().from(leadUnlocksTable).where(eq(leadUnlocksTable.id, dispute.leadUnlockId));
      if (unlock && !dispute.pointsRefunded) {
        const wallet = await getOrCreateWallet(dispute.technicianId);
        const newBalance = wallet.pointsBalance + unlock.pointsDeducted;
        await db.update(walletsTable).set({ pointsBalance: newBalance, updatedAt: new Date() }).where(eq(walletsTable.id, wallet.id));
        await db.insert(walletTransactionsTable).values({
          walletId: wallet.id,
          pointsAmount: unlock.pointsDeducted,
          type: "dispute_refund",
          description: `Dispute refund for order ${dispute.orderId}`,
          orderId: dispute.orderId,
        });
      }
      await db.update(disputesTable).set({
        status: "approved",
        pointsRefunded: true,
        adminNotes: adminNotes ?? null,
        resolvedAt: new Date(),
      }).where(eq(disputesTable.id, id!));
    } else {
      await db.update(disputesTable).set({
        status: "rejected",
        adminNotes: adminNotes ?? null,
        resolvedAt: new Date(),
      }).where(eq(disputesTable.id, id!));
    }
    const [updated] = await db.select().from(disputesTable).where(eq(disputesTable.id, id!));
    res.json({ dispute: updated });
  } catch (err) {
    logger.error({ err }, "Failed to resolve dispute");
    res.status(500).json({ error: "Failed to resolve dispute" });
  }
});

export default router;
