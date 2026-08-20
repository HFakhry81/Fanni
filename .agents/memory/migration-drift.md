---
name: Database migration drift
description: Live schema can lag behind Drizzle definitions; applied migration files must never be edited to repair an existing database.
---

When a deployed database is missing a column or enum value, add a new idempotent migration instead of editing an already-applied migration. Startup should verify that the live schema supports every column selected by recovery and routing queries.

**Why:** The migration runner records filenames, so changing an applied file silently leaves existing databases unchanged and can make one workflow start with a different schema than another.

**How to apply:** Use `ADD COLUMN IF NOT EXISTS`, guarded enum additions, and restart only the canonical API workflow after applying schema changes.