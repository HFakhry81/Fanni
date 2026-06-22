---
name: Tech approval gate
description: How unapproved technicians are blocked from the tab navigator
---

`user.isApproved` (boolean, optional) is returned by the API in `GET /api/auth/me`.
Backend sets `isApproved: false` for new technician registrations by default.

**Rule:** In `(tech)/_layout.tsx` → `TechLayout`, check before rendering tabs:
```tsx
if (user?.type === "technician" && user?.isApproved === false) {
  return <Redirect href="/tech-pending" />;
}
```

**Why:** Redirecting at the layout level blocks ALL tab routes cleanly without per-screen checks.

**How to apply:** Any time a technician logs in and `isApproved` is falsy, they land on `/tech-pending` (amber clock + checklist + refresh/logout). Admin approves them; next refresh loads the tab navigator.
