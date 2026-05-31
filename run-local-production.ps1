# ╔══════════════════════════════════════════════════════════════════════════╗
# ║   ⚠️  本机自用专属 · LOCAL SELF-USE ONLY  ⚠️                             ║
# ║                                                                          ║
# ║   本脚本只用于在你本机笔记本/工作站跑 Tandem 全栈做日常自用。              ║
# ║   含 SKIP_STARTUP_GUARD / ALLOW_DEMO_AUTH / 弱密钥 / Windows 单进程守护。 ║
# ║                                                                          ║
# ║   🚫 严禁直接套到云服务器 / 公司局域网部署 — 会跳过生产硬化检查、         ║
# ║      未登录请求自动获 admin 权、无 HTTPS / 反代 / 健康检查。              ║
# ║                                                                          ║
# ║   云部署请用 docker-compose.prod.yml + Caddy 反代, 详见:                 ║
# ║      DEPLOY-LOCAL-VS-CLOUD.md  /  DEPLOY.md  /  DEPLOY-CHECKLIST.md       ║
# ╚══════════════════════════════════════════════════════════════════════════╝
#
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

# 0. 清场: 杀掉会抢占 .next 文件锁的 dev/tauri 进程 (本机踩坑根因)
#    next dev / tauri:dev 与 next build 同时碰 .next 会导致 webpack chunk 写一半被打断,
#    报 "Cannot find module './xxxx.js'" 或 "pages-manifest.json ENOENT".
Write-Host "🧹 [清场] 正在停止可能占用 .next 的 dev/tauri 进程..." -ForegroundColor Cyan
Get-Process node, tandem -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800

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

# 4. (已停用) Drizzle Schema 对齐
#    本库是 Prisma 时代迁移过来的, User 表仍保留若干 Prisma 遗留物理列
#    (departmentId/managerId/ssoBindings/failedLoginCount/lockedUntil/lastLoginAt/lastLoginIp),
#    而 Drizzle schema 是精简版 (这些字段改存 KvStore auth_user_extras).
#    因此 `drizzle-kit push` 每次都会判定这些列为"待删除", 触发数据丢失警告并中止.
#    => 本机不再盲跑 db:push. schema 变更通过手写幂等 DDL / 迁移管理.
#    (AuditLog 等新表已用 CREATE TABLE IF NOT EXISTS 单独建好.)
Write-Host "📊 [数据库] 跳过 db:push (Prisma 遗留库, push 会误删 User 旧列). schema 由迁移手动管理。" -ForegroundColor Gray

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
# 本机自用预览: 跳过生产强密钥/反代硬约束 (NEXTAUTH_SECRET 强度 / ALLOW_DEMO_AUTH / bootstrap 密码).
# 对外正式生产部署请删除此行, 并按 lib/infra/production-guard.ts 配齐强随机密钥.
$env:SKIP_STARTUP_GUARD="1"
npm run start
