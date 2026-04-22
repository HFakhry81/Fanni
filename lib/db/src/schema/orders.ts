import { sql } from "drizzle-orm";
import { jsonb, pgEnum, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const orderStatusEnum = pgEnum("order_status", ["pending", "acknowledged"]);

export const ordersTable = pgTable("orders", {
  id: varchar("id").primaryKey(),
  orderNumber: varchar("order_number").notNull(),
  status: orderStatusEnum("status").notNull().default("pending"),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
});

export type InsertOrder = typeof ordersTable.$inferInsert;
export type Order = typeof ordersTable.$inferSelect;
