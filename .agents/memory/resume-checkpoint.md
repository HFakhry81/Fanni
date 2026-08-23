---
name: Resume checkpoint 23 Aug 2026
description: VPS deploy cannot SSH from this PC (Cloudflare + no key); run deploy-vps.sh on origin.
---

Live `https://api.upnexa-eg.com/api/healthz` returns 200. DNS is Cloudflare; SSH to that hostname times out. This Windows machine has no `~/.ssh` keys.

Operator: on the Ubuntu origin (existing panel/SSH), from the app clone:

```
git pull
bash scripts/deploy-vps.sh
```

That creates `/var/www/storage/fanni/{id,carnehat,uploads}`, merges missing `.env` keys from `deploy/env.production.example`, migrates, builds, reloads PM2 `fanni-api` on port 5000.

Do not put SSH passwords in chat. Twilio still needs Console AC SID + token. OPay still deferred.

Do not re-implement GL. Do not edit the orders plan file.
