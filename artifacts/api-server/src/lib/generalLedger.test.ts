import { describe, expect, it } from "vitest";
import {
  assertBalanced,
  cashInLines,
  GL_ACCOUNTS,
  leadUnlockLines,
  operatingExpenseLines,
  pointRefundLines,
  pointsToEgp,
  welcomeBonusLines,
} from "./generalLedgerMath";

describe("pointsToEgp", () => {
  it("values 120 points as 100 EGP", () => {
    expect(pointsToEgp(120)).toBe(100);
  });
  it("values 20 points as 16.67 EGP", () => {
    expect(pointsToEgp(20)).toBe(16.67);
  });
  it("values 60 welcome points as 50 EGP", () => {
    expect(pointsToEgp(60)).toBe(50);
  });
});

describe("assertBalanced", () => {
  it("accepts equal debit and credit", () => {
    expect(() =>
      assertBalanced([
        { accountCode: "1100", debit: 100, credit: 0 },
        { accountCode: "2100", debit: 0, credit: 100 },
      ]),
    ).not.toThrow();
  });
  it("rejects unbalanced lines", () => {
    expect(() =>
      assertBalanced([
        { accountCode: "1100", debit: 100, credit: 0 },
        { accountCode: "2100", debit: 0, credit: 90 },
      ]),
    ).toThrow(/UNBALANCED/);
  });
});

describe("cash in / welcome / opex journals", () => {
  it("defers cash on 2100, not 4100 revenue", () => {
    const lines = cashInLines(100);
    assertBalanced(lines);
    expect(lines).toEqual([
      { accountCode: GL_ACCOUNTS.CASH, debit: 100, credit: 0 },
      { accountCode: GL_ACCOUNTS.DEFERRED, debit: 0, credit: 100 },
    ]);
    expect(lines.some((line) => line.accountCode === GL_ACCOUNTS.REVENUE)).toBe(false);
  });

  it("books configured provider fee to 5200 and nets 1100", () => {
    const lines = cashInLines(100, 2.5);
    assertBalanced(lines);
    expect(lines).toEqual([
      { accountCode: GL_ACCOUNTS.CASH, debit: 97.5, credit: 0 },
      { accountCode: GL_ACCOUNTS.OPEX, debit: 2.5, credit: 0 },
      { accountCode: GL_ACCOUNTS.DEFERRED, debit: 0, credit: 100 },
    ]);
  });

  it("ignores a zero or invalid fee so OPay is never hardcoded", () => {
    expect(cashInLines(100, 0)).toHaveLength(2);
    expect(cashInLines(100, 100)).toHaveLength(2);
  });

  it("books welcome bonus as 5300 expense vs 2100 liability", () => {
    const lines = welcomeBonusLines(60);
    assertBalanced(lines);
    expect(lines).toEqual([
      { accountCode: GL_ACCOUNTS.WELCOME, debit: 50, credit: 0 },
      { accountCode: GL_ACCOUNTS.DEFERRED, debit: 0, credit: 50 },
    ]);
    expect(lines.some((line) => line.accountCode === GL_ACCOUNTS.REVENUE)).toBe(false);
  });

  it("books operating expense 5200 vs cash 1100", () => {
    const lines = operatingExpenseLines(40);
    assertBalanced(lines);
    expect(lines[0]?.accountCode).toBe(GL_ACCOUNTS.OPEX);
    expect(lines[1]?.accountCode).toBe(GL_ACCOUNTS.CASH);
  });
});

describe("promo vs purchased unlock", () => {
  it("recognizes purchased points as 4100 revenue", () => {
    const lines = leadUnlockLines(0, 20);
    assertBalanced(lines);
    expect(lines).toEqual([
      { accountCode: GL_ACCOUNTS.DEFERRED, debit: 16.67, credit: 0 },
      { accountCode: GL_ACCOUNTS.REVENUE, debit: 0, credit: 16.67 },
    ]);
  });

  it("relieves promo against 5100, not 4100 revenue", () => {
    const lines = leadUnlockLines(20, 0);
    assertBalanced(lines);
    expect(lines).toEqual([
      { accountCode: GL_ACCOUNTS.DEFERRED, debit: 16.67, credit: 0 },
      { accountCode: GL_ACCOUNTS.PROMO_COST, debit: 0, credit: 16.67 },
    ]);
    expect(lines.some((line) => line.accountCode === GL_ACCOUNTS.REVENUE)).toBe(false);
  });

  it("splits a mixed unlock into promo + purchased pairs", () => {
    const lines = leadUnlockLines(10, 10);
    assertBalanced(lines);
    const purchased = pointsToEgp(10);
    const promo = pointsToEgp(10);
    expect(lines).toEqual([
      { accountCode: GL_ACCOUNTS.DEFERRED, debit: purchased, credit: 0 },
      { accountCode: GL_ACCOUNTS.REVENUE, debit: 0, credit: purchased },
      { accountCode: GL_ACCOUNTS.DEFERRED, debit: promo, credit: 0 },
      { accountCode: GL_ACCOUNTS.PROMO_COST, debit: 0, credit: promo },
    ]);
  });

  it("reverses promo and purchased on refund", () => {
    const unlock = leadUnlockLines(8, 12);
    const refund = pointRefundLines(8, 12);
    assertBalanced(unlock);
    assertBalanced(refund);
    const netByAccount = new Map<string, number>();
    for (const line of [...unlock, ...refund]) {
      netByAccount.set(line.accountCode, (netByAccount.get(line.accountCode) ?? 0) + line.debit - line.credit);
    }
    for (const balance of netByAccount.values()) {
      expect(Math.abs(balance)).toBeLessThan(0.009);
    }
  });
});
