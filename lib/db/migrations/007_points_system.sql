-- Migration 007: Fanni Points System
-- Adds prepaid points wallet for technicians, lead unlock tracking, disputes, and configurable packages.

-- ── Enums ──────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE point_transaction_type AS ENUM (
    'package_purchase', 'lead_unlock', 'dispute_refund', 'admin_adjustment', 'welcome_bonus'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE point_payment_status AS ENUM ('pending', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dispute_status AS ENUM ('submitted', 'under_review', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Wallets ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallets (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         VARCHAR NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  points_balance  INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Wallet Transactions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id                   VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id            VARCHAR NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  points_amount        INTEGER NOT NULL,
  type                 point_transaction_type NOT NULL,
  cash_amount_paid     NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  gateway_fee_charged  NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  payment_status       point_payment_status NOT NULL DEFAULT 'completed',
  external_tx_id       VARCHAR(255),
  description          TEXT,
  order_id             VARCHAR REFERENCES orders(id) ON DELETE SET NULL,
  created_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Lead Unlocks ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_unlocks (
  id               VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id    VARCHAR NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  order_id         VARCHAR NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  points_deducted  INTEGER NOT NULL,
  clicked_call     BOOLEAN NOT NULL DEFAULT false,
  clicked_whatsapp BOOLEAN NOT NULL DEFAULT false,
  unlocked_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(technician_id, order_id)
);

-- ── Disputes ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS disputes (
  id               VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_unlock_id   VARCHAR NOT NULL REFERENCES lead_unlocks(id) ON DELETE CASCADE,
  technician_id    VARCHAR NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  order_id         VARCHAR NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  reason           TEXT NOT NULL,
  status           dispute_status NOT NULL DEFAULT 'submitted',
  admin_notes      TEXT,
  points_refunded  BOOLEAN NOT NULL DEFAULT false,
  resolved_at      TIMESTAMP,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Point Packages (admin-configurable) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS point_packages (
  id                 VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en            VARCHAR(100) NOT NULL,
  name_ar            VARCHAR(100) NOT NULL,
  points_amount      INTEGER NOT NULL,
  price_egp          NUMERIC(10,2) NOT NULL,
  original_price_egp NUMERIC(10,2),
  is_active          BOOLEAN NOT NULL DEFAULT true,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Unlock Cost Config (admin-configurable per category/specialty) ───────────────
CREATE TABLE IF NOT EXISTS unlock_costs (
  id             VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  specialty_slug VARCHAR(100),
  category_slug  VARCHAR(100),
  points_cost    INTEGER NOT NULL DEFAULT 15,
  label          VARCHAR(200),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Seed default point packages ──────────────────────────────────────────────────
INSERT INTO point_packages (name_en, name_ar, points_amount, price_egp, original_price_egp, sort_order)
VALUES
  ('Basic Package',  'الحزمة الأساسية',  100, 100.00, NULL,   1),
  ('Bronze Package', 'الحزمة البرونزية', 250, 235.00, 250.00, 2),
  ('Gold Package',   'الحزمة الذهبية',   500, 450.00, 500.00, 3)
ON CONFLICT DO NOTHING;

-- ── Seed default unlock cost ─────────────────────────────────────────────────────
INSERT INTO unlock_costs (specialty_slug, category_slug, points_cost, label)
VALUES (NULL, NULL, 15, 'Default unlock cost')
ON CONFLICT DO NOTHING;
