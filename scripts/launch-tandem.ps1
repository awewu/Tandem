# Tandem Desktop Launcher (diagnose + auto-fix)
# Usage: right-click -> Run with PowerShell, or double-click launch-tandem.bat

$ErrorActionPreference = "Stop"

$ServerUrl = "http://127.0.0.1:3005"
$ServerPort = 3005

function Test-ServerAlive {
    try {
        $resp = Invoke-WebRequest -Uri $ServerUrl -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
        return ($resp.StatusCode -eq 200)
    } catch { return $false }
}

function Get-ServerProcess {
    return Get-Process node -ErrorAction SilentlyContinue | Where-Object {
        Get-NetTCPConnection -OwningProcess $_.Id -LocalPort $ServerPort -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Tandem Desktop Launcher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- Step 1: Diagnose server ---
Write-Host "[1/4] Checking server ($ServerUrl) ..." -NoNewline
if (Test-ServerAlive) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " DOWN" -ForegroundColor Red

    $p = Get-ServerProcess
    if ($p) {
        Write-Host "      -> Killing stale node PID $($p.Id) ..." -NoNewline
        $p | Stop-Process -Force
        Start-Sleep -Seconds 2
        Write-Host " done" -ForegroundColor Green
    }

    $buildExists = Test-Path "$PSScriptRoot\..\.next" -PathType Container
    if (-not $buildExists) {
        Write-Host ""
        Write-Host "WARNING: No production build (.next folder missing)" -ForegroundColor Yellow
        Write-Host "         Run .\run-local-production.ps1 first" -ForegroundColor Yellow
        Write-Host "Press any key to exit..."
        [void][Console]::ReadKey($true)
        exit 1
    }

    Write-Host "      -> Starting server in background..." -NoNewline
    $pinfo = New-Object System.Diagnostics.ProcessStartInfo
    $pinfo.FileName = "npm"
    $pinfo.Arguments = "start"
    $pinfo.WorkingDirectory = "$PSScriptRoot\.."
    $pinfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
    $pinfo.CreateNoWindow = $true
    $pinfo.UseShellExecute = $false
    [System.Diagnostics.Process]::Start($pinfo) | Out-Null

    $started = $false
    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Seconds 1
        if (Test-ServerAlive) { $started = $true; break }
        Write-Host "." -NoNewline -ForegroundColor Cyan
    }
    if ($started) {
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host " TIMEOUT" -ForegroundColor Red
        Write-Host "        Run 'npm start' manually in project root to see errors" -ForegroundColor Gray
        exit 1
    }
}

# --- Step 2: Clear WebView2 cache ---
Write-Host "[2/4] Clearing WebView2 cache..." -NoNewline
$cleaned = 0
$cachePaths = @(
    "$env:LOCALAPPDATA\com.tandem.app\EBWebView\Default\Cache",
    "$env:LOCALAPPDATA\com.tandem.app\EBWebView\Default\Code Cache"
)
foreach ($cp in $cachePaths) {
    if (Test-Path $cp) {
        Remove-Item -Recurse -Force "$cp\*" -ErrorAction SilentlyContinue
        $cleaned++
    }
}
if ($cleaned -gt 0) {
    Write-Host " cleared" -ForegroundColor Green
} else {
    Write-Host " none" -ForegroundColor Gray
}

# --- Step 3: Launch desktop app ---
Write-Host "[3/4] Launching desktop app..." -NoNewline

$installedPath = "${env:ProgramFiles}\Tandem\Tandem.exe"
$installedPathX86 = "${env:ProgramFiles(x86)}\Tandem\Tandem.exe"
$desktopExe = if (Test-Path $installedPath) { $installedPath }
              elseif (Test-Path $installedPathX86) { $installedPathX86 }
              else { $null }

if ($desktopExe) {
    Start-Process $desktopExe
    Write-Host " OK ($desktopExe)" -ForegroundColor Green
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Tandem launched!" -ForegroundColor Green
    Write-Host "  If window doesn't appear, press Win and search 'Tandem'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Press any key to close this window..."
    [void][Console]::ReadKey($true)
} else {
    Write-Host ""
    Write-Host "  (dev mode: npx tauri dev)" -ForegroundColor Gray
    Set-Location "$PSScriptRoot\.."
    npx tauri dev
}
