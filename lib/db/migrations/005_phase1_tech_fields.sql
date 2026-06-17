-- Phase 1: Add technician profile fields + admin roles + order scheduling + rating

-- 1. Technician fields on users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS national_id        VARCHAR(14) UNIQUE,
  ADD COLUMN IF NOT EXISTS national_id_front_url TEXT,
  ADD COLUMN IF NOT EXISTS national_id_back_url  TEXT,
  ADD COLUMN IF NOT EXISTS license_card_url   TEXT,
  ADD COLUMN IF NOT EXISTS is_approved        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bio                TEXT,
  ADD COLUMN IF NOT EXISTS years_of_experience INTEGER,
  ADD COLUMN IF NOT EXISTS rating             NUMERIC(3,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count       INTEGER NOT NULL DEFAULT 0;

-- Auto-approve existing clients (only technicians go through approval)
UPDATE users SET is_approved = true WHERE role = 'client';

-- 2. Scheduled orders + rating fields on orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS scheduled_at  TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS client_rating SMALLINT CHECK (client_rating >= 1 AND client_rating <= 5),
  ADD COLUMN IF NOT EXISTS tech_rating   SMALLINT CHECK (tech_rating >= 1 AND tech_rating <= 5),
  ADD COLUMN IF NOT EXISTS specialty_id  VARCHAR REFERENCES service_specializations(id) ON DELETE SET NULL;

-- 3. Admin role enum column on admins table
ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS admin_role VARCHAR(20) NOT NULL DEFAULT 'admin';

-- Migrate existing super_admin flag
UPDATE admins SET admin_role = 'super_admin' WHERE is_super_admin = true;
