-- Migration 021: idempotent gap repair for tables/columns in Drizzle schema
-- that were never added to SQL 001–020 (historically created via drizzle-kit push
-- or one-off TS scripts under artifacts/api-server/migrations/).
-- Safe on existing databases: IF NOT EXISTS / ADD COLUMN IF NOT EXISTS only.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Enums ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('client', 'technician');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE approval_status AS ENUM (
    'not_submitted', 'pending_review', 'approved', 'rejected', 'needs_correction'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE location_type AS ENUM ('governorate', 'area', 'neighborhood');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'pending', 'acknowledged', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('draft', 'issued', 'paid', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Core tables (fresh installs; no-op if drizzle-kit push already created them)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR NOT NULL UNIQUE,
  first_name VARCHAR,
  last_name VARCHAR,
  profile_image_url VARCHAR,
  role user_role,
  mobile VARCHAR(20),
  governorate VARCHAR(100),
  area VARCHAR(100),
  district VARCHAR(100),
  address VARCHAR(500),
  street VARCHAR(200),
  building_no VARCHAR(50),
  floor_no VARCHAR(50),
  apt_no VARCHAR(50),
  profession VARCHAR(100),
  specialty VARCHAR(100),
  password_hash VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admins (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR UNIQUE,
  first_name VARCHAR,
  last_name VARCHAR,
  mobile VARCHAR(20) UNIQUE,
  password_hash VARCHAR,
  profile_image_url VARCHAR,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_super_admin BOOLEAN NOT NULL DEFAULT false,
  admin_role VARCHAR(20) NOT NULL DEFAULT 'admin',
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  permissions JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions (expire);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_reset_token_user" ON password_reset_tokens (user_id);

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR PRIMARY KEY,
  order_serial SERIAL UNIQUE,
  order_number VARCHAR NOT NULL,
  status order_status NOT NULL DEFAULT 'pending',
  client_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  technician_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  category VARCHAR(100),
  governorate VARCHAR(100),
  area VARCHAR(100),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_orders_client" ON orders (client_id);
CREATE INDEX IF NOT EXISTS "IDX_orders_tech" ON orders (technician_id);
CREATE INDEX IF NOT EXISTS "IDX_orders_status" ON orders (status);

CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_serial SERIAL UNIQUE,
  order_id VARCHAR REFERENCES orders(id) ON DELETE SET NULL,
  order_number VARCHAR(100),
  client_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  technician_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  category VARCHAR(100),
  subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 14,
  tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'EGP',
  status invoice_status NOT NULL DEFAULT 'issued',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_location_events (
  id BIGSERIAL PRIMARY KEY,
  order_id VARCHAR NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  location geography(POINT, 4326),
  accuracy NUMERIC(10, 2),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_loc_events_order_id ON order_location_events (order_id);

-- ── OTP / login audit (previously TS-only migrations)
CREATE TABLE IF NOT EXISTS phone_verifications (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile VARCHAR(20) NOT NULL,
  code_hash VARCHAR NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_phone_verif_mobile" ON phone_verifications (mobile);

CREATE TABLE IF NOT EXISTS login_logs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR,
  identifier VARCHAR NOT NULL,
  role VARCHAR,
  success BOOLEAN NOT NULL,
  failure_reason VARCHAR,
  ip_address VARCHAR,
  user_agent VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_logs_created_at_idx ON login_logs (created_at);
CREATE INDEX IF NOT EXISTS login_logs_user_id_idx ON login_logs (user_id);

-- ── Locations (required before aliases seed; 001 references locations.id)
CREATE TABLE IF NOT EXISTS locations (
  id VARCHAR PRIMARY KEY,
  type location_type NOT NULL,
  name_ar VARCHAR(200) NOT NULL,
  name_en VARCHAR(200) NOT NULL,
  parent_id VARCHAR,
  slug VARCHAR(200) NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_locations_type" ON locations (type);
CREATE INDEX IF NOT EXISTS "IDX_locations_parent" ON locations (parent_id);
CREATE INDEX IF NOT EXISTS "IDX_locations_slug" ON locations (slug);

ALTER TABLE locations ADD COLUMN IF NOT EXISTS centroid geography(POINT, 4326);

CREATE TABLE IF NOT EXISTS nominatim_cache (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(500) NOT NULL UNIQUE,
  lang VARCHAR(5) NOT NULL DEFAULT 'ar',
  response_json JSONB NOT NULL,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_nominatim_key" ON nominatim_cache (cache_key);
CREATE INDEX IF NOT EXISTS "IDX_nominatim_expires" ON nominatim_cache (expires_at);

-- ── Admin settings + audit (schema only; never in 001–020)
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by VARCHAR REFERENCES admins(id)
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id SERIAL PRIMARY KEY,
  admin_id VARCHAR NOT NULL REFERENCES admins(id),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id VARCHAR NOT NULL,
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  reason TEXT,
  metadata JSONB,
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_logs_admin_id_idx ON admin_audit_logs (admin_id);
CREATE INDEX IF NOT EXISTS admin_audit_logs_target_idx ON admin_audit_logs (target_type, target_id);
CREATE INDEX IF NOT EXISTS admin_audit_logs_created_at_idx ON admin_audit_logs (created_at);

-- ── User columns from Drizzle that may be missing on drifted DBs
ALTER TABLE users ADD COLUMN IF NOT EXISTS location geography(POINT, 4326);
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_accuracy NUMERIC(10, 2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_source VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_captured_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_location geography(POINT, 4326);
ALTER TABLE users ADD COLUMN IF NOT EXISTS service_categories JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS service_start VARCHAR(5);
ALTER TABLE users ADD COLUMN IF NOT EXISTS service_end VARCHAR(5);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status approval_status NOT NULL DEFAULT 'not_submitted';
ALTER TABLE users ADD COLUMN IF NOT EXISTS expo_push_token VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version VARCHAR(32);

-- ── Order columns aligned with schema/orders.ts
ALTER TABLE orders ADD COLUMN IF NOT EXISTS location geography(POINT, 4326);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS street VARCHAR(200);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS building_no VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS floor_no VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS apt_no VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS additional_details TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS location_accuracy NUMERIC(10, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS location_source VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_rating SMALLINT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tech_rating SMALLINT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS specialty_id VARCHAR;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS arrival_detected_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS arrival_confirmed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS arrival_rejection_reason TEXT;
