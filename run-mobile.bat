@echo off
color 0E
title Fanni Mobile App

echo ====================================================
echo       ______ _   _   _ _   _ ___ 
echo      ^|  ____/ \ ^| \ ^| ^| \ ^| ^|_ _^|
echo      ^| ^|__ / _ \^|  \^| ^|  \^| ^| ^| ^| 
echo      ^|  __^| / _ \ . ` ^| . ` ^| ^| ^| 
echo      ^| ^| / ___ \ ^|\  ^| ^|\  ^|_^| ^|_
echo      ^|_^|/_/   \_\_^| \_^|_^| \_^|_^|_____^|
echo.
echo  [MOBILE] Metro Bundler ^& Expo
echo  [STATUS] Loading...
echo ====================================================
echo.

:: ======================================================
:: اضبط عنوان IP الخاص بجهازك هنا (ipconfig في CMD)
:: ======================================================
set MY_IP=192.168.1.11

:: ======================================================
:: رقم البورت الذي يعمل عليه السيرفر المحلي (run-server.bat)
:: ======================================================
set API_PORT=3000

:: --- لا تعدل ما بعد هذا السطر ---
set REACT_NATIVE_PACKAGER_HOSTNAME=%MY_IP%
set EXPO_PUBLIC_DOMAIN=%MY_IP%
set EXPO_PUBLIC_API_URL=http://%MY_IP%:%API_PORT%
set EXPO_PUBLIC_REPL_ID=local

echo [INFO] Computer IP      : %MY_IP%
echo [INFO] API Server URL   : http://%MY_IP%:%API_PORT%
echo [INFO] Metro Hostname   : %MY_IP%
echo.
echo  Scan the QR code with Expo Go on your phone
echo  (Phone and computer must be on the same Wi-Fi)
echo.

cd /d "%~dp0artifacts\mobile"
npx expo start --host lan -c
pause
