# Tandem · 上线检查表

> 把每个 `[ ]` 都做完, 就可以放心给试用用户了.
> 顺序: A (单机能跑) → B (云端可访问) → C (手机能用) → D (上线公告).

---

## A. 单机本地验证 (必做, ~5 分钟)

### A1. 服务起来

- [ ] `docker compose -f docker-compose.db.yml up -d`  PostgreSQL 跑起来
- [ ] `npm install`  依赖装好
- [ ] `npm run db:push`  schema 同步到 PG
- [ ] `node scripts/seed-demo-users.mjs`  3 个测试账号种好
- [ ] `npm run dev`  dev server ready in <30s
- [ ] 浏览器 `http://localhost:3005/login` 能打开

### A2. 全量自动验证 (按顺序跑 4 个脚本)

- [ ] `node scripts/full-loop-verify.mjs`  → 应看到 `✅ Pass: 18, ❌ Fail: 0`
- [ ] `npm test`  → 应看到 `Test Files 62 passed (62), Tests 680 passed (680)`
- [ ] `npx tsc --noEmit`  → Exit 0 (强类型门)
- [ ] 4 道静态门禁全过: `check-ui-charter` / `check-deeplinks` / `check-docs-index` (均 `--strict`)
- [ ] `npm run build`  → Exit 0 (2026-05-31 已确认, 全路由编译)
- [ ] `$env:PORT="3005"; $env:E2E_BASE_URL="http://localhost:3005"; npx playwright test`  → `12 passed`
- [ ] `npx playwright test tests/e2e/mobile.spec.ts`  → `19 passed`

### A3. 手动浏览 (5 个核心页面打开不报错)

- [ ] `/` 工作台 — 议事决议汇总 + Launchpad
- [ ] `/okr` — Objective 树或空态
- [ ] `/convergence` — "发起议事 (17 min)" 按钮可见
- [ ] `/persona/training` — 分身训练台双栏
- [ ] `/kpi` — BSC 四维度

---

## B. 云端部署 (选一种)

### B1. VPS Docker Compose (推荐, 10-20 分钟)

- [ ] 准备好 2 vCPU / 4 GB RAM Linux 服务器, 装好 Docker
- [ ] 域名解析到服务器 IP (A 记录)
- [ ] `cp .env.production.example .env.production`
- [ ] 用 `openssl rand -hex 32` 生成 4 个强随机:
  - [ ] `POSTGRES_PASSWORD`
  - [ ] `NEXTAUTH_SECRET`
  - [ ] `SESSION_SECRET`
  - [ ] `MFA_ENCRYPTION_KEY`
- [ ] `REDIS_PASSWORD` 也用强随机
- [ ] `MINIO_ROOT_PASSWORD` 强随机
- [ ] 设 `NEXTAUTH_URL=https://your-domain.example.com`
- [ ] 设 `TANDEM_BOOTSTRAP_OWNER_EMAIL` (你的邮箱)
- [ ] 设 `TANDEM_BOOTSTRAP_OWNER_PASSWORD` (≥18 字符强密码)
- [ ] 设 `DEEPSEEK_API_KEY` (从 deepseek.com 拿)
- [ ] 确认 `ALLOW_DEMO_AUTH=0`
- [ ] `docker compose -f docker-compose.prod.yml --env-file .env.production up -d`
- [ ] 等 ~60s, `docker compose ps` 看 4 个服务都 `(healthy)`
- [ ] `docker compose exec app npm run db:migrate`  跑迁移
- [ ] `docker compose logs app | grep bootstrap`  确认 owner 已建
- [ ] HTTPS:
  - [ ] 装 Caddy 或 Nginx, 配 `your-domain → reverse_proxy localhost:3000`
  - [ ] 或者直接挂 Cloudflare 前置 (Let's Encrypt 自动)
- [ ] 浏览器打开 `https://your-domain` → 应看到 /login 页面

### B2. Vercel + Neon (适合海外, 0 运维)

- [ ] Neon: 创 project, 拿 connection string
- [ ] Vercel: `vercel login && vercel`
- [ ] Vercel Dashboard 配 7 个 env vars (见 DEPLOY.md §三.2)
- [ ] 跑 `DATABASE_URL='...' npm run db:push` (本地)
- [ ] 等 Vercel deploy done, 访问域名 → 看到 /login

---

## C. 手机端可用性

### C1. 真机测试 (至少跑过一次)

- [ ] iPhone Safari 打开 → 能登录, 工作台能展示
- [ ] iPhone Safari → 分享 → "添加到主屏幕" → 桌面有 Tandem 红色图标
- [ ] Android Chrome 打开 → 地址栏出现 "安装应用" 提示 → 装上
- [ ] 装后从桌面打开, 是 standalone 窗口 (无地址栏)
- [ ] 切换网络 (4G/Wi-Fi) 不掉登录

### C2. 已知问题 (可接受不改, 也可后续优化)

- [ ] 当前 shell 在 375px 屏幕较拥挤 (`AppRail 64px + SubSidebar 240px + main`)
  - 影响: 主内容区只剩 ~70px (实际 SubSidebar 会被挤压)
  - 选项 A (4h): 加 `md:` 断点, mobile 时 SubSidebar 改成抽屉
  - 选项 B (8h): 完整 mobile-first 重做 shell
  - 选项 C (0h): 接受现状, 推荐用户 landscape 模式 / iPad

---

## D. 上线公告

### D1. 试用邀请

- [ ] `node scripts/issue-trial-invite.mjs 100 168 employee` 拿到邀请码
- [ ] 邀请码 + 注册 URL + 邮件模板 (脚本自动输出) 发到群里 / 邮件
- [ ] 准备 1 个 FAQ 文档回答最常见问题:
  - 怎么改密码? → `/settings`
  - 怎么开 MFA? → `/settings/security` → MFA → 扫码
  - AI 没响应? → `/api/llm-health` 看 DeepSeek 是否 healthy
  - 数据隐私? → `/privacy` 页

### D2. 监控

- [ ] UptimeRobot / Better Stack: 5 分钟一次 ping `https://your-domain/api/health`
- [ ] (可选) Sentry: 设 `SENTRY_DSN`, 错误自动上报
- [ ] (可选) Posthog / Plausible: 装个轻量分析

### D3. 备份

- [ ] cron 每天 4:00 跑 `pg_dump` (脚本见 DEPLOY.md §五.备份)
- [ ] dump 自动传到 S3 / OSS / 异机 (至少 7 天保留)
- [ ] 至少跑一次 **完整恢复演练**: 在另一台机器 `psql` import 备份, 验证数据完整

### D4. 速率限制 / 反滥用

- [ ] 确认 `.env.production` 里 `RATE_LIMIT_LOGIN_PER_HOUR=5` (默认)
- [ ] 确认 `RATE_LIMIT_API_PER_MINUTE=120`
- [ ] (高敏感) 用 Cloudflare WAF 拦异常 IP

---

## 上线后 24 小时观察

- [ ] 每 2 小时看一眼 `/api/health` + `/api/llm-health`
- [ ] 看 PG 连接数: `SELECT count(*) FROM pg_stat_activity;`
- [ ] 看磁盘: `df -h`
- [ ] 看 docker 日志有无 ERROR: `docker compose logs app | grep ERROR`
- [ ] 收 5 个真实用户的反馈, 列前 3 个最阻塞的体验问题

---

## 全过 → 你可以放心邀请人来试用了 🎉

如果上面任意一项 ❌, 先把它解决再上.
有问题随时回 `STATUS.md` 看当前确认通过的边界.
