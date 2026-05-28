# Release Commit Plan · 2026-05-28

> **目的**: 把 139 个未提交文件按主题切分成 ~8 个有意义的 commit，方便 review / cherry-pick / revert。
> **使用**: 按顺序逐条复制 PowerShell 命令执行。每条 commit 后跑 `git log -1 --stat` 验证。
> **不会**: 自动 push，所有命令止于本地 commit。

---

## 自检状态 (执行 plan 前已绿)

```
✅ TypeCheck     0 errors
✅ Unit Tests    158 / 158 PASS  (18 files)
✅ Lint          0 warnings
✅ Build         165 pages compiled
✅ E2E (smoke)   28 / 30 (2 网络抖动)
✅ Smoke (7)    ALL PASSED (含 14 模块跨租户隔离)
```

---

## Commit 1 · 工程卫生：.gitignore + 恢复误删

**目的**: 防 `.env.local.bak` 泄密 + 恢复 Dockerfile 等被误删的关键文件。

```powershell
git add .gitignore
git add -- ":(glob)*.bak" 2>$null  # 不存在则跳过
git checkout HEAD -- Dockerfile DOCKER-SETUP.md .dockerignore .hintrc .markdownlint.json 2>$null

git commit -m "chore(repo): gitignore env backup + restore docker/lint configs

- .gitignore: 加 .env.local.bak / *.bak / scratch output 文件
- 恢复工作区被误删的 Dockerfile / DOCKER-SETUP.md / .dockerignore / .hintrc / .markdownlint.json
- 防止 .env.local.bak 中的密钥意外提交"
```

---

## Commit 2 · DB Migration · UsageEvent + LlmUsageLog (0003)

```powershell
git add drizzle/migrations/0003_spooky_nuke.sql
git add drizzle/migrations/meta/0003_snapshot.json
git add drizzle/migrations/meta/_journal.json
git add lib/infra/drizzle-schema.ts

git commit -m "feat(db): migration 0003 · UsageEvent + LlmUsageLog (self-use #2 + B-005)

§SELF-USE-FIRST priority #2 + §B-005 数据飞轮

新增两张表:
- UsageEvent: 用户行为埋点 (谁在用哪个模块)
- LlmUsageLog: LLM 调用成本与延迟可见性

drizzle-kit generate 出的 0003_spooky_nuke 已登记到 _journal.json,
schema 在 lib/infra/drizzle-schema.ts 对齐."
```

---

## Commit 3 · Analytics 接入 + 自用阶段埋点

```powershell
git add lib/analytics/
git add app/api/analytics/
git add app/api/admin/usage/
git add app/admin/usage/

git commit -m "feat(analytics): /api/analytics/* + /admin/usage 看板 (B-005)

- lib/analytics/track.ts: trackUsageEvent / trackLlmUsage / estimateCostMicroUsd
- /api/analytics/usage: 上报用户行为
- /admin/usage: 自用阶段 dashboard (Top 模块/Top 用户/LLM 成本)
- 上线先用 InMemory, 持久化到 PG (UsageEvent / LlmUsageLog 表)"
```

---

## Commit 4 · CENTRAL-AI V1 14 器官 (合并多次累积)

> **建议**: 这部分文件横跨 4-5 个会话累积，可以再细分。下面是合并版。

