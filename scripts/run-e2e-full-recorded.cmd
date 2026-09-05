@echo off
chcp 65001 >nul
color 0B
title FANNI E2E FULL — screenshots + video (local-first)

cls
echo ======================================================================
echo   FANNI E2E FULL-APP  (لقطات شاشة + فيديو)
echo   Default: LOCAL API only — avoids junk data on production
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

if not exist "%ROOT%\e2e\.env" (
  echo [WARN] e2e\.env missing — copy e2e\.env.example
  echo        Fill E2E_LOCAL_* for write tests against local API.
  echo.
)

REM Prefer local stack so orders / top-ups / bonuses never hit live DB.
if not defined E2E_USE_LOCAL set "E2E_USE_LOCAL=1"
if not defined E2E_ALLOW_PROD_WRITES set "E2E_ALLOW_PROD_WRITES=0"

set "E2E_RECORD=1"
set "NODE_OPTIONS=--use-system-ca"

echo [INFO] Root              : %CD%
echo [INFO] Project           : full-recorded
echo [INFO] E2E_USE_LOCAL     : %E2E_USE_LOCAL%
echo [INFO] ALLOW_PROD_WRITES : %E2E_ALLOW_PROD_WRITES%
echo [INFO] Video/shots/trace : ON
echo [INFO] Output            : e2e\test-results\  ^&  e2e\playwright-report\
echo.
echo [HINT] Write journeys need local API + E2E_LOCAL_* in e2e\.env
echo        Production writes require E2E_ALLOW_PROD_WRITES=1 ^(do not use casually^)
echo.
echo ----------------------------------------------------------------------
echo [ACTION] Running full-app suite...
echo ----------------------------------------------------------------------
echo.

call pnpm --filter @workspace/e2e run test:full
set "EXITCODE=%ERRORLEVEL%"

echo.
echo ======================================================================
echo   RESULTS
echo   - HTML report : e2e\playwright-report\index.html
echo   - Videos      : e2e\test-results\**\video.webm
echo   - Screenshots : e2e\test-results\**\screenshots\*.png
echo ======================================================================
echo.

if exist "%ROOT%\e2e\playwright-report\index.html" (
  echo Opening HTML report...
  start "" "%ROOT%\e2e\playwright-report\index.html"
)

pause
exit /b %EXITCODE%
