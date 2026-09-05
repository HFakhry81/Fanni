# Local vs Production environments (Windows)

## Project root
`E:\UpNexa.com\Fanni`

## Two env layers

| File | Git? | Purpose |
|------|------|---------|
| `.env` | **No** | Full **local** stack (DB, API port 3000, mobile → LAN API) |
| `.env.local.example` | Yes | Template to recreate local `.env` |
| `.env.production` | **No** | Your local draft of production values (fill secrets privately) |
| `.env.production.example` | Yes | Seed for `.env.production` |
| `deploy/env.production.example` | **Yes** | **Sanitized** production template for Git / VPS bootstrap |

VPS keeps real secrets in `/var/www/fanni/.env` (never committed). After `git pull`, operators copy/merge from `deploy/env.production.example` and fill `DATABASE_URL` + `SESSION_SECRET` on the server.

## Export production vars for Git

```bat
cd /d E:\UpNexa.com\Fanni
pnpm run env:export-prod
```

This reads `.env.production`, redacts secrets, and writes `deploy/env.production.example` for commit/push. VPS continues to pull code from Git; secrets stay on the VPS.

## Run locally

**One stack only** — do not start a second API (no UpNexa `:5000` / “API2”).

Source of truth under `scripts\`:

1. `run-local-server.cmd` — API on port **3000** (`pnpm run dev:api` from repo root)
2. `run-local-mobile.cmd` — Expo → LAN API `:3000` (auto-detects `MY_IP`)
3. `run-mobile-prod-api.cmd` — Expo Metro against **live** API (QA only)
4. `run-fanni.cmd` — simple menu for the above

Desktop shortcuts (`run-server.bat`, `run-mobile.bat`, …) are thin wrappers that call these scripts.

Daily refresh (install + migrate + seed + typecheck + web zip + git):

```bat
cd /d E:\UpNexa.com\Fanni
pnpm run update:all
```

Or:

```bat
cd /d E:\UpNexa.com\Fanni
pnpm run local:update
pnpm run dev:api
pnpm run dev:mobile
```

## One-time setup

```bat
cd /d E:\UpNexa.com\Fanni
copy .env.local.example .env
:: edit DATABASE_URL password
pnpm install
pnpm run migrate
pnpm run typecheck
pnpm test
```

## Windows TLS / pnpm

If `pnpm install` fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, run once in the repo:

```bat
set NODE_OPTIONS=--use-system-ca
pnpm install
```

The Desktop runners and `scripts/local-update.ps1` set this automatically.

If pnpm refuses `packageManager` pin (signature fetch), this repo uses `pnpm@11.23.0` with `pmOnFail=ignore` in `.npmrc`.

### Mobile Jest on Windows + pnpm

`artifacts/mobile` uses a lightweight Node Jest config (`jest.env.js` + `jest.mocks/`) instead of the full `jest-expo` RN setup file, which fails under pnpm on Windows. Run `pnpm --filter @workspace/mobile test` — all utils tests should pass.

### Android Studio / local APK (Windows path length)

pnpm + `E:\UpNexa.com\Fanni` can exceed CMake’s **250-character** path limit (`CMAKE_OBJECT_PATH_MAX`). Symptoms: CMake warnings, Gradle hangs on `buildCMakeDebug` / `expo-modules-core`.

1. Run `scripts\android-short-path.cmd` — maps repo to **`W:\`**
2. In Android Studio, open **`W:\artifacts\mobile\android`** (not the `E:\...` path)
3. First native build may take **15–30 minutes** (normal)
4. `gradle.properties` builds **arm64-v8a only** for faster local debug; use **EAS** for release APK with all ABIs
5. Optional (Admin PowerShell): enable long paths — `Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name 'LongPathsEnabled' -Value 1` then reboot

When done: `subst W: /d`

## Git remote

`origin` → `https://github.com/HFakhry81/Fanni` (VPS pulls this).

## Sentry

- Org: `upnexa-hb`
- Mobile project: `fanni`
- API project: `node`
- Cursor MCP: Settings → MCP → Sentry → Connect
- Details: `deploy/SENTRY-MCP.md`
