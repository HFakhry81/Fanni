import { boolean, integer, numeric, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./auth";
import { ordersTable } from "./orders";

export const pointTransactionTypeEnum = pgEnum("point_transaction_type", [
  "package_purchase",
  "lead_unlock",
  "dispute_refund",
  "admin_adjustment",
  "welcome_bonus",
]);

export const pointPaymentStatusEnum = pgEnum("point_payment_status", [
  "pending",
  "completed",
  "failed",
]);

export const disputeStatusEnum = pgEnum("dispute_status", [
  "submitted",
  "under_review",
  "approved",
  "rejected",
]);

export const walletsTable = pgTable("wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull().unique(),
  pointsBalance: integer("points_balance").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const walletTransactionsTable = pgTable("wallet_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletId: varchar("wallet_id").references(() => walletsTable.id, { onDelete: "cascade" }).notNull(),
  pointsAmount: integer("points_amount").notNull(),
  type: pointTransactionTypeEnum("type").notNull(),
  cashAmountPaid: numeric("cash_amount_paid", { precision: 10, scale: 2 }).default("0.00").notNull(),
  gatewayFeeCharged: numeric("gateway_fee_charged", { precision: 10, scale: 2 }).default("0.00").notNull(),
  paymentStatus: pointPaymentStatusEnum("payment_status").default("completed").notNull(),
  externalTxId: varchar("external_tx_id", { length: 255 }),
  description: text("description"),
  orderId: varchar("order_id").references(() => ordersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leadUnlocksTable = pgTable("lead_unlocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  technicianId: varchar("technician_id").references(() => usersTable.id, { onDelete: "restrict" }).notNull(),
  orderId: varchar("order_id").references(() => ordersTable.id, { onDelete: "restrict" }).notNull(),
  pointsDeducted: integer("points_deducted").notNull(),
  clickedCall: boolean("clicked_call").default(false).notNull(),
  clickedWhatsapp: boolean("clicked_whatsapp").default(false).notNull(),
  unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
});

export const disputesTable = pgTable("disputes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadUnlockId: varchar("lead_unlock_id").references(() => leadUnlocksTable.id, { onDelete: "cascade" }).notNull(),
  technicianId: varchar("technician_id").references(() => usersTable.id, { onDelete: "restrict" }).notNull(),
  orderId: varchar("order_id").references(() => ordersTable.id, { onDelete: "restrict" }).notNull(),
  reason: text("reason").notNull(),
  status: disputeStatusEnum("status").default("submitted").notNull(),
  adminNotes: text("admin_notes"),
  pointsRefunded: boolean("points_refunded").default(false).notNull(),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pointPackagesTable = pgTable("point_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nameEn: varchar("name_en", { length: 100 }).notNull(),
  nameAr: varchar("name_ar", { length: 100 }).notNull(),
  pointsAmount: integer("points_amount").notNull(),
  priceEgp: numeric("price_egp", { precision: 10, scale: 2 }).notNull(),
  originalPriceEgp: numeric("original_price_egp", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const unlockCostsTable = pgTable("unlock_costs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  specialtySlug: varchar("specialty_slug", { length: 100 }),
  categorySlug: varchar("category_slug", { length: 100 }),
  pointsCost: integer("points_cost").default(15).notNull(),
  label: varchar("label", { length: 200 }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