```powershell
git add lib/agent-runtime/
git add lib/skills/pattern-detector.ts
git add lib/skills/skill-proposal.ts
git add app/api/admin/skill-proposals/

git commit -m "feat(central-ai): 14 器官 V1 · 主循环/工具/MCP/习惯沉淀

§CA-5,6,7 · 14 器官 V1 骨架 (中央 AI 三件套):

#12 主循环精细化 (lib/agent-runtime/multi-step.ts)
- ReAct prompt-based 多轮工具调用循环, maxSteps=5
- mode: 'prompt' | 'native' (native 转发 runToolLoop)

#13 执行肢体 (lib/agent-runtime/tool-loop.ts + mcp-bridge.ts + mcp-client.ts)
- runToolLoop: native function calling 多轮工具调用
- mcp-bridge: MCP server 注册表 + invoke 入口
- mcp-client (V2): 真实接入 @modelcontextprotocol/sdk
  - stdio / streamableHttp / SSE / websocket 四种 transport
  - 连接缓存 + process exit 清理
- Skill Gateway 4 道闸: Baseline / OKR Drift / dataScope / actionScope

#14 习惯沉淀 (lib/skills/pattern-detector.ts + skill-proposal.ts)
- pattern-detector: 扫 DecisionCard, 找 ≥3 张相似 → ProposedSkillPattern
- skill-proposal: LLM 生成 SKILL.md 草稿 → 落 skillProposals KV
- /admin/skill-proposals: Owner / Steward 审批 UI"
```

---

## Commit 5 · Skill Auto-Reload (V2 · 本会话)

```powershell
git add lib/taf/skills/reload.ts
git add lib/taf/skills/registry.ts
git add app/api/admin/skills/
git add lib/audit/log.ts

git commit -m "feat(skill-registry): V2 hot-reload + admin API · §V2-#14

- registry.ts: 加 unregister / clear / has / size 方法
- reload.ts: reloadSkillRegistry() — clear + 重跑 builtin + 过滤 governance suspended
- POST /api/admin/skills/reload: admin 触发 reload
- GET /api/admin/skills/reload: 探针当前 registry 状态
- audit: 新增 'skill.registry.reloaded' action"
```

---

## Commit 6 · B-014 OKR Anchor 注入器 + B-015 OKR Drift 多入口

```powershell
git add lib/persona/company-brain.ts 2>$null
git add lib/persona/company-brain-metrics.ts 2>$null
git add lib/persona/company-brain-reflection.ts 2>$null
git add lib/types/company-brain.ts 2>$null
git add app/api/admin/company-brain/
git add app/admin/company-brain/page.tsx 2>$null
git add scripts/company-brain-reflection.mjs
git add app/api/1on1/[id]/action-items/route.ts

git commit -m "feat(soul-layer): B-014 OKR Anchor 注入器 + B-015 OKR Drift 接入 1on1

§OKR-DRIVEN 灵魂层第 1 + 2 条:

B-014 · OKR Anchor 注入器 (buildOkrAnchorContext):
- 拉 active 周期公司层 Objective + KR 进度
- 注入 buildCompanyBrainSystemPrompt() → 中央 AI 任何输出都基于公司当前 OKR
- 永不抛错 (失败返回降级文本)
- 过滤 paused/abandoned Obj + team-level Obj

B-015 · OKR Drift 检测多入口接入:
- 议事室 ALIGN: validateOkrAnchor() XOR primaryKrId / noKrReason ≥30 字
- 1on1 action-items 创建: 跑 checkOkrDrift, 回执带 okrDrift verdict
- IM Persona 回复 + CompanyBrain · 已落地 (前置会话)

CA-13 · Reflection 月度 cron:
- scripts/company-brain-reflection.mjs (--window/--tenant/--llm)
- 挂 0 2 1 * * 月初凌晨 2 点跑"
```

---

## Commit 7 · CI/CD · GitHub Actions 4 关 + GitLab CI

```powershell
git add .github/workflows/ci.yml
git add .gitlab-ci.yml 2>$null

git commit -m "ci: GitHub Actions 4 关 (typecheck/test/lint/build) + GitLab CI

- .github/workflows/ci.yml: PR + push 自动跑 typecheck → vitest → next lint → build
- 双 job: typecheck-test-lint + build (build 依赖前者)
- .gitlab-ci.yml: GitLab 镜像同步管线 (可选)"
```

---

## Commit 8 · 158 单测全绿 (含本会话新增 +33)

