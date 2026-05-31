# Tandem · 生产级上线审计 (2026-05-31)

> **目的**: 交付一份生产级上线前的完整审计 — 项目梳理 / 架构 / 技术栈 / 功能模块 / 前后端问题 / 上线准备。
> **方法**: 基于代码库实测 (git / 文件 / 门禁脚本), 非主观估计。
> **结论先行**: 代码层 **可上线** (6 道门禁 + 生产 build 全绿); 真上线前需补 **运维三件套** (备份演练 / 监控接入 / 多副本 cron 去重) 与 **提交落库**。

---

## 0. 一句话总览

| 维度 | 现状 |
|---|---|
| 定位 | Owner 自有产研销企业的**内部协作 AI 平台**, 驱动 OKR / 战略执行 (自用优先) |
| 规模 | 104 页面 · 170 API 路由 · 100 组件 · 217 lib 模块 · ~97k 行 TS/TSX |
| 测试 | 680 单测 (62 文件) 全绿 + Playwright e2e/mobile |
| 门禁 | tsc / vitest / UI-charter / deeplinks / docs-index / build — **6 道全绿** |
| 后端成熟度 | 高: 存储抽象 / 多层鉴权 / 防篡改审计 / 限流 / 生产启动硬化 / 健康探针 |
| 主要风险 | 状态双轨 (zustand ↔ 后端) · 单进程 cron 多副本重复 · 审计内存无界 · 巨型 `store.ts` |

---

## 1. 技术栈

### 1.1 核心框架

| 层 | 选型 | 版本 |
|---|---|---|
| 框架 | Next.js (App Router, standalone 输出) | 14.2.5 |
| 运行时 | React | 18.3.1 |
| 语言 | TypeScript | 5.5.3 |
| 样式 | TailwindCSS + CVA + tailwind-merge | 3.4.4 |
| UI 组件 | Radix UI (dialog/select/tabs/toast/...) + lucide-react 图标 | — |
| 客户端状态 | Zustand | 4.5.4 |

### 1.2 后端 / 数据

| 用途 | 选型 |
|---|---|
| ORM | Drizzle ORM 0.45 + drizzle-kit 0.31 (migrate/push/studio) |
| 数据库 | PostgreSQL 16 (pgvector, 生产镜像 `pgvector/pgvector:pg16`) |
| 缓存 / 限流 / 会话 | Redis 7 (ioredis) |
| 对象存储 | S3 兼容 (MinIO, `@aws-sdk/client-s3` + presigner) |
| 实时协作 | Yjs + y-websocket + y-protocols (文档协同) |
| 音视频 | LiveKit (client + server-sdk) |
| 邮件 | nodemailer |
| 推送 | web-push (VAPID) |
| 日志 | pino + pino-pretty |
| 文档解析 | mammoth (docx) · pdfjs-dist · xlsx · jszip |

### 1.3 AI / LLM

- **多 provider 路由** (TAF · `lib/taf`): DeepSeek / OpenAI / Anthropic / Ollama, 启动时按 env 中的 API key 自动注册, 无 key 回落本地 dev router。
- 主推理器: DeepSeek (`deepseek-chat` / `deepseek-v3`)。
- 健康检查区分 liveness 与 LLM degraded (LLM 挂不影响 readiness)。

### 1.4 测试 / 工程

- Vitest 4 (单测 + eval harness) · Playwright (e2e + mobile)。
- 自研门禁脚本: `check-ui-charter` / `check-deeplinks` / `check-docs-index` (均支持 `--strict` CI 模式)。
- 桌面端: Tauri 2 (旧版, **与当前后端不兼容**, 推荐 PWA)。

---

## 2. 架构

### 2.1 分层

```
浏览器 (PWA)
  │
  ├─ middleware.ts (Edge)  ── 第一层鉴权 + 板块 RBAC + requestId 注入
  │
  ├─ app/ (Next App Router)
  │    ├─ 104 page.tsx          UI 页面
  │    └─ api/ 170 route.ts     业务 API (每个 await boot())
  │
  ├─ lib/  (领域 + 基础设施)
  │    ├─ boot.ts               启动注入: store / LLM router / orchestrator / 事件订阅 / cron
  │    ├─ storage/              存储抽象 (TandemStore 接口 · 50+ Repository)
  │    │    ├─ drizzle-store    DATABASE_URL → PG 持久化
  │    │    └─ memory-store     无 DB → 内存 (dev/e2e)
  │    ├─ auth/                 自研身份 (native) · session · MFA · RBAC · 申请审批
  │    ├─ audit/                防篡改审计 (SHA-256 hash chain)
  │    ├─ events/               跨域事件总线 (service A 不直接 await service B)
  │    ├─ taf/                  多 LLM provider 路由 + skill governance
  │    ├─ convergence/          17 分钟议事收敛 orchestrator
  │    ├─ persona/ memory/ okr/ kpi/ governance/ im/ ...  领域模块
  │    └─ infra/                PG/Redis/S3/email/push/限流/可观测/生产硬化
  │
  └─ 外部: PostgreSQL · Redis · MinIO/S3 · LiveKit · LLM API
```

