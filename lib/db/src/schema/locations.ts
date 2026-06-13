import { sql } from "drizzle-orm";
import { customType, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

const geography = customType<{ data: string }>({
  dataType() {
    return "geography(POINT, 4326)";
  },
});

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
    centroid: geography("centroid"),
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

/**
 * Stores alternate spellings (aliases) for locations so that uncommon Nominatim
 * suburb/city names that don't appear in nameEn, nameAr, or slug can still be
 * matched by the locationNormalizer alias map.
 *
 * Each row maps one alias string to one location. Aliases are case-folded to
 * lowercase on insert so the alias map lookup (which is always lowercase) works.
 */
export const locationAliasesTable = pgTable(
  "location_aliases",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    locationId: varchar("location_id").notNull().references(() => locationsTable.id, { onDelete: "cascade" }),
    alias: varchar("alias", { length: 300 }).notNull(),
    note: varchar("note", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => [
    uniqueIndex("uq_location_aliases_location_alias").on(table.locationId, table.alias),
    index("IDX_location_aliases_location").on(table.locationId),
    index("IDX_location_aliases_alias").on(table.alias),
  ],
);

/**
 * Records every /locations/match call that could not be resolved to either a
 * governorate or an area. These rows let the team identify which real-world
 * place names the alias map is missing and prioritise new additions.
 */
export const locationMissLogTable = pgTable(
  "location_miss_log",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    suburbEn: varchar("suburb_en", { length: 300 }),
    suburbAr: varchar("suburb_ar", { length: 300 }),
    cityEn: varchar("city_en", { length: 300 }),
    cityAr: varchar("city_ar", { length: 300 }),
    lat: varchar("lat", { length: 50 }),
    lng: varchar("lng", { length: 50 }),
    seenCount: integer("seen_count").notNull().default(1),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().default(sql`now()`),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => [
    index("IDX_loc_miss_suburb_en").on(table.suburbEn),
    index("IDX_loc_miss_city_en").on(table.cityEn),
    index("IDX_loc_miss_last_seen").on(table.lastSeenAt),
  ],
);

export type Location = typeof locationsTable.$inferSelect;
export type NominatimCache = typeof nominatimCacheTable.$inferSelect;
export type LocationAlias = typeof locationAliasesTable.$inferSelect;
export type LocationMissLog = typeof locationMissLogTable.$inferSelect;
