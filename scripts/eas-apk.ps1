$ErrorActionPreference = "Stop"
if (-not $env:NODE_OPTIONS) {
    $env:NODE_OPTIONS = "--use-system-ca"
} elseif ($env:NODE_OPTIONS -notmatch "use-system-ca") {
    $env:NODE_OPTIONS = "$env:NODE_OPTIONS --use-system-ca"
}

$Root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
Set-Location -LiteralPath $Root

Write-Host "=== EAS APK build (preview) ===" -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File ./scripts/apk-check.ps1
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$mobile = Join-Path $Root "artifacts\mobile"
Set-Location -LiteralPath $mobile
Write-Host "`nStarting EAS cloud build from: $mobile`n" -ForegroundColor Cyan

npx --yes eas-cli@16 build --platform android --profile preview --non-interactive --wait --clear-cache
