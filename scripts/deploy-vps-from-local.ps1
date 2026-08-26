#Requires -Version 5.1
<#
.SYNOPSIS
  Pack latest Fanni from this machine and deploy to VPS (bypasses stale git on server).

.PARAMETER VpsHost
  VPS origin IP or hostname (not Cloudflare). Example: 203.0.113.10

.PARAMETER User
  SSH user (default: root)

.PARAMETER Port
  SSH port (default: 22)

.PARAMETER KeyPath
  Optional path to private key file

.PARAMETER SkipPack
  Reuse existing Downloads\fanni-vps-upload.zip

.PARAMETER SkipApk
  Do not upload artifacts\mobile\dist\fanni.apk

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\deploy-vps-from-local.ps1 -VpsHost 203.0.113.10
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$VpsHost,

  [string]$User = "root",
  [int]$Port = 22,
  [string]$KeyPath = "",
  [switch]$SkipPack,
  [switch]$SkipApk
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Zip = Join-Path ([Environment]::GetFolderPath("UserProfile")) "Downloads\fanni-vps-upload.zip"
$Apk = Join-Path $Root "artifacts\mobile\dist\fanni.apk"

function Get-SshBaseArgs {
  $a = @("-p", "$Port", "-o", "StrictHostKeyChecking=accept-new")
  if ($KeyPath -and (Test-Path -LiteralPath $KeyPath)) {
    $a += @("-i", $KeyPath)
  }
  return $a
}

function Invoke-Remote {
  param([string]$Command)
  $sshArgs = @(Get-SshBaseArgs) + @("${User}@${VpsHost}", $Command)
  & ssh.exe @sshArgs
  if ($LASTEXITCODE -ne 0) { throw "Remote command failed ($LASTEXITCODE): $Command" }
}

if (-not $SkipPack) {
  Write-Host "[deploy] packing latest code from $Root ..."
  & powershell.exe -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\pack-vps-upload.ps1")
  if ($LASTEXITCODE -ne 0) { throw "pack-vps-upload.ps1 failed" }
}

if (-not (Test-Path -LiteralPath $Zip)) {
  throw "Zip not found: $Zip — run without -SkipPack"
}

Write-Host "[deploy] uploading zip ($([math]::Round((Get-Item $Zip).Length / 1MB, 1)) MB) ..."
$scpArgs = @(Get-SshBaseArgs) + @($Zip, "${User}@${VpsHost}:/root/fanni-vps-upload.zip")
& scp.exe @scpArgs
if ($LASTEXITCODE -ne 0) { throw "scp zip failed" }

if (-not $SkipApk -and (Test-Path -LiteralPath $Apk)) {
  Write-Host "[deploy] uploading APK ($([math]::Round((Get-Item $Apk).Length / 1MB, 1)) MB) ..."
  $scpApk = @(Get-SshBaseArgs) + @($Apk, "${User}@${VpsHost}:/root/fanni.apk")
  & scp.exe @scpApk
  if ($LASTEXITCODE -ne 0) { throw "scp apk failed" }
} elseif (-not $SkipApk) {
  Write-Host "[deploy] WARN: APK not found at $Apk — skipping"
}

$RemoteScriptLocal = Join-Path $Root "scripts\remote-install-from-zip.sh"
if (-not (Test-Path -LiteralPath $RemoteScriptLocal)) {
  throw "Missing remote script: $RemoteScriptLocal"
}

Write-Host "[deploy] uploading remote install script ..."
$scpSh = @(Get-SshBaseArgs) + @($RemoteScriptLocal, "${User}@${VpsHost}:/root/fanni-remote-install.sh")
& scp.exe @scpSh
if ($LASTEXITCODE -ne 0) { throw "scp remote script failed" }

Write-Host "[deploy] running remote install on ${User}@${VpsHost} ..."
Invoke-Remote "sed -i 's/\r$//' /root/fanni-remote-install.sh && chmod +x /root/fanni-remote-install.sh && bash /root/fanni-remote-install.sh"

Write-Host "[deploy] done. verify: curl -sS https://api.upnexa-eg.com/api/healthz"