### 2.2 关键架构决策 (实测自代码)

1. **存储抽象 (TandemStore)** — 统一 `Repository<T>` 接口, `DATABASE_URL` 在 `boot.ts` 决定走 Drizzle+PG 还是内存。切换零业务改动, e2e/dev 可复现。
2. **双层鉴权** — `middleware.ts` (Edge, 拦截匿名 + 板块 RBAC) + `requireAuth` (endpoint 级, 注入 userId/roles/tenantId)。刻意冗余防单点失效。
3. **事件总线** — 跨域副作用经 `lib/events`, 禁止 service 直接 await 另一 service (降耦合)。
4. **防篡改审计** — 每条 audit entry 带 SHA-256 链式 hash (`prevHash + payload`), 对齐等保二级 / PIPL 不可篡改要求。
5. **生产启动硬化** — `production-guard.ts` 在 boot 早期校验密钥强度 / DATABASE_URL / demo-auth / bcrypt rounds / LLM provider, 不达标直接抛错阻止启动。
6. **进化五引擎 + 防漂移** — Persona 5 阶段进化 + Constitution (价值观锚, 硬前置 system prompt)。
7. **cron via setInterval** — 议事 17min sweep (30s) + 慢扫描 (10min: 复盘/Memory SLA/降级/Persona 升阶/KPI 快照)。**单进程模型** (见 §4 风险)。

---

## 3. 功能模块分析

### 3.1 三大板块

| 板块 | 别名 | 职责 | 代表路由 |
|---|---|---|---|
| **事半** | OKR 驱动器 | Objective/KR/Initiative/TTI, 严格回溯 OKR | `/okr` `/tti` `/api/okr` `/api/tandem-okr` |
| **拿捏** | 个人 AI | Persona 5 阶段进化 / 代行 / Memory / 学院 / 价值观锚 | `/persona/*` `/tandem` `/api/persona` |
| **搭子** | 协作套件 | IM / 文档 / 日历 / 网盘 / 多维表格 / 邮件 | `/im` `/documents` `/calendar` `/drive` `/bitable` `/mail` |

### 3.2 核心域模块 (TandemStore 50+ Repository 实测)

- **决策 / 议事**: `decisionCards` + `convergence` orchestrator (17min 硬上限, 超时自动 escalate)。
- **Persona / 拿捏**: `personas` `proxyActions` (24h 否决窗口) `personaFeedbacks` `personaConstitutions` (B-027)。
- **Memory**: `memories` `promotions` (三级签批 SLA) `downgrades` (引用率扫描降级) + `stewards`。
- **OKR / 事半**: `cycles` `objectives` `keyResults` `ttis` `initiatives` `checkIns`。
- **KPI (CHARTER-KPI-TTI)**: `kpiCycles` `kpiSubjects` `kpis` `kpiCheckIns` `kpiSnapshots` `kpiManualEntries` `kpiBonusPayouts` + `kpiCausalLinks` (BSC 战略地图因果链 B-019)。三通道写入。
- **协作 (搭子)**: `imChannels/Messages/Memberships` · `documents` `calendarEvents` `driveFiles` `notifications` · `bitableTables/Views`。
- **绩效流程**: `oneOnOneMeetings/ActionItems` · `review360Cycles/Submissions/Assignments`。
- **中央 AI (CompanyBrain)**: `companyBrainDecisions/Versions/EvalCases/Reflections` — 智能迭代闭环 (§CA-13)。
- **治理**: `governanceProjects/Templates/TemplateVersions` (三省六部 RACI 协同模板)。
- **学院 (Academy)**: `learningAttempts/Certifications/Enrollments`。
- **Skills 治理**: `skillRegistry` (状态机) + `skillProposals` (pattern-detector 草稿)。
- **身份**: `auth` (native) + `authApplications` (外部申请审批) + invite (即时邀请码) + MFA。
- **平台治理**: `llmPreferences` `tenantAiPolicies` `workspaceManifests` `intranetPosts`。

### 3.3 API 表面 (170 路由, 50+ 业务分组)

覆盖: `auth` `admin` `okr` `kpi`(19) `im`(15) `persona` `governance` `convergence` `documents` `calendar` `drive` `bitable` `360` `1on1` `nine-box` `company-brain` `boss-ai` `mail` `meetings` `notifications` `cron` `health` `llm-health` `realtime` `search` 等。

