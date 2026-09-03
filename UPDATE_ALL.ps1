# ==============================================================================
# Fanni full local update pipeline (Windows)
# Usage from repo root E:\UpNexa.com\fanni:
#   .\UPDATE_ALL.ps1
#   .\UPDATE_ALL.ps1 -SkipGit
#   .\UPDATE_ALL.ps1 -SkipWeb
#   .\UPDATE_ALL.ps1 -CommitMessage "chore: local refresh"
# ==============================================================================
param(
    [switch]$SkipInstall,
    [switch]$SkipSeed,
    [switch]$SkipTypecheck,
    [switch]$SkipWeb,
    [switch]$SkipGit,
    [string]$CommitMessage = ""
)

$ErrorActionPreference = "Stop"

# Always run from this script's directory (project root)
$Root = if ($PSScriptRoot) { $PSScriptRoot } else { Get-Location }
Set-Location -LiteralPath $Root

if (-not $env:NODE_OPTIONS) {
    $env:NODE_OPTIONS = "--use-system-ca"
} elseif ($env:NODE_OPTIONS -notmatch "use-system-ca") {
    $env:NODE_OPTIONS = "$env:NODE_OPTIONS --use-system-ca"
}

$env:EXPO_PUBLIC_API_URL = if ($env:EXPO_PUBLIC_API_URL) { $env:EXPO_PUBLIC_API_URL } else { "https://api.upnexa-eg.com" }
$env:EXPO_PUBLIC_DOMAIN = if ($env:EXPO_PUBLIC_DOMAIN) { $env:EXPO_PUBLIC_DOMAIN } else { "app.upnexa-eg.com" }
$env:EXPO_ROUTER_APP_ROOT = "./app"

function Step([string]$title) {
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host " $title" -ForegroundColor Cyan
    Write-Host "======================================================================" -ForegroundColor Cyan
}

function Fail([string]$msg) {
    Write-Host "[X] $msg" -ForegroundColor Red
    exit 1
}

Write-Host "FANNI UPDATE_ALL" -ForegroundColor Green
Write-Host "Repo: $Root"

if (-not (Test-Path -LiteralPath ".\package.json")) {
    Fail "package.json not found. Run from E:\UpNexa.com\fanni"
}
if (-not (Test-Path -LiteralPath ".\.env")) {
    Write-Host "WARN: .env missing - copy .env.example to .env and set DATABASE_URL" -ForegroundColor Yellow
}

# ---- 1) Install ----
if (-not $SkipInstall) {
    Step "[1/7] pnpm install"
    pnpm install
    if ($LASTEXITCODE -ne 0) { Fail "pnpm install failed" }
    if (Test-Path -LiteralPath ".\scripts\fix-windows-deps.ps1") {
        powershell -ExecutionPolicy Bypass -File .\scripts\fix-windows-deps.ps1
    }
} else {
    Write-Host "[1/7] skip install" -ForegroundColor Yellow
}

# ---- 2) Migrate ----
Step "[2/7] Database migrate"
pnpm --filter @workspace/db run migrate
if ($LASTEXITCODE -ne 0) { Fail "migrate failed" }

# ---- 3) Seed ----
if (-not $SkipSeed) {
    Step "[3/7] Database seed"
    pnpm --filter @workspace/db run seed
    if ($LASTEXITCODE -ne 0) { Fail "seed failed" }
} else {
    Write-Host "[3/7] skip seed" -ForegroundColor Yellow
}

# ---- 4) Typecheck ----
if (-not $SkipTypecheck) {
    Step "[4/7] Typecheck"
    pnpm run typecheck
    if ($LASTEXITCODE -ne 0) { Fail "typecheck failed" }
} else {
    Write-Host "[4/7] skip typecheck" -ForegroundColor Yellow
}

# ---- 5) Backend build ----
Step "[5/7] Build backend (db + api-zod + api-server)"
pnpm --filter @workspace/db --filter @workspace/api-zod --filter @workspace/api-server run build
if ($LASTEXITCODE -ne 0) { Fail "backend build failed" }

# ---- 6) Web dist ----
if (-not $SkipWeb) {
    Step "[6/7] Export web dist (dist-web + zip)"
    powershell -ExecutionPolicy Bypass -File .\scripts\export-web.ps1 -Zip
    if ($LASTEXITCODE -ne 0) { Fail "web export failed" }
    Write-Host "Web: artifacts\mobile\dist-web" -ForegroundColor Green
    Write-Host "Zip: artifacts\mobile\dist-web.zip" -ForegroundColor Green
} else {
    Write-Host "[6/7] skip web export" -ForegroundColor Yellow
}

# ---- 7) Git commit + safe push ----
if (-not $SkipGit) {
    Step "[7/7] Git status / commit / safe push"
    git status -sb

    $porcelain = @(git status --porcelain)
    if ($porcelain.Count -gt 0) {
        # Never stage secrets
        $safeAdds = @(
            git status --porcelain |
                ForEach-Object { $_.Substring(3).Trim('"') } |
                Where-Object {
                    $_ -notmatch '(^|/)\.env($|\.)' -and
                    $_ -notmatch '\.sentryclirc$' -and
                    $_ -notmatch 'auth\.token$' -and
                    $_ -notmatch '\.pem$' -and
                    $_ -notmatch 'dist-web' -and
                    $_ -notmatch '\.apk$' -and
                    $_ -notmatch 'node_modules'
                }
        )

        if ($safeAdds.Count -eq 0) {
            Write-Host "Changes exist but none are safe to auto-commit (env/build artifacts only)." -ForegroundColor Yellow
        } else {
            foreach ($f in $safeAdds) {
                git add -- $f 2>$null
            }
            $msg = if ($CommitMessage) { $CommitMessage } else {
                "chore: local UPDATE_ALL refresh ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))"
            }
            git commit -m $msg
            if ($LASTEXITCODE -ne 0) {
                Write-Host "WARN: commit skipped or failed (maybe nothing staged)." -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "Working tree clean - nothing to commit." -ForegroundColor Green
    }

    powershell -ExecutionPolicy Bypass -File .\scripts\git-push-safe.ps1
    if ($LASTEXITCODE -ne 0) { Fail "git push failed" }
} else {
    Write-Host "[7/7] skip git" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host " UPDATE_ALL COMPLETED" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host " Next (VPS web publish if needed):"
Write-Host "   upload artifacts\mobile\dist-web.zip -> /root/fanni-dist-web.zip"
Write-Host "   bash /var/www/fanni/scripts/publish-fanni-web.sh /tmp/fanni-web-unpack"
Write-Host " Dev:"
Write-Host "   pnpm run dev:api"
Write-Host "   pnpm run dev:mobile"
