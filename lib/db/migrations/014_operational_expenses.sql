-- Migration 014: Operational expense ledger for net-profit reporting.

DO $$ BEGIN
  CREATE TYPE expense_category AS ENUM (
    'hosting', 'sms_otp', 'maps_api', 'marketing',
    'payment_gateway', 'salaries', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS operational_expenses (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  category expense_category NOT NULL,
  provider VARCHAR(100) NOT NULL,
  amount_egp NUMERIC(10, 2) NOT NULL CHECK (amount_egp >= 0),
  invoice_url TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operational_expenses_created_at
  ON operational_expenses (created_at DESC);