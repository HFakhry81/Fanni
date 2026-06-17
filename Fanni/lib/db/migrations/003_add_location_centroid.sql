ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS centroid geography(POINT, 4326);

CREATE INDEX IF NOT EXISTS "IDX_locations_centroid"
  ON locations USING GIST (centroid)
  WHERE centroid IS NOT NULL;
