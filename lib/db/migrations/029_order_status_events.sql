-- Audit trail for every order status transition (create / accept / start / complete / cancel / …)
CREATE TABLE IF NOT EXISTS order_status_events (
  id              BIGSERIAL PRIMARY KEY,
  order_id        VARCHAR NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status     VARCHAR(32),
  to_status       VARCHAR(32) NOT NULL,
  actor_user_id   VARCHAR(64),
  actor_role      VARCHAR(32),
  source          VARCHAR(64),
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_status_events_order_id
  ON order_status_events (order_id, created_at DESC);
