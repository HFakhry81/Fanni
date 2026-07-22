-- Migration 008: Payment Requests & Account Config
-- Clients submit manual transfer proofs; admin confirms → points credited automatically.

-- ── Payment requests ────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE payment_request_status AS ENUM ('pending', 'confirmed', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method_type AS ENUM ('bank_transfer', 'instapay', 'e_wallet');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS payment_requests (
  id               VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id       VARCHAR REFERENCES point_packages(id) ON DELETE SET NULL,
  amount_egp       NUMERIC(10,2) NOT NULL,
  points_requested INTEGER NOT NULL,
  payment_method   payment_method_type NOT NULL DEFAULT 'bank_transfer',
  reference_number VARCHAR(255),
  transfer_note    TEXT,
  status           payment_request_status NOT NULL DEFAULT 'pending',
  admin_id         VARCHAR,
  admin_notes      TEXT,
  confirmed_at     TIMESTAMP,
  wallet_tx_id     VARCHAR REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_user_id ON payment_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status  ON payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_created ON payment_requests(created_at DESC);

-- ── Payment account config ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_account_config (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name       VARCHAR(100),
  account_name    VARCHAR(200),
  account_number  VARCHAR(100),
  iban            VARCHAR(50),
  instapay_id     VARCHAR(100),
  ewallet_number  VARCHAR(50),
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Default placeholder config (admin will update from the app)
INSERT INTO payment_account_config (bank_name, account_name, account_number, instapay_id, notes)
VALUES (
  'البنك الأهلي المصري',
  'شركة فاني للصيانة المنزلية',
  '1234567890',
  'fanni@instapay',
  'يرجى كتابة رقم الهاتف المسجل في التطبيق كمرجع للتحويل'
)
ON CONFLICT DO NOTHING;