---

## 4. 后端问题审计

> 评级: 🔴 上线前必修 · 🟡 上线后尽快 · 🟢 可接受/已缓解

### 4.1 🔴 必修

| # | 问题 | 影响 | 建议 |
|---|---|---|---|
| B1 | **45+ 改动未提交** (6 条功能线混在工作区) | 无版本快照, 回滚困难, 协作冲突 | 按 6-commit 拆分计划落库 (已有计划) |
| B2 | **备份未做恢复演练** | 灾难时无法保证可恢复 | 上线前至少 1 次完整 `pg_dump` → 异机 `psql` 恢复验证 (LAUNCH-CHECKLIST §D3) |
| ~~B3~~ ✅ | ~~多副本下 cron 重复执行~~ | **已修 (2026-05-31)**: `lib/infra/leader.ts` `withCronLock` Redis 单飞行锁, `boot.ts` 议事 tick + 慢扫描已包裹; 无 Redis 单进程直接跑 | — |

### 4.2 🟡 尽快

| # | 问题 | 影响 | 建议 |
|---|---|---|---|
| B4 | **状态双轨 (zustand ↔ 后端)** | OKR 等部分数据仍在客户端 `lib/store.ts` (zustand), 与后端 API 并存 (见 governance `LinksDrawer` 注释 "OKR 仍是 zustand 客户端")。两套真相源易不一致 | Phase 3 OKR 后端化, 收敛到单一真相源 |
| ~~B5~~ ✅ | ~~审计内存无界增长~~ | **已修 (2026-05-31)**: `lib/audit/log.ts` 环形缓冲 (默认 10000, `AUDIT_MEMORY_MAX` 可调); `verify` 容忍窗口起点仍保链式校验 | — |
| ~~B6~~ ✅ | ~~rate-limit fail-open~~ | **已修 (2026-05-31)**: `failClosed` 选项, login/mfa/register/sso-register Redis 故障时拒绝; `RATE_LIMIT_FORCE_OPEN=1` 逃生阀 | — |
| ~~B7~~ ✅ | ~~无 Redis 时限流单进程~~ | **已修 (2026-05-31)**: production-guard 在 `APP_REPLICAS>1` 且无 `REDIS_URL` 时升级为 error 阻止启动 | — |
| B8 | **巨型 `lib/store.ts` (~90KB, 38 文件 import)** | 维护风险高, 单点改动影响面大 | 已有 `STORE-SLICE-PLAN-2026-05-31.md`, 排专项拆 slice |
| B9 | **多租户未完成** | `lib/multi-tenant/context.ts` 有 NextAuth 集成 TODO, 租户隔离部分 stub | 自用单租户上线可接受; SaaS 化前补齐 |

### 4.3 🟢 已缓解 / 可接受

- **生产启动硬化** `production-guard.ts`: 密钥强度 / DATABASE_URL / `ALLOW_DEMO_AUTH≠1` / bcrypt≥10 / LLM provider 缺失 → 抛错阻止启动。✅
- **健康探针** `/api/health`: DB/Redis/S3 readiness (503 摘流量) + LLM degraded 区分 + 失败 `fireAlert`。✅
- **审计防篡改**: SHA-256 hash chain。✅
- **容器硬化** (Dockerfile): 多阶段 / 非 root (uid 1001) / standalone / HEALTHCHECK。✅
- **编排硬化** (compose.prod): PG/Redis/MinIO **不对外暴露端口** / 健康依赖 / 资源 limits / 日志轮转 / 密钥 `:?must set` 强制。✅
- **TODO/FIXME 极少**: 全库仅 ~2 处真实 TODO (multi-tenant NextAuth, orchestrator hydrate)。✅

---

## 5. 前端问题审计

| # | 评级 | 问题 | 现状 / 建议 |
|---|---|---|---|
| F1 | 🟡 | **移动端 shell 拥挤** | 375px 下 `AppRail 64 + SubSidebar 240 + main` 拥挤; M1 响应断点 ratchet 中 (51 文件 allowlist 渐次清零) |
| F2 | 🟡 | **UI Charter 历史债** | charter `--strict` 0 违规, 但 allowlist 仍挂 90 文件 (raw color / 字号 / 圆角遗留, P1.5 清零中) |
| F3 | 🟢 | **状态耦合** | 大量组件依赖 `lib/store.ts` (见 B8) |
| F4 | 🟢 | **PWA 完整** | manifest / icons(192/512/maskable) / sw / theme_color 一致, service worker 已注册 |
| F5 | 🟢 | **设计语言统一** | 强制走语义 token (charter 门禁守护), 字号/色/圆角/阴影/动效全语义化 |

