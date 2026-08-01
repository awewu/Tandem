param(
  [string]$Root = "E:\tandem-deploy",
  [string]$ServiceName = "TandemServer",
  [string]$PackageName = "tandem-deploy.zip",
  [int]$HealthPort = 3005,
  [string]$HealthPath = "/api/health",
  [int]$HealthTimeoutSeconds = 90,
  [string]$NotifyWebhookUrl = $env:DEPLOY_NOTIFY_WEBHOOK_URL,
  [ValidateSet("generic", "feishu", "dingtalk", "wecom")]
  [string]$NotifyWebhookType = $(if ($env:DEPLOY_NOTIFY_WEBHOOK_TYPE) { $env:DEPLOY_NOTIFY_WEBHOOK_TYPE } else { "generic" })
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$UpdateDir = Join-Path $Root "update"
$AppDir = Join-Path $Root "app"
$ReleaseDir = Join-Path $Root "release"
$BackupDir = Join-Path $Root "backup"
$LogDir = Join-Path $Root "logs"
$EnvFile = Join-Path $Root ".env.production"
$PackagePath = Join-Path $UpdateDir $PackageName
$HealthUrl = "http://127.0.0.1:$HealthPort$HealthPath"

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

function Invoke-Nssm {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$NssmArgs)
  & nssm @NssmArgs
  if ($LASTEXITCODE -ne 0) {
    throw "nssm $($NssmArgs -join ' ') failed with exit code $LASTEXITCODE"
  }
}

function Send-DeployNotification {
  param(
    [string]$Status,
    [string]$Message
  )

  if ([string]::IsNullOrWhiteSpace($NotifyWebhookUrl)) {
    return
  }

  $text = "[Tandem Deploy] $Status`nService: $ServiceName`nRoot: $Root`nTime: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n$Message"
  if ($NotifyWebhookType -eq "feishu") {
    $body = @{ msg_type = "text"; content = @{ text = $text } }
  } elseif ($NotifyWebhookType -eq "dingtalk" -or $NotifyWebhookType -eq "wecom") {
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

function Stop-AppService {
  Write-Step "Stopping NSSM service: $ServiceName"
  & nssm status $ServiceName | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "NSSM service not found: $ServiceName"
  }

  & nssm stop $ServiceName | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Service may already be stopped. Continuing..." -ForegroundColor Yellow
  }

  Start-Sleep -Seconds 3
}

function Start-AppService {
  Write-Step "Starting NSSM service: $ServiceName"
  Invoke-Nssm start $ServiceName
}

function Test-Health {
  Write-Step "Health check: $HealthUrl"
  $deadline = (Get-Date).AddSeconds($HealthTimeoutSeconds)
  do {
    try {
      $response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        Write-Host "Healthy: HTTP $($response.StatusCode)" -ForegroundColor Green
        return
      }
    } catch {
      Start-Sleep -Seconds 3
    }
  } while ((Get-Date) -lt $deadline)

  throw "Health check timed out after $HealthTimeoutSeconds seconds: $HealthUrl"
}

function Restore-PreviousVersion {
  param([string]$BackupApp)

  if (-not $BackupApp -or -not (Test-Path $BackupApp)) {
    Write-Host "No backup app found to restore." -ForegroundColor Yellow
    return
  }

  Write-Step "Rolling back to previous app"
  & nssm stop $ServiceName | Out-Null
  Start-Sleep -Seconds 2

  if (Test-Path $AppDir) {
    Remove-Item -LiteralPath $AppDir -Recurse -Force
  }
  Move-Item -LiteralPath $BackupApp -Destination $AppDir -Force
  if (Test-Path $EnvFile) {
    Copy-Item -LiteralPath $EnvFile -Destination (Join-Path $AppDir ".env.production") -Force
  }

  & nssm start $ServiceName | Out-Null
}

Ensure-Dir $Root
Ensure-Dir $UpdateDir
Ensure-Dir $BackupDir
Ensure-Dir $LogDir

Require-File $PackagePath "Deployment package missing"
Require-File $EnvFile "Production env file missing"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupApp = Join-Path $BackupDir "app-$timestamp"

try {
  Stop-AppService

  Write-Step "Preparing release directory"
  if (Test-Path $ReleaseDir) {
    Remove-Item -LiteralPath $ReleaseDir -Recurse -Force
  }
  New-Item -ItemType Directory -Path $ReleaseDir -Force | Out-Null

  Write-Step "Extracting package"
  Expand-Archive -LiteralPath $PackagePath -DestinationPath $ReleaseDir -Force
  $ExtractedApp = Join-Path $ReleaseDir "app"
  Require-File (Join-Path $ExtractedApp "server.js") "Package is invalid, server.js missing"

  Write-Step "Backing up current app"
  if (Test-Path $AppDir) {
    Move-Item -LiteralPath $AppDir -Destination $BackupApp -Force
  }

  Write-Step "Promoting new app"
  Move-Item -LiteralPath $ExtractedApp -Destination $AppDir -Force
  Copy-Item -LiteralPath $EnvFile -Destination (Join-Path $AppDir ".env.production") -Force

  Write-Step "Applying database migrations"
  Push-Location $AppDir
  try {
    $env:NODE_ENV = "production"
    node "scripts\apply-migrations.mjs"
    if ($LASTEXITCODE -ne 0) {
      throw "Database migration failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }

  Start-AppService
  Test-Health

  Write-Step "Cleaning release directory"
  if (Test-Path $ReleaseDir) {
    Remove-Item -LiteralPath $ReleaseDir -Recurse -Force
  }

  Write-Host ""
  Write-Host "Deployment complete: $timestamp" -ForegroundColor Green
  Send-DeployNotification -Status "SUCCESS" -Message "Version: $timestamp`nHealth: $HealthUrl"
} catch {
  Write-Host ""
  Write-Host "Deployment failed: $($_.Exception.Message)" -ForegroundColor Red
  Restore-PreviousVersion -BackupApp $BackupApp
  Send-DeployNotification -Status "FAILED" -Message "Error: $($_.Exception.Message)`nRollback: attempted"
  throw
}
