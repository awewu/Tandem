param(
  [string]$Root = "E:\tandem-deploy",
  [string]$PackageName = "tandem-deploy.zip",
  [string]$BlueServiceName = "TandemServerBlue",
  [string]$GreenServiceName = "TandemServerGreen",
  [int]$BluePort = 3005,
  [int]$GreenPort = 3006,
  [string]$NodeExe = "C:\Program Files\nodejs\node.exe",
  [string]$NginxExe = "nginx",
  [string]$NginxUpstreamFile = "E:\tandem-deploy\nginx\tandem-upstream.conf",
  [string]$PublicBaseUrl = "http://127.0.0.1:3000",
  [string]$HealthPath = "/api/health",
  [int]$HealthTimeoutSeconds = 90,
  [string]$NotifyWebhookUrl = $env:DEPLOY_NOTIFY_WEBHOOK_URL,
  [string]$NotifyWebhookType = $(if ($env:DEPLOY_NOTIFY_WEBHOOK_TYPE) { $env:DEPLOY_NOTIFY_WEBHOOK_TYPE } else { "generic" })
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$UpdateDir = Join-Path $Root "update"
$SlotsDir = Join-Path $Root "slots"
$BlueDir = Join-Path $SlotsDir "blue"
$GreenDir = Join-Path $SlotsDir "green"
$ReleaseDir = Join-Path $Root "release"
$BackupDir = Join-Path $Root "backup"
$LogDir = Join-Path $Root "logs"
$EnvFile = Join-Path $Root ".env.production"
$ActiveSlotFile = Join-Path $Root "active-slot.txt"
$PackagePath = Join-Path $UpdateDir $PackageName

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

  $type = $NotifyWebhookType
  if ([string]::IsNullOrWhiteSpace($type)) { $type = "generic" }
  $type = $type.Trim().Trim("'").Trim('"').ToLowerInvariant()
  $text = "[Tandem Blue-Green Deploy] $Status`nRoot: $Root`nTime: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n$Message"
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

function Get-Slot {
  param([string]$Name)
  if ($Name -eq "green") {
    return @{
      Name = "green"
      Dir = $GreenDir
      AppDir = (Join-Path $GreenDir "app")
      Service = $GreenServiceName
      Port = $GreenPort
    }
  }

  return @{
    Name = "blue"
    Dir = $BlueDir
    AppDir = (Join-Path $BlueDir "app")
    Service = $BlueServiceName
    Port = $BluePort
  }
}

function Get-ActiveSlotName {
  if (Test-Path $ActiveSlotFile) {
    $slot = (Get-Content -LiteralPath $ActiveSlotFile -TotalCount 1).Trim().ToLowerInvariant()
    if ($slot -eq "blue" -or $slot -eq "green") {
      return $slot
    }
  }

  return "blue"
}

function Ensure-NssmService {
  param([hashtable]$Slot)

  & nssm status $($Slot.Service) | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Step "Installing NSSM service: $($Slot.Service)"
    Invoke-Nssm install $($Slot.Service) $NodeExe "server.js"
  }

  Invoke-Nssm set $($Slot.Service) AppDirectory $($Slot.AppDir)
  Invoke-Nssm set $($Slot.Service) AppEnvironmentExtra "NODE_ENV=production" "PORT=$($Slot.Port)"
  Invoke-Nssm set $($Slot.Service) AppStdout (Join-Path $LogDir "$($Slot.Name).out.log")
  Invoke-Nssm set $($Slot.Service) AppStderr (Join-Path $LogDir "$($Slot.Name).err.log")
  Invoke-Nssm set $($Slot.Service) AppRotateFiles 1
  Invoke-Nssm set $($Slot.Service) AppRotateOnline 1
  Invoke-Nssm set $($Slot.Service) AppRotateBytes 10485760
  Invoke-Nssm set $($Slot.Service) Start SERVICE_AUTO_START
}

function Stop-ServiceIfExists {
  param([string]$ServiceName)
  & nssm status $ServiceName | Out-Null
  if ($LASTEXITCODE -eq 0) {
    & nssm stop $ServiceName | Out-Null
  }
}

function Start-NssmService {
  param([string]$ServiceName)
  Invoke-Nssm start $ServiceName
}

function Wait-Health {
  param([string]$Url, [int]$TimeoutSeconds)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        Write-Host "Healthy: $Url HTTP $($response.StatusCode)" -ForegroundColor Green
        return
      }
    } catch {
      Start-Sleep -Seconds 3
    }
  } while ((Get-Date) -lt $deadline)

  throw "Health check timed out after $TimeoutSeconds seconds: $Url"
}

function Write-NginxUpstream {
  param([int]$TargetPort)

  $content = @"
upstream tandem_backend {
    server 127.0.0.1:$TargetPort;
    keepalive 64;
}
"@
  $dir = [System.IO.Path]::GetDirectoryName($NginxUpstreamFile)
  if (-not [string]::IsNullOrWhiteSpace($dir)) {
    Ensure-Dir $dir
  }
  Set-Content -LiteralPath $NginxUpstreamFile -Value $content -Encoding ASCII
}

