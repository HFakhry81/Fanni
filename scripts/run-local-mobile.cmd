@echo off
chcp 65001 >nul
color 0B
title FANNI MOBILE - Expo -> local API :3000

cls
echo ======================================================================
echo   FANNI MOBILE :: EXPO METRO -> LOCAL API (same stack, no API2)
echo ======================================================================
echo.

set "ROOT=%~dp0.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"
set "NODE_OPTIONS=--use-system-ca"
set "EXPO_OFFLINE=1"

call "%~dp0set-lan-ip.cmd"
set "REACT_NATIVE_PACKAGER_HOSTNAME=%MY_IP%"

:: Same backend as run-local-server.cmd
set "EXPO_PUBLIC_DOMAIN=localhost"
set "EXPO_PUBLIC_API_URL=http://%MY_IP%:3000"
set "EXPO_PUBLIC_REPL_ID=local"

cd /d "%ROOT%" 2>nul
if errorlevel 1 (
  echo [ERROR] Cannot cd to %ROOT%
  pause
  exit /b 1
)

echo [INFO] Root      : %CD%
echo [INFO] Metro IP  : %MY_IP%
echo [INFO] Local API : %EXPO_PUBLIC_API_URL%
echo [INFO] Tip       : start API first - scripts\run-local-server.cmd
echo.
echo ----------------------------------------------------------------------
echo [ACTION] Launching Expo...
echo ----------------------------------------------------------------------
echo.

call pnpm run dev:mobile
set "EXITCODE=%ERRORLEVEL%"
pause
exit /b %EXITCODE%
