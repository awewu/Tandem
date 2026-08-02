# ╔══════════════════════════════════════════════════════════════════════════╗
# ║   Tandem · 部署包更新脚本 (deploy-update.ps1)                              ║
# ║   幂等: 解压 tandem-deploy.zip → 原子换版 → (可选)迁移 → 重启 standalone。  ║
# ║                                                                          ║
# ║   ⚠️  运行期密钥不由本脚本注入。请在 -EnvFile 指向的 env 文件里配齐:        ║
# ║        DATABASE_URL / DEEPSEEK_API_KEY / 强随机 NEXTAUTH_SECRET+SESSION_  ║
# ║        SECRET。缺失强密钥时 production-guard 会拒绝启动 (这是正确行为)。     ║
# ║        本机自用预览可在 env 文件加 SKIP_STARTUP_GUARD=1 跳过硬化检查。      ║
# ║   🚫 对外服务器正式上线请用 docker-compose.prod.yml + Caddy (见 DEPLOY.md)。║
# ╚══════════════════════════════════════════════════════════════════════════╝
#
# 用法示例:
#   # 仅换版 + 重启 (不迁移), 用 <Target>\app\.env.production 里的运行期配置:
#   powershell -ExecutionPolicy Bypass -File deploy-update.ps1
#
#   # 换版 + 跑幂等 DB 迁移 + 重启, 指定 env 与端口:
#   powershell -ExecutionPolicy Bypass -File deploy-update.ps1 -RunMigrations -EnvFile "E:\tandem-deploy\.env.production" -Port 3005
#
#   # 只解压换版, 不启动 (稍后手动起服务):
#   powershell -ExecutionPolicy Bypass -File deploy-update.ps1 -NoStart

param(
  [string]$Zip = "E:\tandem-deploy\update\tandem-deploy.zip",
  [string]$Target = "E:\tandem-deploy\current",
  [int]$Port = 3005,
  [string]$BindHost = "0.0.0.0",
  [string]$EnvFile = "",          # 运行期 env (KEY=VALUE). 缺省: <Target>\app\.env.production
  [string]$ExpectedSha = "",      # 可选: 校验 zip 的 SHA256 (大小写不敏感)
  [int]$KeepReleases = 5,         # 保留最近 N 个历史版本用于回滚
  [switch]$RunMigrations,         # 显式开启后才跑 DB 迁移 (需 DATABASE_URL)
  [switch]$NoStart,               # 只换版不启动
  [switch]$Force                  # 跳过交互确认
)

$ErrorActionPreference = "Stop"
function Step($m){ Write-Host ""; Write-Host "==> $m" -ForegroundColor Cyan }
function Info($m){ Write-Host "    $m" -ForegroundColor Gray }
function Warn($m){ Write-Host "    ! $m" -ForegroundColor Yellow }
function Die($m){ Write-Host "    ✗ $m" -ForegroundColor Red; exit 1 }

$ts = Get-Date -Format "yyyyMMdd-HHmmss"

# ── 1. 预检 ────────────────────────────────────────────────────────────────
Step "预检"
if (-not (Test-Path $Zip)) { Die "找不到部署包: $Zip" }
$zipItem = Get-Item $Zip
Info "包: $($zipItem.FullName)  ($([math]::Round($zipItem.Length/1MB,1)) MB)"

$sha = (Get-FileHash $Zip -Algorithm SHA256).Hash
Info "SHA256: $sha"
if ($ExpectedSha -and ($sha -ne $ExpectedSha.ToUpper())) {
  Die "SHA256 不匹配 (期望 $ExpectedSha)"
}

# 校验 zip 结构 (必须含 app/server.js)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipArchive = [IO.Compression.ZipFile]::OpenRead($Zip)
try {
  $names = $zipArchive.Entries | ForEach-Object { $_.FullName -replace "\\","/" }
  foreach ($req in @("app/server.js","app/.next/BUILD_ID","app/node_modules/")) {
    if (-not ($names | Where-Object { $_ -eq $req -or $_.StartsWith($req) } | Select-Object -First 1)) {
      Die "部署包结构不完整, 缺少: $req"
    }
  }
} finally { $zipArchive.Dispose() }
Info "包结构校验通过 (含 app/server.js)"

if (-not $EnvFile) { $EnvFile = Join-Path $Target "app\.env.production" }

