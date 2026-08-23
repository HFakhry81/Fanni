---
name: Resume checkpoint 23 Aug 2026
description: Twilio deferred; VPS upload is ordered steps on origin (git pull + deploy-vps.sh).
---

Twilio is out of scope for this ship. Masked calling stays 503 until Console credentials exist.

Closeout for VPS: follow `deploy/VPS-STEPS.md` on the Ubuntu origin (not Cloudflare). Local Windows copy is already on `main`; server must `git pull` then `bash scripts/deploy-vps.sh`.

Do not re-implement GL. Do not edit the orders plan file. Do not put SSH passwords in chat.
