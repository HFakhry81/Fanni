#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push

psql "$DATABASE_URL" -c "
  ALTER TABLE locations ADD COLUMN IF NOT EXISTS centroid GEOGRAPHY(POINT, 4326);
  CREATE INDEX IF NOT EXISTS \"IDX_locations_centroid\"
    ON locations USING GIST (centroid)
    WHERE centroid IS NOT NULL;
"

psql "$DATABASE_URL" << 'EOSQL'
DELETE FROM locations WHERE type = 'neighborhood';
EOSQL
