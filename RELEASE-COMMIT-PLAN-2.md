# Release Commit Plan #2 · 2026-05-29 18:00

> **目的**: 把过去 12-37h 累积的 80 个未提交文件 + 16 个新文档拆成 **7 个有逻辑顺序的 commit**。
> **使用**: 按顺序逐条复制 PowerShell 命令执行。每条 commit 后跑 `git log -1 --stat` 验证。
> **不会**: 自动 push。所有命令止于本地 commit。

---

## 健康度（执行前已绿）

```
✅ TypeCheck     0 errors
✅ Unit Tests    188 / 188 PASS  (+30 自上次)
```

## 文件分布

```
40 ?? (new)   34  M (modified)   6  D (deleted)
= 80 files
```

---

## Commit 顺序逻辑

依赖链：
```
1. Migration + Schema      ← 基础
2. Persona Types           ← Learning + UI 依赖
3. Learning Module (新)    ← 核心新功能
4. Persona 学院重构        ← 重大重构
5. 新页面 (atlas/tandem/…) ← 拓展面
6. Mobile UI 调整 + 杂项   ← 表层调整
7. 删除被替代的旧文件      ← 清理
8. 战略文档                ← 独立, 最后
```

---

## Commit 1 · Migration 0004 + Schema · Learning 表族

```powershell
git add drizzle/migrations/0004_normal_champions.sql
git add drizzle/migrations/meta/0004_snapshot.json
git add drizzle/migrations/meta/_journal.json
git add lib/infra/drizzle-schema.ts
git add lib/storage/repository.ts
git add lib/storage/memory-store.ts
git add lib/storage/drizzle-store.ts

git commit -m "feat(db): migration 0004 · Learning 表族 (8 张表) + Repository 接入

§ACADEMY-METAPHOR 学院化的数据基础:

新增 8 张表:
- Course / Lesson / Question        : 课程内容三件套
- Enrollment / LessonAttempt        : 学员学习状态
- Certification                     : 结业证 + 解锁权限/熟练度
- CourseAssignment                  : 指派 (个人/部门/角色)
- LearningMcpToken                  : 学院 MCP 网关 token

drizzle-schema.ts + repository.ts + 两个 store 实现同步接入.
索引覆盖: userId×status, courseId×status, tenantId, slug×tenant 唯一."
```

---

## Commit 2 · Persona 类型升级 · 学院化所需的字段

```powershell
git add lib/types/persona.ts
git add lib/persona/stage-meta.ts
git add lib/persona/maturity.ts
git add lib/persona/skill-modes.ts
git add lib/persona/compose-prompt.ts
git add tests/unit/stage-meta.test.ts
git add tests/unit/compose-prompt.test.ts

git commit -m "feat(persona): 学院化阶段/熟练度/技能模式 + compose-prompt 编排

- stage-meta.ts: Persona 阶段元数据 (新生/见习/胜任/精进/独立/导师)
- maturity.ts: 熟练度计算 + 阶段升级判定
- skill-modes.ts: 技能模式 (lecture/practice/decision/reflection)
- compose-prompt.ts: 动态拼接 Persona system prompt
- 单测: stage-meta + compose-prompt 共 +10 case"
```

---

## Commit 3 · Learning 模块完整闭环 (新功能)

```powershell
git add lib/learning/
git add lib/services/academy-service.ts
git add app/api/learning/
git add app/learning/
git add components/learning/
git add tests/unit/learning-closure.test.ts

git commit -m "feat(learning): 学院模块完整闭环 · 课程/课时/答题/证书

§ACADEMY-METAPHOR 落地:

- lib/learning/enrollment.ts     : 选课/指派/状态机
- lib/learning/closure.ts        : 学习闭环 (LessonAttempt → 解锁 KR/熟练度/委托等级)
- lib/services/academy-service.ts: 跨模块编排服务
- /api/learning/complete         : 完成课时回调 → 触发 closure
- /learning + /learning/lesson/[id]: 学员视角
- components/learning/LessonViewer.tsx: 课时内容组件
- tests: learning-closure 单测 +10 case"
```

---

## Commit 4 · Persona 学院重构 · Tab 系统 + Dashboard 改写

