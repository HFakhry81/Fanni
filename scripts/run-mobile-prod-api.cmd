@echo off
chcp 65001 > nul
color 0E
title FANNI MOBILE - AGAINST PRODUCTION API

cls
echo ======================================================================
echo   FANNI MOBILE :: EXPO against PRODUCTION API
echo   Use only for QA. Local full stack uses run-local-mobile.cmd
echo ======================================================================
echo.

set MY_IP=192.168.1.17
set REACT_NATIVE_PACKAGER_HOSTNAME=%MY_IP%
set EXPO_PUBLIC_DOMAIN=api.upnexa-eg.com
set EXPO_PUBLIC_API_URL=https://api.upnexa-eg.com
set EXPO_PUBLIC_REPL_ID=production

set ROOT=E:\UpNexa.com\Fanni
set NODE_OPTIONS=--use-system-ca
set EXPO_OFFLINE=1

echo [INFO] Live Backend : https://api.upnexa-eg.com
echo [INFO] Metro IP     : %MY_IP%
cd /d "%ROOT%"
call pnpm run dev:mobile
pause
