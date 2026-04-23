import { sql } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const locationTypeEnum = pgEnum("location_type", [
  "governorate",
  "area",
  "neighborhood",
]);

export const locationsTable = pgTable(
  "locations",
  {
    id: varchar("id").primaryKey(),
    type: locationTypeEnum("type").notNull(),
    nameAr: varchar("name_ar", { length: 200 }).notNull(),
    nameEn: varchar("name_en", { length: 200 }).notNull(),
    parentId: varchar("parent_id"),
    slug: varchar("slug", { length: 200 }).notNull(),
  },
  (table) => [
    index("IDX_locations_type").on(table.type),
    index("IDX_locations_parent").on(table.parentId),
    index("IDX_locations_slug").on(table.slug),
  ],
);

export const nominatimCacheTable = pgTable(
  "nominatim_cache",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    cacheKey: varchar("cache_key", { length: 500 }).notNull().unique(),
    lang: varchar("lang", { length: 5 }).notNull().default("ar"),
    responseJson: jsonb("response_json").notNull(),
    cachedAt: timestamp("cached_at", { withTimezone: true }).notNull().default(sql`now()`),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("IDX_nominatim_key").on(table.cacheKey),
    index("IDX_nominatim_expires").on(table.expiresAt),
  ],
);

export type Location = typeof locationsTable.$inferSelect;
export type NominatimCache = typeof nominatimCacheTable.$inferSelect;
