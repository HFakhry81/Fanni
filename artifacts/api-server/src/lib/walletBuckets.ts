export type WalletBuckets = {
  pointsBalance: number;
  promotionalBalance: number;
  purchasedBalance: number;
};

export function creditPurchased(wallet: WalletBuckets, amount: number): WalletBuckets {
  if (amount < 0) throw new Error("CREDIT_MUST_BE_POSITIVE");
  return {
    pointsBalance: wallet.pointsBalance + amount,
    promotionalBalance: wallet.promotionalBalance,
    purchasedBalance: wallet.purchasedBalance + amount,
  };
}

export function creditPromotional(wallet: WalletBuckets, amount: number): WalletBuckets {
  if (amount < 0) throw new Error("CREDIT_MUST_BE_POSITIVE");
  return {
    pointsBalance: wallet.pointsBalance + amount,
    promotionalBalance: wallet.promotionalBalance + amount,
    purchasedBalance: wallet.purchasedBalance,
  };
}

/** Spend promotional points first, then purchased. */
export function debitPromoFirst(wallet: WalletBuckets, amount: number): WalletBuckets & {
  promotionalUsed: number;
  purchasedUsed: number;
} {
  if (amount < 0) throw new Error("DEBIT_MUST_BE_POSITIVE");
  if (wallet.pointsBalance < amount) {
    throw new Error("INSUFFICIENT_POINTS");
  }
  const promotionalUsed = Math.min(Math.max(wallet.promotionalBalance, 0), amount);
  const purchasedUsed = amount - promotionalUsed;
  if (purchasedUsed > Math.max(wallet.purchasedBalance, 0)) {
    // Buckets drifted; still allow if total balance covers the spend.
    const purchasedAvailable = Math.max(wallet.purchasedBalance, 0);
    const extraFromTotal = purchasedUsed - purchasedAvailable;
    return {
      pointsBalance: wallet.pointsBalance - amount,
      promotionalBalance: Math.max(0, wallet.promotionalBalance - promotionalUsed - extraFromTotal),
      purchasedBalance: 0,
      promotionalUsed: promotionalUsed + extraFromTotal,
      purchasedUsed: purchasedAvailable,
    };
  }
  return {
    pointsBalance: wallet.pointsBalance - amount,
    promotionalBalance: wallet.promotionalBalance - promotionalUsed,
    purchasedBalance: wallet.purchasedBalance - purchasedUsed,
    promotionalUsed,
    purchasedUsed,
  };
}

export function refundToBuckets(
  wallet: WalletBuckets,
  promotionalUsed: number,
  purchasedUsed: number,
): WalletBuckets {
  const promo = Math.max(0, promotionalUsed);
  const purchased = Math.max(0, purchasedUsed);
  return {
    pointsBalance: wallet.pointsBalance + promo + purchased,
    promotionalBalance: wallet.promotionalBalance + promo,
    purchasedBalance: wallet.purchasedBalance + purchased,
  };
}
