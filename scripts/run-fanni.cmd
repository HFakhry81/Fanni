@echo off
chcp 65001 >nul
color 0B
title FANNI - unified local runners

cls
echo ======================================================================
echo   FANNI :: ONE local stack (no second API / no API2)
echo   Repo scripts are the only source of truth
echo ======================================================================
echo.
echo   [1] Start API          (port 3000 - only server)
echo   [2] Start Mobile       (Expo -> local API :3000)
echo   [3] Mobile vs Prod API (QA only)
echo   [4] UPDATE_ALL         (install / migrate / typecheck / ...)
echo   [0] Exit
echo.
choice /c 12340 /n /m "Select: "
if errorlevel 5 goto :eof
if errorlevel 4 goto update
if errorlevel 3 goto mobile_prod
if errorlevel 2 goto mobile
if errorlevel 1 goto api
goto :eof

:api
call "%~dp0run-local-server.cmd"
goto :eof

:mobile
call "%~dp0run-local-mobile.cmd"
goto :eof

:mobile_prod
call "%~dp0run-mobile-prod-api.cmd"
goto :eof

:update
cd /d "%~dp0.."
call "%~dp0..\update_all.bat"
goto :eof
