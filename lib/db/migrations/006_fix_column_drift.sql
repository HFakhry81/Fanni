-- Migration 006: Ensure all Phase-1 columns exist (safe re-run with IF NOT EXISTS)
-- This migration is a safety net for environments where migration 005
-- was tracked as applied before all its ALTER TABLE statements ran.
-- All statements use IF NOT EXISTS so they are harmless if columns already exist.

-- ── users table (technician profile fields) ────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS national_id             VARCHAR(14),
  ADD COLUMN IF NOT EXISTS national_id_front_url   TEXT,
  ADD COLUMN IF NOT EXISTS national_id_back_url    TEXT,
  ADD COLUMN IF NOT EXISTS license_card_url        TEXT,
  ADD COLUMN IF NOT EXISTS is_approved             BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bio                     TEXT,
  ADD COLUMN IF NOT EXISTS years_of_experience     INTEGER,
  ADD COLUMN IF NOT EXISTS rating                  NUMERIC(3,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count            INTEGER NOT NULL DEFAULT 0;

-- Auto-approve existing clients (only new technicians go through approval flow)
UPDATE users SET is_approved = true WHERE role = 'client' AND is_approved = false;

-- ── orders table (scheduling + ratings + specialty) ────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS scheduled_at  TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS client_rating SMALLINT,
  ADD COLUMN IF NOT EXISTS tech_rating   SMALLINT,
  ADD COLUMN IF NOT EXISTS specialty_id  VARCHAR;

-- Add CHECK constraints only if they don't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'orders' AND constraint_name = 'orders_client_rating_check'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_client_rating_check
      CHECK (client_rating >= 1 AND client_rating <= 5);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'orders' AND constraint_name = 'orders_tech_rating_check'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_tech_rating_check
      CHECK (tech_rating >= 1 AND tech_rating <= 5);
  END IF;
END $$;

-- ── admins table (role column) ─────────────────────────────────────────────
ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS admin_role VARCHAR(20) NOT NULL DEFAULT 'admin';

-- Promote existing super admins to super_admin role
UPDATE admins SET admin_role = 'super_admin' WHERE is_super_admin = true AND admin_role = 'admin';
