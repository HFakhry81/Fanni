import { sql } from "drizzle-orm";
import { index, numeric, pgTable, text, timestamp, unique, varchar } from "drizzle-orm/pg-core";

export const glAccountsTable = pgTable("gl_accounts", {
  code: varchar("code", { length: 20 }).primaryKey(),
  nameEn: varchar("name_en", { length: 120 }).notNull(),
  nameAr: varchar("name_ar", { length: 120 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(),
});

export const glJournalEntriesTable = pgTable(
  "gl_journal_entries",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    sourceType: varchar("source_type", { length: 40 }).notNull(),
    sourceId: varchar("source_id", { length: 80 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("gl_journal_source_unique").on(table.sourceType, table.sourceId),
    index("IDX_gl_journal_created").on(table.createdAt),
  ],
);

export const glJournalLinesTable = pgTable(
  "gl_journal_lines",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    entryId: varchar("entry_id")
      .references(() => glJournalEntriesTable.id, { onDelete: "cascade" })
      .notNull(),
    accountCode: varchar("account_code", { length: 20 })
      .references(() => glAccountsTable.code)
      .notNull(),
    debit: numeric("debit", { precision: 12, scale: 2 }).notNull().default("0.00"),
    credit: numeric("credit", { precision: 12, scale: 2 }).notNull().default("0.00"),
  },
  (table) => [index("IDX_gl_lines_entry").on(table.entryId), index("IDX_gl_lines_account").on(table.accountCode)],
);
