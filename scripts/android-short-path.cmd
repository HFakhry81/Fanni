@echo off
title FANNI Android - W: drive
subst W: /d >nul 2>&1
subst W: "E:\UpNexa.com\Fanni"
echo.
echo OK - W: now points to E:\UpNexa.com\Fanni
echo.
echo Open in Android Studio:
echo   W:\artifacts\mobile\android
echo.
pause
