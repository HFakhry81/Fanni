-- Migration 018: Promotional vs purchased point buckets + terms acceptance.
-- Consume promotional points first. Idempotent.

ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS promotional_balance integer NOT NULL DEFAULT 0;

ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS purchased_balance integer NOT NULL DEFAULT 0;

ALTER TABLE lead_unlocks
  ADD COLUMN IF NOT EXISTS promotional_points_used integer NOT NULL DEFAULT 0;

ALTER TABLE lead_unlocks
  ADD COLUMN IF NOT EXISTS purchased_points_used integer NOT NULL DEFAULT 0;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS terms_version varchar(32);

UPDATE wallets w
SET
  promotional_balance = sub.promo_left,
  purchased_balance = GREATEST(0, w.points_balance - sub.promo_left)
FROM (
  SELECT
    w2.id AS wallet_id,
    GREATEST(
      0,
      LEAST(
        w2.points_balance,
        GREATEST(
          0,
          COALESCE((
            SELECT SUM(t.points_amount)
            FROM wallet_transactions t
            WHERE t.wallet_id = w2.id
              AND t.type = 'welcome_bonus'
              AND t.points_amount > 0
          ), 0)
          - COALESCE((
            SELECT SUM(-t.points_amount)
            FROM wallet_transactions t
            WHERE t.wallet_id = w2.id
              AND t.type = 'lead_unlock'
              AND t.points_amount < 0
          ), 0)
        )
      )
    ) AS promo_left
  FROM wallets w2
) sub
WHERE w.id = sub.wallet_id;
