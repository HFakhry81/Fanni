export type JournalLine = {
  accountCode: string;
  debit: number;
  credit: number;
};

/** Chart of accounts — must match lib/db/migrations/020_general_ledger.sql */
export const GL_ACCOUNTS = {
  CASH: "1100",
  DEFERRED: "2100",
  REVENUE: "4100",
  PROMO_COST: "5100",
  OPEX: "5200",
  WELCOME: "5300",
} as const;

export function roundMoney(value: number): number {
  return Math.round(Number(value) * 100) / 100;
}

/** 120 points = 100 EGP. */
export function pointsToEgp(points: number): number {
  return Math.round(((points * 100) / 120) * 100) / 100;
}

export function assertBalanced(lines: JournalLine[]): void {
  const debit = lines.reduce((sum, line) => sum + line.debit, 0);
  const credit = lines.reduce((sum, line) => sum + line.credit, 0);
  if (Math.abs(debit - credit) > 0.009) {
    throw new Error(`UNBALANCED_JOURNAL debit=${debit} credit=${credit}`);
  }
}

export function cashInLines(amountEgp: number, feeEgp = 0): JournalLine[] {
  const amount = roundMoney(amountEgp);
  const fee = roundMoney(feeEgp);
  if (!(amount > 0)) return [];
  if (fee > 0 && fee < amount) {
    return [
      { accountCode: GL_ACCOUNTS.CASH, debit: amount - fee, credit: 0 },
      { accountCode: GL_ACCOUNTS.OPEX, debit: fee, credit: 0 },
      { accountCode: GL_ACCOUNTS.DEFERRED, debit: 0, credit: amount },
    ];
  }
  return [
    { accountCode: GL_ACCOUNTS.CASH, debit: amount, credit: 0 },
    { accountCode: GL_ACCOUNTS.DEFERRED, debit: 0, credit: amount },
  ];
}

export function welcomeBonusLines(points: number): JournalLine[] {
  const amount = pointsToEgp(points);
  if (!(amount > 0)) return [];
  return [
    { accountCode: GL_ACCOUNTS.WELCOME, debit: amount, credit: 0 },
    { accountCode: GL_ACCOUNTS.DEFERRED, debit: 0, credit: amount },
  ];
}

export function leadUnlockLines(promotionalUsed: number, purchasedUsed: number): JournalLine[] {
  const promoEgp = pointsToEgp(promotionalUsed);
  const purchasedEgp = pointsToEgp(purchasedUsed);
  const lines: JournalLine[] = [];
  if (purchasedEgp > 0) {
    lines.push({ accountCode: GL_ACCOUNTS.DEFERRED, debit: purchasedEgp, credit: 0 });
    lines.push({ accountCode: GL_ACCOUNTS.REVENUE, debit: 0, credit: purchasedEgp });
  }
  if (promoEgp > 0) {
    lines.push({ accountCode: GL_ACCOUNTS.DEFERRED, debit: promoEgp, credit: 0 });
    lines.push({ accountCode: GL_ACCOUNTS.PROMO_COST, debit: 0, credit: promoEgp });
  }
  return lines;
}

export function pointRefundLines(promotionalUsed: number, purchasedUsed: number): JournalLine[] {
  const promoEgp = pointsToEgp(promotionalUsed);
  const purchasedEgp = pointsToEgp(purchasedUsed);
  const lines: JournalLine[] = [];
  if (purchasedEgp > 0) {
    lines.push({ accountCode: GL_ACCOUNTS.REVENUE, debit: purchasedEgp, credit: 0 });
    lines.push({ accountCode: GL_ACCOUNTS.DEFERRED, debit: 0, credit: purchasedEgp });
  }
  if (promoEgp > 0) {
    lines.push({ accountCode: GL_ACCOUNTS.PROMO_COST, debit: promoEgp, credit: 0 });
    lines.push({ accountCode: GL_ACCOUNTS.DEFERRED, debit: 0, credit: promoEgp });
  }
  return lines;
}

export function operatingExpenseLines(amountEgp: number): JournalLine[] {
  const amount = roundMoney(amountEgp);
  if (!(amount > 0)) return [];
  return [
    { accountCode: GL_ACCOUNTS.OPEX, debit: amount, credit: 0 },
    { accountCode: GL_ACCOUNTS.CASH, debit: 0, credit: amount },
  ];
}
