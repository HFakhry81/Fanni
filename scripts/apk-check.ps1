$ErrorActionPreference = "Stop"
if (-not $env:NODE_OPTIONS) {
    $env:NODE_OPTIONS = "--use-system-ca"
} elseif ($env:NODE_OPTIONS -notmatch "use-system-ca") {
    $env:NODE_OPTIONS = "$env:NODE_OPTIONS --use-system-ca"
}

$Root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$mobile = Join-Path $Root "artifacts\mobile"
Set-Location -LiteralPath $mobile

Write-Host "=== APK preflight (Expo doctor + deps) ===" -ForegroundColor Cyan
Write-Host "Directory: $mobile`n"

if (-not (Test-Path -LiteralPath ".\app.json")) {
    Write-Host "ERROR: app.json not found." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path -LiteralPath ".\eas.json")) {
    Write-Host "ERROR: eas.json not found (must run from artifacts/mobile)." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path -LiteralPath ".\google-services.json")) {
    Write-Host "ERROR: google-services.json missing (required for Android push)." -ForegroundColor Red
    exit 1
}

pnpm exec expo-doctor
$doctorCode = $LASTEXITCODE
if ($doctorCode -ne 0) {
    Write-Host ""
    Write-Host "NOTE: In pnpm monorepos, expo-doctor often flags duplicate native modules" -ForegroundColor Yellow
    Write-Host "even when versions match (same package, different store links)." -ForegroundColor Yellow
    Write-Host "EAS Cloud installs fresh — local duplicates do not always block APK builds." -ForegroundColor Yellow
    Write-Host "If versions differ (not just duplicate paths), fix deps before building." -ForegroundColor Yellow
    # Soft-fail only when exit was from doctor; still fail hard on install --check / typecheck below.
    Write-Host "Continuing APK preflight after doctor warnings..." -ForegroundColor Yellow
}

pnpm exec expo install --check
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

pnpm run typecheck
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($doctorCode -ne 0) {
    Write-Host "`nOK - typecheck + expo install --check passed (doctor had warnings)." -ForegroundColor Green
} else {
    Write-Host "`nOK - project passes Expo doctor and APK preflight checks." -ForegroundColor Green
}
