import { desc, inArray, sql } from "drizzle-orm";
import { db, glJournalEntriesTable, glJournalLinesTable } from "@workspace/db";
import { logger } from "./logger";
import { getSetting, SETTING_KEYS } from "./settings";
import {
  assertBalanced,
  cashInLines,
  leadUnlockLines,
  operatingExpenseLines,
  pointRefundLines,
  roundMoney,
  welcomeBonusLines,
  type JournalLine,
} from "./generalLedgerMath";

export {
  assertBalanced,
  cashInLines,
  GL_ACCOUNTS,
  leadUnlockLines,
  operatingExpenseLines,
  pointRefundLines,
  pointsToEgp,
  welcomeBonusLines,
  type JournalLine,
} from "./generalLedgerMath";

export type JournalExecutor = {
  insert: typeof db.insert;
  select: typeof db.select;
  execute: typeof db.execute;
};

/**
 * Super Admin setting `payment_gateway_fee_percent` (0–100). Default 0 — no fake OPay rate.
 * When set, cash-in books the fee to 5200 and nets 1100. Skip until configured.
 */
export async function resolveProviderFeeEgp(grossEgp: number): Promise<number> {
  const raw = await getSetting<number>(SETTING_KEYS.PAYMENT_GATEWAY_FEE_PERCENT, 0);
  const percent = Number(raw);
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return roundMoney((grossEgp * Math.min(percent, 100)) / 100);
}

export async function postJournal(
  input: {
    sourceType: string;
    sourceId: string;
    description: string;
    lines: JournalLine[];
  },
  executor: JournalExecutor = db,
): Promise<{ posted: boolean; id?: string }> {
  try {
    const lines = input.lines.filter((line) => line.debit > 0 || line.credit > 0);
    if (lines.length < 2) return { posted: false };
    assertBalanced(lines);
    const [dup] = await executor
      .select({ id: glJournalEntriesTable.id })
      .from(glJournalEntriesTable)
      .where(sql`${glJournalEntriesTable.sourceType} = ${input.sourceType} AND ${glJournalEntriesTable.sourceId} = ${input.sourceId}`);
    if (dup) return { posted: false, id: dup.id };

    const [entry] = await executor
      .insert(glJournalEntriesTable)
      .values({
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        description: input.description,
      })
      .returning({ id: glJournalEntriesTable.id });
    if (!entry) return { posted: false };
    await executor.insert(glJournalLinesTable).values(
      lines.map((line) => ({
        entryId: entry.id,
        accountCode: line.accountCode,
        debit: line.debit.toFixed(2),
        credit: line.credit.toFixed(2),
      })),
    );
    return { posted: true, id: entry.id };
  } catch (err) {
    logger.warn({ err, sourceType: input.sourceType, sourceId: input.sourceId }, "GL post skipped");
    return { posted: false };
  }
}

export async function postCashIn(
  sourceId: string,
  amountEgp: number,
  description: string,
  executor?: JournalExecutor,
  feeEgp = 0,
) {
  const lines = cashInLines(amountEgp, feeEgp);
  if (lines.length < 2) return { posted: false };
  return postJournal({
    sourceType: "payment_confirm",
    sourceId,
    description,
    lines,
  }, executor);
}

export async function postWelcomeBonus(sourceId: string, points: number, executor?: JournalExecutor) {
  const lines = welcomeBonusLines(points);
  if (lines.length < 2) return { posted: false };
  return postJournal({
    sourceType: "welcome_bonus",
    sourceId,
    description: `Welcome bonus ${points} pts`,
    lines,
  }, executor);
}

export async function postLeadUnlock(
  sourceId: string,
  promotionalUsed: number,
  purchasedUsed: number,
  executor?: JournalExecutor,
) {
  const lines = leadUnlockLines(promotionalUsed, purchasedUsed);
  if (lines.length < 2) return { posted: false };
  return postJournal({
    sourceType: "lead_unlock",
    sourceId,
    description: `Lead unlock promo=${promotionalUsed} purchased=${purchasedUsed}`,
    lines,
  }, executor);
}

export async function postPointRefund(
  sourceId: string,
  promotionalUsed: number,
  purchasedUsed: number,
  executor?: JournalExecutor,
) {
  const lines = pointRefundLines(promotionalUsed, purchasedUsed);
  if (lines.length < 2) return { posted: false };
  return postJournal({
    sourceType: "point_refund",
    sourceId,
    description: `Point refund promo=${promotionalUsed} purchased=${purchasedUsed}`,
    lines,
  }, executor);
}

export async function postOperatingExpense(sourceId: string, amountEgp: number, description: string, executor?: JournalExecutor) {
  const lines = operatingExpenseLines(amountEgp);
  if (lines.length < 2) return { posted: false };
  return postJournal({
    sourceType: "operating_expense",
    sourceId,
    description,
    lines,
  }, executor);
}

export async function getTrialBalance() {
  try {
    const rows = await db.execute(sql`
      SELECT a.code, a.name_ar, a.name_en, a.type,
             COALESCE(SUM(l.debit::numeric), 0) AS debit,
             COALESCE(SUM(l.credit::numeric), 0) AS credit
      FROM gl_accounts a
      LEFT JOIN gl_journal_lines l ON l.account_code = a.code
      GROUP BY a.code, a.name_ar, a.name_en, a.type
      ORDER BY a.code
    `);
    const accounts = (rows.rows as Array<{
      code: string;
      name_ar: string;
      name_en: string;
      type: string;
      debit: string;
      credit: string;
    }>).map((row) => {
      const debit = Number(row.debit);
      const credit = Number(row.credit);
      return {
        code: row.code,
        nameAr: row.name_ar,
        nameEn: row.name_en,
        type: row.type,
        debit,
        credit,
        balance: debit - credit,
      };
    });
    const revenue = accounts.filter((a) => a.type === "revenue").reduce((s, a) => s + a.credit - a.debit, 0);
    const expense = accounts.filter((a) => a.type === "expense").reduce((s, a) => s + a.debit - a.credit, 0);
    return { accounts, netIncome: revenue - expense };
  } catch (err) {
    logger.warn({ err }, "GL trial balance unavailable");
    return { accounts: [], netIncome: 0 };
  }
}

export async function listJournals(limit = 50) {
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 200) : 50;
  try {
    const entries = await db
      .select()
      .from(glJournalEntriesTable)
      .orderBy(desc(glJournalEntriesTable.createdAt))
      .limit(safeLimit);
    if (entries.length === 0) return { journals: [] };
    const ids = entries.map((entry) => entry.id);
    const lines = await db
      .select()
      .from(glJournalLinesTable)
      .where(inArray(glJournalLinesTable.entryId, ids));
    const byEntry = new Map<string, typeof lines>();
    for (const line of lines) {
      const bucket = byEntry.get(line.entryId) ?? [];
      bucket.push(line);
      byEntry.set(line.entryId, bucket);
    }
    return {
      journals: entries.map((entry) => ({
        ...entry,
        lines: byEntry.get(entry.id) ?? [],
      })),
    };
  } catch (err) {
    logger.warn({ err }, "GL journal list unavailable");
    return { journals: [] };
  }
}
