import { and, desc, eq } from "drizzle-orm";
import {
  db,
  usersTable,
  walletsTable,
  walletBonusGrantsTable,
  walletTransactionsTable,
} from "@workspace/db";
import { creditPromotional } from "./walletBuckets";
import { createNotification } from "../routes/notifications";

export type BonusGrantRow = typeof walletBonusGrantsTable.$inferSelect;

async function getOrCreateWalletInTx(
  tx: Pick<typeof db, "select" | "insert">,
  userId: string,
) {
  const [existing] = await tx.select().from(walletsTable).where(eq(walletsTable.userId, userId));
  if (existing) return existing;
  const [created] = await tx.insert(walletsTable).values({ userId }).returning();
  return created!;
}

export async function createBonusGrant(opts: {
  technicianId: string;
  adminId: string;
  pointsAmount: number;
  message: string;
}): Promise<BonusGrantRow> {
  const { technicianId, adminId, pointsAmount, message } = opts;
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    throw new Error("Message is required");
  }
  if (!Number.isFinite(pointsAmount) || pointsAmount < 1) {
    throw new Error("pointsAmount must be a positive integer");
  }

  const [tech] = await db
    .select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, technicianId))
    .limit(1);
  if (!tech || tech.role !== "technician") {
    throw new Error("Technician not found");
  }

  const [grant] = await db
    .insert(walletBonusGrantsTable)
    .values({
      technicianId,
      adminId,
      pointsAmount: Math.round(pointsAmount),
      message: trimmedMessage.slice(0, 2000),
      status: "pending_ack",
    })
    .returning();

  await createNotification({
    userId: technicianId,
    type: "bonus_grant_pending",
    titleAr: "🎁 مكافأة نقاط من الإدارة",
    titleEn: "🎁 Bonus points from admin",
    bodyAr: `لديك ${Math.round(pointsAmount)} نقطة مكافأة. اضغط «استلام» لتأكيد الإضافة لمحفظتك.\n\n${trimmedMessage}`,
    bodyEn: `You have ${Math.round(pointsAmount)} bonus points. Tap «Receive» to credit your wallet.\n\n${trimmedMessage}`,
    payload: {
      grantId: grant!.id,
      pointsAmount: Math.round(pointsAmount),
      message: trimmedMessage,
      adminId,
    },
  });

  return grant!;
}

export async function listBonusGrantsForAdmin(adminId: string, limit = 50): Promise<BonusGrantRow[]> {
  return db
    .select()
    .from(walletBonusGrantsTable)
    .where(eq(walletBonusGrantsTable.adminId, adminId))
    .orderBy(desc(walletBonusGrantsTable.createdAt))
    .limit(limit);
}

export async function listPendingBonusGrantsForTechnician(technicianId: string): Promise<BonusGrantRow[]> {
  return db
    .select()
    .from(walletBonusGrantsTable)
    .where(
      and(
        eq(walletBonusGrantsTable.technicianId, technicianId),
        eq(walletBonusGrantsTable.status, "pending_ack"),
      ),
    )
    .orderBy(desc(walletBonusGrantsTable.createdAt));
}

export async function acknowledgeBonusGrant(
  technicianId: string,
  grantId: string,
): Promise<{ grant: BonusGrantRow; newBalance: number }> {
  return db.transaction(async (tx) => {
    const [grant] = await tx
      .select()
      .from(walletBonusGrantsTable)
      .where(
        and(
          eq(walletBonusGrantsTable.id, grantId),
          eq(walletBonusGrantsTable.technicianId, technicianId),
          eq(walletBonusGrantsTable.status, "pending_ack"),
        ),
      )
      .limit(1);

    if (!grant) {
      throw new Error("Bonus grant not found or already processed");
    }

    const wallet = await getOrCreateWalletInTx(tx, technicianId);
    const buckets = {
      pointsBalance: wallet.pointsBalance,
      promotionalBalance: wallet.promotionalBalance ?? 0,
      purchasedBalance: wallet.purchasedBalance ?? 0,
    };
    const next = creditPromotional(buckets, grant.pointsAmount);

    await tx
      .update(walletsTable)
      .set({
        pointsBalance: next.pointsBalance,
        promotionalBalance: next.promotionalBalance,
        purchasedBalance: next.purchasedBalance,
        updatedAt: new Date(),
      })
      .where(eq(walletsTable.id, wallet.id));

    const [walletTx] = await tx
      .insert(walletTransactionsTable)
      .values({
        walletId: wallet.id,
        pointsAmount: grant.pointsAmount,
        type: "bonus_grant",
        description: grant.message,
      })
      .returning();

    const now = new Date();
    const [updated] = await tx
      .update(walletBonusGrantsTable)
      .set({
        status: "credited",
        techAcknowledgedAt: now,
        creditedAt: now,
        walletTxId: walletTx!.id,
      })
      .where(eq(walletBonusGrantsTable.id, grantId))
      .returning();

    const [tech] = await tx
      .select({ firstName: usersTable.firstName, lastName: usersTable.lastName, mobile: usersTable.mobile })
      .from(usersTable)
      .where(eq(usersTable.id, technicianId))
      .limit(1);
    const techLabel = [tech?.firstName, tech?.lastName].filter(Boolean).join(" ") || tech?.mobile || technicianId;

    await createNotification({
      userId: grant.adminId,
      type: "bonus_grant_acknowledged",
      titleAr: "✅ تم استلام المكافأة",
      titleEn: "✅ Bonus received",
      bodyAr: `الفني ${techLabel} استلم ${grant.pointsAmount} نقطة مكافأة.\n\nالرسالة: ${grant.message}`,
      bodyEn: `Technician ${techLabel} received ${grant.pointsAmount} bonus points.\n\nMessage: ${grant.message}`,
      payload: {
        grantId: grant.id,
        technicianId,
        pointsAmount: grant.pointsAmount,
        message: grant.message,
      },
    });

    return { grant: updated!, newBalance: next.pointsBalance };
  });
}
