import { boolean, integer, json, numeric, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./auth";
import { pointPackagesTable, walletTransactionsTable } from "./points";

export const paymentRequestStatusEnum = pgEnum("payment_request_status", [
  "pending",
  "confirmed",
  "rejected",
]);

export const paymentMethodTypeEnum = pgEnum("payment_method_type", [
  "bank_transfer",
  "instapay",
  "e_wallet",
]);

export const paymentRequestsTable = pgTable("payment_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  packageId: varchar("package_id").references(() => pointPackagesTable.id, { onDelete: "set null" }),
  amountEgp: numeric("amount_egp", { precision: 10, scale: 2 }).notNull(),
  pointsRequested: integer("points_requested").notNull(),
  paymentMethod: paymentMethodTypeEnum("payment_method").notNull().default("bank_transfer"),
  referenceNumber: varchar("reference_number", { length: 255 }),
  transferNote: text("transfer_note"),
  /** JSON: { accountNumber?, instapayId?, walletNumber?, accountName? } */
  senderDetails: json("sender_details").$type<Record<string, string>>(),
  status: paymentRequestStatusEnum("status").notNull().default("pending"),
  adminId: varchar("admin_id"),
  adminNotes: text("admin_notes"),
  confirmedAt: timestamp("confirmed_at"),
  walletTxId: varchar("wallet_tx_id").references(() => walletTransactionsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const paymentAccountConfigTable = pgTable("payment_account_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bankName: varchar("bank_name", { length: 100 }),
  accountName: varchar("account_name", { length: 200 }),
  accountNumber: varchar("account_number", { length: 100 }),
  iban: varchar("iban", { length: 50 }),
  instapayId: varchar("instapay_id", { length: 100 }),
  ewalletNumber: varchar("ewallet_number", { length: 50 }),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  /** Which admin user is responsible for confirming payments (VARCHAR, same type as users.id) */
  paymentManagerId: varchar("payment_manager_id", { length: 36 }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notificationsTable = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // No FK — user_id can be either a usersTable.id (tech/client) or adminsTable.id
  userId: varchar("user_id").notNull(),
  type: varchar("type", { length: 60 }).notNull(),
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en").notNull(),
  bodyAr: text("body_ar"),
  bodyEn: text("body_en"),
  payload: json("payload").$type<Record<string, unknown>>(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
