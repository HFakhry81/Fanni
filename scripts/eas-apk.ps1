$ErrorActionPreference = "Stop"
$mobile = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\artifacts\mobile"))
Set-Location -LiteralPath $mobile
Write-Host "EAS project directory: $mobile"
if (-not (Test-Path -LiteralPath ".\app.json")) {
    Write-Host "ERROR: app.json not found. Wrong repo path." -ForegroundColor Red
    exit 1
}
npx --yes eas-cli@16 build --platform android --profile preview --non-interactive
