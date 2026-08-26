-- Migration 022: Align point packages with final Word wallet/GL specs.
-- Ladder: 100/250/500/750/1000 EGP → 120/300/600/900/1200 points (120 pts per 100 EGP).
-- Deactivates the older 200/300/400 EGP packages. Idempotent.
-- Note: point_packages has no updated_at column.

UPDATE point_packages
SET is_active = false
WHERE is_active = true
  AND NOT (
    (price_egp::numeric = 100 AND points_amount = 120)
    OR (price_egp::numeric = 250 AND points_amount = 300)
    OR (price_egp::numeric = 500 AND points_amount = 600)
    OR (price_egp::numeric = 750 AND points_amount = 900)
    OR (price_egp::numeric = 1000 AND points_amount = 1200)
  );

INSERT INTO point_packages (name_en, name_ar, points_amount, price_egp, original_price_egp, is_active, sort_order)
SELECT 'Starter 100', 'باقة 100 جنيه', 120, 100.00, NULL, true, 1
WHERE NOT EXISTS (
  SELECT 1 FROM point_packages WHERE price_egp::numeric = 100 AND points_amount = 120
);

UPDATE point_packages
SET name_en = 'Starter 100',
    name_ar = 'باقة 100 جنيه',
    is_active = true,
    sort_order = 1
WHERE price_egp::numeric = 100 AND points_amount = 120;

INSERT INTO point_packages (name_en, name_ar, points_amount, price_egp, original_price_egp, is_active, sort_order)
SELECT 'Plus 250', 'باقة 250 جنيه', 300, 250.00, NULL, true, 2
WHERE NOT EXISTS (
  SELECT 1 FROM point_packages WHERE price_egp::numeric = 250 AND points_amount = 300
);

UPDATE point_packages
SET name_en = 'Plus 250',
    name_ar = 'باقة 250 جنيه',
    is_active = true,
    sort_order = 2
WHERE price_egp::numeric = 250 AND points_amount = 300;

INSERT INTO point_packages (name_en, name_ar, points_amount, price_egp, original_price_egp, is_active, sort_order)
SELECT 'Pro 500', 'باقة 500 جنيه', 600, 500.00, NULL, true, 3
WHERE NOT EXISTS (
  SELECT 1 FROM point_packages WHERE price_egp::numeric = 500 AND points_amount = 600
);

UPDATE point_packages
SET name_en = 'Pro 500',
    name_ar = 'باقة 500 جنيه',
    is_active = true,
    sort_order = 3
WHERE price_egp::numeric = 500 AND points_amount = 600;

INSERT INTO point_packages (name_en, name_ar, points_amount, price_egp, original_price_egp, is_active, sort_order)
SELECT 'Max 750', 'باقة 750 جنيه', 900, 750.00, NULL, true, 4
WHERE NOT EXISTS (
  SELECT 1 FROM point_packages WHERE price_egp::numeric = 750 AND points_amount = 900
);

UPDATE point_packages
SET name_en = 'Max 750',
    name_ar = 'باقة 750 جنيه',
    is_active = true,
    sort_order = 4
WHERE price_egp::numeric = 750 AND points_amount = 900;

INSERT INTO point_packages (name_en, name_ar, points_amount, price_egp, original_price_egp, is_active, sort_order)
SELECT 'Elite 1000', 'باقة 1000 جنيه', 1200, 1000.00, NULL, true, 5
WHERE NOT EXISTS (
  SELECT 1 FROM point_packages WHERE price_egp::numeric = 1000 AND points_amount = 1200
);

UPDATE point_packages
SET name_en = 'Elite 1000',
    name_ar = 'باقة 1000 جنيه',
    is_active = true,
    sort_order = 5
WHERE price_egp::numeric = 1000 AND points_amount = 1200;
