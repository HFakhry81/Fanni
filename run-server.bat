@echo off
color 0B
title Fanni Backend Server

echo ====================================================
echo       ______ _   _   _ _   _ ___ 
echo      ^|  ____/ \ ^| \ ^| ^| \ ^| ^|_ _^|
echo      ^| ^|__ / _ \^|  \^| ^|  \^| ^| ^| ^| 
echo      ^|  __^| / _ \ . ` ^| . ` ^| ^| ^| 
echo      ^| ^| / ___ \ ^|\  ^| ^|\  ^|_^| ^|_
echo      ^|_^|/_/   \_\_^| \_^|_^| \_^|_^|_____^|
echo.
echo  [SYSTEM] API Server
echo  [PORT]   3000
echo ====================================================
echo.

:: ======================================================
:: اضبط قاعدة البيانات المحلية هنا
:: ======================================================
set DATABASE_URL=postgresql://postgres:123456@localhost:5432/fanni_db
set SESSION_SECRET=local-dev-secret-change-in-production
set NODE_ENV=development
set PORT=3000

echo [INFO] API Server starting on http://localhost:3000
echo.

cd /d "%~dp0artifacts\api-server"
pnpm run dev
pause
