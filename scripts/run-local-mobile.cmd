@echo off
chcp 65001 > nul
color 0B
title FANNI MOBILE - LOCAL (E:\UpNexa.com\Fanni)

cls
echo ======================================================================
echo   FANNI MOBILE :: EXPO METRO (LOCAL API)
echo   Root: E:\UpNexa.com\Fanni
echo ======================================================================
echo.

set ROOT=E:\UpNexa.com\Fanni
set NODE_OPTIONS=--use-system-ca

:: LAN IP for phone on same Wi-Fi (update if your IP changes)
set MY_IP=192.168.1.17
set REACT_NATIVE_PACKAGER_HOSTNAME=%MY_IP%

:: LOCAL backend
set EXPO_PUBLIC_DOMAIN=localhost
set EXPO_PUBLIC_API_URL=http://%MY_IP%:3000
set EXPO_PUBLIC_REPL_ID=local

cd /d "%ROOT%"

echo [INFO] Metro IP  : %MY_IP%
echo [INFO] Local API : %EXPO_PUBLIC_API_URL%
echo [INFO] Tip       : start API first via run-server-local.cmd
echo.
echo ----------------------------------------------------------------------
echo [ACTION] Launching Expo...
echo ----------------------------------------------------------------------
echo.

call pnpm run dev:mobile
pause
