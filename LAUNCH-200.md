# Tandem · 200 人上线检查表

> 与 `LAUNCH-CHECKLIST.md` (30 人 dogfood) 互补.
> 30 人是 "能跑就行", 200 人是 "出事不能塌"。每一项明确 **已完成 / 待办 / 已弃用**。

写于 2026-06-09. 本表内"已落"项均经 grep 实测验证, 不靠记忆。

---

## §0. 工作量预估

| 类别 | 项数 | 状态 |
|---|---|---|
| 已建好 (复用即可) | 14 | ✅ |
| 上线前必做 (P0) | 5 | 🟡 阻塞 |
| 上线 30 天内补 (P1) | 6 | ⚪ 计划 |
| 规模化后再做 (P2) | 4 | ⚪ 远期 |

预估: **集中冲 1-2 周拿下 P0**, 即可发邀请到 200 人.

---

## §1. 已建好 (盘点 · 不要重复造轮子)

实测时间 2026-06-09. 文件均存在.

| 能力 | 实现 | 说明 |
|---|---|---|
| 限流 (per-user per-min + per-day) | `lib/infra/rate-limit.ts` | Redis sliding window + InMemory fallback, fail-open/closed 二选一 |
| BossAI 成本闸 | `app/api/boss-ai/stream/route.ts` §0 + `lib/im/service.ts:1008` | minute=20 / day=500 (env 可调), IM @中央 AI 共享同一预算池 |
| 启动硬化 | `lib/infra/production-guard.ts` | NODE_ENV=production 时检 SECRET 强度 / DATABASE_URL / `ALLOW_DEMO_AUTH≠1` / `BCRYPT_ROUNDS≥10` / LLM 至少 1 个 |
| 多副本守门 | 同上 §APP_REPLICAS | `APP_REPLICAS>1` 但无 REDIS_URL → 直接 fatal (防 cron 重复 + 限流失效) |
| Redis 单飞行 cron | `lib/infra/leader.ts withCronLock` | KPI 快照/月度反思/escalate 不会跨副本重跑 |
| JSONB 索引 | `drizzle/migrations/0007_kv_hot_collection_indexes.sql` | 9 个热点索引: im_messages, memories, decision_cards, im_memberships, im_channels |
| Auth 审计索引 | `0006_db_audit_hardening.sql` | session refreshHash / userId, invite codeHash, auth_event, KvStore(collection,tenantId) |
| 邀请码注册 | `scripts/issue-trial-invite.mjs` | 批量发码 + 邀请有效期可控 |
| MFA + Lockout | `lib/auth/*` | 密码 scrypt + lockedUntil + failedLoginCount + MFA 加密 |
| 健康端点 | `/api/health`, `/api/llm-health`, `/api/integrations/health` | 给 UptimeRobot 用 |
| 错误聚合 | `lib/infra/observability.ts` + SENTRY_DSN | 配 DSN 即生效 |
| 备份脚本 | `scripts/backup-pg.ps1`, `scripts/restore-pg.ps1` | 已存在, 但不自动跑 (P0-4) |
| 桌面 App | `npm run tauri:build` + `scripts/install-tandem-service.ps1` | NSIS 安装包 + Windows 计划任务守护 :3005 |
| PWA (移动) | `public/manifest.webmanifest` + sw.js | 加桌面 / standalone OK |

## §2. P0 · 200 人上线前必做 (阻塞)

### P0-1 · IM 普通消息限流 ✅ 本会话已落
- 已添加 `/api/im/channels/[id]/messages POST` per-user per-minute 限 (复用 `POLICIES.api()` 120/min).
- 同时落审计事件 `im.rate_limited`.
- 文件: `app/api/im/channels/[id]/messages/route.ts`.

