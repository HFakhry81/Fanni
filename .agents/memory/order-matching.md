---
name: Order matching consistency
description: Routing between customer orders and technician profiles must use the same canonical category and location normalization in API queries and WebSocket delivery.
---

The order list and live order notifications must share one tolerant matching policy: canonicalize category aliases (Arabic, English, slug, spacing) and store profile/order locations as canonical slugs. Pending-order edits should remove the stale broadcast entry and re-announce the order.

**Why:** A technician can have the correct service and area while seeing an empty list when the GET endpoint and WebSocket broadcaster compare different representations.

**How to apply:** When adding a service category or location source, update normalization/matching centrally and verify both the pending-orders endpoint and live registration/replay path.