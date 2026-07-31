$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Require-Env {
  param([string]$Name)
  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing CI variable: $Name"
  }
  return $value.Trim().Trim("'").Trim('"')
}

function Require-File {
  param([string]$Path, [string]$Message)
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "$Message`: $Path"
  }
}

function Invoke-Checked {
  param(
    [string]$Command,
    [string[]]$Arguments
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Command failed with exit code $LASTEXITCODE"
  }
}

function Resolve-SshKeyPath {
  $candidates = @()

  $configured = [Environment]::GetEnvironmentVariable("DEPLOY_SSH_KEY_PATH")
  if (-not [string]::IsNullOrWhiteSpace($configured)) {
    $candidates += $configured.Trim().Trim("'").Trim('"')
  }

  if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
    $candidates += (Join-Path $env:USERPROFILE ".ssh\id_tandem_deploy")
  }

  $candidates += @(
    "C:\Users\Administrator\.ssh\id_tandem_deploy",
    "C:\GitLab-Runner\.ssh\id_tandem_deploy"
  )

  foreach ($candidate in $candidates) {
    if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path -LiteralPath $candidate)) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  throw "SSH private key missing. Checked: $($candidates -join ', ')"
}

$DeployHost = Require-Env "DEPLOY_HOST"
$DeployUser = Require-Env "DEPLOY_USER"
$DeployRoot = Require-Env "DEPLOY_ROOT"
$NginxExe = Require-Env "DEPLOY_NGINX_EXE"
$NginxPrefix = Require-Env "DEPLOY_NGINX_PREFIX"
$NginxConfig = Require-Env "DEPLOY_NGINX_CONFIG"
$PublicBaseUrl = Require-Env "DEPLOY_PUBLIC_BASE_URL"
$NotifyWebhookUrl = [Environment]::GetEnvironmentVariable("DEPLOY_NOTIFY_WEBHOOK_URL")
$NotifyWebhookType = [Environment]::GetEnvironmentVariable("DEPLOY_NOTIFY_WEBHOOK_TYPE")

$KeyPath = Resolve-SshKeyPath

$PackagePath = Join-Path (Get-Location) "tandem-deploy.zip"
$BlueGreenScript = Join-Path (Get-Location) "scripts\deploy-windows-nssm-bluegreen.ps1"

Require-File $PackagePath "Deployment package missing"
Require-File $BlueGreenScript "Blue-green deploy script missing"

$Target = "$DeployUser@$DeployHost"
$SshOptions = @(
  "-o", "BatchMode=yes",
  "-o", "StrictHostKeyChecking=no",
  "-o", "UserKnownHostsFile=NUL",
  "-i", $KeyPath
)

Write-Host "Deploy target: $Target"
Write-Host "Deploy root:   $DeployRoot"
Write-Host "SSH key:       $KeyPath"

Invoke-Checked "ssh" ($SshOptions + @(
  $Target,
  "powershell -NoProfile -ExecutionPolicy Bypass -Command `"New-Item -ItemType Directory -Force '$DeployRoot','${DeployRoot}/update','${DeployRoot}/nginx' | Out-Null`""
))

Invoke-Checked "scp" ($SshOptions + @(
  $BlueGreenScript,
  "${Target}:$DeployRoot/deploy-windows-nssm-bluegreen.ps1"
))

Invoke-Checked "scp" ($SshOptions + @(
  $PackagePath,
  "${Target}:$DeployRoot/update/tandem-deploy.zip"
))

$RemoteCommand = @(
  "powershell -NoProfile -ExecutionPolicy Bypass -File $DeployRoot/deploy-windows-nssm-bluegreen.ps1",
  "-Root $DeployRoot",
  "-PackageName tandem-deploy.zip",
  "-BlueServiceName TandemServerBlue",
  "-GreenServiceName TandemServerGreen",
  "-BluePort 3005",
  "-GreenPort 3006",
  "-NginxExe '$NginxExe'",
  "-NginxPrefix '$NginxPrefix'",
  "-NginxConfig '$NginxConfig'",
  "-NginxUpstreamFile '$DeployRoot/nginx/tandem-upstream.conf'",
  "-PublicBaseUrl '$PublicBaseUrl'"
)

if (-not [string]::IsNullOrWhiteSpace($NotifyWebhookUrl)) {
  $RemoteCommand += "-NotifyWebhookUrl '$($NotifyWebhookUrl.Trim().Trim("'").Trim('"'))'"
}
if (-not [string]::IsNullOrWhiteSpace($NotifyWebhookType)) {
  $RemoteCommand += "-NotifyWebhookType '$($NotifyWebhookType.Trim().Trim("'").Trim('"'))'"
}

Invoke-Checked "ssh" ($SshOptions + @($Target, ($RemoteCommand -join " ")))
