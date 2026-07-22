---
name: Payment Request Flow
description: Manual bank-transfer/InstaPay/e-wallet flow for purchasing points; admin confirms → wallet credited automatically.
---

## Architecture

**DB tables (migration 008):**
- `payment_requests` — client submits amount, method, reference number; status: pending/confirmed/rejected
- `payment_account_config` — single row; admin updates bank/InstaPay details shown to clients

**API routes (artifacts/api-server/src/routes/payments.ts):**
- `GET /api/payment-config` — public; clients fetch account details
- `POST /api/payments/request` — technician submits payment proof
- `GET /api/payments/my-requests` — technician lists own requests
- `GET /api/admin/payments` — admin lists all (filterable by status/date)
- `PATCH /api/admin/payments/:id/confirm` — admin confirms → auto-credits wallet via `getOrCreateWallet`
- `PATCH /api/admin/payments/:id/reject` — admin rejects
- `GET /api/admin/accounting/points` — revenue + points flow report (summary, txSummary, daily, byMethod)
- `GET/PUT /api/admin/payment-config` — admin manages account details

**Mobile screens:**
- `artifacts/mobile/app/(tech)/wallet.tsx` — 2-step modal: step 1 shows account details (copy-able rows), step 2 collects reference number; shows `myRequests` history with status colors
- `artifacts/mobile/app/(admin)/(tabs)/payments.tsx` — admin confirms/rejects with notes modal; filter chips by status
- `artifacts/mobile/app/(admin)/(tabs)/accounting.tsx` — revenue summary cards, points flow table, by-method breakdown, daily breakdown

**Why:** Payment gateway integration not ready; manual transfer flow is the MVP; admin must confirm before points are credited.

**How to apply:** When adding online payment gateway later, skip the payment_requests table for gateway-confirmed txns and post directly to wallet_transactions with paymentStatus='completed'.

## Startup seed (index.ts seedPointsDemo)
- Seeded automatically on server start (idempotent)
- Creates default packages (3), default unlock cost (15 pts), default payment config, welcome bonus (50 pts) per technician wallet
