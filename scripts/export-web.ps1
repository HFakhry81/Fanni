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

# Stage APK into web export so /fanni.apk survives rsync publish (not in sitemap).
$ApkCandidates = @(
    (Join-Path $Mobile "dist\fanni.apk"),
    (Join-Path $Root "fanni.apk")
)
$ApkStaged = $false
foreach ($apk in $ApkCandidates) {
    if (Test-Path -LiteralPath $apk) {
        Copy-Item -LiteralPath $apk -Destination (Join-Path $OutDir "fanni.apk") -Force
        $sizeMb = [math]::Round((Get-Item -LiteralPath $apk).Length / 1MB, 1)
        Write-Host "[export-web] apk:    staged fanni.apk (${sizeMb} MB) from $apk" -ForegroundColor Green
        $ApkStaged = $true
        break
    }
}
if (-not $ApkStaged) {
    Write-Host "[export-web] warn:   no fanni.apk found — place EAS build at artifacts\mobile\dist\fanni.apk before zip upload" -ForegroundColor Yellow
}

if ($Zip) {
    $ZipPath = Join-Path $Mobile "dist-web.zip"
    if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
    Push-Location -LiteralPath $OutDir
    try {
        Compress-Archive -Path * -DestinationPath $ZipPath -CompressionLevel Optimal
    } finally {
        Pop-Location
    }
    Write-Host "[export-web] zip:    $ZipPath (contents at zip root, not dist-web/)" -ForegroundColor Green
}

