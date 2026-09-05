@echo off
chcp 65001 >nul
color 0A
title FANNI E2E smoke — production READ-ONLY

cls
echo ======================================================================
echo   FANNI E2E SMOKE vs PRODUCTION  (read-only)
echo   No orders / top-ups / bonuses — health + public UI only
echo ======================================================================
echo.

set "ROOT=%~dp0.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"
cd /d "%ROOT%" 2>nul
if errorlevel 1 (
  echo [ERROR] Cannot cd to repo root
  pause
  exit /b 1
)

set "E2E_ALLOW_PROD_WRITES=0"
set "E2E_USE_LOCAL=0"
if not defined E2E_BASE_URL set "E2E_BASE_URL=https://app.upnexa-eg.com"
if not defined E2E_API_URL set "E2E_API_URL=https://api.upnexa-eg.com"
set "NODE_OPTIONS=--use-system-ca"

echo [INFO] App : %E2E_BASE_URL%
echo [INFO] API : %E2E_API_URL%
echo [INFO] Writes blocked on production
echo.

call pnpm --filter @workspace/e2e exec playwright test --project=local-chrome tests/smoke.spec.ts
set "EXITCODE=%ERRORLEVEL%"

if exist "%ROOT%\e2e\playwright-report\index.html" (
  start "" "%ROOT%\e2e\playwright-report\index.html"
)

pause
exit /b %EXITCODE%
