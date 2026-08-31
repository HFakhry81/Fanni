# Local update: install deps, migrate DB, typecheck, build API.
# Usage:
#   cd E:\UpNexa.com\Fanni
#   powershell -ExecutionPolicy Bypass -File scripts\local-update.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\local-update.ps1 -Seed
param(
    [switch]$Seed,
    [switch]$SkipTypecheck
)

$ErrorActionPreference = "Stop"
$Root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
Set-Location -LiteralPath $Root

if (-not $env:NODE_OPTIONS) {
    $env:NODE_OPTIONS = "--use-system-ca"
} elseif ($env:NODE_OPTIONS -notmatch "use-system-ca") {
    $env:NODE_OPTIONS = "$($env:NODE_OPTIONS) --use-system-ca"
}

Write-Host "[local-update] repo: $Root"

if (-not (Test-Path -LiteralPath ".\.env")) {
    Write-Host "WARN: .env missing - copy .env.example to .env and set DATABASE_URL" -ForegroundColor Yellow
}

pnpm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

pnpm --filter @workspace/db run migrate
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($Seed) {
    pnpm --filter @workspace/db run seed
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if (-not $SkipTypecheck) {
    pnpm run typecheck
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

pnpm --filter @workspace/api-server run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "[local-update] done." -ForegroundColor Green
Write-Host "  API dev:  pnpm run dev:api"
Write-Host "  Mobile:   pnpm run dev:mobile"
Write-Host "  Web exp:  pnpm run export:web"

