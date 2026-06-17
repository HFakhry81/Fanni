# =============================================================================
#  Fanni — Local Database Migration Script (Windows PowerShell)
#  Usage: Right-click → "Run with PowerShell"   OR   from terminal:
#         powershell -ExecutionPolicy Bypass -File scripts\migrate-local.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

# ── 1. Environment Variables ──────────────────────────────────────────────────
$env:DATABASE_URL = "postgresql://postgres:123456@localhost:5432/fanni_db"
$env:PORT         = "3000"
$env:NODE_ENV     = "development"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Fanni — Database Migration (Local)"    -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Database : $env:DATABASE_URL" -ForegroundColor DarkGray
Write-Host ""

# ── 2. Verify pnpm is installed ───────────────────────────────────────────────
try {
    $pnpmVersion = pnpm --version 2>&1
    Write-Host "pnpm     : v$pnpmVersion" -ForegroundColor DarkGray
} catch {
    Write-Host "ERROR: pnpm not found." -ForegroundColor Red
    Write-Host "Install it with:  npm install -g pnpm" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# ── 3. Verify Node.js is installed ───────────────────────────────────────────
try {
    $nodeVersion = node --version 2>&1
    Write-Host "Node.js  : $nodeVersion" -ForegroundColor DarkGray
} catch {
    Write-Host "ERROR: Node.js not found." -ForegroundColor Red
    Write-Host "Install Node.js 24+ from https://nodejs.org" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# ── 4. Navigate to project root ───────────────────────────────────────────────
$scriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

Set-Location $projectRoot
Write-Host "Project  : $projectRoot" -ForegroundColor DarkGray
Write-Host ""

# ── 5. Install dependencies (if node_modules missing) ────────────────────────
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies (first time)..." -ForegroundColor Yellow
    pnpm install
    Write-Host ""
}

# ── 6. Build lib/db (TypeScript → JavaScript) ────────────────────────────────
Write-Host "Building lib/db ..." -ForegroundColor Yellow
pnpm --filter @workspace/db build
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Failed to build lib/db." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# ── 7. Run migrations ─────────────────────────────────────────────────────────
Write-Host "Running migrations ..." -ForegroundColor Yellow
Write-Host ""
pnpm --filter @workspace/db run migrate
$exitCode = $LASTEXITCODE

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Migration completed successfully!"     -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  Migration FAILED (exit code $exitCode)" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common causes:" -ForegroundColor Yellow
    Write-Host "  - PostgreSQL is not running" -ForegroundColor Yellow
    Write-Host "  - Database 'fanni_db' does not exist" -ForegroundColor Yellow
    Write-Host "  - Wrong password in DATABASE_URL" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Fix: Open pgAdmin 4 and verify the connection." -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Press Enter to close"
exit $exitCode
