-- Migration 023: columns required by Drizzle users schema but missing on some production DBs.
-- Root cause of register 500: column "working_hours" of relation "users" does not exist

ALTER TABLE users ADD COLUMN IF NOT EXISTS working_hours JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_preference VARCHAR(50);

-- Defensive: ensure related profile columns exist (idempotent)
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_source VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_captured_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_accuracy NUMERIC(10, 2);
