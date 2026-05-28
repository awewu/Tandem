# Tandem · 部署指南

完整覆盖 4 种场景：

1. **本机单机** - 一台 Windows / macOS / Linux 跑给自己 + 局域网用
2. **VPS 单机** - 一台云服务器（阿里云 ECS / 腾讯云 / DigitalOcean / Hetzner...）
3. **Vercel** - 前端 Vercel + DB 用 Neon / Supabase（适合海外、零运维）
4. **Railway** - 一键托管 Next + PG（适合海外，几分钟出生产 URL）

---

## 一、本机单机

最快验证业务闭环。30 分钟跑起来。

### 1. 先决条件

- Node.js 20+ (`node -v` 看)
- Docker Desktop (用于跑 PostgreSQL)
- Git

### 2. 步骤

```bash
git clone <你的仓库> && cd Hermes
npm install

# 起本地 PostgreSQL (Docker)
docker compose -f docker-compose.db.yml up -d

# 复制配置, 改密码
cp .env.example .env.local
# 至少改: NEXTAUTH_SECRET, TANDEM_BOOTSTRAP_OWNER_EMAIL/PASSWORD,
#         DATABASE_URL (用 docker-compose.db.yml 的 5440 端口)
#         DEEPSEEK_API_KEY (如要测 AI)

# 数据库迁移
npm run db:push

# 种 demo 用户 (员工/经理/HR) - 用于跨角色试用
node scripts/seed-demo-users.mjs

# 启动 dev (端口 3005)
$env:PORT="3005"; npm run dev   # PowerShell
PORT=3005 npm run dev           # bash

# 浏览器打开 http://localhost:3005/login
# Owner 账号: 用 .env.local 里的 TANDEM_BOOTSTRAP_OWNER_*
# Demo 账号: employee@tandem.local / Demo1234!@#
#           manager@tandem.local  / Demo1234!@#
#           hr@tandem.local       / Demo1234!@#
```

### 3. 全量验证

```bash
# 单元测试 (95 个, ~1.2s)
npm test

# E2E + storageState (12 个, ~16s)
$env:PORT="3005"; $env:E2E_BASE_URL="http://localhost:3005"; npm run test:e2e

# 全业务闭环 (18 个 API 调用, 含真 LLM SSE)
node scripts/full-loop-verify.mjs

# 移动端 viewport
$env:PORT="3005"; npx playwright test tests/e2e/mobile.spec.ts
```

---

## 二、VPS 单机 (Docker Compose)

最适合"100 人内部试用"或"本公司私有部署"。

### 1. 准备

- 一台 2 vCPU / 4 GB RAM / 40 GB SSD 起步的 Linux 服务器
- 装好 Docker + Docker Compose
- 域名（或者直接用 IP）
- SSL 证书（推荐 Caddy / Traefik 自动 Let's Encrypt）

### 2. 配置

```bash
git clone <repo> && cd Hermes
cp .env.production.example .env.production

# 编辑 .env.production
#   - 所有 CHANGE_ME 用 `openssl rand -hex 32` 生成强随机
#   - NEXTAUTH_URL 改成你的真实域名 (含 https://)
#   - TANDEM_BOOTSTRAP_OWNER_EMAIL + PASSWORD (首次启动建 owner)
#   - 至少一个 LLM key (DEEPSEEK_API_KEY 推荐)
#   - ALLOW_DEMO_AUTH=0 (生产严禁开)

nano .env.production
```

### 3. 启动

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# 等 30 秒, 等 healthcheck 通过
docker compose -f docker-compose.prod.yml ps

# 跑数据库迁移 (首次)
docker compose -f docker-compose.prod.yml exec app npm run db:migrate

# 看日志确认 owner 已建
docker compose -f docker-compose.prod.yml logs app | grep bootstrap
# 应看到: [bootstrap] 已创建 owner: admin@your-domain.example.com
```

### 4. 加 HTTPS (推荐 Caddy)

```caddyfile
# /etc/caddy/Caddyfile
your-domain.example.com {
    reverse_proxy localhost:3000
    encode gzip
}
```

```bash
sudo caddy reload
```

### 5. 升级

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
# 自动滚动更新, 旧容器先停, 新容器健康检查通过后切流
```

---

## 三、Vercel + Neon (零运维)

适合：海外用户试用、不想维护服务器。

### 1. PG 用 Neon

