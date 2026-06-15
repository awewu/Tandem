# Tandem · 200 人上线验收 Runbook（可执行 Checklist）

> 配套 `LAUNCH-200.md`（状态盘点）。本文件是**上线日逐条勾选的操作手册**。
> 每一项含：操作命令、预期结果、验收标准、回滚动作。
> 负责人填 `@who`，完成打 `[x]` 并记录时间戳 + 证据链接。

最后更新：2026-06-12

---

## 阶段 0 · 上线前置（T-7 ~ T-1 天）

### 0.1 环境变量核对
- [ ] 生产 `.env.production` 全部就位（负责人：`@ops`）
  ```bash
  # 必须存在且非默认值
  grep -E 'JWT_SECRET|REFRESH_SECRET|DATABASE_URL|REDIS_URL' .env.production
  ```
  - **验收**：`JWT_SECRET` / `REFRESH_SECRET` 长度 ≥ 32 且非示例值；`ALLOW_DEMO_AUTH` 未设或 `=0`；`BCRYPT_ROUNDS ≥ 10`
  - **验收**：`REQUIRE_MFA_FOR_PRIVILEGED=1`；至少 1 个 LLM key（`DEEPSEEK_API_KEY`/`OPENAI_API_KEY`）
  - **验收**：`APP_REPLICAS > 1` 时 `REDIS_URL` 必须存在（否则启动 fatal）

### 0.2 UI 宪章 / Lint 清场
- [ ] 清掉上次 `--no-verify` 绕过的 raw-color 违规（负责人：`@fe`）
  ```bash
  npm run lint
  npm run lint:ui-charter
  npx tsc --noEmit
  ```
  - **验收**：三条命令全绿，**不再需要 `--no-verify`** 提交

### 0.3 数据库迁移演练
- [ ] 在 staging 库跑全量 migrate（负责人：`@be`）
  ```bash
  docker compose exec app npm run db:migrate
  ```
  - **验收**：0006 / 0007 索引迁移成功，`\d "KvStore"` 看到分区索引

---

## 阶段 1 · 备份与恢复演练（P0-2，阻塞）

### 1.1 备份产出
- [ ] 跑一次完整备份（负责人：`@ops`）
  ```bash
  # Linux
  sudo bash scripts/install-backup-cron.sh /opt/tandem /var/backups/tandem
  # Windows
  node scripts/backup-pg.mjs --dir D:/backups/tandem
  ```
  - **验收**：产出 dump 文件，记录 `sha256sum` 到 `docs/RUNBOOK.md`

### 1.2 异地恢复演练（必须另一台机器）
- [ ] 在**独立机器**完整 restore（负责人：`@ops`）
  ```bash
  node scripts/restore-pg.* --file <backup>
  # 起应用
  docker compose -f docker-compose.prod.yml up -d
  curl http://localhost:3000/api/health
  ```
  - **验收**：应用能起 + 数据完整（用户数/OKR 数与源库一致）+ 能登录
  - **证据**：restore 日志贴到 `docs/RUNBOOK.md`
  - **回滚**：演练机器与生产隔离，演练失败不影响生产

---

## 阶段 2 · 告警实战演练（P0-3，阻塞）

### 2.1 应用侧告警（3 条）
- [ ] 配置 `ALERT_WEBHOOK_URL`（Lark/钉钉/Slack）（负责人：`@ops`）
- [ ] 制造 DB 故障验证 readiness 告警
  ```bash
  docker stop tandem-postgres
  # 等 ≤ 60s
  ```
  - **验收**：群里收到 "Readiness check failed" critical 告警
  - **恢复**：`docker start tandem-postgres`
- [ ] 制造 LLM 全失败（临时改坏所有 LLM key）
  - **验收**：群里收到 "all-providers-failed" 告警
- [ ] brain-smoke 基线跌破
  - **验收**：故意改坏 system prompt → GitHub Actions 红

### 2.2 基础设施侧告警（2 条，留 ops）
- [ ] DB 连接池 > 80% max_connections（Prometheus + postgres_exporter）
- [ ] 磁盘 > 80%（node_exporter / perfmon）

---

## 阶段 3 · 容量压测三关（P0-5，阻塞）

- [ ] 烟测（负责人：`@be`）
  ```bash
  curl https://your-domain/api/health
  npm run brain:smoke   # 走 https
  ```
  - **验收**：health 全绿，brain-smoke 5 场景全过
- [ ] 第 1 关 · 30 人
  ```bash
  npm run brain:load -- --users 30 --duration 60 --confirm
  ```
- [ ] 第 2 关 · 100 人
  ```bash
  npm run brain:load -- --users 100 --duration 120 --confirm
  ```
- [ ] 第 3 关 · 200 人（真容量）
  ```bash
  npm run brain:load -- --users 200 --duration 300 --confirm
  ```
  - **验收**：p95 < 5s 且 success > 95%
  - **注意**：压测烧 LLM token，先确认预算

---

## 阶段 4 · 分波邀请

- [ ] 第一波 30 人（负责人：`@pm`）
  ```bash
  node scripts/issue-trial-invite.mjs 30 168 employee
  ```
- [ ] 观察 48h：`/admin/business-review?windowDays=2` + `/teammates` 验证 AI 学习正常
- [ ] 第二波 +70 人（48h 后）
- [ ] 第三波 +100 人（再 48h 后）

---

## 阶段 5 · Definition of Done（全满足才算上线完成）

- [ ] §2 五项 P0 全 ✅
- [ ] brain-smoke baseline 锁定 + CI 接通
- [ ] 备份 + 恢复演练完成一次，日志归档
- [ ] 一次成功的 200 人模拟（p95 < 5s, success > 95%）
- [ ] 一次告警实战演练（503 → 5 条告警全部到群）

---

## 紧急回滚预案

| 场景 | 动作 |
|---|---|
| 新版本起不来 | `docker compose down` → 切回上一个 image tag → `up -d` |
| 数据迁移坏库 | 停服 → restore 最近备份 → 排查 migration |
| LLM 全挂 | 系统 fail-open 仍可用非 AI 功能；切备用 provider key |
| 限流误伤 | 临时调高 `BOSS_AI_RATE_*` env 并重启 |
| 被刷爆 | 临时设 `APP_REPLICAS` + Redis 限流收紧 |
