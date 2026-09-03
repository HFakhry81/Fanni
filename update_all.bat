@echo off
title Fanni UPDATE_ALL
color 0A
cd /d "%~dp0"

echo ======================================================================
echo  FANNI UPDATE_ALL
echo  Migrate + Seed + Backend + Web Dist + Git push
echo ======================================================================
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0UPDATE_ALL.ps1" %*
set ERR=%ERRORLEVEL%

echo.
if %ERR% NEQ 0 (
  echo [X] UPDATE_ALL failed with exit code %ERR%
  pause
  exit /b %ERR%
)

echo [OK] UPDATE_ALL finished.
pause
exit /b 0
