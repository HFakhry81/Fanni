# Ensures Windows-native deps resolve under pnpm hoisted layout.
# Called from local-update.ps1 / UPDATE_ALL.ps1 after pnpm install.
$ErrorActionPreference = "Stop"
$Root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
Set-Location -LiteralPath $Root

function Test-RealPath([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return $false }
  try {
    $item = Get-Item -LiteralPath $path -Force -ErrorAction Stop
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
      # Broken junction/symlink: target missing
      $target = cmd /c "dir /AL `"$path`" 2>nul"
      return (Test-Path -LiteralPath $path) -and @(Get-ChildItem -LiteralPath $path -Force -ErrorAction SilentlyContinue).Count -gt 0
    }
    return $true
  } catch {
    return $false
  }
}

function Ensure-SwcHelpers {
  $target = Join-Path $Root "node_modules\@swc\helpers"
  if (Test-RealPath $target) { return }

  $source = Join-Path $Root "artifacts\api-server\node_modules\@swc\helpers"
  if (-not (Test-Path -LiteralPath $source)) {
    Write-Host "[fix-windows-deps] @swc/helpers not installed yet - run pnpm install" -ForegroundColor Yellow
    return
  }

  if (Test-Path -LiteralPath $target) {
    cmd /c "rmdir `"$target`"" | Out-Null
  }

  New-Item -ItemType Directory -Force -Path (Join-Path $Root "node_modules\@swc") | Out-Null
  cmd /c mklink /J "$target" "$source"
  if ($LASTEXITCODE -ne 0 -or -not (Test-RealPath $target)) {
    throw "[fix-windows-deps] mklink failed for @swc/helpers"
  }
  Write-Host "[fix-windows-deps] linked $target -> $source" -ForegroundColor Green
}

function Ensure-EsbuildWin32 {
  $pkgJson = Join-Path $Root "node_modules\@esbuild\win32-x64\package.json"
  $exe = Join-Path $Root "node_modules\@esbuild\win32-x64\esbuild.exe"
  if ((Test-Path -LiteralPath $pkgJson) -and (Test-Path -LiteralPath $exe)) { return }

  Write-Host "[fix-windows-deps] repairing @esbuild/win32-x64 ..." -ForegroundColor Yellow
  $link = Join-Path $Root "node_modules\@esbuild\win32-x64"
  if (Test-Path -LiteralPath $link) {
    # Remove broken junction without following it
    cmd /c "rmdir `"$link`"" | Out-Null
  }

  if (-not $env:NODE_OPTIONS) {
    $env:NODE_OPTIONS = "--use-system-ca"
  } elseif ($env:NODE_OPTIONS -notmatch "use-system-ca") {
    $env:NODE_OPTIONS = "$env:NODE_OPTIONS --use-system-ca"
  }

  pnpm add -Dw "@esbuild/win32-x64@0.27.3"
  if ($LASTEXITCODE -ne 0) {
    throw "[fix-windows-deps] pnpm add @esbuild/win32-x64 failed"
  }
  if (-not ((Test-Path -LiteralPath $pkgJson) -and (Test-Path -LiteralPath $exe))) {
    throw "[fix-windows-deps] @esbuild/win32-x64 still missing after reinstall"
  }
  Write-Host "[fix-windows-deps] @esbuild/win32-x64 restored" -ForegroundColor Green
}

Ensure-SwcHelpers
Ensure-EsbuildWin32
Write-Host "[fix-windows-deps] ok" -ForegroundColor Green
