# Safe push: refuse if env/secrets are staged; otherwise push current branch to origin.
$ErrorActionPreference = "Stop"
$Root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
Set-Location -LiteralPath $Root

$blocked = @(
  '(^|/)\.env$',
  '(^|/)\.env\.(local|production)$',
  '(^|/)\.env\.[^/]+\.local$',
  '\.sentryclirc$',
  'sentry\.auth\.token$',
  '(^|/)auth\.token$',
  '\.pem$',
  '\.jks$',
  '\.p12$',
  '\.mobileprovision$'
)

$staged = git diff --cached --name-only
if (-not $staged) {
  # Also block if dirty unstaged secrets would be force-added by mistake later —
  # only enforce on staged set for push.
  Write-Host "[git-push-safe] no staged files — pushing commits only" -ForegroundColor Cyan
}

foreach ($file in $staged) {
  foreach ($pat in $blocked) {
    if ($file -match $pat) {
      Write-Host "ERROR: refusing push — staged secret/env file: $file" -ForegroundColor Red
      Write-Host "Unstage it: git restore --staged `"$file`"" -ForegroundColor Yellow
      exit 1
    }
  }
}

# Ensure real env files stay untracked
$mustIgnore = @(".env", ".env.production", "artifacts/mobile/.env", "artifacts/api-server/.env")
foreach ($f in $mustIgnore) {
  if (Test-Path -LiteralPath $f) {
    $tracked = git ls-files --error-unmatch -- $f 2>$null
    if ($LASTEXITCODE -eq 0) {
      Write-Host "ERROR: $f is tracked by git — remove it from the index before push." -ForegroundColor Red
      Write-Host "  git rm --cached `"$f`"" -ForegroundColor Yellow
      exit 1
    }
  }
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "[git-push-safe] branch: $branch" -ForegroundColor Cyan
Write-Host "[git-push-safe] remote: origin" -ForegroundColor Cyan
git push -u origin HEAD
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "[git-push-safe] OK" -ForegroundColor Green
