# Migration Run: Normalize Order Areas (Task #238)

**Script:** `artifacts/api-server/src/scripts/normalizeOrderAreas.ts`
**Command:** `pnpm --filter @workspace/api-server normalize-areas`
**Date:** 2026-04-26
**Environment:** Production (DATABASE_URL secret)

## Execution Output

```
> @workspace/api-server@0.0.0 normalize-areas
> pnpm --filter @workspace/db build && tsx src/scripts/normalizeOrderAreas.ts

[00:38:33.903] INFO: Starting order area/governorate normalization migration
[00:38:35.212] INFO: Location cache warmed  count=423
[00:38:35.223] INFO: Orders fetched — scanning for non-slug values  total=3
[00:38:35.224] INFO: Normalized location to slug
    raw: "al montaza district"
    resolved: "alexandria__el_montaza"
    type: "area"
[00:38:35.243] INFO: Order location normalized
    orderId: "1776912555604k4mst"
    orderNumber: "ORD-000001"
    before: { governorate: "alexandria", area: "al montaza district" }
    after:  { governorate: "alexandria", area: "alexandria__el_montaza" }
[00:38:35.243] INFO: Normalized location to slug
    raw: "al montaza district"
    resolved: "alexandria__el_montaza"
    type: "area"
[00:38:35.246] INFO: Order location normalized
    orderId: "1776948470028vhxyz"
    orderNumber: "ORD-000002"
    before: { governorate: "alexandria", area: "al montaza district" }
    after:  { governorate: "alexandria", area: "alexandria__el_montaza" }
[00:38:35.246] INFO: Normalized location to slug
    raw: "al montaza district"
    resolved: "alexandria__el_montaza"
    type: "area"
[00:38:35.249] INFO: Order location normalized
    orderId: "1776979267932wz9st"
    orderNumber: "ORD-000003"
    before: { governorate: "alexandria", area: "al montaza district" }
    after:  { governorate: "alexandria", area: "alexandria__el_montaza" }
[00:38:35.249] INFO: Migration complete
    total: 3
    updated: 3
    skipped: 0
    unresolved: 0
    errors: 0
```

## Post-Run Verification

Verification query run immediately after:

```sql
SELECT id, order_number, governorate, area
FROM orders
WHERE
  (governorate IS NOT NULL AND governorate !~ '^[a-z0-9]+(__[a-z0-9_]+)?$')
  OR
  (area IS NOT NULL AND area !~ '^[a-z0-9]+(__[a-z0-9_]+)?$');
```

**Result:** 0 rows returned.

Script output: `Total orders with governorate/area: 3 | Non-slug rows remaining: 0 | All rows have clean slug values. Migration verified.`

## Summary

| Metric     | Value |
|------------|-------|
| Total rows | 3     |
| Updated    | 3     |
| Skipped    | 0     |
| Unresolved | 0     |
| Errors     | 0     |

All 3 orders had `area = "al montaza district"` (raw Nominatim display name) and were
successfully resolved to the canonical slug `"alexandria__el_montaza"`. No rows remain
with non-slug values.
