import { sql } from "drizzle-orm";
import { bigserial, customType, index, jsonb, numeric, pgEnum, pgTable, serial, smallint, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

const geography = customType<{ data: string }>({
  dataType() {
    return "geography(POINT, 4326)";
  },
});

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "acknowledged",
  "en_route",
  "arrived",
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
    location: geography("location"),
        street: varchar("street", { length: 200 }),
    buildingNo: varchar("building_no", { length: 50 }),
    floorNo: varchar("floor_no", { length: 50 }),
    aptNo: varchar("apt_no", { length: 50 }),
    additionalDetails: text("additional_details"),
    locationAccuracy: numeric("location_accuracy", { precision: 10, scale: 2 }),
    locationSource: varchar("location_source", { length: 50 }),
    data: jsonb("data").notNull(),

    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    clientRating: smallint("client_rating"),
    techRating: smallint("tech_rating"),
    specialtyId: varchar("specialty_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
        cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    arrivedAt: timestamp("arrived_at", { withTimezone: true }),
    arrivalDetectedAt: timestamp("arrival_detected_at", { withTimezone: true }),
    arrivalConfirmedAt: timestamp("arrival_confirmed_at", { withTimezone: true }),
    arrivalRejectionReason: text("arrival_rejection_reason"),
  },

  (table) => [
    index("IDX_orders_client").on(table.clientId),
    index("IDX_orders_tech").on(table.technicianId),
    index("IDX_orders_status").on(table.status),
    index("IDX_orders_serial").on(table.orderSerial),
  ],
);

export const orderLocationEventsTable = pgTable(
  "order_location_events",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    orderId: varchar("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 50 }).notNull(), // e.g., 'ARRIVAL_DETECTED', 'CUSTOMER_CONFIRMED'
    location: geography("location"),
    accuracy: numeric("accuracy", { precision: 10, scale: 2 }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_order_loc_events_order_id").on(table.orderId)],
);

/** Every status transition for client / tech / admin timelines. */
export const orderStatusEventsTable = pgTable(
  "order_status_events",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    orderId: varchar("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
    fromStatus: varchar("from_status", { length: 32 }),
    toStatus: varchar("to_status", { length: 32 }).notNull(),
    actorUserId: varchar("actor_user_id", { length: 64 }),
    actorRole: varchar("actor_role", { length: 32 }),
    source: varchar("source", { length: 64 }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_order_status_events_order_id").on(table.orderId)],
);

export type InsertOrder = typeof ordersTable.$inferInsert;

export type Order = typeof ordersTable.$inferSelect;
