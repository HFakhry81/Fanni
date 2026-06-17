@echo off
:: Fanni — Local Database Migration Launcher
:: Double-click this file to run the migration
powershell -ExecutionPolicy Bypass -File "%~dp0migrate-local.ps1"
