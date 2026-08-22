---
name: Resume checkpoint 23 Aug 2026
description: GL first slice and 7-tab admin IA shipped; migrate 020 applied locally.
---

Shipped locally: double-entry GL (`020_general_ledger.sql` applied — re-run migrate reported all 20 files already applied), postings on payment/welcome/unlock/refund/expense, trial balance + journal APIs, GL section on admin ledger plus accounting trial balance, admin tabs collapsed to 7 hubs.

Still waiting on secrets/live: Twilio env, OPay API, production VPS, live e2e on device. KYC card store still needs VPS (`pending_review` exists).

Next: do not re-implement GL. Remaining product work is KYC/VPS, live e2e, then Twilio/OPay when credentials exist. Later GL: fiscal periods, cost centers, cash-flow, gateway settlement, Super Admin fee-percent UI (setting key exists, default 0).

Do not edit the orders plan file.
