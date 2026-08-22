import { sql } from "drizzle-orm";
import { index, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import { ordersTable } from "./orders";

export const maskedCallSessionsTable = pgTable("masked_call_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => ordersTable.id, { onDelete: "cascade" }).notNull(),
  initiatorUserId: varchar("initiator_user_id").references(() => usersTable.id, { onDelete: "restrict" }).notNull(),
  destinationUserId: varchar("destination_user_id").references(() => usersTable.id, { onDelete: "restrict" }).notNull(),
  destinationE164: varchar("destination_e164", { length: 20 }).notNull(),
  provider: varchar("provider", { length: 20 }).notNull().default("twilio"),
  providerCallSid: varchar("provider_call_sid", { length: 64 }),
  status: varchar("status", { length: 32 }).notNull().default("queued"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_masked_calls_order").on(table.orderId),
  index("idx_masked_calls_sid").on(table.providerCallSid),
]);
