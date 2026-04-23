#!/bin/bash
set -e
pnpm install --frozen-lockfile

pnpm --filter @workspace/api-server exec tsx migrations/008-add-location-centroid.ts

pnpm --filter @workspace/api-server exec tsx migrations/009-reseed-locations.ts

pnpm --filter db push
