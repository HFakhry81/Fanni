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

if not exist "%ROOT%\.env" (
  echo [WARN] .env missing — copy .env.local.example to .env
  echo.
)

echo [INFO] Target : %ROOT%
echo [INFO] Command: pnpm run dev:api
echo.
echo ----------------------------------------------------------------------
echo [ACTION] Starting API...
echo ----------------------------------------------------------------------
echo.

call pnpm run dev:api
pause
