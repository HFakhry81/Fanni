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

function Ensure-ExpoFont {
  $plugin = Join-Path $Root "artifacts\mobile\node_modules\expo-font\app.plugin.js"
  $build = Join-Path $Root "artifacts\mobile\node_modules\expo-font\build\index.js"
  if ((Test-Path -LiteralPath $plugin) -and (Test-Path -LiteralPath $build)) { return }

  Write-Host "[fix-windows-deps] repairing expo-font ..." -ForegroundColor Yellow
  $folder = Get-ChildItem (Join-Path $Root "node_modules\.pnpm") -Directory -Filter "expo-font@*" |
    Select-Object -First 1
  if (-not $folder) {
    throw "[fix-windows-deps] expo-font pnpm folder not found - run pnpm install"
  }
  $dest = Join-Path $folder.FullName "node_modules\expo-font"
  $tmp = Join-Path $env:TEMP ("expo-font-" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $tmp | Out-Null
  try {
    Push-Location $tmp
    npm pack "expo-font@14.0.12" | Out-Null
    $tg = Get-ChildItem *.tgz | Select-Object -First 1
    tar -xzf $tg.Name
    if (Test-Path -LiteralPath $dest) {
      & node -e "const fs=require('fs'); fs.rmSync(process.argv[1],{recursive:true,force:true});" $dest
    }
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    Copy-Item -Recurse -Force ".\package\*" $dest
  } finally {
    Pop-Location
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
  }
  if (-not ((Test-Path -LiteralPath $plugin) -or (Test-Path -LiteralPath (Join-Path $dest "app.plugin.js")))) {
    throw "[fix-windows-deps] expo-font still missing app.plugin.js"
  }
  Write-Host "[fix-windows-deps] expo-font restored" -ForegroundColor Green
}

function Ensure-SentryReactNative {
  $index = Join-Path $Root "artifacts\mobile\node_modules\@sentry\react-native\dist\js\index.js"
  if (Test-Path -LiteralPath $index) { return }

  Write-Host "[fix-windows-deps] repairing @sentry/react-native ..." -ForegroundColor Yellow
  $folder = Get-ChildItem (Join-Path $Root "node_modules\.pnpm") -Directory -Filter "@sentry+react-native@*" |
    Select-Object -First 1
  if (-not $folder) {
    throw "[fix-windows-deps] @sentry/react-native pnpm folder not found - run pnpm install"
  }
  $dest = Join-Path $folder.FullName "node_modules\@sentry\react-native"
  $tmp = Join-Path $env:TEMP ("sentry-rn-" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $tmp | Out-Null
  try {
    Push-Location $tmp
    npm pack "@sentry/react-native@7.2.0" | Out-Null
    $tg = Get-ChildItem *.tgz | Select-Object -First 1
    tar -xzf $tg.Name
    if (Test-Path -LiteralPath $dest) {
      & node -e "const fs=require('fs'); fs.rmSync(process.argv[1],{recursive:true,force:true});" $dest
    }
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    Copy-Item -Recurse -Force ".\package\*" $dest
  } finally {
    Pop-Location
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
  }
  if (-not (Test-Path -LiteralPath (Join-Path $dest "dist\js\index.js"))) {
    throw "[fix-windows-deps] @sentry/react-native still missing dist/js/index.js"
  }
  Write-Host "[fix-windows-deps] @sentry/react-native restored" -ForegroundColor Green
}

function Restore-PnpmPackageFromNpm {
  param(
    [Parameter(Mandatory = $true)][string]$PackageName,
    [Parameter(Mandatory = $true)][string]$Version,
    [Parameter(Mandatory = $true)][string]$PnpmFilter,
    [Parameter(Mandatory = $true)][string]$CanaryRelativePath
  )

  $folder = Get-ChildItem (Join-Path $Root "node_modules\.pnpm") -Directory -Filter $PnpmFilter |
    Sort-Object Name -Descending |
    Select-Object -First 1
  if (-not $folder) {
    Write-Host "[fix-windows-deps] $PackageName pnpm folder not found - run pnpm install" -ForegroundColor Yellow
    return
  }

  $scopedPath = $PackageName -replace "/", "\"
  $dest = Join-Path $folder.FullName "node_modules\$scopedPath"
  $canary = Join-Path $dest $CanaryRelativePath
  if (Test-Path -LiteralPath $canary) { return }

  Write-Host "[fix-windows-deps] repairing $PackageName@$Version ..." -ForegroundColor Yellow
  $tmp = Join-Path $env:TEMP (("pkg-" + ($PackageName -replace "[@/]", "-") + "-") + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $tmp | Out-Null
  try {
    Push-Location $tmp
    npm pack "${PackageName}@${Version}" | Out-Null
    $tg = Get-ChildItem *.tgz | Select-Object -First 1
    if (-not $tg) { throw "[fix-windows-deps] npm pack failed for $PackageName@$Version" }
    tar -xzf $tg.Name
    if (Test-Path -LiteralPath $dest) {
      & node -e "const fs=require('fs'); fs.rmSync(process.argv[1],{recursive:true,force:true});" $dest
    }
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    Copy-Item -Recurse -Force ".\package\*" $dest
  } finally {
    Pop-Location
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
  }
  if (-not (Test-Path -LiteralPath $canary)) {
    throw "[fix-windows-deps] $PackageName still missing $CanaryRelativePath"
  }
  Write-Host "[fix-windows-deps] $PackageName restored" -ForegroundColor Green
}

function Ensure-SentryCore {
  # Incomplete Windows extracts often drop esm tracing entrypoints (openai/index.js present as .map only).
  Restore-PnpmPackageFromNpm `
    -PackageName "@sentry/core" `
    -Version "10.73.0" `
    -PnpmFilter "@sentry+core@10.73.0" `
    -CanaryRelativePath "build\esm\tracing\openai\index.js"
}

function Ensure-ChromeLauncher {
  # @react-native/dev-middleware needs chrome-launcher/dist/index.js; Windows extracts often keep only .d.ts.
  Restore-PnpmPackageFromNpm `
    -PackageName "chrome-launcher" `
    -Version "0.15.2" `
    -PnpmFilter "chrome-launcher@0.15.2*" `
    -CanaryRelativePath "dist\index.js"
}

function Ensure-ReactDevtoolsCore {
  # Windows NTFS damage can leave dist/backend.js present but garbled; Metro then fails Android bundle parse.
  $folder = Get-ChildItem (Join-Path $Root "node_modules\.pnpm") -Directory -Filter "react-devtools-core@6.1.5*" |
    Select-Object -First 1
  if (-not $folder) { return }
  $backend = Join-Path $folder.FullName "node_modules\react-devtools-core\dist\backend.js"
  $needsRepair = $true
  if (Test-Path -LiteralPath $backend) {
    $sample = Get-Content -LiteralPath $backend -TotalCount 1200 -ErrorAction SilentlyContinue
    $line = $sample | Select-Object -Skip 1154 -First 1
    if ($line -and ($line -match '__source" !== propName') -and ($line -notmatch '!=rops')) {
      $needsRepair = $false
    }
  }
  if (-not $needsRepair) { return }

  Write-Host "[fix-windows-deps] repairing corrupted react-devtools-core@6.1.5 ..." -ForegroundColor Yellow
  $dest = Join-Path $folder.FullName "node_modules\react-devtools-core"
  $tmp = Join-Path $env:TEMP ("rdc-" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $tmp | Out-Null
  try {
    Push-Location $tmp
    npm pack "react-devtools-core@6.1.5" | Out-Null
    $tg = Get-ChildItem *.tgz | Select-Object -First 1
    tar -xzf $tg.Name
    if (Test-Path -LiteralPath $dest) {
      & node -e "const fs=require('fs'); fs.rmSync(process.argv[1],{recursive:true,force:true});" $dest
    }
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    Copy-Item -Recurse -Force ".\package\*" $dest
  } finally {
    Pop-Location
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
  }
  Write-Host "[fix-windows-deps] react-devtools-core restored" -ForegroundColor Green
}

Ensure-SwcHelpers
Ensure-EsbuildWin32
Ensure-ExpoFont
Ensure-SentryReactNative
Ensure-SentryCore
Ensure-ChromeLauncher
Ensure-ReactDevtoolsCore
Write-Host "[fix-windows-deps] ok" -ForegroundColor Green