function Reload-Nginx {
  & $NginxExe -t
  if ($LASTEXITCODE -ne 0) {
    throw "nginx config test failed with exit code $LASTEXITCODE"
  }

  & $NginxExe -s reload
  if ($LASTEXITCODE -ne 0) {
    throw "nginx reload failed with exit code $LASTEXITCODE"
  }
}

Ensure-Dir $Root
Ensure-Dir $UpdateDir
Ensure-Dir $SlotsDir
Ensure-Dir $BlueDir
Ensure-Dir $GreenDir
Ensure-Dir $BackupDir
Ensure-Dir $LogDir

Require-File $PackagePath "Deployment package missing"
Require-File $EnvFile "Production env file missing"
Require-File $NodeExe "Node executable missing"

$activeName = Get-ActiveSlotName
$inactiveName = if ($activeName -eq "blue") { "green" } else { "blue" }
$active = Get-Slot $activeName
$inactive = Get-Slot $inactiveName
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$inactiveBackup = Join-Path $BackupDir "$($inactive.Name)-$timestamp"

Write-Host "Active slot:   $($active.Name) / $($active.Service) / $($active.Port)"
Write-Host "Release slot:  $($inactive.Name) / $($inactive.Service) / $($inactive.Port)"

try {
  Write-Step "Stopping inactive service"
  Stop-ServiceIfExists -ServiceName $($inactive.Service)

  Write-Step "Preparing release directory"
  if (Test-Path $ReleaseDir) {
    Remove-Item -LiteralPath $ReleaseDir -Recurse -Force
  }
  New-Item -ItemType Directory -Path $ReleaseDir -Force | Out-Null

  Write-Step "Extracting package"
  Expand-Archive -LiteralPath $PackagePath -DestinationPath $ReleaseDir -Force
  $ExtractedApp = Join-Path $ReleaseDir "app"
  Require-File (Join-Path $ExtractedApp "server.js") "Package is invalid, server.js missing"

  Write-Step "Replacing inactive slot app"
  if (Test-Path $inactive.AppDir) {
    Move-Item -LiteralPath $($inactive.AppDir) -Destination $inactiveBackup -Force
  }
  Move-Item -LiteralPath $ExtractedApp -Destination $($inactive.AppDir) -Force
  Copy-Item -LiteralPath $EnvFile -Destination (Join-Path $($inactive.AppDir) ".env.production") -Force

  Write-Step "Applying database migrations"
  Push-Location $($inactive.AppDir)
  try {
    $env:NODE_ENV = "production"
    node "scripts\apply-migrations.mjs"
    if ($LASTEXITCODE -ne 0) {
      throw "Database migration failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }

  Write-Step "Configuring inactive NSSM service"
  Ensure-NssmService -Slot $inactive

  Write-Step "Starting inactive service"
  Start-NssmService -ServiceName $($inactive.Service)
  Wait-Health "http://127.0.0.1:$($inactive.Port)$HealthPath" $HealthTimeoutSeconds

  Write-Step "Switching Nginx to $($inactive.Name)"
  Write-NginxUpstream $inactive.Port
  Reload-Nginx
  Wait-Health "$PublicBaseUrl$HealthPath" $HealthTimeoutSeconds

  Set-Content -LiteralPath $ActiveSlotFile -Value $inactive.Name -Encoding ASCII

  Write-Step "Stopping old active service"
  Stop-ServiceIfExists -ServiceName $($active.Service)

  if (Test-Path $ReleaseDir) {
    Remove-Item -LiteralPath $ReleaseDir -Recurse -Force
  }

  Write-Host ""
  Write-Host "Blue-green deployment complete: $($active.Name) -> $($inactive.Name)" -ForegroundColor Green
  Send-DeployNotification -Status "SUCCESS" -Message "Switched: $($active.Name) -> $($inactive.Name)`nService: $($inactive.Service)`nPort: $($inactive.Port)`nHealth: $PublicBaseUrl$HealthPath"
} catch {
  Write-Host ""
  Write-Host "Blue-green deployment failed: $($_.Exception.Message)" -ForegroundColor Red

  try {
    Write-Step "Restoring Nginx to active slot: $($active.Name)"
    Write-NginxUpstream $active.Port
    Reload-Nginx
    Wait-Health "$PublicBaseUrl$HealthPath" 30
  } catch {
    Write-Host "Rollback proxy switch failed: $($_.Exception.Message)" -ForegroundColor Red
  }

  try {
    Stop-ServiceIfExists -ServiceName $($inactive.Service)
    if ((Test-Path $inactiveBackup) -and (Test-Path $($inactive.AppDir))) {
      Remove-Item -LiteralPath $($inactive.AppDir) -Recurse -Force
      Move-Item -LiteralPath $inactiveBackup -Destination $($inactive.AppDir) -Force
    }
  } catch {
    Write-Host "Inactive slot cleanup failed: $($_.Exception.Message)" -ForegroundColor Yellow
  }

  Send-DeployNotification -Status "FAILED" -Message "Target: $($inactive.Name)`nError: $($_.Exception.Message)`nRollback: attempted to keep $($active.Name)"
  throw
}
