# Tandem Server Daemon · 后台常驻守护进程
#
# 用途: 作为 Windows 计划任务在登录时静默启动, 把 Tandem 生产服务锁死在 3005,
#       崩溃后自动重启. 桌面端 App (localhost:3005) 始终有后端可连.
#
# 注册/卸载请用 scripts/install-tandem-service.ps1。
# 前置: 已 `npm run build` (存在 .next 生产产物) + 原生 Postgres 在 5432 运行。

$ErrorActionPreference = "Continue"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

# 日志目录 (放 LOCALAPPDATA, 不污染仓库)
$LogDir = Join-Path $env:LOCALAPPDATA "Tandem"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
$LogFile = Join-Path $LogDir "server.log"

function Log($msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
    Add-Content -Path $LogFile -Value $line
}

# 锁端口 + 生产 env (本机自用跳过启动守卫)
$env:PORT = "3005"
$env:NODE_ENV = "production"
$env:SKIP_STARTUP_GUARD = "1"

Log "daemon started (repo=$RepoRoot)"

# 守护循环: next start 退出即等待后重启
while ($true) {
    # 若 3005 已被占用 (例如手动起了一个), 等待而非重复拉起
    $inUse = Get-NetTCPConnection -State Listen -LocalPort 3005 -ErrorAction SilentlyContinue
    if ($inUse) {
        Log "port 3005 already listening (pid=$($inUse[0].OwningProcess)); skip launch, recheck in 30s"
        Start-Sleep -Seconds 30
        continue
    }

    if (-not (Test-Path (Join-Path $RepoRoot ".next"))) {
        Log "FATAL: .next 不存在, 请先 npm run build. 60s 后重试"
        Start-Sleep -Seconds 60
        continue
    }

    Log "launching: next start -p 3005"
    # 直接调 next 二进制, 输出重定向到日志
    & node "node_modules\next\dist\bin\next" start -p 3005 *>> $LogFile
    $code = $LASTEXITCODE
    Log "next start exited (code=$code); restarting in 5s"
    Start-Sleep -Seconds 5
}
