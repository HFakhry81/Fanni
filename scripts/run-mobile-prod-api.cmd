@echo off
chcp 65001 >nul
color 0E
title FANNI MOBILE - Expo -> production API (QA only)

cls
echo ======================================================================
echo   FANNI MOBILE :: EXPO against PRODUCTION API
echo   QA only. Full local stack: run-local-server.cmd + run-local-mobile.cmd
echo ======================================================================
echo.

set "ROOT=%~dp0.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"
set "NODE_OPTIONS=--use-system-ca"
set "EXPO_OFFLINE=1"

call "%~dp0set-lan-ip.cmd"
set "REACT_NATIVE_PACKAGER_HOSTNAME=%MY_IP%"
set "EXPO_PUBLIC_DOMAIN=api.upnexa-eg.com"
set "EXPO_PUBLIC_API_URL=https://api.upnexa-eg.com"
set "EXPO_PUBLIC_REPL_ID=production"

cd /d "%ROOT%" 2>nul
if errorlevel 1 (
  echo [ERROR] Cannot cd to %ROOT%
  pause
  exit /b 1
)

echo [INFO] Root         : %CD%
echo [INFO] Live Backend : https://api.upnexa-eg.com
echo [INFO] Metro IP     : %MY_IP%
echo.
call pnpm run dev:mobile
set "EXITCODE=%ERRORLEVEL%"
pause
exit /b %EXITCODE%
