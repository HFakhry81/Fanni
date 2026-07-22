import { boolean, integer, numeric, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
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
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
