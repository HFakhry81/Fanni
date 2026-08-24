# Run from anywhere. Forces cwd to the Expo app so eas-cli finds app.json.
$ErrorActionPreference = "Stop"
$mobile = Join-Path $PSScriptRoot "..\artifacts\mobile" | Resolve-Path
Set-Location $mobile
Write-Host "EAS project directory: $mobile"
if (-not (Test-Path ".\app.json")) {
    Write-Host "ERROR: app.json not found. Wrong repo path." -ForegroundColor Red
    exit 1
}
npx --yes eas-cli@16 build -p android --profile preview
