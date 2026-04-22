import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgEnum, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "acknowledged",
  "in_progress",
  "completed",
  "cancelled",
]);

export const ordersTable = pgTable(
  "orders",
  {
    id: varchar("id").primaryKey(),
    orderSerial: serial("order_serial").notNull().unique(),
    orderNumber: varchar("order_number").notNull(),
    status: orderStatusEnum("status").notNull().default("pending"),
    clientId: varchar("client_id").references(() => usersTable.id, { onDelete: "set null" }),
    technicianId: varchar("technician_id").references(() => usersTable.id, { onDelete: "set null" }),
    category: varchar("category", { length: 100 }),
    governorate: varchar("governorate", { length: 100 }),
    area: varchar("area", { length: 100 }),
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (table) => [
    index("IDX_orders_client").on(table.clientId),
    index("IDX_orders_tech").on(table.technicianId),
    index("IDX_orders_status").on(table.status),
    index("IDX_orders_serial").on(table.orderSerial),
  ],
);

export type InsertOrder = typeof ordersTable.$inferInsert;
export type Order = typeof ordersTable.$inferSelect;
