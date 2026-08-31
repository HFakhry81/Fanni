import { describe, expect, it } from "vitest";
import { coerceWalletNumbers, toWalletSummaryView } from "./walletSummary";

describe("walletSummary", () => {
  it("coerces string balances from raw SQL", () => {
    const view = coerceWalletNumbers({
      pointsBalance: "160",
      promotionalBalance: "100",
      purchasedBalance: "60",
      updatedAt: "2026-08-31T12:00:00.000Z",
    });
    expect(view.pointsBalance).toBe(160);
    expect(view.promotionalBalance).toBe(100);
    expect(view.purchasedBalance).toBe(60);
  });

  it("includes pending bonus separately from spendable balance", () => {
    const summary = toWalletSummaryView(
      { pointsBalance: 60, promotionalBalance: 60, purchasedBalance: 0 },
      100,
    );
    expect(summary.pointsBalance).toBe(60);
    expect(summary.pendingBonusPoints).toBe(100);
  });
});
