-- Migration 011: Align the default point economy with the product requirements.
-- Only updates the original seeded defaults; admin-customized specialty costs remain unchanged.

UPDATE unlock_costs
SET points_cost = 20,
    updated_at = NOW()
WHERE specialty_slug IS NULL
  AND category_slug IS NULL
  AND (label = 'Default unlock cost' OR points_cost = 15);

UPDATE point_packages
SET name_en = 'Basic Package',
    name_ar = 'الحزمة الأساسية',
    points_amount = 50,
    price_egp = 50.00,
    original_price_egp = NULL,
    sort_order = 1
WHERE sort_order = 1
  AND points_amount IN (100, 50);

UPDATE point_packages
SET name_en = 'Standard Package',
    name_ar = 'الحزمة المتوسطة',
    points_amount = 100,
    price_egp = 100.00,
    original_price_egp = NULL,
    sort_order = 2
WHERE sort_order = 2
  AND points_amount IN (250, 100);

UPDATE point_packages
SET name_en = 'Premium Package',
    name_ar = 'الحزمة الكبيرة',
    points_amount = 200,
    price_egp = 200.00,
    original_price_egp = NULL,
    sort_order = 3
WHERE sort_order = 3
  AND points_amount IN (500, 200);