# ╔══════════════════════════════════════════════════════════════════════════╗
# ║   ⚠️  本机自用专属 · LOCAL SELF-USE ONLY  ⚠️                             ║
# ║   云服务器/公司局域网部署请用 docker-compose.prod.yml + Systemd, 勿用此。  ║
# ║   详见 DEPLOY-LOCAL-VS-CLOUD.md                                          ║
# ╚══════════════════════════════════════════════════════════════════════════╝
#
# Tandem Server · 注册/卸载 Windows 开机自启后台服务 (任务计划, Windows-only)
#
# 把 scripts/tandem-server-daemon.ps1 注册成"登录时自动、隐藏窗口、崩溃自动重启"的计划任务,
# 使 Tandem 生产服务常驻锁在 3005, 桌面端 App 随时可连。
#
# 用法:
#   安装:  powershell -ExecutionPolicy Bypass -File scripts/install-tandem-service.ps1
#   卸载:  powershell -ExecutionPolicy Bypass -File scripts/install-tandem-service.ps1 -Uninstall
#
# 注: 任务在当前用户登录时启动。服务本身无需窗口; 桌面端 App 单独从开始菜单/快捷方式启动。

param([switch]$Uninstall)

$ErrorActionPreference = "Stop"
$TaskName = "TandemServer"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Daemon = Join-Path $RepoRoot "scripts\tandem-server-daemon.ps1"

if ($Uninstall) {
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "已卸载计划任务: $TaskName" -ForegroundColor Green
    } else {
        Write-Host "未找到计划任务: $TaskName (无需卸载)" -ForegroundColor Yellow
    }
    return
}

if (-not (Test-Path $Daemon)) { throw "找不到守护脚本: $Daemon" }

# 已存在则先移除, 保证幂等
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$Daemon`""

$trigger = New-ScheduledTaskTrigger -AtLogOn

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Seconds 0) `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -Hidden

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
    -Settings $settings -Principal $principal `
    -Description "Tandem 生产服务常驻 (next start -p 3005), 崩溃自动重启" | Out-Null

Write-Host "已注册计划任务: $TaskName (登录自启, 隐藏窗口, 崩溃重启)" -ForegroundColor Green
Write-Host "日志: $env:LOCALAPPDATA\Tandem\server.log" -ForegroundColor Gray
