import { sql } from "drizzle-orm";
import { boolean, customType, index, jsonb, pgEnum, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";

const geography = customType<{ data: string }>({
  dataType() {
    return "geography(POINT, 4326)";
  },
});

export const userRoleEnum = pgEnum("user_role", ["client", "technician"]);

export const sessionsTable = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const usersTable = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: userRoleEnum("role"),
  mobile: varchar("mobile", { length: 20 }),
  governorate: varchar("governorate", { length: 100 }),
  area: varchar("area", { length: 100 }),
  district: varchar("district", { length: 100 }),
  address: varchar("address", { length: 500 }),
  profession: varchar("profession", { length: 100 }),
  specialty: varchar("specialty", { length: 100 }),
  serviceCategories: jsonb("service_categories").$type<string[]>(),
  isAvailable: boolean("is_available").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  location: geography("location"),
  passwordHash: varchar("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const passwordResetTokensTable = pgTable(
  "password_reset_tokens",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("IDX_reset_token_user").on(table.userId)],
);

export const adminsTable = pgTable("admins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  mobile: varchar("mobile", { length: 20 }).unique(),
  passwordHash: varchar("password_hash"),
  profileImageUrl: varchar("profile_image_url"),
  isActive: boolean("is_active").notNull().default(true),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  permissions: jsonb("permissions").$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const serviceDomainsTable = pgTable("service_domains", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nameEn: varchar("name_en", { length: 100 }).notNull(),
  nameAr: varchar("name_ar", { length: 100 }).notNull(),
  icon: varchar("icon", { length: 50 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const serviceSpecializationsTable = pgTable("service_specializations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  domainId: varchar("domain_id").notNull().references(() => serviceDomainsTable.id, { onDelete: "cascade" }),
  nameEn: varchar("name_en", { length: 100 }).notNull(),
  nameAr: varchar("name_ar", { length: 100 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [index("service_specializations_domain_id_idx").on(table.domainId)]);

export const phoneVerificationsTable = pgTable(
  "phone_verifications",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    mobile: varchar("mobile", { length: 20 }).notNull(),
    codeHash: varchar("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("IDX_phone_verif_mobile").on(table.mobile)],
);

export const loginLogsTable = pgTable(
  "login_logs",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id"),
    identifier: varchar("identifier").notNull(),
    role: varchar("role"),
    success: boolean("success").notNull(),
    failureReason: varchar("failure_reason"),
    ipAddress: varchar("ip_address"),
    userAgent: varchar("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("login_logs_created_at_idx").on(table.createdAt),
    index("login_logs_user_id_idx").on(table.userId),
  ],
);

export type UpsertUser = typeof usersTable.$inferInsert;
export type User = typeof usersTable.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokensTable.$inferSelect;
export type Admin = typeof adminsTable.$inferSelect;
export type UpsertAdmin = typeof adminsTable.$inferInsert;
export type PhoneVerification = typeof phoneVerificationsTable.$inferSelect;
export type LoginLog = typeof loginLogsTable.$inferSelect;
export type ServiceDomain = typeof serviceDomainsTable.$inferSelect;
export type ServiceSpecialization = typeof serviceSpecializationsTable.$inferSelect;
