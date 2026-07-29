param(
  [string]$Root = "E:\tandem-deploy",
  [string]$SourcePackageName = "tandem-source.zip",
  [string]$BlueServiceName = "TandemServerBlue",
  [string]$GreenServiceName = "TandemServerGreen",
  [int]$BluePort = 3005,
  [int]$GreenPort = 3006,
  [string]$NodeExe = "C:\Program Files\nodejs\node.exe",
  [string]$NginxExe = "nginx",
  [string]$NginxPrefix = "",
  [string]$NginxConfig = "conf\nginx.conf",
  [string]$NginxUpstreamFile = "E:\tandem-deploy\nginx\tandem-upstream.conf",
  [string]$PublicBaseUrl = "http://127.0.0.1:3000",
  [string]$HealthPath = "/api/health",
  [int]$HealthTimeoutSeconds = 90,
  [string]$NotifyWebhookUrl = $env:DEPLOY_NOTIFY_WEBHOOK_URL,
  [string]$NotifyWebhookType = $(if ($env:DEPLOY_NOTIFY_WEBHOOK_TYPE) { $env:DEPLOY_NOTIFY_WEBHOOK_TYPE } else { "generic" })
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Normalize-Arg {
  param([string]$Value)
  if ($null -eq $Value) { return $Value }
  return $Value.Trim().Trim("'").Trim('"')
}

$Root = Normalize-Arg $Root
$SourcePackageName = Normalize-Arg $SourcePackageName
$BlueServiceName = Normalize-Arg $BlueServiceName
$GreenServiceName = Normalize-Arg $GreenServiceName
$NodeExe = Normalize-Arg $NodeExe
$NginxExe = Normalize-Arg $NginxExe
$NginxPrefix = Normalize-Arg $NginxPrefix
$NginxConfig = Normalize-Arg $NginxConfig
$NginxUpstreamFile = Normalize-Arg $NginxUpstreamFile
$PublicBaseUrl = Normalize-Arg $PublicBaseUrl
$HealthPath = Normalize-Arg $HealthPath
$NotifyWebhookUrl = Normalize-Arg $NotifyWebhookUrl
$NotifyWebhookType = Normalize-Arg $NotifyWebhookType

$UpdateDir = Join-Path $Root "update"
$SourceZip = Join-Path $UpdateDir $SourcePackageName
$SourceDir = Join-Path $Root "source"
$SourceBackupDir = Join-Path $Root "source-backup"
$DeployZip = Join-Path $UpdateDir "tandem-deploy.zip"
$EnvFile = Join-Path $Root ".env.production"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Ensure-Dir {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Require-File {
  param([string]$Path, [string]$Message)
  if (-not (Test-Path $Path)) {
    throw "$Message`: $Path"
  }
}

function Resolve-Executable {
  param([string]$Command, [string]$Message)

  if (Test-Path $Command) {
    return (Resolve-Path -LiteralPath $Command).Path
  }

  $resolved = Get-Command $Command -ErrorAction SilentlyContinue
  if ($resolved) {
    return $resolved.Source
  }

  $leaf = Split-Path -Leaf $Command
  if ($leaf) {
    $resolved = Get-Command $leaf -ErrorAction SilentlyContinue
    if ($resolved) {
      return $resolved.Source
    }
  }

  if ($leaf -ieq "node.exe") {
    $resolved = Get-Command "node" -ErrorAction SilentlyContinue
    if ($resolved) {
      return $resolved.Source
    }
  }

  throw "$Message`: $Command"
}

function Send-DeployNotification {
  param(
    [string]$Status,
    [string]$Message
  )

  if ([string]::IsNullOrWhiteSpace($NotifyWebhookUrl)) {
    return
  }

  $type = $NotifyWebhookType
  if ([string]::IsNullOrWhiteSpace($type)) { $type = "generic" }
  $type = $type.Trim().Trim("'").Trim('"').ToLowerInvariant()
  $text = "[Tandem Source Deploy] $Status`nRoot: $Root`nTime: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n$Message"
  if ($type -eq "feishu") {
    $body = @{ msg_type = "text"; content = @{ text = $text } }
  } elseif ($type -eq "dingtalk" -or $type -eq "wecom") {
    $body = @{ msgtype = "text"; text = @{ content = $text } }
  } else {
    $body = @{ text = $text }
  }
  $payload = $body | ConvertTo-Json -Depth 6

  try {
    Invoke-RestMethod -Uri $NotifyWebhookUrl -Method Post -ContentType "application/json; charset=utf-8" -Body $payload | Out-Null
  } catch {
    Write-Host "Notification failed: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

Ensure-Dir $Root
Ensure-Dir $UpdateDir
Ensure-Dir $SourceBackupDir
Require-File $SourceZip "Source package missing"
Require-File $EnvFile "Production env file missing"
$NodeExe = Resolve-Executable $NodeExe "Node executable missing"
Write-Host "Node executable: $NodeExe"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$SourceBackup = Join-Path $SourceBackupDir "source-$timestamp"

try {
  Write-Step "Preparing source directory"
  if (Test-Path $SourceDir) {
    Move-Item -LiteralPath $SourceDir -Destination $SourceBackup -Force
  }
  New-Item -ItemType Directory -Path $SourceDir -Force | Out-Null

  Write-Step "Extracting source package"
  Expand-Archive -LiteralPath $SourceZip -DestinationPath $SourceDir -Force
  Require-File (Join-Path $SourceDir "package.json") "Source package is invalid, package.json missing"
  Require-File (Join-Path $SourceDir "package-deploy.ps1") "Source package is invalid, package-deploy.ps1 missing"

  Write-Step "Installing dependencies and building Windows package"
  Push-Location $SourceDir
  try {
    $env:NEXT_TELEMETRY_DISABLED = "1"
    $env:NEXT_OUTPUT = "standalone"
    & npm.cmd ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) {
      throw "npm ci failed with exit code $LASTEXITCODE"
    }

    powershell -ExecutionPolicy Bypass -File "package-deploy.ps1" -OutputZip $DeployZip
    if ($LASTEXITCODE -ne 0) {
      throw "package-deploy.ps1 failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }

  Write-Step "Running blue-green deployment"
  powershell -ExecutionPolicy Bypass -File (Join-Path $SourceDir "scripts\deploy-windows-nssm-bluegreen.ps1") `
    -Root $Root `
    -PackageName "tandem-deploy.zip" `
    -BlueServiceName $BlueServiceName `
    -GreenServiceName $GreenServiceName `
    -BluePort $BluePort `
    -GreenPort $GreenPort `
    -NodeExe $NodeExe `
    -NginxExe $NginxExe `
    -NginxPrefix $NginxPrefix `
    -NginxConfig $NginxConfig `
    -NginxUpstreamFile $NginxUpstreamFile `
    -PublicBaseUrl $PublicBaseUrl `
    -HealthPath $HealthPath `
    -HealthTimeoutSeconds $HealthTimeoutSeconds `
    -NotifyWebhookUrl $NotifyWebhookUrl `
    -NotifyWebhookType $NotifyWebhookType
  if ($LASTEXITCODE -ne 0) {
    throw "blue-green deployment failed with exit code $LASTEXITCODE"
  }

  Send-DeployNotification -Status "SUCCESS" -Message "Source package deployed successfully."
} catch {
  Write-Host ""
  Write-Host "Source deployment failed: $($_.Exception.Message)" -ForegroundColor Red
  Send-DeployNotification -Status "FAILED" -Message "Error: $($_.Exception.Message)"
  throw
}
