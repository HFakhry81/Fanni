# Repair corrupted packages under node_modules/.pnpm (common after interrupted deletes on Windows).
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\repair-node-modules.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\repair-node-modules.ps1 -Full
param(
    [switch]$Full
)

$ErrorActionPreference = "Stop"
$Root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
Set-Location -LiteralPath $Root

if (-not $env:NODE_OPTIONS) {
    $env:NODE_OPTIONS = "--use-system-ca"
} elseif ($env:NODE_OPTIONS -notmatch "use-system-ca") {
    $env:NODE_OPTIONS = "$env:NODE_OPTIONS --use-system-ca"
}

function FastRemove([string]$path) {
    if (-not (Test-Path -LiteralPath $path)) { return }
    Write-Host "Removing $path"
    $empty = Join-Path $env:TEMP ("empty_" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $empty | Out-Null
    cmd /c "robocopy `"$empty`" `"$path`" /MIR /NFL /NDL /NJH /NJS /NC /NS /NP >nul"
    Remove-Item -Recurse -Force $empty -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force $path -ErrorAction SilentlyContinue
}

function RestoreNpmPackage([string]$name, [string]$version, [string]$pnpmFolder) {
    $tmp = Join-Path $env:TEMP ("pkg_" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $tmp | Out-Null
    try {
        Push-Location $tmp
        npm pack "$name@$version" | Out-Null
        $tg = Get-ChildItem *.tgz | Select-Object -First 1
        if (-not $tg) { throw "npm pack failed for $name@$version" }
        tar -xzf $tg.Name
        $dest = Join-Path $Root "node_modules\.pnpm\$pnpmFolder\node_modules\$name"
        if (Test-Path -LiteralPath $dest) { Remove-Item -Recurse -Force $dest }
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
        Copy-Item -Recurse -Force ".\package\*" $dest
        Write-Host "Restored $name@$version -> $dest" -ForegroundColor Green
    } finally {
        Pop-Location
        Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
    }
}

Write-Host "=== repair-node-modules ===" -ForegroundColor Cyan
Write-Host "Repo: $Root"

if ($Full) {
    Write-Host "FULL clean reinstall (recommended after heavy corruption)..." -ForegroundColor Yellow
    FastRemove (Join-Path $Root "node_modules")
    FastRemove (Join-Path $Root "artifacts\mobile\node_modules")
    FastRemove (Join-Path $Root "artifacts\api-server\node_modules")
    FastRemove (Join-Path $Root "artifacts\mobile\.expo")
    pnpm install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
    # Targeted restores for packages we already saw corrupted
    RestoreNpmPackage "react-devtools-core" "6.1.5" "react-devtools-core@6.1.5"
    RestoreNpmPackage "@egjs/hammerjs" "2.0.17" "@egjs+hammerjs@2.0.17"
    # mime-db may be 1.52 or 1.54 depending on lock
    $mime = Get-ChildItem (Join-Path $Root "node_modules\.pnpm") -Directory -Filter "mime-db@*" -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($mime) {
        $ver = $mime.Name -replace '^mime-db@', ''
        RestoreNpmPackage "mime-db" $ver $mime.Name
    }
    pnpm install
}

# Clear Expo caches that break icon/splash resolution
$expoCache = Join-Path $Root "artifacts\mobile\.expo"
if (Test-Path $expoCache) {
    Write-Host "Clearing artifacts/mobile/.expo cache..."
    FastRemove $expoCache
}

Write-Host ""
Write-Host "OK. Restart Metro with a clean cache:" -ForegroundColor Green
Write-Host "  cd artifacts\mobile"
Write-Host "  pnpm exec expo start -c"
