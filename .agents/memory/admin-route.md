---
name: Admin dashboard Expo Router path
description: The correct router path for the admin dashboard tab.
---

Valid Expo Router `router.replace(...)` path: **`/(admin)/(tabs)/dashboard`**

Invalid (causes TS type error): `/(admin)/dashboard`

**Why:** The admin section uses a nested `(tabs)` group inside `(admin)`, so the full path must include `(tabs)`.
