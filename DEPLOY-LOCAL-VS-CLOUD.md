# 部署路径分离 · Local Self-Use vs Cloud Server

> **TL;DR**: 本机自用与公司服务器部署是**两条独立路径**, 配套、脚本、env、安全模型都不同。
> 误用 → 弱密钥/默认密码/无登录 admin 直接上线, 跟"开门迎贼"一个效果。
>
> - **本机自用** (一个人在自己笔记本/工作站): `run-local-production.ps1` + Windows 任务计划
> - **云服务器** (公司局域网/公网, 多人共用): `docker-compose.prod.yml` + Caddy + 强随机密钥
> - **桌面端 .msi 分发给员工**: build 时设 `TANDEM_DEFAULT_SERVER_URL` 把公司域名烧进去

---

## 一目了然对照表

| 配套 | 本机自用 (Local Self-Use) | 云服务器 (Cloud / LAN) |
|---|---|---|
| **启动入口** | `.\run-local-production.ps1` | `docker compose -f docker-compose.prod.yml up -d` |
| **服务常驻** | `scripts/install-tandem-service.ps1` (Windows 任务计划) | Docker `restart: unless-stopped` / Systemd / K8s |
| **守护脚本** | `scripts/tandem-server-daemon.ps1` (Windows-only) | Docker 进程托管 |
| **服务端口** | `next start -H 0.0.0.0 -p 3005` 直接对外 | Caddy 80/443 → 容器内 3000 |
| **HTTPS** | ❌ 不需要 (loopback) | ✅ **必须** (Caddy 自动 Let's Encrypt; PWA + cookie 安全前置) |
| **数据库** | 主机原生 pg `:5432`, `tandem:tandem` 弱密码 | 容器化 pg + 强随机密码 + 定期备份 |
| **`SKIP_STARTUP_GUARD=1`** | ✅ 必带 (本机弱密钥/`ALLOW_DEMO_AUTH=1` 才能起) | 🚫 **绝对不能** — 等于关闭所有生产硬化检查 |
| **`ALLOW_DEMO_AUTH=1`** | ✅ 可 (单人, 任何请求自动 admin 通行无烦扰) | 🚫 **绝对不能** — 任何未登录请求自动 admin (开门迎贼) |
| **`NEXTAUTH_SECRET`** | 任意占位即可 | 必须 `openssl rand -base64 48` 强随机 ≥32 字符 |
| **`TANDEM_BOOTSTRAP_OWNER_PASSWORD`** | `Test1234!!` 此类弱口令可 | 必须强随机, 首次登录强制改密 + 立刻启 MFA |
| **`DEEPSEEK_API_KEY` (或其它 LLM)** | 必须 | 必须 |
| **`REDIS_URL`** | ❌ 不需要 (单进程内存退化) | ✅ **多副本必须** (cron 单飞行 + 分布式限流) |
| **`SENTRY_DSN`** | ❌ 不需要 | ✅ 强烈建议 (错误聚合) |
| **`S3_ENDPOINT`** | ❌ 不需要 (本地存储) | ✅ 建议 (Drive 文件容器重启不丢) |
| **桌面端 .msi 默认 URL** | 烧死 `http://127.0.0.1:3005` | 由 build 时 `TANDEM_DEFAULT_SERVER_URL` 注入公司域名 |
| **`drizzle-kit push`** | 🚫 禁 (会删 Prisma 遗留列) | 🚫 同样禁, 用幂等 SQL 迁移 |

---

## 路径 A · 本机自用 (Local Self-Use)

> 场景: Owner / 你一个人在自己笔记本/工作站跑全栈做日常使用 + 测试。

### 一次性安装

```powershell
# 1. 装依赖 + 配 .env.local (照 .env.local.example 抄, 关键填 DEEPSEEK_API_KEY 等)
npm ci
copy .env.local.example .env.local
notepad .env.local  # 填 DEEPSEEK_API_KEY / TANDEM_BOOTSTRAP_OWNER_PASSWORD

# 2. 启动 Docker / 原生 Postgres (任一)
#    主机原生 pg :5432 推荐 (与脚本一致); Docker 容器在 :5440 是另一独立库

# 3. 跑一次本机生产部署 (编译 + 启 3005)
.\run-local-production.ps1

# 4. (可选) 注册成 Windows 开机自启服务, 关掉终端窗口也常驻
powershell -ExecutionPolicy Bypass -File .\scripts\install-tandem-service.ps1
# UAC 确认后, Tandem 服务以后开机自启 + 崩溃自动重启

# 5. (可选) 装桌面端 App (Tauri, 默认连 127.0.0.1:3005)
npm run tauri:build
# 安装包: src-tauri\target\release\bundle\nsis\Tandem_1.0.0_x64-setup.exe
```

### 日常使用

- 浏览器: `http://localhost:3005` 或 `http://127.0.0.1:3005`
- 桌面: 开始菜单 → Tandem (推荐, 有原生托盘 / 通知 / 快捷键)

### 卸载

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-tandem-service.ps1 -Uninstall
# 桌面 App 走"添加或删除程序"卸载
```

---

## 路径 B · 云服务器部署 (Cloud / 公司局域网)

> 场景: 公司服务器(局域网或公网), 多人通过浏览器/桌面端访问。
> 详细 step-by-step 见 `DEPLOY.md` + `DEPLOY-CHECKLIST.md`。本节是**精简核对清单**。

### 前置 (5 分钟)

```bash
# 服务器要求: Linux + Docker + 域名 (或局域网固定 IP)
docker --version          # ≥ 24
docker compose version    # v2+

# 克隆代码
git clone <你的 git remote> /opt/tandem
cd /opt/tandem
```

### Step 1 · 准备生产 env (15 分钟)

```bash
cp .env.production.example .env.production
nano .env.production
```

**必填项** (生产硬化守卫会逐条校验, 缺一个起不来):

```dotenv
# === 强密钥, 全部用 openssl rand -base64 48 重新生成 ===
NEXTAUTH_SECRET=<openssl rand -base64 48>
SESSION_SECRET=<openssl rand -base64 48>
MFA_ENCRYPTION_KEY=<openssl rand -base64 48>

# === 数据库 ===
DATABASE_URL=postgresql://tandem:<强随机密码>@postgres:5432/tandem

# === LLM ===
DEEPSEEK_API_KEY=sk-...

# === Owner bootstrap (首次起会自动建该用户, 强制首登改密) ===
TANDEM_BOOTSTRAP_OWNER_EMAIL=admin@yourco.com
TANDEM_BOOTSTRAP_OWNER_PASSWORD=<openssl rand -base64 24>  # 强随机
TANDEM_BOOTSTRAP_OWNER_NAME=Tandem Owner

# === 反代域名 (HTTPS 强制) ===
NEXTAUTH_URL=https://tandem.yourco.com

# === 多副本必须 ===
REDIS_URL=redis://redis:6379

# === 可选 ===
SENTRY_DSN=https://...@sentry.io/...
S3_ENDPOINT=https://s3.yourco.com
BCRYPT_ROUNDS=12
```

**🚫 绝对不能出现在生产 `.env.production` 里的**:

- `SKIP_STARTUP_GUARD=1`
- `ALLOW_DEMO_AUTH=1`
- 任何带 `change-me` / `placeholder` / `test` / `dev` 字样的占位密钥

### Step 2 · 启动 (5 分钟)

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
docker compose -f docker-compose.prod.yml logs -f tandem | head -50
```

确认看到:
```
[startup-guard] ✓ 所有关键配置就绪
Ready in 800ms
```

如果看到 `[startup-guard] FATAL: ...` 中止 → 按提示修 `.env.production` 重启, **不要**走 `SKIP_STARTUP_GUARD` 旁路。

### Step 3 · 反代 + HTTPS (5 分钟)

```bash
cp deploy/Caddyfile.example /etc/caddy/Caddyfile
nano /etc/caddy/Caddyfile  # 改成你的域名
systemctl reload caddy
```

Caddy 会自动从 Let's Encrypt 取证书。

### Step 4 · 首次登录 + 强制改密 + MFA (5 分钟)

1. 浏览器开 `https://tandem.yourco.com/login`
2. 用 `.env.production` 里的 Owner 邮箱 + 强随机密码登录
3. 立刻去 `/settings` 改密 + 开 MFA

### Step 5 · 备份策略

```bash
# 每天凌晨 dump 到本机 + S3
crontab -e
# 加: 0 3 * * * /opt/tandem/scripts/backup-pg.mjs
```

### 升级 (拉新代码)

```bash
cd /opt/tandem
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

schema 变更走 SQL 迁移 (drizzle-kit push 禁用, 详见 `lib/infra/drizzle-schema.ts` + `scripts/apply-migrations.mjs`)。

---

## 桌面端 .msi 分发给员工

> 想让员工双击安装就连上公司服务器, 无需手填地址。

### Build 时烧域名进 .msi

```powershell
# Windows (PowerShell)
$env:TANDEM_DEFAULT_SERVER_URL = "https://tandem.yourco.com"
npm run tauri:build

# 产物: src-tauri\target\release\bundle\nsis\Tandem_1.0.0_x64-setup.exe
```

```bash
# Linux/macOS
TANDEM_DEFAULT_SERVER_URL="https://tandem.yourco.com" npm run tauri:build
```

`src-tauri/src/main.rs` 用 `option_env!("TANDEM_DEFAULT_SERVER_URL")` 在编译期读取该变量, 该值被烧进可执行文件。员工装包打开即连上公司服务器, 不弹配置表单。

### 不设环境变量 = 本机自用版

不设 `TANDEM_DEFAULT_SERVER_URL` 跑 `npm run tauri:build`, 产物默认连 `http://127.0.0.1:3005`, 适合 Owner 自己用。

### 兜底 (用户在装包后改服务器地址)

如果烧进的默认 URL 探活失败, bootstrap (dist/index.html) 会自动弹出配置表单, 用户填新地址 → 落 `%APPDATA%\local.tandem.app\tandem-config.json` 永久保存。

---

## 🚫 红线 · 这些事绝对不能在云上做

1. **在生产 server 跑 `run-local-production.ps1` / `tandem-server-daemon.ps1` / `install-tandem-service.ps1`**
   - 它们带 `SKIP_STARTUP_GUARD=1` + 假设 `:5432` 主机原生 pg + Windows 任务计划; 服务器环境不适用且会跳过所有硬化检查。

2. **在生产 `.env` 里设 `ALLOW_DEMO_AUTH=1`**
   - 任何未登录请求自动 admin。等于把 admin 权限白送给随便一个会用 curl 的人。
   - 生产硬化守卫会拒绝启动, 但如果你顺手加了 `SKIP_STARTUP_GUARD=1` 就绕过了。

3. **跑 `npm run db:push` / `drizzle-kit push` 对生产库**
   - 本仓库 User 表保留 Prisma 时代物理列 (departmentId 等), drizzle schema 是精简版。push 会判定它们为"待删除", 触发 DATA LOSS 警告 + 4 行用户数据 + 误删丢光。
   - schema 变更走幂等 SQL: `CREATE TABLE/ALTER ... IF NOT EXISTS` (参考 `drizzle/migrations/*.sql`)。

4. **把 `Test1234!!` / 任何弱口令带进生产 `TANDEM_BOOTSTRAP_OWNER_PASSWORD`**
   - 生产守卫会拒绝, 但如果绕过 → 等于公开 admin 凭据。

5. **用主机原生 Postgres :5432 跑生产**
   - `:5432` 默认监听 `0.0.0.0`, 外网可达, `tandem:tandem` 弱口令暴露 → 直接拖库。
   - 生产必须容器化 + 仅内网监听 + 强密码 + 备份。

---

## 排查 · 常见误用 → 真因

| 现象 | 多半是因为 | 处置 |
|---|---|---|
| 生产起来 `/login` 200 但**任何未登录请求都通**, GET `/api/admin/*` 返 200 | `.env.production` 含 `ALLOW_DEMO_AUTH=1` | 立即停服 → 删除该行 → 改 owner 密码 → 重启 |
| 部署后启动日志没有 `[startup-guard] ✓ 所有关键配置就绪` | 漏写硬化项 / 跳了 guard | 看 startup log FATAL 列表, 一项项补 |
| 桌面端 App 全公司员工都连 `127.0.0.1` | build 时漏设 `TANDEM_DEFAULT_SERVER_URL` | 设 env 重 build, 重分发 |
| 浏览器登录后 cookie 不持久 / 跨标签丢登录 | 用 http:// 跑生产 (非 https) → SameSite/Secure 失效 | 必须上 HTTPS (Caddy 反代) |
| `next start` 在生产服务器上跑得很慢 | 没用 docker / 没编译生产产物 | `docker compose ... up -d` 走标准 prod build |

---

## 摘要

- 本机自用: 一条命令 `.\run-local-production.ps1`, 一切默认。
- 云服务器: 强密钥 + 强密码 + HTTPS + Docker, **绝不**带任何 `SKIP_*` / `ALLOW_DEMO_*` 旁路。
- 桌面分发: build 时 `TANDEM_DEFAULT_SERVER_URL=公司域名 npm run tauri:build`, 员工装包即连。

**判断你在哪条路径**: 看 `.env` 里有没有 `SKIP_STARTUP_GUARD=1` 或 `ALLOW_DEMO_AUTH=1`。有 → 本机自用版; 没有 → 准备走生产。
