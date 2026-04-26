-- Migration: Create location_aliases table
-- Purpose: Store alternate spellings (Nominatim variants) for locations so the
--          locationNormalizer alias map can match uncommon suburb/city names.
-- Safe to run on existing DBs: uses IF NOT EXISTS guards.

CREATE TABLE IF NOT EXISTS location_aliases (
  id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id VARCHAR NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  alias       VARCHAR(300) NOT NULL,
  note        VARCHAR(500),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique index: one alias string per location. Makes ON CONFLICT (location_id, alias)
-- reliable in the seed script and prevents duplicate rows.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_location_aliases_location_alias"
  ON location_aliases(location_id, alias);

-- Performance indexes
CREATE INDEX IF NOT EXISTS "IDX_location_aliases_location" ON location_aliases(location_id);
CREATE INDEX IF NOT EXISTS "IDX_location_aliases_alias"    ON location_aliases(alias);
