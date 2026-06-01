# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  Tandem · 桌面端一键启动器 (含诊断 + 自动修复)                          ║
# ║                                                                          ║
# ║  用法: 双击此脚本 或 右键 → "使用 PowerShell 运行"                       ║
# ║  功能: ① 诊断服务器 ② 自动重启假死 ③ 清 WebView2 缓存 ④ 开桌面端       ║
# ╚══════════════════════════════════════════════════════════════════════════╝

$ErrorActionPreference = "Stop"
$host.ui.RawUI.WindowTitle = "Tandem 启动器"

# ── 配置 ──────────────────────────────────────────────────────────
$ServerUrl = "http://127.0.0.1:3005"
$ServerPort = 3005
$CachePaths = @(
    "$env:LOCALAPPDATA\com.tandem.app\EBWebView\Default\Cache",
    "$env:LOCALAPPDATA\com.tandem.app\EBWebView\Default\Code Cache"
)

# ── 辅助函数 ──────────────────────────────────────────────────────
function Test-ServerAlive {
    try {
        $resp = Invoke-WebRequest -Uri $ServerUrl -TimeoutSec 3 -ErrorAction Stop
        return ($resp.StatusCode -eq 200)
    } catch { return $false }
}

function Get-ServerProcess {
    return Get-Process node -ErrorAction SilentlyContinue | Where-Object {
        Get-NetTCPConnection -OwningProcess $_.Id -LocalPort $ServerPort -ErrorAction SilentlyContinue
    }
}

# ── 步骤 1: 诊断服务器 ────────────────────────────────────────────
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  Tandem 桌面端一键启动器" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/4] 诊断服务器 ($ServerUrl) ..." -NoNewline
if (Test-ServerAlive) {
    Write-Host " ✅ 正常" -ForegroundColor Green
} else {
    Write-Host " 🔴 无响应" -ForegroundColor Red

    # 1a. 杀掉占端口的假死 node
    $p = Get-ServerProcess
    if ($p) {
        Write-Host "      → 发现假死进程 PID $($p.Id)，正在清理..." -NoNewline
        $p | Stop-Process -Force
        Start-Sleep -Seconds 2
        Write-Host " 完成" -ForegroundColor Green
    }

    # 1b. 检查是否有 .next 构建产物
    $buildExists = Test-Path "$PSScriptRoot\..\.next" -PathType Container
    if (-not $buildExists) {
        Write-Host ""
        Write-Host "⚠️  缺少生产构建产物 (.next 目录不存在)" -ForegroundColor Yellow
        Write-Host "    请先运行: .\run-local-production.ps1" -ForegroundColor Yellow
        Write-Host "    按任意键退出..."
        [void][Console]::ReadKey($true)
        exit 1
    }

    # 1c. 后台启动 npm start
    Write-Host "      → 启动服务器..." -NoNewline
    $pinfo = New-Object System.Diagnostics.ProcessStartInfo
    $pinfo.FileName = "npm"
    $pinfo.Arguments = "start"
    $pinfo.WorkingDirectory = "$PSScriptRoot\.."
    $pinfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
    $pinfo.CreateNoWindow = $true
    $pinfo.UseShellExecute = $false
    [System.Diagnostics.Process]::Start($pinfo) | Out-Null

    # 等待启动
    $maxWait = 15
    $started = $false
    for ($i = 0; $i -lt $maxWait; $i++) {
        Start-Sleep -Seconds 1
        if (Test-ServerAlive) { $started = $true; break }
        Write-Host "." -NoNewline -ForegroundColor Cyan
    }
    if ($started) {
        Write-Host " ✅ 启动成功" -ForegroundColor Green
    } else {
        Write-Host " ❌ 启动超时，请检查日志" -ForegroundColor Red
        Write-Host "      命令: npm start (在项目根目录手动运行看报错)" -ForegroundColor Gray
        exit 1
    }
}

# ── 步骤 2: 清理 WebView2 缓存 ──────────────────────────────────
Write-Host "[2/4] 清理 WebView2 缓存..." -NoNewline
$cleaned = 0
foreach ($cp in $CachePaths) {
    if (Test-Path $cp) {
        Remove-Item -Recurse -Force "$cp\*" -ErrorAction SilentlyContinue
        $cleaned++
    }
}
if ($cleaned -gt 0) {
    Write-Host " ✅ 已清理" -ForegroundColor Green
} else {
    Write-Host " ℹ️  无缓存 (首次启动)" -ForegroundColor Gray
}

# ── 步骤 3: 启动桌面端 ──────────────────────────────────────────
Write-Host "[3/4] 启动桌面端..." -NoNewline

# 检查是否已安装 .msi（开始菜单有）
$installedPath = "${env:ProgramFiles}\Tandem\Tandem.exe"
$installedPathX86 = "${env:ProgramFiles(x86)}\Tandem\Tandem.exe"
$desktopExe = if (Test-Path $installedPath) { $installedPath }
              elseif (Test-Path $installedPathX86) { $installedPathX86 }
              else { $null }

if ($desktopExe) {
    # 启动已安装的桌面端
    Start-Process $desktopExe
    Write-Host " ✅ 已启动 ($desktopExe)" -ForegroundColor Green
} else {
    # 开发模式启动
    Write-Host ""
    Write-Host "      (开发模式: npx tauri dev)" -ForegroundColor Gray
    Set-Location "$PSScriptRoot\.."
    # 直接运行，保持窗口附着以便看日志
    npx tauri dev
}

# ── 完成 ──────────────────────────────────────────────────────────
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
if ($desktopExe) {
    Write-Host "  Tandem 已启动！" -ForegroundColor Green
    Write-Host "  如果窗口没出来，按 Win 键搜索 'Tandem'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  按任意键关闭此窗口..."
    [void][Console]::ReadKey($true)
}
