@echo off
:: Shared LAN IP for Expo on physical devices. Call: call "%~dp0set-lan-ip.cmd"
set "MY_IP="
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1 -ExpandProperty IPAddress)"`) do set "MY_IP=%%i"
if not defined MY_IP set "MY_IP=192.168.1.17"
