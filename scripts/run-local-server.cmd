@echo off
chcp 65001 >nul
color 0B
title FANNI API - single local server (port 3000)

cls
echo ======================================================================
echo   FANNI API :: LOCAL (ONE SERVER ONLY - no API2)
echo ======================================================================
echo.

set "ROOT=%~dp0.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"
set "NODE_OPTIONS=--use-system-ca"

cd /d "%ROOT%" 2>nul
if errorlevel 1 (
  echo [ERROR] Cannot cd to %ROOT%
  pause
  exit /b 1
)

if not exist "%ROOT%\package.json" (
  echo [ERROR] package.json not found in %ROOT%
  pause
  exit /b 1
)

if not exist "%ROOT%\.env" (
  echo [WARN] .env missing - copy .env.local.example to .env
  echo.
)

echo [INFO] Root    : %CD%
echo [INFO] Command : pnpm run dev:api
echo [INFO] Port    : 3000 (from .env PORT - do not start a second API)
echo.
echo ----------------------------------------------------------------------
echo [ACTION] Starting the ONLY local API...
echo ----------------------------------------------------------------------
echo.

call pnpm run dev:api
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" (
  echo.
  echo [ERROR] API exited with code %EXITCODE%
)
pause
exit /b %EXITCODE%
