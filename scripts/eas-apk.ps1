$ErrorActionPreference = "Stop"
# Corporate/Windows TLS intercept: use OS trust store instead of Node's bundled CAs.
if (-not $env:NODE_OPTIONS) {
    $env:NODE_OPTIONS = "--use-system-ca"
} elseif ($env:NODE_OPTIONS -notmatch "use-system-ca") {
    $env:NODE_OPTIONS = "$env:NODE_OPTIONS --use-system-ca"
}
$mobile = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\artifacts\mobile"))
Set-Location -LiteralPath $mobile
Write-Host "EAS project directory: $mobile"
if (-not (Test-Path -LiteralPath ".\app.json")) {
    Write-Host "ERROR: app.json not found. Wrong repo path." -ForegroundColor Red
    exit 1
}
npx --yes eas-cli@16 build --platform android --profile preview --non-interactive --wait