if (-not $Force) {
  $ans = Read-Host "确认上线到 $Target (端口 $Port, 迁移=$($RunMigrations.IsPresent), 启动=$([bool](-not $NoStart)))? [y/N]"
  if ($ans -ne 'y' -and $ans -ne 'Y') { Warn "已取消"; exit 0 }
}

# ── 2. 停旧服务 (PID 文件优先, 再兜底按端口占用者) ─────────────────────────
Step "停止旧服务"
$pidFile = Join-Path $Target "server.pid"
if (Test-Path $pidFile) {
  $oldPid = (Get-Content $pidFile -Raw).Trim()
  if ($oldPid -match '^\d+$') {
    $p = Get-Process -Id ([int]$oldPid) -ErrorAction SilentlyContinue
    if ($p) { Info "停止 PID $oldPid (server.pid)"; Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
  }
  Remove-Item $pidFile -ErrorAction SilentlyContinue
}
# 兜底: 释放目标端口 (仅当占用者是 node.exe 时才杀, 避免误伤)
try {
  $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conns) {
    $owner = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
    if ($owner -and $owner.ProcessName -eq 'node') {
      Info "端口 $Port 仍被 node PID $($owner.Id) 占用, 停止"
      Stop-Process -Id $owner.Id -Force -ErrorAction SilentlyContinue
    } elseif ($owner) {
      Warn "端口 $Port 被非 node 进程占用: $($owner.ProcessName) PID $($owner.Id) (未自动停止)"
    }
  }
} catch {}
Start-Sleep -Milliseconds 800

# ── 3. 原子换版 (备份旧版 → 解压 → 移入) ───────────────────────────────────
Step "换版"
$incoming = Join-Path $Target "_incoming"
$releases = Join-Path $Target "releases"
New-Item -ItemType Directory -Force -Path $Target,$releases | Out-Null
if (Test-Path $incoming) { Remove-Item $incoming -Recurse -Force }

Info "解压到临时目录 _incoming ..."
Expand-Archive -Path $Zip -DestinationPath $incoming -Force
$incomingApp = Join-Path $incoming "app"
if (-not (Test-Path (Join-Path $incomingApp "server.js"))) { Die "解压后未找到 app\server.js" }

$currentApp = Join-Path $Target "app"
$savedEnv = $null
if (Test-Path $currentApp) {
  # 保留旧版 env, 换版后回填 (避免丢配置)
  $oldEnvProd = Join-Path $currentApp ".env.production"
  if (Test-Path $oldEnvProd) { $savedEnv = Join-Path $Target "_saved.env.production"; Copy-Item $oldEnvProd $savedEnv -Force }
  $backup = Join-Path $releases "app-$ts"
  Info "备份旧版 → releases\app-$ts"
  Move-Item $currentApp $backup -Force
}
Move-Item $incomingApp $currentApp -Force
Remove-Item $incoming -Recurse -Force -ErrorAction SilentlyContinue
Info "新版就位: $currentApp"

# ── 4. 运行期 env ─────────────────────────────────────────────────────────
Step "运行期配置"
$appEnv = Join-Path $currentApp ".env.production"
if ($EnvFile -and (Test-Path $EnvFile) -and ((Resolve-Path $EnvFile).Path -ne (Join-Path $currentApp ".env.production"))) {
  Copy-Item $EnvFile $appEnv -Force
  Info "已写入 env: $EnvFile → app\.env.production"
} elseif ($savedEnv -and (Test-Path $savedEnv)) {
  Copy-Item $savedEnv $appEnv -Force
  Info "沿用上一版 env (app\.env.production)"
}
if (-not (Test-Path $appEnv)) {
  Warn "未找到运行期 env ($appEnv)。缺 DATABASE_URL/密钥 时服务可能拒绝启动。"
} else {
  $envText = Get-Content $appEnv -Raw
  foreach ($k in @('DATABASE_URL','DEEPSEEK_API_KEY','NEXTAUTH_SECRET')) {
    if ($envText -notmatch "(?m)^\s*$k\s*=") { Warn "env 缺少 $k" }
  }
}
if ($savedEnv -and (Test-Path $savedEnv)) { Remove-Item $savedEnv -ErrorAction SilentlyContinue }

