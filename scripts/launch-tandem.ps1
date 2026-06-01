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

# --- Step 3: Handle proxy (WebView2 localhost fix) ---
Write-Host "[3/4] Checking proxy settings..." -NoNewline
$proxyKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings"
$proxyWasEnabled = $false
$originalProxy = $null
$originalOverride = $null
try {
    $prop = Get-ItemProperty -Path $proxyKey -Name ProxyEnable, ProxyServer, ProxyOverride -ErrorAction Stop
    if ($prop.ProxyEnable -eq 1 -and $prop.ProxyServer) {
        $proxyWasEnabled = $true
        $originalProxy = $prop.ProxyServer
        $originalOverride = $prop.ProxyOverride
        Write-Host " proxy detected ($originalProxy), temporarily disabling for localhost..." -NoNewline
        Set-ItemProperty -Path $proxyKey -Name ProxyEnable -Value 0
        Write-Host " disabled" -ForegroundColor Green
    } else {
        Write-Host " none" -ForegroundColor Gray
    }
} catch {
    Write-Host " error checking proxy" -ForegroundColor Gray
}

# --- Step 4: Launch desktop app ---
Write-Host "[4/4] Launching desktop app..." -NoNewline

$installedPath = "${env:ProgramFiles}\Tandem\Tandem.exe"
$installedPathX86 = "${env:ProgramFiles(x86)}\Tandem\Tandem.exe"
$installedPathLocal = "$env:LOCALAPPDATA\Tandem\tandem.exe"
$desktopExe = if (Test-Path $installedPathLocal) { $installedPathLocal }
              elseif (Test-Path $installedPath) { $installedPath }
              elseif (Test-Path $installedPathX86) { $installedPathX86 }
              else { $null }

if ($desktopExe) {
    Write-Host " OK ($desktopExe)" -ForegroundColor Green
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Tandem launched!" -ForegroundColor Green
    Write-Host "  Close Tandem to restore proxy settings" -ForegroundColor Gray
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    # -Wait keeps proxy disabled until Tandem exits
    Start-Process $desktopExe -Wait
} else {
    Write-Host ""
    Write-Host "  (dev mode: npx tauri dev)" -ForegroundColor Gray
    Set-Location "$PSScriptRoot\.."
    npx tauri dev
}

# --- Restore proxy ---
if ($proxyWasEnabled) {
    Write-Host "Restoring proxy settings..." -NoNewline
    Set-ItemProperty -Path $proxyKey -Name ProxyEnable -Value 1
    if ($originalProxy) { Set-ItemProperty -Path $proxyKey -Name ProxyServer -Value $originalProxy }
    if ($originalOverride) { Set-ItemProperty -Path $proxyKey -Name ProxyOverride -Value $originalOverride }
    Write-Host " restored" -ForegroundColor Green
}
