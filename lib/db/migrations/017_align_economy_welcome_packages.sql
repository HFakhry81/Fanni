-- Migration 017: Align point economy with approved baseline.
-- Welcome 60; packages 100/200/300/400/500 EGP → 120/240/360/480/600 points.
-- Bonus ladder +20/+40/+60/+80/+100. Default lead cost 20. Idempotent.

UPDATE unlock_costs
SET points_cost = 20,
    updated_at = NOW()
WHERE specialty_slug IS NULL
  AND category_slug IS NULL
  AND points_cost <> 20;

UPDATE point_packages
SET is_active = false
WHERE is_active = true
  AND NOT (
    (price_egp::numeric = 100 AND points_amount = 120)
    OR (price_egp::numeric = 200 AND points_amount = 240)
    OR (price_egp::numeric = 300 AND points_amount = 360)
    OR (price_egp::numeric = 400 AND points_amount = 480)
    OR (price_egp::numeric = 500 AND points_amount = 600)
  );

INSERT INTO point_packages (name_en, name_ar, points_amount, price_egp, original_price_egp, is_active, sort_order)
SELECT 'Starter 100', 'باقة 100 جنيه', 120, 100.00, NULL, true, 1
WHERE NOT EXISTS (
  SELECT 1 FROM point_packages WHERE price_egp::numeric = 100 AND points_amount = 120 AND is_active = true
);

INSERT INTO point_packages (name_en, name_ar, points_amount, price_egp, original_price_egp, is_active, sort_order)
SELECT 'Plus 200', 'باقة 200 جنيه', 240, 200.00, NULL, true, 2
WHERE NOT EXISTS (
  SELECT 1 FROM point_packages WHERE price_egp::numeric = 200 AND points_amount = 240 AND is_active = true
);

INSERT INTO point_packages (name_en, name_ar, points_amount, price_egp, original_price_egp, is_active, sort_order)
SELECT 'Pro 300', 'باقة 300 جنيه', 360, 300.00, NULL, true, 3
WHERE NOT EXISTS (
  SELECT 1 FROM point_packages WHERE price_egp::numeric = 300 AND points_amount = 360 AND is_active = true
);

INSERT INTO point_packages (name_en, name_ar, points_amount, price_egp, original_price_egp, is_active, sort_order)
SELECT 'Max 400', 'باقة 400 جنيه', 480, 400.00, NULL, true, 4
WHERE NOT EXISTS (
  SELECT 1 FROM point_packages WHERE price_egp::numeric = 400 AND points_amount = 480 AND is_active = true
);

INSERT INTO point_packages (name_en, name_ar, points_amount, price_egp, original_price_egp, is_active, sort_order)
SELECT 'Elite 500', 'باقة 500 جنيه', 600, 500.00, NULL, true, 5
WHERE NOT EXISTS (
  SELECT 1 FROM point_packages WHERE price_egp::numeric = 500 AND points_amount = 600 AND is_active = true
);

CREATE TEMP TABLE welcome_topup_targets AS
SELECT w.id AS wallet_id
FROM wallets w
JOIN (
  SELECT wallet_id, SUM(points_amount) AS bonus_pts
  FROM wallet_transactions
  WHERE type = 'welcome_bonus'
  GROUP BY wallet_id
) t ON t.wallet_id = w.id
WHERE t.bonus_pts = 50;

INSERT INTO wallet_transactions (wallet_id, points_amount, type, description)
SELECT wallet_id, 10, 'welcome_bonus', 'تسوية المكافأة الترحيبية إلى 60 — Welcome bonus align'
FROM welcome_topup_targets t
WHERE NOT EXISTS (
  SELECT 1 FROM wallet_transactions wt
  WHERE wt.wallet_id = t.wallet_id
    AND wt.type = 'welcome_bonus'
    AND wt.description LIKE '%Welcome bonus align%'
);

UPDATE wallets w
SET points_balance = points_balance + 10,
    updated_at = NOW()
FROM welcome_topup_targets t
WHERE w.id = t.wallet_id;
