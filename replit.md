# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Fanni Mobile App (`artifacts/mobile`)

Bilingual (Arabic RTL + English LTR) home maintenance service app built with Expo Router.

### Brand
- Primary color: **#F5A623** (orange)
- Secondary: **#2D2D2D** (dark charcoal)
- Font: Inter (400/500/600/700)
- Default language: Arabic (RTL)

### User Types & Routes
- **Client** → `/(client)/` tabs: home, orders, invoices, profile
- **Technician** → `/(tech)/` tabs: map, orders, profile
- **Admin** → `/(admin)/` tabs: dashboard, users, orders, stats, permissions

### Demo Credentials
- Client: `01012345678` / `123456`
- Technician: `01098765432` / `123456`
- Admin: `admin` / `admin`

### Geography — Egypt Focus
- Default region: **Alexandria** (lat 31.2001, lng 29.9187)
- `constants/egyptLocations.ts` — 27 Egyptian governorates seed source (also seeded into DB)
- **PostGIS** enabled on the database; `orders.location GEOGRAPHY(POINT,4326)` column stores pin coordinates
- `lib/db/src/schema/locations.ts` — `locationsTable` (237 rows: govs/areas/neighborhoods) + `nominatimCacheTable`
- **API routes** (no auth required):
  - `GET /api/locations/governorates` — all 27 governorates from DB
  - `GET /api/locations/:govId/areas` — areas for a governorate
  - `GET /api/locations/:areaId/neighborhoods` — neighborhoods for an area
  - `GET /api/geo/search?q=&lang=` — Nominatim proxy with 30-day DB cache, 1 req/sec queue
  - `GET /api/geo/reverse?lat=&lon=&lang=` — reverse geocode with caching
  - `GET /api/technicians/available?lat=&lon=&radiusKm=` — spatial ST_DWithin filter (falls back to text match)
- `components/LocationPicker.tsx` — DB-backed cascading dropdowns + integrated map picker
- `components/MapPickerModal.tsx` — full-screen map (react-native-maps + OpenStreetMap tiles), draggable pin, address search, web fallback
- Map screen (`(tech)/map.tsx`) shows Alexandria with Mediterranean sea band, district tags, city coordinates

### Architecture
- **Frontend-only** (no backend calls) — uses AsyncStorage for persistence
- `context/AppContext.tsx` — i18n (130+ keys), user state, RTL
- `context/OrderContext.tsx` — orders + invoices with seed data
- `constants/colors.ts` — design tokens (Navy #0D1B2A, Golden #F5A623, Sky Blue #4DADD9)
- `hooks/useColors.ts` — color scheme hook

### Key Screens
- `app/welcome.tsx` — 3 login entry points + language toggle
- `app/login.tsx` — mock auth for 3 user types
- `app/register.tsx` — multi-step registration (client + technician)
- `app/new-order.tsx` — 3-step order creation
- `app/order-details.tsx` — order tracking/invoice/rating
- `app/(client)/home.tsx` — categories grid + subcategories
- `app/(tech)/map.tsx` — pending orders map + accept modal
- `app/(tech)/orders.tsx` — active orders + completion flow (materials/solution/satisfaction)
- `app/(admin)/dashboard.tsx` — stats overview + recent orders
- `app/(admin)/users.tsx` — clients/technicians management
- `app/(admin)/orders.tsx` — all orders with filter chips
- `app/(admin)/stats.tsx` — charts (category breakdown, status, top techs)
- `app/(admin)/permissions.tsx` — toggle-based permissions management
