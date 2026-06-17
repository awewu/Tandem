param(
  [switch]$SkipBuild,
  [string]$OutputZip
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$Parent = Split-Path -Parent $Repo
if (-not $OutputZip) {
  $OutputZip = Join-Path $Parent "tandem-deploy.zip"
}

$Stage = Join-Path $Repo "deploy-package"
$App = Join-Path $Stage "app"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Remove-DirSafe {
  param([string]$Path, [string]$Root)
  $resolved = Resolve-Path -Path $Path -ErrorAction SilentlyContinue
  if ($resolved -and $resolved.Path.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase)) {
    Remove-Item -LiteralPath $resolved.Path -Recurse -Force
  }
}

Set-Location $Repo

Write-Host "Tandem deploy package builder" -ForegroundColor Green
Write-Host "Repo: $Repo"
Write-Host "Output: $OutputZip"

Write-Step "Stopping local Next.js processes for this repo"
$nodeProcesses = Get-CimInstance Win32_Process -Filter "name = 'node.exe'" -ErrorAction SilentlyContinue |
  Where-Object {
    $_.CommandLine -and
    $_.CommandLine.Contains($Repo) -and
    ($_.CommandLine -match "next dev|next start|server\.js")
  }

foreach ($p in $nodeProcesses) {
  Write-Host "Stopping node PID $($p.ProcessId)"
  Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
}

if (-not $SkipBuild) {
  Write-Step "Preparing static assets"
  if (Test-Path "scripts\copy-pdf-worker.mjs") {
    & node "scripts\copy-pdf-worker.mjs"
  }

  Write-Step "Running standalone production build"
  $env:NEXT_OUTPUT = "standalone"
  $env:NEXT_TELEMETRY_DISABLED = "1"
  $env:NEXTAUTH_SECRET = "build-only-secret-please-do-not-use-in-prod-20260611-standalone"
  $env:SESSION_SECRET = $env:NEXTAUTH_SECRET
  $env:SKIP_STARTUP_GUARD = "1"
  $env:DEEPSEEK_API_KEY = "build-placeholder"
  $env:DATABASE_URL = ""

  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) {
    throw "next build failed with exit code $LASTEXITCODE"
  }
} else {
  Write-Step "Skipping build and using existing .next output"
}

Write-Step "Checking standalone output"
$Standalone = Join-Path $Repo ".next\standalone"
$StandaloneServer = Join-Path $Standalone "server.js"
if (-not (Test-Path $StandaloneServer)) {
  throw "Missing $StandaloneServer. Run without -SkipBuild to generate standalone output."
}
if (-not (Test-Path ".next\static")) {
  throw "Missing .next\static. Build output is incomplete."
}

Write-Step "Assembling deployment folder"
Remove-DirSafe -Path $Stage -Root $Repo
New-Item -ItemType Directory -Path $App -Force | Out-Null

Get-ChildItem -LiteralPath $Standalone -Force | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $App -Recurse -Force
}

Copy-Item -LiteralPath ".next\static" -Destination (Join-Path $App ".next\static") -Recurse -Force
Copy-Item -LiteralPath "public" -Destination (Join-Path $App "public") -Recurse -Force
Copy-Item -LiteralPath "drizzle" -Destination (Join-Path $App "drizzle") -Recurse -Force
Copy-Item -LiteralPath "drizzle.config.ts" -Destination (Join-Path $App "drizzle.config.ts") -Force

Write-Step "Creating zip"
if (Test-Path $OutputZip) {
  Remove-Item -LiteralPath $OutputZip -Force
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipCreated = $false
for ($attempt = 1; $attempt -le 5 -and -not $zipCreated; $attempt++) {
  try {
    [System.GC]::Collect()
    Start-Sleep -Seconds 2
    [System.IO.Compression.ZipFile]::CreateFromDirectory(
      $Stage,
      $OutputZip,
      [System.IO.Compression.CompressionLevel]::Optimal,
      $false
    )
    $zipCreated = $true
  } catch {
    Write-Host "Zip attempt $attempt failed: $($_.Exception.Message). Retrying..." -ForegroundColor Yellow
    if (Test-Path $OutputZip) { Remove-Item -LiteralPath $OutputZip -Force -ErrorAction SilentlyContinue }
    if ($attempt -eq 5) { throw }
  }
}

Write-Step "Verifying zip"
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($OutputZip)
try {
  $needed = @(
    "app/server.js",
    "app/package.json",
    "app/.next/BUILD_ID",
    "app/.next/static/",
    "app/node_modules/",
    "app/public/",
    "app/drizzle/",
    "app/lib/",
    "app/docs/",
    "app/skills/",
    "app/drizzle.config.ts"
  )
  $names = $zip.Entries | ForEach-Object { $_.FullName -replace "\\", "/" }
  foreach ($item in $needed) {
    $present = ($names | Where-Object { $_ -eq $item -or $_.StartsWith($item) } | Select-Object -First 1) -ne $null
    if (-not $present) {
      throw "Zip verification failed, missing: $item"
    }
  }
} finally {
  $zip.Dispose()
}

$hash = Get-FileHash $OutputZip -Algorithm SHA256
$file = Get-Item $OutputZip
Remove-DirSafe -Path $Stage -Root $Repo

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "Package: $($file.FullName)"
Write-Host "Size: $($file.Length) bytes"
Write-Host "SHA256: $($hash.Hash)"
Write-Host ""
Write-Host "Upload this file to: E:\tandem-deploy\update\tandem-deploy.zip"
Write-Host "Then run: E:\tandem-deploy\update\更新脚本-本次打包版.ps1"
