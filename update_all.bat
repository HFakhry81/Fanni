@echo off
title Fanni Project - Deployment Dashboard
color 0A

echo ======================================================================
echo  FANNI PROJECT DEPLOYMENT SUITE
echo ======================================================================
echo.

set PORT=3000
set BASE_PATH=/
set EXPO_PUBLIC_DOMAIN=app.upnexa-eg.com

echo [1/4] Running Database Migrations...
pnpm --filter @workspace/db run migrate
if errorlevel 1 (
    echo [X] Error: Database migration failed!
    pause
    exit /b %errorlevel%
)
echo [✓] Migration completed successfully.
echo ----------------------------------------------------------------------

echo [2/4] Running Database Seeding...
pnpm --filter @workspace/db run seed
echo [✓] Seeding completed successfully.
echo ----------------------------------------------------------------------

echo [3/4] Building Backend & API Services...
pnpm --filter @workspace/db --filter @workspace/api-zod --filter @workspace/api-server run build
if errorlevel 1 (
    echo [X] Error: Backend build failed!
    pause
    exit /b %errorlevel%
)
echo [✓] Backend built successfully.
echo ----------------------------------------------------------------------

echo [4/4] Exporting Web Frontend (dist-web for app.upnexa-eg.com)...
set EXPO_PUBLIC_API_URL=https://api.upnexa-eg.com
set EXPO_ROUTER_APP_ROOT=./app
powershell -ExecutionPolicy Bypass -File scripts\export-web.ps1 -Zip
if errorlevel 1 (
    echo [X] Error: Web export failed!
    pause
    exit /b %errorlevel%
)
echo [✓] Web dist exported: artifacts\mobile\dist-web
echo [✓] Upload zip: artifacts\mobile\dist-web.zip -^> VPS /root/fanni-dist-web.zip
echo      Then on VPS: unzip + rsync to /var/www/fanni-web (see deploy\WEB-APP-UPNEXA.md)
echo ----------------------------------------------------------------------

echo ======================================================================
echo  ALL TASKS COMPLETED SUCCESSFULLY!
echo  Web dist path: artifacts\mobile\dist-web
echo  Web zip path:  artifacts\mobile\dist-web.zip
echo ======================================================================
pause