1. <https://neon.tech> 注册 → 创建 project → 拿 connection string
2. 拷贝形如 `postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/tandem`

### 2. Vercel 部署

```bash
npm i -g vercel
vercel login
vercel
# 选择 framework: Next.js (自动识别)
```

在 Vercel Dashboard → Project → Settings → Environment Variables，**至少添加**：

| Key | Value | 来源 |
|---|---|---|
| `DATABASE_URL` | `postgresql://...@neon.tech/...?sslmode=require` | Neon |
| `NEXTAUTH_SECRET` | `openssl rand -hex 32` 生成 | 自己生成 |
| `NEXTAUTH_URL` | `https://your-project.vercel.app` | Vercel 域名 |
| `TANDEM_BOOTSTRAP_OWNER_EMAIL` | `admin@your-domain.com` | 自定 |
| `TANDEM_BOOTSTRAP_OWNER_PASSWORD` | 强密码 | 自定 |
| `DEEPSEEK_API_KEY` | `sk-...` | DeepSeek 平台 |
| `ALLOW_DEMO_AUTH` | `0` | 生产必须 0 |

### 3. 迁移 DB

```bash
DATABASE_URL='postgresql://...@neon.tech/...?sslmode=require' npm run db:push
```

### 4. 限制

Vercel Hobby 套餐有限制：
- 函数执行 ≤ 10s (Pro 60s)
- 没有 Redis（需要单独配 Upstash Redis）→ 影响 session/rate-limit
- 没有 S3 兼容存储 → Drive 文件功能需配 AWS S3 或 R2

→ **结论：Vercel 适合小规模试用 (≤ 20 用户)，正式用建议 VPS Compose**

---

## 四、Railway (中等运维)

```bash
npm i -g @railway/cli
railway login
railway init
railway add postgresql      # 自动注入 DATABASE_URL
railway add redis            # 自动注入 REDIS_URL
railway up
# 同样在 Railway Dashboard 配 NEXTAUTH_SECRET / TANDEM_BOOTSTRAP_* / DEEPSEEK_API_KEY
```

Railway 优势：PG + Redis 自动 provision、按用量付费，比 Vercel 灵活。劣势：国内访问慢。

---

## 五、运维要点

### 备份

```bash
# 每天凌晨自动 dump (cron)
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U tandem tandem > backup-$(date +%F).sql

# 上传到 S3 / OSS / 本地异机
aws s3 cp backup-*.sql s3://your-backup-bucket/
```

### 监控

最低门槛 - 拉外部 monitor 服务：

- UptimeRobot / Better Stack 监 `GET /api/health` (5 分钟一次)
- Sentry: 在 .env 加 `SENTRY_DSN=https://...`

### 升级数据库 schema

```bash
# 生成迁移文件
npm run db:generate

# 在生产应用
docker compose -f docker-compose.prod.yml exec app npm run db:migrate
```

### 重置 rate limit (调试 / 误锁)

Rate limit 默认走 in-memory (POLICIES.login = 5/h)。
重启 app 容器即可清空：

```bash
docker compose -f docker-compose.prod.yml restart app
```

### 加新员工 (邀请码)

Owner 登录 → `/admin/users/bulk-invite` → 生成邀请码 → 发给员工 → 员工去 `/register` 填邀请码注册

或者通过 API：

```bash
curl -X POST https://your-domain/api/auth/invite \
  -H "Cookie: tandem_at=<owner-token>" \
  -d '{"email":"new@company.com","presetRoles":["employee"]}'
```

---

## 六、验证 launch ready

部署后跑一遍：

```bash
# 1. 健康度
curl https://your-domain/api/health
curl https://your-domain/api/llm-health

# 2. owner 能登
curl -X POST https://your-domain/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@your-domain.com","password":"<your-strong-pwd>"}'

# 3. 浏览器打开 https://your-domain/login → 登录 → 浏览 / / okr / convergence / persona/training
# 4. 手机端访问同样地址 → 应能加载、内容可见
# 5. PWA 安装: Chrome 地址栏右侧应出现"安装"图标 (Edge / Android Chrome 同样)
```

如有问题：

- 看日志：`docker compose -f docker-compose.prod.yml logs -f app`
- 看 PG：`docker compose -f docker-compose.prod.yml exec postgres psql -U tandem -d tandem`
- 看 Redis：`docker compose -f docker-compose.prod.yml exec redis redis-cli -a $REDIS_PASSWORD`
