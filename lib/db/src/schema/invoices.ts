import { sql } from "drizzle-orm";
import { index, numeric, pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import { ordersTable } from "./orders";

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "issued",
  "paid",
  "cancelled",
]);

export const invoicesTable = pgTable(
  "invoices",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    invoiceSerial: serial("invoice_serial").notNull().unique(),
    orderId: varchar("order_id").references(() => ordersTable.id, { onDelete: "set null" }),
    orderNumber: varchar("order_number", { length: 100 }),
    clientId: varchar("client_id").references(() => usersTable.id, { onDelete: "set null" }),
    technicianId: varchar("technician_id").references(() => usersTable.id, { onDelete: "set null" }),
    category: varchar("category", { length: 100 }),
    subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("14"),
    taxAmount: numeric("tax_amount", { precision: 10, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("EGP"),
    status: invoiceStatusEnum("status").notNull().default("issued"),
    noteAr: text("note_ar"),
    noteEn: text("note_en"),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().default(sql`now()`),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => [
    index("IDX_invoices_client").on(table.clientId),
    index("IDX_invoices_tech").on(table.technicianId),
    index("IDX_invoices_order").on(table.orderId),
    index("IDX_invoices_status").on(table.status),
    index("IDX_invoices_serial").on(table.invoiceSerial),
  ],
);

export type InsertInvoice = typeof invoicesTable.$inferInsert;
export type Invoice = typeof invoicesTable.$inferSelect;
