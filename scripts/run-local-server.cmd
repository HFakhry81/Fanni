@echo off
chcp 65001 > nul
color 0B
title FANNI API SERVER - LOCAL (E:\UpNexa.com\Fanni)

cls
echo ======================================================================
echo   FANNI API :: LOCAL DEVELOPMENT
echo   Root: E:\UpNexa.com\Fanni
echo ======================================================================
echo.

set ROOT=E:\UpNexa.com\Fanni

set NODE_OPTIONS=--use-system-ca
cd /d "%ROOT%"

:: Load .env if present (simple KEY=VAL lines) via PowerShell helper for reliability
if exist "%ROOT%\.env" (
  for /f "usebackq tokens=1,* delims==" %%A in (`powershell -NoProfile -Command "Get-Content '%ROOT%\.env' | Where-Object { $_ -match '^[A-Za-z_][A-Za-z0-9_]*=' -and $_ -notmatch '^\s*#' } | ForEach-Object { $_ }"`) do (
    set "%%A=%%B"
  )
)

:: Local defaults (override .env if missing)
if not defined PORT set PORT=3000
if not defined NODE_ENV set NODE_ENV=development
if not defined DATABASE_URL set DATABASE_URL=postgresql://postgres:123456@localhost:5432/fanni_db

echo [INFO] PORT         : %PORT%
echo [INFO] NODE_ENV     : %NODE_ENV%
echo [INFO] DATABASE_URL : (from .env or local default)
echo [INFO] Target       : %ROOT%\artifacts\api-server
echo.
echo ----------------------------------------------------------------------
echo [ACTION] Starting API (pnpm run dev)...
echo ----------------------------------------------------------------------
echo.

cd /d "%ROOT%\artifacts\api-server"
call pnpm run dev
pause

