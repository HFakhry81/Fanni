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
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

pnpm exec expo install --check
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

pnpm run typecheck
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nOK - project passes Expo doctor and APK preflight checks." -ForegroundColor Green
