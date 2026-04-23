#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push
pnpm tsx artifacts/api-server/migrations/008-add-location-centroid.ts
pnpm tsx artifacts/api-server/migrations/009-reseed-locations.ts
