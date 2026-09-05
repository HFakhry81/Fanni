@echo off
chcp 65001 >nul
color 0B
title FANNI E2E quality loop

set "ROOT=%~dp0.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"
cd /d "%ROOT%" || exit /b 1

set "PLAYWRIGHT_BROWSERS_PATH=%ROOT%\e2e\.playwright-browsers"
set "E2E_RECORD=1"
if not defined E2E_ALLOW_PROD_WRITES set "E2E_ALLOW_PROD_WRITES=0"
if not defined E2E_USE_LOCAL set "E2E_USE_LOCAL=0"
set "NODE_OPTIONS=--use-system-ca"
set "SUITE=%~1"
if "%SUITE%"=="" set "SUITE=ui-safe"

if not exist "%PLAYWRIGHT_BROWSERS_PATH%\chromium_headless_shell-1234\chrome-headless-shell-win64\chrome-headless-shell.exe" (
  echo [SETUP] Installing Chromium...
  pushd "%ROOT%\e2e"
  call pnpm exec playwright install chromium
  popd
)

echo ======================================================================
echo   FANNI quality-loop  suite=%SUITE%
echo ======================================================================
node "%ROOT%\e2e\quality-loop.mjs" --suite %SUITE%
set "EXITCODE=%ERRORLEVEL%"

echo.
type "%ROOT%\e2e\quality-loop-out\SUMMARY.md" 2>nul
echo.

if exist "%ROOT%\e2e\quality-loop-out\SUMMARY.md" start "" notepad "%ROOT%\e2e\quality-loop-out\SUMMARY.md"
if exist "%ROOT%\e2e\playwright-report\index.html" start "" "%ROOT%\e2e\playwright-report\index.html"
if exist "%ROOT%\e2e\test-results" start "" explorer "%ROOT%\e2e\test-results"

pause
exit /b %EXITCODE%
