# Local update: install deps, migrate DB, typecheck, build API.
# Run from anywhere; resolves repo root from script location.
# Usage:
#   cd C:\Fanni
#   powershell -ExecutionPolicy Bypass -File scripts\local-update.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\local-update.ps1 -Seed
param([switch]$Seed, [switch]$SkipTypecheck)

$ErrorActionPreference = "Stop"
$Root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
Set-Location -LiteralPath $Root

if (-not $env:NODE_OPTIONS) {
    $env:NODE_OPTIONS = "--use-system-ca"
} elseif ($env:NODE_OPTIONS -notmatch "use-system-ca") {
    $env:NODE_OPTIONS = "$env:NODE_OPTIONS --use-system-ca"
}

Write-Host "[local-update] repo: $Root"

if (-not (Test-Path -LiteralPath ".\.env")) {
    Write-Host "WARN: .env missing — copy .env.example to .env and set DATABASE_URL" -ForegroundColor Yellow
}

pnpm install
pnpm --filter @workspace/db run migrate
if ($Seed) {
    pnpm --filter @workspace/db run seed
}
if (-not $SkipTypecheck) {
    pnpm run typecheck
}
pnpm --filter @workspace/api-server run build

Write-Host ""
Write-Host "[local-update] done." -ForegroundColor Green
Write-Host "  API dev:  pnpm run dev:api     -> http://localhost:3000"
Write-Host "  Mobile:   pnpm run dev:mobile"
Write-Host "  Web exp:  powershell -File scripts\export-web.ps1"
