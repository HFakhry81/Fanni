#!/bin/bash
set -e
pnpm install --frozen-lockfile

psql "$DATABASE_URL" -c "
  ALTER TABLE locations ADD COLUMN IF NOT EXISTS centroid GEOGRAPHY(POINT, 4326);
  CREATE INDEX IF NOT EXISTS \"IDX_locations_centroid\"
    ON locations USING GIST (centroid)
    WHERE centroid IS NOT NULL;
"

node artifacts/api-server/migrations/009-reseed-locations.mjs

pnpm --filter db push
