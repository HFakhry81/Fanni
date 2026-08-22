import { describe, expect, it } from "vitest";
import { creditPurchased, creditPromotional, debitPromoFirst, refundToBuckets } from "./walletBuckets";

describe("walletBuckets", () => {
  it("spends promotional points before purchased", () => {
    const next = debitPromoFirst({
      pointsBalance: 80,
      promotionalBalance: 60,
      purchasedBalance: 20,
    }, 20);
    expect(next.promotionalUsed).toBe(20);
    expect(next.purchasedUsed).toBe(0);
    expect(next.promotionalBalance).toBe(40);
    expect(next.purchasedBalance).toBe(20);
    expect(next.pointsBalance).toBe(60);
  });

  it("uses purchased after promotional is exhausted", () => {
    const next = debitPromoFirst({
      pointsBalance: 80,
      promotionalBalance: 10,
      purchasedBalance: 70,
    }, 25);
    expect(next.promotionalUsed).toBe(10);
    expect(next.purchasedUsed).toBe(15);
    expect(next.pointsBalance).toBe(55);
  });

  it("credits purchase and promo separately", () => {
    const base = { pointsBalance: 0, promotionalBalance: 0, purchasedBalance: 0 };
    expect(creditPromotional(base, 60).promotionalBalance).toBe(60);
    expect(creditPurchased(base, 120).purchasedBalance).toBe(120);
  });

  it("refunds to the original buckets", () => {
    const restored = refundToBuckets({
      pointsBalance: 40,
      promotionalBalance: 10,
      purchasedBalance: 30,
    }, 15, 5);
    expect(restored.pointsBalance).toBe(60);
    expect(restored.promotionalBalance).toBe(25);
    expect(restored.purchasedBalance).toBe(35);
  });
});
