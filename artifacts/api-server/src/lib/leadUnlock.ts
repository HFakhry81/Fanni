import { and, eq, sql } from "drizzle-orm";
import { db, leadUnlocksTable, ordersTable, walletsTable, walletTransactionsTable } from "@workspace/db";
import { resolveLeadCost } from "./leadPricing";
import { debitPromoFirst, refundToBuckets } from "./walletBuckets";
import { postLeadUnlock, postPointRefund } from "./generalLedger";

export type OrderContact = {
  clientName: unknown;
  clientMobile: unknown;
  street: unknown;
  building: unknown;
  floor: unknown;
  apartment: unknown;
  landmark: unknown;
  latitude: unknown;
  longitude: unknown;
};

export function contactFromOrderData(data: Record<string, unknown>): OrderContact {
  return {
    clientName: data.clientName ?? null,
    clientMobile: data.clientMobile ?? null,
    street: data.street ?? null,
    building: data.building ?? null,
    floor: data.floor ?? null,
    apartment: data.apartment ?? null,
    landmark: data.landmark ?? null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
  };
}

export function maskSensitiveOrderFields<T extends Record<string, unknown>>(order: T): T {
  return {
    ...order,
    clientName: null,
    clientMobile: null,
    street: null,
    building: null,
    floor: null,
    apartment: null,
    landmark: null,
    latitude: null,
    longitude: null,
  };
}

export class InsufficientPointsError extends Error {
  balance: number;
  required: number;
  constructor(balance: number, required: number) {
    super("Insufficient points");
    this.name = "InsufficientPointsError";
    this.balance = balance;
    this.required = required;
  }
}

export async function unlockLeadAtomically(opts: {
  technicianId: string;
  orderId: string;
  category?: string | null;
  specialty?: string | null;
  assign?: {
    technicianName?: string;
    technicianMobile?: string;
    technicianAvatar?: string;
    technicianRating?: number;
  };
}): Promise<{
  alreadyUnlocked: boolean;
  unlock: typeof leadUnlocksTable.$inferSelect;
  newBalance: number;
  costPoints: number;
  contact: OrderContact;
  assigned: boolean;
}> {
  const costPoints = await resolveLeadCost({
    category: opts.category,
    specialty: opts.specialty,
  });

  return db.transaction(async (tx) => {
    const lockedOrder = await tx.execute(sql`
      SELECT id, status, data FROM orders WHERE id = ${opts.orderId} FOR UPDATE
    `);
    const orderRow = lockedOrder.rows[0] as { id: string; status: string; data: Record<string, unknown> } | undefined;
    if (!orderRow) throw new Error("ORDER_NOT_FOUND");
    if (orderRow.status !== "pending") throw new Error("ORDER_UNAVAILABLE");

    const [existing] = await tx
      .select()
      .from(leadUnlocksTable)
      .where(and(eq(leadUnlocksTable.technicianId, opts.technicianId), eq(leadUnlocksTable.orderId, opts.orderId)));

    const data = (orderRow.data ?? {}) as Record<string, unknown>;
    const contact = contactFromOrderData(data);

    const assignOrder = async () => {
      if (!opts.assign) return false;
      const dataPatch: Record<string, unknown> = {
        status: "en_route",
        technicianId: opts.technicianId,
      };
      if (opts.assign.technicianName !== undefined) dataPatch.technicianName = opts.assign.technicianName;
      if (opts.assign.technicianMobile !== undefined) dataPatch.technicianMobile = opts.assign.technicianMobile;
      if (opts.assign.technicianAvatar !== undefined) dataPatch.technicianAvatar = opts.assign.technicianAvatar;
      if (opts.assign.technicianRating !== undefined) dataPatch.technicianRating = opts.assign.technicianRating;
      const rows = await tx
        .update(ordersTable)
        .set({
          status: "en_route",
          technicianId: opts.technicianId,
          acknowledgedAt: new Date(),
          updatedAt: new Date(),
          data: sql`${ordersTable.data} || ${JSON.stringify(dataPatch)}::jsonb`,
        })
        .where(and(eq(ordersTable.id, opts.orderId), eq(ordersTable.status, "pending")))
        .returning({ id: ordersTable.id });
      if (rows.length === 0) throw new Error("ORDER_UNAVAILABLE");
      return true;
    };

    if (existing) {
      const [wallet] = await tx.select().from(walletsTable).where(eq(walletsTable.userId, opts.technicianId));
      const assigned = await assignOrder();
      return {
        alreadyUnlocked: true,
        unlock: existing,
        newBalance: wallet?.pointsBalance ?? 0,
        costPoints: existing.pointsDeducted,
        contact,
        assigned,
      };
    }

    let [wallet] = await tx.select().from(walletsTable).where(eq(walletsTable.userId, opts.technicianId));
    if (!wallet) {
      const [created] = await tx.insert(walletsTable).values({ userId: opts.technicianId }).returning();
      wallet = created!;
    }

    await tx.execute(sql`SELECT id FROM wallets WHERE id = ${wallet.id} FOR UPDATE`);
    const [freshWallet] = await tx.select().from(walletsTable).where(eq(walletsTable.id, wallet.id));
    const balance = freshWallet?.pointsBalance ?? 0;
    if (balance < costPoints) {
      throw new InsufficientPointsError(balance, costPoints);
    }

    const split = debitPromoFirst({
      pointsBalance: balance,
      promotionalBalance: freshWallet?.promotionalBalance ?? 0,
      purchasedBalance: freshWallet?.purchasedBalance ?? 0,
    }, costPoints);
    await tx.update(walletsTable).set({
      pointsBalance: split.pointsBalance,
      promotionalBalance: split.promotionalBalance,
      purchasedBalance: split.purchasedBalance,
      updatedAt: new Date(),
    }).where(eq(walletsTable.id, wallet.id));

    const [unlock] = await tx.insert(leadUnlocksTable).values({
      technicianId: opts.technicianId,
      orderId: opts.orderId,
      pointsDeducted: costPoints,
      promotionalPointsUsed: split.promotionalUsed,
      purchasedPointsUsed: split.purchasedUsed,
      balanceBefore: balance,
      balanceAfter: split.pointsBalance,
    }).returning();

    await tx.insert(walletTransactionsTable).values({
      walletId: wallet.id,
      pointsAmount: -costPoints,
      type: "lead_unlock",
      description: `Customer Data Access — order ${opts.orderId}`,
      orderId: opts.orderId,
      paymentStatus: "completed",
    });
    await postLeadUnlock(unlock!.id, split.promotionalUsed, split.purchasedUsed, tx);

    const assigned = await assignOrder();
    return {
      alreadyUnlocked: false,
      unlock: unlock!,
      newBalance: split.pointsBalance,
      costPoints,
      contact,
      assigned,
    };
  });
}