# ── 5. (可选) 幂等 DB 迁移 ─────────────────────────────────────────────────
if ($RunMigrations) {
  Step "数据库迁移 (幂等)"
  Push-Location $currentApp
  try {
    $migs = @("scripts\apply-migrations.mjs","scripts\apply-pms-migrations.mjs")
    foreach ($m in $migs) {
      if (Test-Path $m) {
        Info "node $m"
        & node $m
        if ($LASTEXITCODE -ne 0) { Pop-Location; Die "迁移失败: $m (exit $LASTEXITCODE)" }
      } else { Warn "缺少迁移脚本 (跳过): $m" }
    }
  } finally { Pop-Location }
} else {
  Info "未启用 -RunMigrations, 跳过数据库迁移"
}

# ── 6. 启动 standalone 服务 ────────────────────────────────────────────────
if ($NoStart) {
  Step "完成 (换版-only, 未启动)"
  Write-Host "    新版目录: $currentApp" -ForegroundColor Green
  Write-Host "    手动启动: `$env:PORT=$Port; node `"$currentApp\server.js`"" -ForegroundColor Green
  exit 0
}

Step "启动服务"
$logDir = Join-Path $Target "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$outLog = Join-Path $logDir "server-$ts.out.log"
$errLog = Join-Path $logDir "server-$ts.err.log"

$env:PORT = "$Port"
$env:HOSTNAME = $BindHost
$env:NODE_ENV = "production"
$proc = Start-Process -FilePath "node" -ArgumentList "server.js" `
  -WorkingDirectory $currentApp `
  -RedirectStandardOutput $outLog -RedirectStandardError $errLog `
  -PassThru -WindowStyle Hidden
"$($proc.Id)" | Out-File -Encoding ascii (Join-Path $Target "server.pid")
Info "已启动 node server.js  PID=$($proc.Id)"
Info "日志: $outLog"

# ── 7. 就绪探测 ────────────────────────────────────────────────────────────
Step "就绪探测 (最多 ~40s)"
$ok = $false
for ($i = 1; $i -le 20; $i++) {
  Start-Sleep -Seconds 2
  if (-not (Get-Process -Id $proc.Id -ErrorAction SilentlyContinue)) {
    Write-Host "    ✗ 进程已退出, 见错误日志:" -ForegroundColor Red
    if (Test-Path $errLog) { Get-Content $errLog -Tail 25 }
    Die "服务启动失败"
  }
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:$Port/" -TimeoutSec 4 -MaximumRedirection 0 -ErrorAction Stop
    if ($r.StatusCode -lt 500) { $ok = $true; break }
  } catch {
    # 重定向(3xx)/鉴权(401)也算已起来: 只要有 HTTP 响应即视为就绪
    $resp = $_.Exception.Response
    if ($resp -and [int]$resp.StatusCode -lt 500) { $ok = $true; break }
  }
}

$buildId = ""
$bidPath = Join-Path $currentApp ".next\BUILD_ID"
if (Test-Path $bidPath) { $buildId = (Get-Content $bidPath -Raw).Trim() }

Write-Host ""
if ($ok) {
  Write-Host "==================================================" -ForegroundColor Green
  Write-Host "🎉 上线成功" -ForegroundColor Green
  Write-Host "   URL      : http://localhost:$Port" -ForegroundColor Green
  Write-Host "   PID      : $($proc.Id)" -ForegroundColor Green
  Write-Host "   BUILD_ID : $buildId" -ForegroundColor Green
  Write-Host "   SHA256   : $sha" -ForegroundColor Green
  Write-Host "   日志     : $outLog" -ForegroundColor Green
  Write-Host "   回滚     : releases\ 下保留最近 $KeepReleases 版" -ForegroundColor Gray
  Write-Host "==================================================" -ForegroundColor Green
} else {
  Warn "端口 $Port 未在 40s 内响应 HTTP。进程仍在 (PID $($proc.Id)), 可能仍在冷启动。"
  Warn "查看日志: $outLog / $errLog"
}

# ── 8. 清理历史版本 (保留最近 N) ───────────────────────────────────────────
$old = Get-ChildItem $releases -Directory -ErrorAction SilentlyContinue |
  Sort-Object Name -Descending | Select-Object -Skip $KeepReleases
foreach ($d in $old) { Info "清理历史版本 $($d.Name)"; Remove-Item $d.FullName -Recurse -Force -ErrorAction SilentlyContinue }
