import { and, eq, sql } from "drizzle-orm";
import { db, walletBonusGrantsTable } from "@workspace/db";

export type WalletSummaryView = {
  pointsBalance: number;
  promotionalBalance: number;
  purchasedBalance: number;
  pendingBonusPoints: number;
  updatedAt: string | null;
};

export type AdminWalletStatRow = {
  id: string;
  userId: string;
  pointsBalance: number;
  promotionalBalance: number;
  purchasedBalance: number;
  pendingBonusPoints: number;
  firstName: string | null;
  lastName: string | null;
  mobile: string | null;
  updatedAt: string | null;
};

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function coerceWalletNumbers(row: {
  pointsBalance?: unknown;
  promotionalBalance?: unknown;
  purchasedBalance?: unknown;
  updatedAt?: Date | string | null;
}): Omit<WalletSummaryView, "pendingBonusPoints"> {
  return {
    pointsBalance: toNumber(row.pointsBalance),
    promotionalBalance: toNumber(row.promotionalBalance),
    purchasedBalance: toNumber(row.purchasedBalance),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function toWalletSummaryView(
  row: Parameters<typeof coerceWalletNumbers>[0],
  pendingBonusPoints = 0,
): WalletSummaryView {
  return { ...coerceWalletNumbers(row), pendingBonusPoints: toNumber(pendingBonusPoints) };
}

export async function sumPendingBonusForTechnician(technicianId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`COALESCE(SUM(${walletBonusGrantsTable.pointsAmount}), 0)` })
    .from(walletBonusGrantsTable)
    .where(
      and(
        eq(walletBonusGrantsTable.technicianId, technicianId),
        eq(walletBonusGrantsTable.status, "pending_ack"),
      ),
    );
  return toNumber(row?.total);
}

function mapAdminWalletRow(raw: Record<string, unknown>): AdminWalletStatRow {
  return {
    id: String(raw.id),
    userId: String(raw.user_id),
    pointsBalance: toNumber(raw.points_balance),
    promotionalBalance: toNumber(raw.promotional_balance),
    purchasedBalance: toNumber(raw.purchased_balance),
    pendingBonusPoints: toNumber(raw.pending_bonus),
    firstName: raw.first_name != null ? String(raw.first_name) : null,
    lastName: raw.last_name != null ? String(raw.last_name) : null,
    mobile: raw.mobile != null ? String(raw.mobile) : null,
    updatedAt: raw.updated_at ? new Date(String(raw.updated_at)).toISOString() : null,
  };
}

export async function listAdminWalletStats(): Promise<{
  wallets: AdminWalletStatRow[];
  totalLiabilityPoints: number;
  totalPendingBonusPoints: number;
}> {
  const rows = await db.execute(sql`
    SELECT w.id, w.user_id, w.points_balance, w.promotional_balance, w.purchased_balance, w.updated_at,
      u.first_name, u.last_name, u.mobile,
      COALESCE(pending.pending_bonus, 0) AS pending_bonus
    FROM wallets w
    JOIN users u ON u.id = w.user_id
    LEFT JOIN (
      SELECT technician_id, SUM(points_amount) AS pending_bonus
      FROM wallet_bonus_grants
      WHERE status = 'pending_ack'
      GROUP BY technician_id
    ) pending ON pending.technician_id = w.user_id
    ORDER BY w.points_balance DESC
  `);

  const wallets = (rows.rows as Record<string, unknown>[]).map(mapAdminWalletRow);
  const totalLiabilityPoints = wallets.reduce((sum, row) => sum + row.pointsBalance, 0);
  const totalPendingBonusPoints = wallets.reduce((sum, row) => sum + row.pendingBonusPoints, 0);
  return { wallets, totalLiabilityPoints, totalPendingBonusPoints };
}
