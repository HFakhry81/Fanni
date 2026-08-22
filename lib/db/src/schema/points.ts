import { boolean, integer, numeric, pgEnum, pgTable, smallint, text, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./auth";
import { ordersTable } from "./orders";

export const leadPricingRulesTable = pgTable("lead_pricing_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceCategory: varchar("service_category", { length: 100 }), // null means all
  serviceSpecialization: varchar("service_specialization", { length: 100 }), // null means all
  dayOfWeek: smallint("day_of_week"), // 0-6 (Sunday-Saturday), null means all days
  startTime: varchar("start_time", { length: 5 }), // HH:mm format, e.g. "09:00"
  endTime: varchar("end_time", { length: 5 }), // HH:mm format, e.g. "17:00"
  pointsCost: integer("points_cost").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  priority: integer("priority").default(0).notNull(), // higher priority rules override lower ones
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

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
  promotionalBalance: integer("promotional_balance").default(0).notNull(),
  purchasedBalance: integer("purchased_balance").default(0).notNull(),
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

export const leadRefundStatusEnum = pgEnum("lead_refund_status", ["none", "requested", "refunded", "rejected"]);

export const leadUnlocksTable = pgTable("lead_unlocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  technicianId: varchar("technician_id").references(() => usersTable.id, { onDelete: "restrict" }).notNull(),
  orderId: varchar("order_id").references(() => ordersTable.id, { onDelete: "restrict" }).notNull(),
  pointsDeducted: integer("points_deducted").notNull(),
  promotionalPointsUsed: integer("promotional_points_used").notNull().default(0),
  purchasedPointsUsed: integer("purchased_points_used").notNull().default(0),
  balanceBefore: integer("balance_before").notNull().default(0),
  balanceAfter: integer("balance_after").notNull().default(0),
  clickedCall: boolean("clicked_call").default(false).notNull(),
  clickedWhatsapp: boolean("clicked_whatsapp").default(false).notNull(),
  refundStatus: leadRefundStatusEnum("refund_status").default("none").notNull(),
  unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
}, (table) => [unique("lead_unlocks_tech_order_unique").on(table.technicianId, table.orderId)]);

export const orderDeclinesTable = pgTable("order_declines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  technicianId: varchar("technician_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  orderId: varchar("order_id").references(() => ordersTable.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [unique("order_declines_tech_order_unique").on(table.technicianId, table.orderId)]);


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
  pointsCost: integer("points_cost").default(20).notNull(),
  label: varchar("label", { length: 200 }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const expenseCategoryEnum = pgEnum("expense_category", [
  "hosting",
  "sms_otp",
  "maps_api",
  "marketing",
  "payment_gateway",
  "salaries",
  "other",
]);

export const operationalExpensesTable = pgTable("operational_expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: expenseCategoryEnum("category").notNull(),
  provider: varchar("provider", { length: 100 }).notNull(),
  amountEgp: numeric("amount_egp", { precision: 10, scale: 2 }).notNull(),
  invoiceUrl: text("invoice_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
