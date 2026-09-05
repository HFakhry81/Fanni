@echo off
chcp 65001 >nul
color 0B
title FANNI E2E FULL — screenshots + video

cls
echo ======================================================================
echo   FANNI E2E FULL-APP  (لقطات شاشة + فيديو لكل سيناريو)
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
  echo [WARN] e2e\.env missing — copy e2e\.env.example and fill E2E_* credentials
  echo.
)

set "E2E_RECORD=1"
set "NODE_OPTIONS=--use-system-ca"

echo [INFO] Root   : %CD%
echo [INFO] Project: full-recorded
echo [INFO] Video  : ON  ^|  Screenshots: ON  ^|  Trace: ON
echo [INFO] Output : e2e\test-results\  and  e2e\playwright-report\
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
