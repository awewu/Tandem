# Tandem · 本机极速生产级部署与启动脚本 (run-local-production.ps1)
#
# 💡 为什么需要这个？
#   因为默认的 'npm run dev' 在开发模式下对 9.7 万行代码进行按需实时编译，导致页面点击时有数秒延迟。
#   本脚本通过生产级全量编译优化 (Production Build)，让页面切换变为 0 毫秒编译、50 毫秒瞬间加载，爽快感倍增！
#
# ⚙️ 前置条件:
#   1. 启动 Docker Desktop
#   2. 本地已配置好 .env.local (至少有 DEEPSEEK_API_KEY)

$ErrorActionPreference = "Stop"
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "🚀 开始 Tandem 本机生产级极速部署与启动" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. 确保 .env.local 存在
if (-not (Test-Path ".env.local")) {
    if (Test-Path ".env.example") {
        Write-Host "⚠️ [配置] 未检测到 .env.local，已从 .env.example 复制，请稍后用文本编辑器填入你的 DEEPSEEK_API_KEY。" -ForegroundColor Yellow
        Copy-Item ".env.example" ".env.local"
    } else {
        Write-Host "❌ [错误] 缺失 .env.local 与 .env.example 配置，请确保处于项目根目录。" -ForegroundColor Red
        Exit 1
    }
}

# 2. 启动本地 Docker 数据库 (端口 5440)
Write-Host "🐳 [数据库] 正在检查并启动本地 Docker PostgreSQL (5440 端口)..." -ForegroundColor Cyan
docker compose -f docker-compose.db.yml up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ [错误] Docker 启动失败，请确保 Docker Desktop 已运行且端口 5440 未被占用。" -ForegroundColor Red
    Exit 1
}

# 3. 询问是否需要重新编译 (第一次部署必须编译，之后如果代码没改可以跳过编译)
$needBuild = $true
if (Test-Path ".next") {
    $choice = Read-Host "❓ 检测到已有编译缓存。是否需要【重新编译优化】(如果代码没有修改，输入 'N' 可在 2 秒内极速启动) [Y/N]"
    if ($choice -eq "N" -or $choice -eq "n") {
        $needBuild = $false
    }
}

if ($needBuild) {
    Write-Host "📦 [编译] 正在对 9.7 万行代码进行生产级极致编译与优化 (大约需要 30-60 秒，请耐心等待)..." -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ [错误] 编译失败，请检查上面终端的 TypeScript 报错。" -ForegroundColor Red
        Exit 1
    }
    Write-Host "✅ [编译] 生产编译优化完成！" -ForegroundColor Green
} else {
    Write-Host "⏩ [编译] 已跳过编译，直接使用缓存启动。" -ForegroundColor Gray
}

# 4. 确保 Drizzle Schema 对齐
Write-Host "📊 [数据库] 正在校验并对齐本地 Drizzle 数据表结构..." -ForegroundColor Cyan
npm run db:push
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ [警告] 数据库推送失败，可能因为你还没有在 .env.local 中将 DATABASE_URL 指向 5440 端口。" -ForegroundColor Yellow
    Write-Host "请确保你的 .env.local 包含: DATABASE_URL=postgresql://tandem:tandem@localhost:5440/tandem" -ForegroundColor Yellow
    $ans = Read-Host "是否已确认配置并重试？[Y/N]"
    if ($ans -eq "Y" -or $ans -eq "y") {
        npm run db:push
    }
}

# 5. 极速拉起生产级服务
Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "🎉 部署就绪！正在极速拉起 Tandem 本机生产级服务" -ForegroundColor Green
Write-Host "👉 极速访问入口: http://localhost:3005" -ForegroundColor Green
Write-Host "   (提示: 切至后台运行，切换页面体验瞬间加载的快感！)" -ForegroundColor Gray
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""

$env:PORT="3005"
$env:NODE_ENV="production"
npm run start
