---
name: DB schema dist types and migration sync
description: Lessons about keeping Drizzle schema, TypeScript dist types, and the physical DB in sync
---

## Rule 1: Rebuild packages after schema changes

`lib/db` and `lib/api-zod` use TypeScript project references (`tsconfig.json` → `references`).
The API server reads compiled `.d.ts` files from `lib/db/dist/` and `lib/api-zod/dist/`, NOT from source.

After adding/changing Drizzle schema columns, run:
```
pnpm --filter @workspace/db run build
pnpm --filter @workspace/api-zod run build
```
Then the API server typecheck will see the new types.

**Why:** TypeScript project references compile referenced packages to `dist/*.d.ts`. The source `.ts` files are only used within that package, not by packages that reference it.

**How to apply:** Any time you add a column to `lib/db/src/schema/*.ts`, rebuild before running `npx tsc --noEmit` in `artifacts/api-server`.

## Rule 2: Add a SQL migration for new columns

Adding a column to the Drizzle schema does NOT add it to the physical PostgreSQL database.
You must add a migration file: `lib/db/migrations/NNN_description.sql`

The migration runner (`lib/db/scripts/migrate.ts`) runs all `.sql` files in lexicographic order during `prestart`.

Pattern:
```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS street VARCHAR(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS building_no VARCHAR(50);
```

Use `ADD COLUMN IF NOT EXISTS` to make migrations idempotent.

**Why:** The `prestart` script runs `pnpm --filter @workspace/db run migrate` which applies all pending `.sql` files. Without a migration file, Drizzle schema and real DB diverge — causing runtime errors like `column "street" does not exist`.

## Rule 3: GetCurrentAuthUserResponse strips unknown fields

`auth.ts` uses `GetCurrentAuthUserResponse.parse()` (Zod `.parse()` strips unknown keys by default).
Adding fields to `buildAuthUser` without updating the Zod schema results in those fields being stripped from the response.

Fix options:
1. Remove `.parse()` and return `res.json({ user: buildAuthUser(dbUser) })` directly
2. Update the Zod schema (careful — generated schemas in `lib/api-zod/src/generated/` are overwritten by codegen)

The `/api/auth/user` authenticated path was fixed to use option 1.
