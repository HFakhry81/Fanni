@echo off
chcp 65001 >nul
color 0B
title FANNI API SERVER - LOCAL (E:\UpNexa.com\Fanni)

cls
echo ======================================================================
echo   FANNI API :: LOCAL DEVELOPMENT
echo   Root: E:\UpNexa.com\Fanni
echo ======================================================================
echo.

set "ROOT=E:\UpNexa.com\Fanni"
set "NODE_OPTIONS=--use-system-ca"

cd /d "%ROOT%" 2>nul
if errorlevel 1 (
  echo [ERROR] Access denied or path missing: %ROOT%
  pause
  exit /b 1
)

if not exist "%ROOT%\package.json" (
  echo [ERROR] package.json not found in %ROOT%
  pause
  exit /b 1
)

if not exist "%ROOT%\.env" (
  echo [WARN] .env missing — copy .env.local.example to .env
  echo.
)

echo [INFO] CWD    : %CD%
echo [INFO] Target : %ROOT%
echo [INFO] Command: pnpm --filter @workspace/api-server run dev
echo.
echo ----------------------------------------------------------------------
echo [ACTION] Starting API...
echo ----------------------------------------------------------------------
echo.

call pnpm --filter @workspace/api-server run dev
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" (
  echo.
  echo [ERROR] API exited with code %EXITCODE%
)
pause
exit /b %EXITCODE%
