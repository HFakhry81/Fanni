@echo off
chcp 65001 >nul
color 0B
title FANNI E2E LOGIC SUITE — full business paths

cls
echo ======================================================================
echo   FANNI LOGIC SUITE
echo   شحن · ترحيب · بونص أدمن · طلبات · قبول/رفض · إكمال · فشل · استرداد
echo   Default: LOCAL writes  (E2E_USE_LOCAL=1)
echo ======================================================================
echo.

set "ROOT=%~dp0.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"
cd /d "%ROOT%" 2>nul || (echo [ERROR] bad root & pause & exit /b 1)

if not defined E2E_USE_LOCAL set "E2E_USE_LOCAL=1"
if not defined E2E_ALLOW_PROD_WRITES set "E2E_ALLOW_PROD_WRITES=0"
set "E2E_RECORD=1"
set "E2E_QUALITY_LOOP=1"
set "NODE_OPTIONS=--use-system-ca"
set "PLAYWRIGHT_BROWSERS_PATH=%ROOT%\e2e\.playwright-browsers"

if not exist "%PLAYWRIGHT_BROWSERS_PATH%\chromium_headless_shell-1234\chrome-headless-shell-win64\chrome-headless-shell.exe" (
  echo [SETUP] Installing Chromium...
  pushd "%ROOT%\e2e"
  call pnpm exec playwright install chromium
  popd
)

echo [INFO] E2E_USE_LOCAL=%E2E_USE_LOCAL%  ALLOW_PROD_WRITES=%E2E_ALLOW_PROD_WRITES%
echo [INFO] Docs: e2e\LOGIC_SCRIPTS.md
echo.
echo [WARN] Needs local API+web OR intentional prod writes.
echo        Fill E2E_LOCAL_* in e2e\.env for local.
echo.

pushd "%ROOT%\e2e"
call pnpm exec playwright test --project=logic-suite
set "EXITCODE=%ERRORLEVEL%"
popd

echo.
echo   Results: e2e\test-results\  ^|  e2e\playwright-report\index.html
echo   Map:     e2e\LOGIC_SCRIPTS.md
echo.

if exist "%ROOT%\e2e\playwright-report\index.html" start "" "%ROOT%\e2e\playwright-report\index.html"
if exist "%ROOT%\e2e\test-results" start "" explorer "%ROOT%\e2e\test-results"

pause
exit /b %EXITCODE%