### P0-2 · 备份 cron + 一次完整恢复演练 🟡 脚本已就绪
- 现状: `scripts/backup-pg.mjs` (跨平台) + `scripts/install-backup-cron.sh` (本会话) 已就绪.
- 部署侧落地:
  - Linux: `sudo bash scripts/install-backup-cron.sh /opt/tandem /var/backups/tandem` → 写 `/etc/cron.d/tandem-backup`, 每天 04:00 备份 + 保留 7 天.
  - Windows: 用 Task Scheduler 调 `node scripts/backup-pg.mjs --dir D:/backups/tandem`.
  - 异地拷贝: `aws s3 cp` / `rclone` / `scp` 任选一 (install 脚本末尾有提示).
  - **必须**: 在另一台机器跑一次完整 restore, 验证 backup 能 import + 应用能起 + 数据完整.
- 验收: 备份 SHA256 + restore 演练日志贴到 `docs/RUNBOOK.md`.

### P0-3 · 关键告警 5 条接入 🟡 应用侧已落 (3/5), 基础设施 2 条留 ops
- 应用侧 (✅ 已落): 设 `ALERT_WEBHOOK_URL` (Lark/钉钉/Slack) 即生效, 内置 60s 同标题抖动抑制.
  1. ✅ `/api/health` 任一关键依赖失败 → critical 告警 (`app/api/health/route.ts:109`)
  2. ✅ LLM 全 provider 失败 (非流式 + 流式) → critical (`lib/taf/router.ts:127`, 本会话)
  3. ✅ brain-smoke CI 基线跌破 → GitHub Actions 红 (brain-quality.yml 本会话)
- 基础设施侧 (🟡 留 ops):
  4. DB 连接池饱和 (`pg_stat_activity > 80% max_connections`) — Prometheus + postgres_exporter, 接 alertmanager.
  5. 磁盘 > 80% — node_exporter (Linux) / perfmon (Windows), 同上.
- 验收: 故意停掉 PG (`docker stop tandem-postgres`), 1 分钟内群里看到 "Readiness check failed".

### P0-4 · 特权角色 MFA 强制 ✅ 本会话已落 (选 A)
- 落地: `lib/auth/native.ts login()` 检测 `DATA_STEWARD_ROLES (owner/admin/steward) && !mfa && mfaForcedOn`, 返回 `mfaEnrollmentRequired: true`. 客户端 `app/login/page.tsx` 收到此 flag 强跳 `/settings/security?enrollMfa=1`.
- 开关 (env): `REQUIRE_MFA_FOR_PRIVILEGED=1` 显式开启; 生产环境 (`NODE_ENV=production`) 默认 ON, 可用 `REQUIRE_MFA_FOR_PRIVILEGED=0` 显式关闭 (不建议).
- 审计: 拦截事件 `login_mfa_enrollment_required` 入 AuditLog, 便于追溯哪些特权账户被门强跳过.
- 验收: 
  1. 设 `NODE_ENV=production REQUIRE_MFA_FOR_PRIVILEGED=1`, 一个 owner 账号未启 MFA 登录 → 必跳 `/settings/security`.
  2. 启 MFA 后再登录 → 走正常 MFA 二步流.
- 后续 (选 B · 远期): 公司 IdP (OIDC / SAML) 完全替换密码登录, demo-auth 永久禁用.

### P0-5 · `brain-smoke` + `brain-load` 进 CI ✅ 本会话已落
- 落地: `.github/workflows/brain-quality.yml`
  - `brain-smoke` job: workflow_dispatch + 每日 02:00 UTC schedule. 起 PG + Redis + dev server, 跑 `node scripts/brain-smoke.mjs --json`, 任一场景失败 → CI 红, 报告 artifact 上传.
  - `brain-load` job: 仅 workflow_dispatch (避免 schedule 烧 LLM 余额), 可输入 `users` / `duration`.
- 依赖 GitHub secret: `DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY`. 未配 secret 则 job skip (不红).
- 验收: 1) 在 GitHub Actions UI 手动 trigger 一次 brain-smoke, 看 5 场景全过. 2) 故意把 system prompt 改坏一句, 下次 trigger 必红.

## §3. P1 · 上线 30 天内补 (不阻塞首发)