---

## 6. 生产级上线准备 (Go-Live 清单)

### 6.1 代码门禁 (✅ 本次全绿)

```
tsc=0  vitest=697  charter=0 (allowlist 已清零)  deeplinks=0  docs-index=0  build=Exit0
```

> **2026-05-31 后端硬化批次**: B3 (cron 单飞行) / B5 (审计环形缓冲) / B6 (限流 fail-closed) / B7 (多副本强制 Redis) 已修, 回归测试见 `tests/unit/backend-hardening.test.ts` (9 用例)。剩余 B1/B2 为运维侧, B4/B8/B9 为大型重构 (各有专项计划)。

### 6.2 上线前必做 (Blocking)

- [ ] **提交落库** — 6-commit 拆分, 工作区清零 (B1)
- [ ] **A2 e2e 跑通** — `full-loop-verify.mjs` (18/18) + Playwright e2e(12) + mobile(19) (需 dev server + PG 在线)
- [ ] **备份 + 恢复演练** — `pg_dump` 异机恢复验证 (B2)
- [ ] **生产密钥** — `openssl rand` 生成 `NEXTAUTH_SECRET`/`SESSION_SECRET`/`MFA_ENCRYPTION_KEY`/`POSTGRES_PASSWORD`/`REDIS_PASSWORD`/`MINIO_ROOT_PASSWORD`
- [ ] **`ALLOW_DEMO_AUTH=0`** + 强 Owner bootstrap 密码 (production-guard 会拦默认值)
- [ ] **HTTPS** — Caddy/Nginx/Cloudflare 反代到 `127.0.0.1:3000`
- [ ] **`db:migrate`** — 容器启动后跑迁移

### 6.3 上线即配 (强烈建议)

- [ ] **监控** — UptimeRobot/Better Stack 5min ping `/api/health`; 配 `ALERT_WEBHOOK_URL` (飞书/钉钉/Slack) 接 `fireAlert`
- [ ] **错误聚合** — `SENTRY_DSN` (否则仅 stdout)
- [ ] **Redis 必配** — 否则限流/会话多副本失效 (B7)
- [ ] **S3/MinIO 必配** — 否则 Drive 文件容器重启丢失

### 6.4 部署形态 (本项目是有状态应用)

> ⚠️ **不能**部署到纯静态/Serverless (Netlify/Vercel 裸跑) — 依赖 PG + Redis + MinIO + 进程内 cron。

- **推荐 B1**: VPS + `docker-compose.prod.yml` (PG/Redis/MinIO/app 一套起, 2vCPU/4GB)。
- **备选 B2**: Vercel + Neon(托管 PG) + Upstash(Redis) + 外部 S3 — 但进程内 cron 在 Serverless 失效, 需改 Vercel Cron / 外部调度。

### 6.5 上线后 24h 观察

- 每 2h 看 `/api/health` + `/api/llm-health`
- PG 连接数 `SELECT count(*) FROM pg_stat_activity;`
- 磁盘 `df -h` · 容器日志 `docker compose logs app | grep ERROR`
- 收集 5 个真实用户反馈, 列前 3 阻塞项

---

## 7. 风险登记 (按优先级)

| 优先级 | 风险 | 触发条件 | 缓解 |
|---|---|---|---|
| P0 | 备份不可恢复 | 数据灾难 | 上线前恢复演练 (B2) |
| P0 | 弱密钥/demo-auth 上生产 | 配置失误 | production-guard 已自动拦截 ✅ |
| P1 | 多副本 cron 重复 | 横向扩容 | 单副本上线 / leader-election (B3) |
| P1 | 状态双轨不一致 | OKR 客户端/后端分叉 | Phase 3 后端化 (B4) |
| P2 | 审计内存增长 | 超长 uptime | 环形缓冲 (B5) |
| P2 | 限流 fail-open | Redis 故障 | login fail-closed (B6) |

---

## 8. 审计结论

- **代码质量**: 高。强类型 + 6 道门禁 + 680 测试 + 极少 TODO + 存储抽象 + 防篡改审计 + 生产硬化, 工程底盘扎实。
- **可上线性**: 单租户 / 单副本 / VPS Docker Compose 形态下 **代码已就绪**, 阻塞项全在「提交 + 备份演练 + 密钥 + 监控接入」运维侧。
- **下一步**: ① 落 git; ② A2 e2e 实跑确认; ③ 备份恢复演练; ④ 按 §6.2 配生产 env 部署; ⑤ 上线后补 B3/B4/B5 横向扩展与状态收敛。

> 本审计基于 2026-05-31 工作区实测。提交落库后建议重跑 6 道门禁 + `npm run build` 复核。
