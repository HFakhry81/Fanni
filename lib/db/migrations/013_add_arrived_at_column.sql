-- Migration 013: add the missing arrival timestamp to live orders databases.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMP WITH TIME ZONE;