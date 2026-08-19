-- Migration 011: Lead pricing rules, unlock ledger fields, order declines

DO $$ BEGIN
  CREATE TYPE lead_refund_status AS ENUM ('none', 'requested', 'refunded', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS lead_pricing_rules (
  id                      VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  service_category        VARCHAR(100),
  service_specialization  VARCHAR(100),
  day_of_week             SMALLINT,
  start_time              VARCHAR(5),
  end_time                VARCHAR(5),
  points_cost             INTEGER NOT NULL,
  is_active               BOOLEAN NOT NULL DEFAULT true,
  priority                INTEGER NOT NULL DEFAULT 0,
  description             TEXT,
  created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_pricing_rules_active ON lead_pricing_rules (is_active, priority DESC);

CREATE TABLE IF NOT EXISTS order_declines (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id   VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id        VARCHAR NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (technician_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_order_declines_order ON order_declines (order_id);

ALTER TABLE lead_unlocks ADD COLUMN IF NOT EXISTS balance_before INTEGER NOT NULL DEFAULT 0;
ALTER TABLE lead_unlocks ADD COLUMN IF NOT EXISTS balance_after INTEGER NOT NULL DEFAULT 0;
ALTER TABLE lead_unlocks ADD COLUMN IF NOT EXISTS refund_status lead_refund_status NOT NULL DEFAULT 'none';

ALTER TABLE unlock_costs ALTER COLUMN points_cost SET DEFAULT 20;

UPDATE unlock_costs
SET points_cost = 20, label = COALESCE(label, 'Default unlock cost'), updated_at = NOW()
WHERE specialty_slug IS NULL AND category_slug IS NULL AND points_cost = 15;

INSERT INTO unlock_costs (specialty_slug, category_slug, points_cost, label)
SELECT NULL, NULL, 20, 'Default unlock cost'
WHERE NOT EXISTS (
  SELECT 1 FROM unlock_costs WHERE specialty_slug IS NULL AND category_slug IS NULL
);
