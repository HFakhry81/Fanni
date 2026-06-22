---
name: Admin mobile change via OTP
description: Admin profile mobile change requires OTP; backend needed explicit fix
---

**Problem:** Admin `PATCH /api/auth/me` did not apply `mobileVal` to `adminUpdates`,
so admin mobile was silently ignored even though OTP validation ran for all users.

**Fix:** In `auth.ts` admin section, add:
```ts
if (mobileVal !== undefined) adminUpdates.mobile = mobileVal;
```

**Why:** The backend validates OTP and normalizes `mobileVal` before the admin/regular split.
The admin block just needs to pass it through.

**How to apply:** Mobile change for admin follows the same OTP flow as client/tech.
The `applyAdminSave(verToken)` helper in admin profile constructs the body with
`mobile` + `verificationToken` only when mobile actually changed and OTP was verified.
