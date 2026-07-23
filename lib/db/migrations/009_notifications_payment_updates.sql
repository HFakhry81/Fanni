-- Migration 009: notifications table + sender_details on payment_requests + payment_manager_id on config

-- 1. Add sender_details (JSON blob: the tech's own source account info)
ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS sender_details JSONB;

-- 2. Add payment_manager_id to config (which admin handles payment confirmations)
--    users.id is VARCHAR so we use VARCHAR here too (no FK to keep it simple)
ALTER TABLE payment_account_config
  ADD COLUMN IF NOT EXISTS payment_manager_id VARCHAR(36);

-- 3. In-app notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id           VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id      VARCHAR(36)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         VARCHAR(60)  NOT NULL,
  title_ar     TEXT         NOT NULL,
  title_en     TEXT         NOT NULL,
  body_ar      TEXT,
  body_en      TEXT,
  payload      JSONB,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;