| ID | 项 | 当前 | 落地 |
|---|---|---|---|
| P1-1 | embedding 真物理列 (pgvector) | `lib/infra/embedding.ts` ok, 存 KvStore.data.embedding JSONB | 加 `Memory_embedding` 向量列 + ivfflat 索引, `scripts/backfill-embeddings.mjs` 重跑 |
| P1-2 | LLM 单租户/单用户日预算硬上限可看 | 已有限流, 无 dashboard | `/admin/cost` 页, 按 user × day 出 token 用量曲线 (audit log 已含) |
| P1-3 | 数据导出 / 一键删除 (合规-lite) | 无 | `/api/me/export` 出 ZIP + `/api/me/delete` 软删 30 天兜底 |
| P1-4 | 审计日志归档 / 轮转 | 无限增长 | 90 天前 dump 到 S3 + 主表 delete |
| P1-5 | 实时通知扇出验证 | `lib/realtime/*` 存在, 200 人未实测 | 200 用户 + 50 channel 模拟 (`scripts/im-load.mjs` 待写) |
| P1-6 | mobile shell 真适配 | LAUNCH-CHECKLIST §C2 已记 | 抽屉式 SubSidebar (Option A, 4h) |

## §4. P2 · 规模化后再做 (200→1000+)

| ID | 项 | 当前 | 触发条件 |
|---|---|---|---|
| P2-1 | 多租户隔离真生效 | `lib/multi-tenant/context.ts` 已造, 但 `app/api/**` **零调用** (grep 验证) | 第 2 个真实租户加入前必须做 |
| P2-2 | KvStore 热点物理化 | im_messages / memories / auditLogs 仍是 JSONB | QPS > 50 或单 collection > 10M 行 |
| P2-3 | 读写分离 / 副本 | 单 PG | 写 QPS > 200 |
| P2-4 | LLM provider 智能路由 | 走 `lib/llm/router.ts` 但策略简单 | 成本 > 月 ¥10k 后做 cost-aware routing |

## §5. 不做 (明确决定)

- ❌ **K8s / Helm**: 单服务器 docker compose 完全够 200 人, 不上 K8s 复杂度.
- ❌ **微服务拆分**: 单 Next.js + Postgres + Redis + MinIO 四件套.
- ❌ **国际化 i18n**: 公司语料中文, 不做多语.
- ❌ **MCP 出站 / B-021-023**: 见 memory 战略纠偏 — 自用 tool-loop 留, 对外 MCP 远期可选.

---

## §6. 上线日操作顺序

按本表 §2 全部 ✅ 后:

```bash
# 1. 部署
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
docker compose exec app npm run db:migrate

# 2. 烟测
curl https://your-domain/api/health
npm run brain:smoke   # 在外部跑, 走 https

# 3. 容量摸底
npm run brain:load -- --users 30 --duration 60 --confirm   # 第 1 关
npm run brain:load -- --users 100 --duration 120 --confirm # 第 2 关
npm run brain:load -- --users 200 --duration 300 --confirm # 第 3 关 = 真容量

# 4. 邀请分波
node scripts/issue-trial-invite.mjs 30 168 employee  # 第一波 30 人
# 观察 48h → 第二波 70 → 再 48h → 剩 100
```

每一波之间看 `/admin/business-review?windowDays=2` 与 `/teammates` (本会话已落) 验证 AI 学习正常.

## §7. 验收完成定义

200 人上线 = 同时满足:
1. §2 五项 P0 全 ✅
2. brain-smoke baseline 锁定 + CI 接通
3. 备份 + 恢复演练完成一次, 日志归档
4. 一次成功的 200 人模拟 (`brain:load --users 200`) 通过 (p95 < 5s, success > 95%)
5. 一次告警实战演练 (主动制造一次 503, 验证 5 条告警全部到群)

---

最后一次更新: 2026-06-09  
SSOT: 与 `COMMERCIAL-READINESS-GAP.md` / `docs/ROADMAP-EXECUTION.md` 对账
