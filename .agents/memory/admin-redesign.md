---
name: Admin interface redesign
description: New 7-tab admin layout with hub-and-spoke users screen, profile as initial route.
---

## Tab structure (left-to-right in code → right-to-left in RTL UI)
1. `profile` — الملف الشخصي (initial route after login)
2. `users` — المستخدمون (hub screen)
3. `categories` — الفئات والتخصصات (existing, kept)
4. `orders` — الطلبات (existing, kept)
5. `ledger` — دفتر الأستاذ (existing, kept)
6. `permissions` — مسئولو النظام (title changed from admin.permissions → admin.sysAdmins)
7. `stats` — الإحصائيات (existing, kept)

Hidden (href: null): `dashboard`, `pending`, `login-logs`, `map-dashboard`, `missed-locations`

**Why:** Don't add `map-dashboard.web` as a hidden screen — it's a platform-specific file and Expo Router treats it as the same route as `map-dashboard`. Adding it causes a "No route named" error.

## Users Hub (users.tsx) navigation state
- `mainView`: `'hub' | 'clients' | 'technicians' | 'collection'`
- `techSubView`: `'hub' | 'list'`
- `collSubView`: `'hub' | 'received' | 'refunded' | 'tech_balances' | 'commission'`

Clients / technicians: call `/api/admin/users?role=...` with filter + search.
Login logs: router.push to `/(admin)/(tabs)/login-logs` (hidden tab, still navigable).
Technicians → live map: router.push to `/(admin)/(tabs)/map-dashboard`.
Technicians → missed: router.push to `/(admin)/(tabs)/missed-locations`.
Technicians → pending: router.push to `/(admin)/(tabs)/pending`.
Collection received/commission: call `/api/admin/ledger`.
Tech balances + refunded: placeholder UI ("coming soon").

## Translation keys added (AppContext.tsx)
Keys starting with: `admin.categories`, `admin.ledger`, `admin.sysAdmins`, `admin.users.*`, `admin.tech.*`, `admin.coll.*`, `common.back`, `common.search`, `common.noData`, `common.comingSoon`, `common.egpShort`, etc.
