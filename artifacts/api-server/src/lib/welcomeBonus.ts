import { and, eq, sql } from "drizzle-orm";
import { db, walletsTable, walletTransactionsTable } from "@workspace/db";
import { postWelcomeBonus } from "./generalLedger";

export const WELCOME_BONUS_POINTS = 60;

/** Grant 60 on first approval. If an older seed granted 50, top up +10 once. */
export async function grantWelcomeBonusIfNeeded(userId: string): Promise<{ granted: number }> {
  const wallet = await getOrCreateWalletRow(userId);
  const [sumRow] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${walletTransactionsTable.pointsAmount}), 0)`,
    })
    .from(walletTransactionsTable)
    .where(
      and(
        eq(walletTransactionsTable.walletId, wallet.id),
        eq(walletTransactionsTable.type, "welcome_bonus"),
      ),
    );
  const already = Number(sumRow?.total ?? 0);
  if (already >= WELCOME_BONUS_POINTS) return { granted: 0 };

  const add = WELCOME_BONUS_POINTS - already;
  const description =
    already === 0
      ? "مكافأة ترحيبية — Welcome bonus"
      : "تسوية المكافأة الترحيبية إلى 60 — Welcome bonus align";

  await db.transaction(async (tx) => {
    await tx.insert(walletTransactionsTable).values({
      walletId: wallet.id,
      pointsAmount: add,
      type: "welcome_bonus",
      description,
    });
    await tx
      .update(walletsTable)
      .set({
        pointsBalance: sql`${walletsTable.pointsBalance} + ${add}`,
        promotionalBalance: sql`${walletsTable.promotionalBalance} + ${add}`,
        updatedAt: new Date(),
      })
      .where(eq(walletsTable.id, wallet.id));
    await postWelcomeBonus(`${wallet.id}:${already}-${add}`, add, tx);
  });
  return { granted: add };
}

async function getOrCreateWalletRow(userId: string) {
  const [existing] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
  if (existing) return existing;
  const [created] = await db.insert(walletsTable).values({ userId }).returning();
  return created!;
}
