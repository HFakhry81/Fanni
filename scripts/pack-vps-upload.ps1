#Requires -Version 5.1
# Builds a WinSCP zip: backend source + optional Expo web dist. Never packs .env, SQL dumps, or node_modules.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Stage = Join-Path $env:TEMP "fanni-vps-stage"
$Zip = Join-Path ([Environment]::GetFolderPath("UserProfile")) "Downloads\fanni-vps-upload.zip"
$WebOut = Join-Path $Root "artifacts\mobile\dist-web"

Write-Host "[pack] root $Root"
if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force }
New-Item -ItemType Directory -Path $Stage | Out-Null

robocopy $Root $Stage /E /NFL /NDL /NJH /NJS /nc /ns /np `
  /XD node_modules .git .pnpm-store uploads .expo .cursor agent-transcripts canvases .tmp-spec-extract dist-web `
  /XF .env .env.local backup.sql backup_new.sql *.zip | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with $LASTEXITCODE" }

$env:EXPO_PUBLIC_API_URL = "https://api.upnexa-eg.com"
$env:EXPO_ROUTER_APP_ROOT = "./app"
Push-Location (Join-Path $Root "artifacts\mobile")
try {
  Write-Host "[pack] expo export web (API = https://api.upnexa-eg.com)"
  pnpm exec expo export --platform web --output-dir dist-web
  if ($LASTEXITCODE -ne 0) { throw "expo export failed" }
  $webDest = Join-Path $Stage "artifacts\mobile\dist-web"
  if (Test-Path $WebOut) {
    if (Test-Path $webDest) { Remove-Item $webDest -Recurse -Force }
    Copy-Item $WebOut $webDest -Recurse
  }
} catch {
  Write-Host "[pack] WARN: web export skipped: $_"
} finally {
  Pop-Location
}

if (Test-Path $Zip) { Remove-Item $Zip -Force }
Compress-Archive -Path (Join-Path $Stage "*") -DestinationPath $Zip -CompressionLevel Optimal
Write-Host "[pack] ready: $Zip"
Write-Host "[pack] upload zip to VPS /root/ then follow deploy/VPS-STEPS.md"
