# Nexus 上线 · 需在真环境执行的清单（本机无法代做）

> 本机已完成并验证：发布安全网(preflight/db:verify/prod:provision) · React 版本对齐 · 码库固化(api-units 189/189) · VI strict 0 · cutover M0–M2。
> 下列为**必须在生产/staging/legacy 可启动环境**才能推进的项，按阻断优先级排列。

## 🔴 上线硬阻断（配置类 + 迁移类）
- [ ] **生产密钥注入**：`JWT_SECRET`、`PII_ENCRYPTION_KEY`(32 字节)、`PII_HASH_SALT` 生成并注入生产环境。验收：`npm run preflight`(生产模式)通过、不再拒启。
- [ ] **生产库迁移**：用属主/migrator 角色对生产库执行 `SEED_ADMIN=1 … npm run prod:provision`（preflight→migrate→db:verify→建初始管理员）。验收：`db:verify` 权限全表齐、`npm run guard:rls-enforcement`(连生产库)通过。
- [ ] **租户枚举**：所有运营租户经 `<SLUG>_TENANT_ID` env 列全。验收：`npm run test:integration:flywheel` 跨域反应不卡 pending。
- [ ] **AI provider 接线**：配置真实 AI 网关/密钥（经 Tandem 治理网关），AgenticGEO/内容生成脱离确定性兜底。

## 🔴 staging 生产就绪门禁（需类生产环境）
- [ ] `npm run guard:rls-enforcement`（连 staging/prod 库）——**确证租户不串号**。
- [ ] `ENABLE_REACT_CANDIDATE=true npm run guard:browser-visual` + `npm run guard:ui-vi`
- [ ] `npm run guard:postgres-staging-smoke` + `npm run guard:target-api-boot-smoke`
- [ ] `npm run test:production-readiness`（含 CI evidence 产物生成后，A 类 artifact 门禁才有据）

## 🟠 部署形态
- [ ] 走 Runbook Path A（进程部署）：`prod:provision` → `NODE_ENV=production npm run start:api` → 工作台 `next build && next start` → pm2/nginx 反代 + TLS。
- [ ] （可选 Path B 容器）：需先补 `Dockerfile.workbench`(Next standalone+pnpm) + `docker-compose.nexus-prod.yml`。

## 🟡 legacy 收敛（需可启动 legacy 单体做 parity）
- [ ] 起 legacy(Mongo)+ NestJS 双跑环境，逐路由 parity 验证后执行 M3（退役非-v2 遗留路由）/ M4（删 `server/` 主体 + Mongo 退役）。
- [ ] 修/复核 `test:production-readiness` 的 4 个 legacy 契约测试（quote-calculation/route-catalog/static-surface/diagnosis）。

## 🟡 上线后
- [ ] 度量读模型刷新调度上线；接 Sentry（errorSink 接缝已留）；限流监控。
- [ ] 对外品牌站(Next-app)GEO 就绪核验（`guard:geo` 仅覆盖静态 HTML，Next-app 标记 unmeasured）。