```powershell
git add components/persona/CourseTabs.tsx
git add components/persona/StudentCard.tsx
git add components/persona/TodayTab.tsx
git add components/persona/ArchiveTab.tsx
git add components/persona/PrivacyFooter.tsx
git add components/persona/StageProgressDashboard.tsx
git add components/persona/UpgradeProposalBanner.tsx
git add app/persona/page.tsx
git add app/persona/evolution/page.tsx
git add app/persona/data-source/
git add app/persona/delegation/
git add app/persona/profile/

git commit -m "refactor(persona): 重构成学院 Tab 系统 · 替代旧 PersonaDashboard

§ACADEMY-METAPHOR 第一人称重构:

新 Tab 体系 (/persona):
- StudentCard       : 学员卡片 (姓名/阶段/进度/熟练度)
- CourseTabs        : Tab 容器
- TodayTab          : 今日待办 (当前课程 + 复习提醒)
- ArchiveTab        : 档案 (已学课程/证书)
- PrivacyFooter     : 隐私声明 (数据 only employee)
- StageProgressDashboard / UpgradeProposalBanner (M)

新子页:
- /persona/data-source : 数据来源透明化
- /persona/delegation  : 委托等级管理
- /persona/profile     : 学员档案

PersonaDashboard.tsx 已被替代, 由 Commit 7 清理."
```

---

## Commit 5 · 新页面 · atlas / tandem / summon / retros / portfolio + lib 基础

```powershell
git add app/atlas/
git add app/tandem/
git add app/summon/
git add app/retros/
git add app/portfolio/
git add lib/decision-layer/
git add lib/mcp/
git add lib/skill-gateway/
git add components/placeholder-page.tsx

git commit -m "feat(platform): 新 5 页面 + Decision Layer / MCP / Skill Gateway 底座

新页面:
- /atlas      : 平台地图 (替代 /dashboard)
- /tandem     : 主入口聚合
- /summon     : Persona 召唤
- /retros     : 复盘存档
- /portfolio  : 个人成果集

新 lib (V2 底座):
- lib/decision-layer/  : 议事决策层抽象
- lib/mcp/             : MCP 协议实现
- lib/skill-gateway/   : Skill Gateway 4 道闸 (§B-017)

components/placeholder-page.tsx: 未实现页面占位组件"
```

---

## Commit 6 · Mobile UI 调整 + 杂项 (M 文件群)

```powershell
git add app/page.tsx
git add app/chat/page.tsx
git add app/convergence/page.tsx
git add app/im/page.tsx
git add app/okr/page.tsx
git add app/report/page.tsx
git add app/globals.css
git add components/api-hydrator.tsx
git add components/mobile-drawer.tsx
git add components/nav-modules.ts
git add lib/design-tokens.ts
git add lib/audit/log.ts
git add lib/checkin/auto-draft.ts
git add lib/convergence/decision-engine.ts
git add lib/convergence/orchestrator.ts
git add lib/im/service.ts
git add lib/types/decision-card.ts
git add tests/unit/decision-card.test.ts

git commit -m "chore(ui+lib): Mobile UI 调整 + 杂项 lib 修正

UI:
- /im /okr /convergence /report /chat /page 手机端布局微调
- mobile-drawer + nav-modules 同步新模块入口
- globals.css + design-tokens 色板/字号统一

Lib:
- audit/log.ts        : 新增 learning.* 系列 action
- checkin/auto-draft  : 接入新 Persona 阶段
- convergence/*       : decision-engine + orchestrator 小修
- im/service          : aiTraceId 字段透传
- types/decision-card : 字段补全
- tests/decision-card : 用例同步"
```

---

## Commit 7 · 清理被替代的旧文件

```powershell
git rm app/admin/skills/page.tsx
git rm app/dashboard/page.tsx
git rm app/decision-card/page.tsx
git rm 'app/decision-card/[id]/page.tsx'
git rm components/persona/PersonaDashboard.tsx
git rm components/sidebar.tsx

git commit -m "chore(cleanup): 删除被替代的旧实现 (skills/dashboard/decision-card/sidebar)

替代关系:
- /dashboard               → /atlas (Commit 5)
- /decision-card           → 议事室融合 (/convergence/[id])
- /admin/skills            → 待重写, 暂去
- components/sidebar       → components/mobile-drawer + nav-modules
- components/persona/PersonaDashboard → CourseTabs + StudentCard (Commit 4)"
```

---

## Commit 8 · 战略文档 (16 个 md)

