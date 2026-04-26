-- Migration: Promote all raw startup migrations from api-server/src/index.ts
-- Safe to run on existing DBs: every statement uses IF NOT EXISTS guards.
-- Previously these ran on every server boot; they now run once as a proper migration.

-- invoice_type enum ---------------------------------------------------------
CREATE TYPE IF NOT EXISTS invoice_type AS ENUM ('technician', 'client', 'admin');

-- invoices: three-party columns ---------------------------------------------
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type invoice_type;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS materials_photos JSONB;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ocr_line_items JSONB;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ocr_materials_total NUMERIC(10,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS labour_fee NUMERIC(10,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS transport_fee NUMERIC(10,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS service_fee_rate NUMERIC(5,2) DEFAULT 15;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS service_fee_amount NUMERIC(10,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2) DEFAULT 14;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(10,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS net_total NUMERIC(10,2);
CREATE INDEX IF NOT EXISTS "IDX_invoices_type" ON invoices (invoice_type);

-- users: profile columns ----------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS service_start VARCHAR(5);
ALTER TABLE users ADD COLUMN IF NOT EXISTS service_end VARCHAR(5);
ALTER TABLE users ADD COLUMN IF NOT EXISTS expo_push_token VARCHAR;

-- service_domains ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_domains (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100) NOT NULL,
  icon VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- service_specializations ----------------------------------------------------
CREATE TABLE IF NOT EXISTS service_specializations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id VARCHAR NOT NULL REFERENCES service_domains(id) ON DELETE CASCADE,
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_specializations_domain_id_idx ON service_specializations (domain_id);

-- sort_order backfill: add to existing tables that predate the column ----------
ALTER TABLE service_domains ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE service_specializations ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- technician_notifications ---------------------------------------------------
CREATE TABLE IF NOT EXISTS technician_notifications (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS technician_notifications_technician_id_idx ON technician_notifications (technician_id) WHERE delivered_at IS NULL;

-- availability_audit_logs ----------------------------------------------------
CREATE TABLE IF NOT EXISTS availability_audit_logs (
  id SERIAL PRIMARY KEY,
  technician_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  changed_by_id VARCHAR NOT NULL,
  changed_by_role VARCHAR(20) NOT NULL,
  old_value BOOLEAN NOT NULL,
  new_value BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS availability_audit_logs_tech_id_idx ON availability_audit_logs (technician_id);
CREATE INDEX IF NOT EXISTS availability_audit_logs_created_at_idx ON availability_audit_logs (created_at);

-- rate_limits ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL,
  hit_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_limits_key_hit_at_idx ON rate_limits (key, hit_at);

-- location_miss_log ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS location_miss_log (
  id            VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  suburb_en     VARCHAR(300),
  suburb_ar     VARCHAR(300),
  city_en       VARCHAR(300),
  city_ar       VARCHAR(300),
  lat           VARCHAR(50),
  lng           VARCHAR(50),
  seen_count    INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_loc_miss_terms" ON location_miss_log (
  COALESCE(suburb_en, ''),
  COALESCE(suburb_ar, ''),
  COALESCE(city_en,   ''),
  COALESCE(city_ar,   '')
);
CREATE INDEX IF NOT EXISTS "IDX_loc_miss_suburb_en" ON location_miss_log (suburb_en);
CREATE INDEX IF NOT EXISTS "IDX_loc_miss_city_en"   ON location_miss_log (city_en);
CREATE INDEX IF NOT EXISTS "IDX_loc_miss_last_seen" ON location_miss_log (last_seen_at);
