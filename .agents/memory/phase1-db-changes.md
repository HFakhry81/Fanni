---
name: Phase 1 DB & API changes
description: What was added in Phase 1 — tech profile fields, race condition fix, approval workflow, rating system
---

## Migration 005 (lib/db/migrations/005_phase1_tech_fields.sql)

### users table additions
- `national_id` VARCHAR(14) UNIQUE
- `national_id_front_url` TEXT
- `national_id_back_url` TEXT
- `license_card_url` TEXT
- `is_approved` BOOLEAN NOT NULL DEFAULT false  ← clients auto-true, techs start false
- `bio` TEXT
- `years_of_experience` INTEGER
- `rating` NUMERIC(3,2) NOT NULL DEFAULT 0
- `rating_count` INTEGER NOT NULL DEFAULT 0

### orders table additions
- `scheduled_at` TIMESTAMP WITH TIME ZONE
- `client_rating` SMALLINT CHECK 1-5
- `tech_rating` SMALLINT CHECK 1-5
- `specialty_id` VARCHAR → FK service_specializations

### admins table additions
- `admin_role` VARCHAR(20) NOT NULL DEFAULT 'admin'  (super_admin / admin / operator)
- Seeded from existing isSuperAdmin boolean on migration

## Race Condition Fix
- `/orders/:id/acknowledge` now uses `db.transaction()` + `SELECT ... FOR UPDATE SKIP LOCKED`
- Returns HTTP 409 "Order already accepted by another technician" if row already taken

## New API Endpoints
- `GET /api/admin/technicians/pending` — lists unapproved techs (is_approved=false, is_active=true)
- `PATCH /api/admin/technicians/:id/approve` — sets is_approved=true
- `PATCH /api/admin/technicians/:id/reject` — sets is_approved=false, is_active=false
- `POST /api/orders/:id/rate` — body: {rating: 1-5}; updates order.client_rating or tech_rating + recalculates user running average

## buildAuthUser now returns
- isApproved, bio, yearsOfExperience, rating (as Number), ratingCount

## registerSchema new optional fields
- nationalIdFrontUrl, nationalIdBackUrl, licenseCardUrl, bio, yearsOfExperience

**Why:** Phase 1 closes the gaps identified in the product spec file 4 (gap analysis).
**How to apply:** Demo tech (01098765432) has isApproved=false — needs admin to approve via /admin/technicians/:id/approve before it can receive orders.
