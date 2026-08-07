# Nexus 上线 Runbook（生产发布手册）

> 目标:把"生产密钥 + 生产库迁移 + staging 门禁"这三件从未做过的事做实,安全上线。
> 每步都有**验收**;任一未过 = 不上线。

## 0. 前置准备
- [ ] 生产 PostgreSQL 已开:**属主/migrator 角色 `rhautt`**(跑迁移)+ **应用角色 `rhautt_app`**(NOSUPERUSER/NOBYPASSRLS,运行时)。
- [ ] Redis 已开(缓存 + Streams 事件分发)。
- [ ] 密钥管理就位(Vault/KMS 或安全注入通道;禁止明文入库/入镜像)。
- [ ] staging 环境与生产同构。

## 1. 密钥生成与注入（堵 🔴1）
```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # PII_ENCRYPTION_KEY（32 字节）
openssl rand -hex 16   # PII_HASH_SALT
```
- [ ] 以 `.env.production.example` 为清单,注入 `.env.production` 全部必需值。
- [ ] `NODE_ENV=production`、`POSTGRES_USER=rhautt_app`、`POSTGRES_SYNCHRONIZE=false`。
- [ ] 无任何 dev 开关(`NEXUS_DEV_SSO` / `OIDC_DEV_*`)。
- **验收**:`npm run preflight` → ✅ 通过(0 错误)。preflight 已集成进 `start:api`,缺项会直接拒启。

## 2. 生产库迁移（堵 🔴2）
```bash
# 用【属主/migrator】角色（非 rhautt_app）跑：
POSTGRES_USER=rhautt POSTGRES_PASSWORD=*** POSTGRES_HOST=*** npm run db:migrate
npm run db:migrate:status   # 应 0 pending
```
- [ ] 076–088 全部 applied、0 pending。
- **验收**:抽查新表 `relforcerowsecurity=true`(FORCE RLS)+ `rhautt_app` 有 SELECT/INSERT/UPDATE/DELETE。
  `npm run guard:rls-enforcement`(连生产/staging 库)通过 —— 确认 rhautt_app 无法绕 RLS。

## 3. 多租户 outbox 枚举（堵 🔴4）
- [ ] 为**每个运营租户**设 `<SLUG>_TENANT_ID`(见 .env.production.example)。
- **验收**:`npm run test:integration:flywheel`(指向 staging)—— 跨域事件(线索派单/成效回流)不卡 pending。

## 4. Staging 生产就绪门禁（堵 🔴3 · 这些平时是 SKIP，上线前必须真跑）
在 staging 依次跑绿:
- [ ] `npm run guard:ledger`(35 绿)
- [ ] `npm run guard:rls-enforcement`
- [ ] `ENABLE_REACT_CANDIDATE=true npm run guard:browser-visual` + `npm run guard:ui-vi`
- [ ] `npm run guard:postgres-staging-smoke` + `npm run guard:target-api-boot-smoke`
- [ ] `npm run test:production-readiness`
- [ ] `npm run guard:frontend-api-contract` + `npm run guard:geo`（若改过对外站，先 `npm run geo:build`）

## 5. 部署
- [ ] 构建:API(`dist/services/api`)+ 工作台(`next build`,标准产物)。
- [ ] 启动 API:`NODE_ENV=production npm run start:api`(preflight 自动前置校验)。
- [ ] 工作台以生产模式部署(dev-guest 按钮 `NODE_ENV!==production` 自动隐藏)。

## 6. 上线冒烟
- [ ] `GET /api/v2/health` = 200。
- [ ] 真实登录(生产用户,非 dev 种子)→ 拿到 JWT。
- [ ] 关键链路:问诊建线索 → 派单 → cockpit 北极星计数 +1;渠道返利过毛利闸;内容无事实源发布被拦。
- [ ] 响应头含 `x-trace-id`(可观测性生效)。

## 7. 回滚预案
- [ ] 应用:保留上一个可用镜像/版本,一键回切。
- [ ] 数据库:**迁移无 down 脚本** —— 回滚依赖**发布前快照/PITR**;结构变更均为**增量新增**(未删列),旧版本应用仍兼容 → 首选"回退应用版本、保留新表"。
- [ ] 若必须回退 schema:从发布前快照恢复(接受该窗口数据丢失,需业务确认)。

## 8. 上线后（首日）
- [ ] 挂**读模型刷新调度**(cron/outbox 触发 `POST /api/v2/metrics/refresh`),否则 CMO 归因/滚动不更新。
- [ ] 接 **Sentry**(`SENTRY_DSN` + `setErrorSink` 注入 @sentry/node)—— 线上错误按 traceId 溯源。
- [ ] 监控:DB 连接/慢查询、outbox pending 堆积、问诊 ingress 限流(`INGRESS_RATE_LIMIT`)、5xx 率。
- [ ] 公开入口(问诊)前置 WAF/限流(当前仅应用层 `INGRESS_RATE_LIMIT`)。

## 已知取舍（上线可接受、已在硬化 roadmap）
经销商门户 Under Construction · AI 未接真 provider(走兜底,配 §1 AI key 可启真模型)· 分析部分仍直查 OLTP(度量中台读模型逐步替代)· 双运行时未收敛 · e2e/视觉回归尚未进 CI。详见 `docs/architecture/NEXUS-PLATFORM-HARDENING-ROADMAP.md`。