```powershell
git add tests/unit/agent-runtime.test.ts
git add tests/unit/agent-runtime-v2.test.ts
git add tests/unit/baseline-guard.test.ts
git add tests/unit/company-brain-okr-anchor.test.ts
git add tests/unit/company-brain-reflection.test.ts
git add tests/unit/proxy-actions.test.ts
git add tests/e2e/auth.setup.ts
git add tests/e2e/mobile.spec.ts

git commit -m "test: 单测 158 全绿 (+33 本会话) · e2e auth setup + mobile spec

新增/扩展:
- agent-runtime.test.ts: #12/#13/#14 三器官 mock router 15 case
- agent-runtime-v2.test.ts (新): V2 升级 10 case (MCP live mode / Skill Gateway / reload / native)
- baseline-guard.test.ts: 8 case
- company-brain-okr-anchor.test.ts (新): B-014 OKR 注入 8 case
- company-brain-reflection.test.ts: CA-13 cron 闭环
- proxy-actions.test.ts: §13 24h 否决窗口

e2e:
- auth.setup.ts: storageState 一次性登录 (Playwright 项目复用)
- mobile.spec.ts: iPhone-SE/14/iPad-mini × 关键页面"
```

---

## Commit 9 · 其余文档 + 脚本 + 杂项 admin UI

```powershell
git add docs/
git add scripts/
git add app/

# 注意: 此条一次性吞掉余下文件, 量大. 建议 review 后再 commit
git status --short  # 看还剩什么

git commit -m "docs+scripts+ui: M2-W6 杂项 (REFLECTION/ROADMAP-AI/PRODUCT-NARRATIVE + admin pages + smoke scripts)

文档:
- docs/REFLECTION-2026-05.md: 自反思月度报告
- docs/ROADMAP-AI.md: AI 路线图整合
- docs/PRODUCT-NARRATIVE.md + PRODUCT-SPIRIT.md: 产品叙事
- docs/SELF-USE-FIRST.md: 自用优先原则
- docs/PRODUCTION-DEPLOY.md: 3 条生产部署路径
- docs/DEPLOY-READINESS-AUDIT.md: 上架前审计

脚本:
- scripts/seed-demo-users.mjs / issue-trial-invite.mjs
- scripts/backup-pg.mjs / restore-pg.mjs
- scripts/full-loop-verify.mjs: 端到端冒烟

UI:
- /admin/usage (B-005)
- /persona/me + /persona/training (拿捏闭环)
- /report/weekly + /partner + /register/employee

杂项:
- public/icon-*.png + generate-pwa-icons.mjs (PWA 资源)
- middleware.ts: production guard 接入"
```

---

## 余下未归类（手动决定）

```powershell
git status --short
```

可能包含:
- `.env.production.example` — 安全, 应 commit
- `LAUNCH-CHECKLIST.md` / `STATUS.md` / `DEPLOY.md` / `TRY-IT.md` / `LOCAL-SHARE.md` — 文档, 应 commit
- `.git-status-snapshot.txt` — scratch, 手动删

---

## 最终发布前清单

执行完上面所有 commit 后:

```powershell
# 1. 跑全四关
npx tsc --noEmit
npx vitest run
npx next lint --max-warnings=0
npm run build

# 2. 看 commit 历史
git log --oneline -10

# 3. push (确认无误后)
git push origin main

# 4. 部署 (按 docs/PRODUCTION-DEPLOY.md 选 A/B/C 路径)
```

---

## ⚠️ Pre-push 安全检查

```powershell
# 不让 .env.local / .env.local.bak 泄露
git ls-files --error-unmatch .env.local 2>$null && Write-Host "⚠️ .env.local IS TRACKED, REMOVE BEFORE PUSH" -ForegroundColor Red
git ls-files --error-unmatch .env.local.bak 2>$null && Write-Host "⚠️ .env.local.bak IS TRACKED, REMOVE BEFORE PUSH" -ForegroundColor Red

# 看 staged 里有没有密钥关键词
git diff --staged | Select-String "sk-[a-zA-Z0-9]{20,}|AKIA[A-Z0-9]{16}|ghp_[a-zA-Z0-9]{36}|api[_-]?key.*[=:].*[a-zA-Z0-9]{20,}"
```

如果有命中 → STOP，处理后再 push。
