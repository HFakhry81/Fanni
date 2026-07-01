---
name: Fanni Points System
description: Architecture of the prepaid points wallet feature for technicians — unlock flow, DB tables, API routes, and mobile screens.
---

## Architecture

Technicians buy point packages and spend points to unlock client contact details for pending orders.

### DB Tables (migration 007_points_system.sql)
- `wallets` — one per technician, holds `points_balance`
- `wallet_transactions` — audit log: package_purchase / lead_unlock / dispute_refund / admin_adjustment / welcome_bonus
- `lead_unlocks` — (technician_id, order_id) UNIQUE; records cost + call/whatsapp tracking
- `disputes` — submitted against a lead_unlock; admin approve → auto-refund points
- `point_packages` — admin-configurable; seeded with 100/250/500 pt packages
- `unlock_costs` — default 15 pts; nullable specialty_slug/category_slug for overrides

### API Routes
- `GET /api/wallet` — tech's wallet + last 50 transactions
- `GET /api/wallet/packages` — active packages (public)
- `GET /api/wallet/unlock-cost?category=&specialty=` — resolve cost
- `POST /api/orders/:id/unlock` — spend points, returns contact details (402 if insufficient)
- `PATCH /api/orders/:id/unlock/track` — record call/whatsapp click
- `POST /api/disputes` — tech submits dispute for a lead_unlock
- `GET /api/disputes` — tech's own disputes
- Admin routes: `/api/admin/wallet-stats`, `/api/admin/wallet/adjust`, `/api/admin/point-packages` (CRUD), `/api/admin/unlock-costs` (CRUD), `/api/admin/disputes` (list + resolve)

### Mobile
- `app/(tech)/wallet.tsx` — balance card, buy packages modal, transaction history
- Wallet tab added to `(tech)/_layout.tsx` (both ClassicTechTabs and NativeTechTabs)
- `available-orders.tsx` — orders masked by default; "Unlock for X pts" button; contact box revealed after unlock with Call + WhatsApp buttons

### Masking Logic (technicians.ts pending-orders endpoint)
- Non-unlocked orders: `street`, `building`, `floor`, `landmark`, `latitude`, `longitude` → null
- `isUnlocked: bool` and `unlockCost: int` added to each order in response
- Batch query lead_unlocks for current tech + current page of order IDs

**Why:** Prevents techs from seeing client contact info without paying — core monetization mechanic.

**How to apply:** Any new field exposed in pending-orders that is sensitive contact data must also be nulled when `isUnlocked === false`.
