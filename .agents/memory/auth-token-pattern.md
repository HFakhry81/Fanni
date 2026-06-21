---
name: Auth token pattern in mobile app
description: How to get the session token in screens/components throughout the mobile app.
---

`AuthContextValue` exports `sessionToken: string | null` — use this in all screens:

```tsx
const { sessionToken } = useAuth();
```

Do NOT use `const { token } = useAuth()` — `token` is not exported. Admin screens that need the token for API calls should destructure `sessionToken`.

**Why:** The context internally uses SecureStore with key `fanni_auth_token`, but the value is surfaced as `sessionToken` in the public context interface.
