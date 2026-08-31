import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTx = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
};

vi.mock("@workspace/db", () => ({
  db: {
    transaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
    insert: vi.fn(),
    select: vi.fn(),
  },
  usersTable: {},
  walletsTable: {},
  walletBonusGrantsTable: {},
  walletTransactionsTable: {},
}));

vi.mock("./walletBuckets", () => ({
  creditPromotional: vi.fn((b: { pointsBalance: number; promotionalBalance: number; purchasedBalance: number }, amt: number) => ({
    pointsBalance: b.pointsBalance + amt,
    promotionalBalance: b.promotionalBalance + amt,
    purchasedBalance: b.purchasedBalance,
  })),
}));

vi.mock("../routes/notifications", () => ({
  createNotification: vi.fn(),
}));

describe("bonusGrants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("rejects empty message on create", async () => {
    const { createBonusGrant } = await import("./bonusGrants");
    await expect(
      createBonusGrant({ technicianId: "t1", adminId: "a1", pointsAmount: 10, message: "  " }),
    ).rejects.toThrow(/Message is required/);
  });
});
