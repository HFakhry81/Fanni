import { and, eq, sql } from "drizzle-orm";
import { db, leadUnlocksTable, walletsTable, walletTransactionsTable } from "@workspace/db";
import { resolveLeadCost } from "./leadPricing";

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
}): Promise<{
  alreadyUnlocked: boolean;
  unlock: typeof leadUnlocksTable.$inferSelect;
  newBalance: number;
  costPoints: number;
  contact: OrderContact;
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

    if (existing) {
      const [wallet] = await tx.select().from(walletsTable).where(eq(walletsTable.userId, opts.technicianId));
      return {
        alreadyUnlocked: true,
        unlock: existing,
        newBalance: wallet?.pointsBalance ?? 0,
        costPoints: existing.pointsDeducted,
        contact,
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

    const newBalance = balance - costPoints;
    await tx.update(walletsTable).set({ pointsBalance: newBalance, updatedAt: new Date() }).where(eq(walletsTable.id, wallet.id));

    const [unlock] = await tx.insert(leadUnlocksTable).values({
      technicianId: opts.technicianId,
      orderId: opts.orderId,
      pointsDeducted: costPoints,
      balanceBefore: balance,
      balanceAfter: newBalance,
    }).returning();

    await tx.insert(walletTransactionsTable).values({
      walletId: wallet.id,
      pointsAmount: -costPoints,
      type: "lead_unlock",
      description: `Customer Data Access — order ${opts.orderId}`,
      orderId: opts.orderId,
      paymentStatus: "completed",
    });

    return {
      alreadyUnlocked: false,
      unlock: unlock!,
      newBalance,
      costPoints,
      contact,
    };
  });
}
