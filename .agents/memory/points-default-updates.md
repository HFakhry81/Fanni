---
name: Points default updates
description: How to safely change the default point economy after the system is already in use.
---

Update both startup seed values and an idempotent database migration when changing default point packages or unlock costs.

**Why:** Startup seed logic intentionally skips existing rows, so changing only the seed leaves live installations on the old economy.

**How to apply:** Limit the migration to recognizable original defaults; preserve administrator-created specialty overrides and custom packages.