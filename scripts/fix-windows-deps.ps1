# Ensures pdfkit/fontkit can resolve @swc/helpers on Windows + pnpm hoisted layout.
# Called from local-update.ps1 after pnpm install.
$ErrorActionPreference = "Stop"
$Root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$target = Join-Path $Root "node_modules\@swc\helpers"
if (Test-Path -LiteralPath $target) { exit 0 }

$source = Join-Path $Root "artifacts\api-server\node_modules\@swc\helpers"
if (-not (Test-Path -LiteralPath $source)) {
  Write-Host "[fix-windows-deps] @swc/helpers not installed yet — run pnpm install" -ForegroundColor Yellow
  exit 0
}

New-Item -ItemType Directory -Force -Path (Join-Path $Root "node_modules\@swc") | Out-Null
cmd /c mklink /J "$target" "$source" | Out-Null
Write-Host "[fix-windows-deps] linked $target -> $source" -ForegroundColor Green
