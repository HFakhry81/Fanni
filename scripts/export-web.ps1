# Export Expo web app for app.upnexa-eg.com (or local preview).
# Usage:
#   cd E:\UpNexa.com\Fanni
#   powershell -ExecutionPolicy Bypass -File scripts\export-web.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\export-web.ps1 -Zip
param(
    [string]$ApiUrl = "https://api.upnexa-eg.com",
    [switch]$Zip
)

$ErrorActionPreference = "Stop"
$Root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$Mobile = Join-Path $Root "artifacts\mobile"
$OutDir = Join-Path $Mobile "dist-web"

if (-not $env:NODE_OPTIONS) {
    $env:NODE_OPTIONS = "--use-system-ca"
} elseif ($env:NODE_OPTIONS -notmatch "use-system-ca") {
    $env:NODE_OPTIONS = "$env:NODE_OPTIONS --use-system-ca"
}

$env:EXPO_PUBLIC_API_URL = $ApiUrl
$env:EXPO_ROUTER_APP_ROOT = "./app"

Set-Location -LiteralPath $Mobile
Write-Host "[export-web] mobile: $Mobile"
Write-Host "[export-web] API:    $ApiUrl"

if (-not (Test-Path -LiteralPath ".\app.json")) {
    Write-Host "ERROR: app.json not found under $Mobile" -ForegroundColor Red
    exit 1
}

pnpm exec expo export --platform web --output-dir dist-web
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[export-web] output: $OutDir" -ForegroundColor Green

if ($Zip) {
    $ZipPath = Join-Path $Mobile "dist-web.zip"
    if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
    Compress-Archive -Path (Join-Path $OutDir "*") -DestinationPath $ZipPath -CompressionLevel Optimal
    Write-Host "[export-web] zip:    $ZipPath" -ForegroundColor Green
}

