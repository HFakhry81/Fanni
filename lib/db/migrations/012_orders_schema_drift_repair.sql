-- Migration 012: keep the live orders table aligned with the Drizzle schema.
-- Every statement is safe to run against databases that already contain these fields.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS additional_details TEXT,
  ADD COLUMN IF NOT EXISTS location_accuracy NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS location_source VARCHAR(50),
  ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS arrival_detected_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS arrival_confirmed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS arrival_rejection_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'order_status'::regtype
      AND enumlabel = 'en_route'
  ) THEN
    ALTER TYPE order_status ADD VALUE 'en_route';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'order_status'::regtype
      AND enumlabel = 'arrived'
  ) THEN
    ALTER TYPE order_status ADD VALUE 'arrived';
  END IF;
END $$;