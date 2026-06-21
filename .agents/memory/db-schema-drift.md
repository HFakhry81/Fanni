---
name: DB schema-migration drift
description: Schema code can get ahead of applied migrations; columns exist in Drizzle schema but not in DB.
---

Migration 005 (`lib/db/migrations/005_phase1_tech_fields.sql`) was tracked as "applied" in the migrations table but several ALTER TABLE statements didn't execute against the live DB. Affected columns:
- `admins.admin_role` — missing, manually applied: `ALTER TABLE admins ADD COLUMN IF NOT EXISTS admin_role VARCHAR(20) NOT NULL DEFAULT 'admin';`
- `orders.scheduled_at`, `orders.client_rating`, `orders.tech_rating`, `orders.specialty_id` — missing, manually applied.

**Why:** The migration runner marks files as applied even if some statements fail silently. PostGIS-safe migration approach is raw SQL in `lib/db/migrations/` with `IF NOT EXISTS` guards.

**How to apply:** When DB errors mention "column does not exist" on a column that IS in the Drizzle schema, run the relevant `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` directly via `psql $DATABASE_URL`. Always restart the `Start application` workflow after DB changes.