/**
 * Refund a client-cancelled lead only when the technician has not used either
 * contact action and the unlock happened within the policy window.
 */
export async function refundEligibleUnlocksForCancelledOrder(orderId: string): Promise<number> {
  return db.transaction(async (tx) => {
    const unlocks = await tx
      .select()
      .from(leadUnlocksTable)
      .where(and(
        eq(leadUnlocksTable.orderId, orderId),
        eq(leadUnlocksTable.refundStatus, "none"),
        eq(leadUnlocksTable.clickedCall, false),
        eq(leadUnlocksTable.clickedWhatsapp, false),
        sql`unlocked_at >= NOW() - INTERVAL '3 minutes'`,
      ));

    let refunded = 0;
    for (const unlock of unlocks) {
      const [wallet] = await tx.select().from(walletsTable).where(eq(walletsTable.userId, unlock.technicianId));
      if (!wallet) continue;

      const [marked] = await tx
        .update(leadUnlocksTable)
        .set({ refundStatus: "refunded" })
        .where(and(eq(leadUnlocksTable.id, unlock.id), eq(leadUnlocksTable.refundStatus, "none")))
        .returning({ id: leadUnlocksTable.id });
      if (!marked) continue;

      const recorded = (unlock.promotionalPointsUsed ?? 0) + (unlock.purchasedPointsUsed ?? 0);
      const promoUsed = recorded > 0 ? (unlock.promotionalPointsUsed ?? 0) : 0;
      const purchasedUsed = recorded > 0 ? (unlock.purchasedPointsUsed ?? 0) : unlock.pointsDeducted;
      const restored = refundToBuckets({
        pointsBalance: wallet.pointsBalance,
        promotionalBalance: wallet.promotionalBalance ?? 0,
        purchasedBalance: wallet.purchasedBalance ?? 0,
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
        description: `Automatic refund: client cancelled before contact — order ${orderId}`,
        orderId,
        paymentStatus: "completed",
      });
      await postPointRefund(unlock.id, promoUsed, purchasedUsed, tx);
      refunded++;
    }
    return refunded;
  });
}
