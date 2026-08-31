-- Migration 026: Super-admin manual bonus grants with technician acknowledgment

DO $$ BEGIN
  ALTER TYPE point_transaction_type ADD VALUE IF NOT EXISTS 'bonus_grant';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE wallet_bonus_grant_status AS ENUM ('pending_ack', 'credited', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS wallet_bonus_grants (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id   VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_id        VARCHAR NOT NULL,
  points_amount   INTEGER NOT NULL CHECK (points_amount > 0),
  message         TEXT NOT NULL,
  status          wallet_bonus_grant_status NOT NULL DEFAULT 'pending_ack',
  notification_id VARCHAR,
  wallet_tx_id    VARCHAR REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  tech_acknowledged_at TIMESTAMPTZ,
  credited_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wallet_bonus_grants_technician_status_idx
  ON wallet_bonus_grants (technician_id, status);

CREATE INDEX IF NOT EXISTS wallet_bonus_grants_admin_created_idx
  ON wallet_bonus_grants (admin_id, created_at DESC);
