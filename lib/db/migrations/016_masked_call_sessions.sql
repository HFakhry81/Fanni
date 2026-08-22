CREATE TABLE IF NOT EXISTS masked_call_sessions (
  id                   VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             VARCHAR NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  initiator_user_id    VARCHAR NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  destination_user_id  VARCHAR NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  destination_e164     VARCHAR(20) NOT NULL,
  provider             VARCHAR(20) NOT NULL DEFAULT 'twilio',
  provider_call_sid    VARCHAR(64),
  status               VARCHAR(32) NOT NULL DEFAULT 'queued',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_masked_calls_order ON masked_call_sessions (order_id);
CREATE INDEX IF NOT EXISTS idx_masked_calls_sid ON masked_call_sessions (provider_call_sid);