```powershell
# 已修改
git add docs/AGENT-FRAMEWORK.md
git add docs/MANIFESTO.md
git add docs/MEETING-PROXY.md
git add docs/PERSONA-EVOLUTION.md
git add docs/PITCH-DECK.md
git add docs/USER-GUIDE.md

# 新增
git add docs/ACADEMY-METAPHOR-2026-05-29.md
git add docs/CHARTER-UI-V1.md
git add docs/DEAD-CODE-AUDIT-2026-05-29.md
git add docs/EVOLUTION-ROADMAP-2026-05-28.md
git add docs/EVOLUTION-STATUS-2026-05-28.md
git add docs/IMPL-NOTES-2026-05-29.md
git add docs/OPTIMIZATION-PLAN-2026-05-28.md
git add docs/OPTIMIZATION-PLAN-2026-05-28-CROSSCHECK.md
git add docs/PLATFORM-ARCHITECTURE-2026-05-29.md

git commit -m "docs: 学院隐喻 + 优化计划 + 演化路线图 (16 份战略文档)

新增 9 份:
- ACADEMY-METAPHOR-2026-05-29       : 学院隐喻总章 (核心方向)
- PLATFORM-ARCHITECTURE-2026-05-29  : 平台架构 v2
- CHARTER-UI-V1                     : UI 宪章 v1
- EVOLUTION-ROADMAP-2026-05-28      : 演化路线图
- EVOLUTION-STATUS-2026-05-28       : 演化现状
- OPTIMIZATION-PLAN-2026-05-28      : 优化计划
- OPTIMIZATION-PLAN-2026-05-28-CROSSCHECK : 交叉验证版
- IMPL-NOTES-2026-05-29             : 实施笔记
- DEAD-CODE-AUDIT-2026-05-29        : 死代码审计

修订 6 份:
- MANIFESTO (33KB)                  : 总章融入学院隐喻
- AGENT-FRAMEWORK / MEETING-PROXY / PERSONA-EVOLUTION / PITCH-DECK / USER-GUIDE
"
```

---

## 验证（每 commit 后建议）

```powershell
# 单关
npx tsc --noEmit                          # 0 errors 才往下
npx vitest run --silent | Select-Object -Last 3  # 188/188 才往下

# 完整四关 (最后一次)
npx tsc --noEmit
npx vitest run
npx next lint --max-warnings=0
npm run build
```

---

## 最终 push 前安检

```powershell
# 1. 看 commit 历史
git log --oneline -10

# 2. 扫密钥泄漏
git diff origin/main..HEAD | Select-String "sk-[a-zA-Z0-9]{20,}|AKIA[A-Z0-9]{16}|ghp_[a-zA-Z0-9]{36}"
# 应该没命中

# 3. 看 .env / .env.local / .env.local.bak 不在 staged
git log origin/main..HEAD --stat | Select-String "\.env"
# 只允许 .env.example / .env.production.example

# 4. push
git push origin main
```

---

## 一键执行（如果你完全信任此分类，跳过 review）

> **不推荐**。建议你至少把 Commit 1+2 跑完确认全绿，再批量跑 3-8。

```powershell
# 在仓库根目录
$ErrorActionPreference = 'Stop'
cd e:\Hermes

# Commit 1-8 按顺序跑
# (复制上面 8 个 commit 块)
```

---

## 如果某条 commit 失败

```powershell
# 看错误
git status

# 回退 staged
git reset HEAD

# 重新拣选
git add <files>
git commit -m "..."
```

---

## 完成后

总共 **+8 commits**（已合并到现有的 21 commits 历史）。可视化：

```powershell
git log --oneline --all -15
```

应该看到：
```
xxxxxxx docs: 学院隐喻 + 优化计划 + 演化路线图 (16 份战略文档)
xxxxxxx chore(cleanup): 删除被替代的旧实现
xxxxxxx chore(ui+lib): Mobile UI 调整 + 杂项 lib 修正
xxxxxxx feat(platform): 新 5 页面 + Decision Layer / MCP / Skill Gateway 底座
xxxxxxx refactor(persona): 重构成学院 Tab 系统
xxxxxxx feat(learning): 学院模块完整闭环
xxxxxxx feat(persona): 学院化阶段/熟练度/技能模式
xxxxxxx feat(db): migration 0004 · Learning 表族
f9350fd feat(mobile+desktop+db): Kimi/GPT 风手机端 + Tauri 桌面瘦客户端 + DB 完整性修复
...
```

然后 → push → 按 `DEPLOY-CHECKLIST.md` 部署。
