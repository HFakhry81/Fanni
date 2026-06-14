---
name: Type discrimination — AppContext User vs AuthContext AuthUser
description: Two different user objects exist; they use different field names for the user type/role.
---

AppContext (`context/AppContext.tsx`) exports `User` with field **`.type`** (`UserType = "client" | "technician" | "admin" | null`).

AuthContext (`context/AuthContext.tsx`) exports `AuthUser` with field **`.role`** (`"client" | "technician" | "admin" | null`).

**Why:** Two context layers were built independently — AppContext holds the local/offline user model, AuthContext holds the server-session user model.

**How to apply:** In components that pull from `useApp()` (returns `User`), use `.type`. In components that pull from `useAuth()` (returns `AuthUser`), use `.role`. Mixing them causes TS2339 "property does not exist" errors.
