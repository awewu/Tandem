# Session Requirements Log — Tandem / Hermes

> 本文档记录 Owner 在 AI 编程会话中给出的所有输入要求，按时间轴排列。
> 由 AI 根据会话记录整理，每次新会话后人工或 AI 追加。

---

## 格式说明

```
### [日期 时区] 要求描述
- **输入原文**: 用户原话
- **意图**: 解读
- **执行结果**: 已落地 / 未落地 / 部分落地
- **对应 commit / 文件**: 关联代码
```

---

## 2026-06-15 (UTC-7 / 北京时间 2026-06-16)

---

### 2026-06-15 ~17:00 PDT  按依赖序推进 7 个任务

- **输入原文**: "按依赖序排好任务，开始逐一实现。0 / 7 tasks done …（含学院 API、LessonViewer、LaunchpadSection 空白、S2 接线、B-015、B-025 等清单）"
- **意图**: 按优先级顺序自动推进多个积压功能，不需要逐一确认
- **执行结果**: ✅ 全部落地
- **落地清单**:
  - `app/learning/page.tsx` — 从 FIXTURE_LESSONS 改为 fetch `/api/learning/lessons` 真 API，加 loading 骨架态
  - `components/learning/LessonViewer.tsx` — 优先渲染 `lesson.contentMarkdown`，内置轻量 Markdown 解析（无新依赖）
  - `app/page.tsx` — LaunchpadSection fetch 加 `credentials: 'include'`（根本原因：cookie 未带 → 401 → 空跳板）
  - `app/api/learning/lessons/route.ts` + `app/api/learning/lessons/[id]/route.ts` — 新建 CRUD API
  - S2 接线状态确认（IM + BossAI 已接线，ROADMAP 标记更新）
  - B-015 OKR Drift 三色判定 + zone 字段 + 模块级 cache + `invalidateOkrDriftCache()` 导出
  - UI Charter 违规修复（`rounded-xl` → `rounded-2xl`，`text-sm` → `text-footnote`）
- **对应 commit**: `da60e64` — "fix: LaunchpadSection blank + 学院 API + LessonViewer markdown + charter fixes"

---

### 2026-06-15 ~17:20 PDT  Palantir Ontology/AIP 竞品研究

- **输入原文**: "学习 Palantir 的 Ontology 产品方法路和 AIP 逻辑，看看对我们的产品进化有哪些启发"
- **意图**: 对标分析，产出可落地的技术启发
- **执行结果**: ✅ 输出深度分析报告（未写入文件，在对话中）
- **核心结论**:
  1. ObjectTypeRegistry — 把实体显式注册（Palantir #1）
  2. 事件驱动 OKR 基线刷新 — CDC 替代纯 TTL（Palantir #2）
  3. per-skill AIP Evals MVP — 聚合 adopted/overruled 率（Palantir #3）

---

### 2026-06-15 ~17:30 PDT  推进 Palantir 三项进化

- **输入原文**: "同意 推进进化"
- **意图**: 立即实现上述三项
- **执行结果**: ✅ 全部落地，1040/1040 测试通过
- **落地清单**:
  - `lib/ontology/object-types.ts` — 新增 `DecisionCardType` / `PersonaType` / `KpiType` / `MemoryEntryType` 四个 ObjectType，共 7 个实体注册到 ontology 单例
  - `lib/governance/okr-drift.ts` — 模块级 5min TTL cache（key=tenantId，含 cycleId 验证），`invalidateOkrDriftCache()` 导出，`OkrDriftDecision.zone` 字段（green/yellow/red/no_okr），三色阈值 0.28/0.15
  - `lib/events/subscribers.ts` — `okr.objective-rolled-up` 订阅 → `invalidateOkrDriftCache()` 即时刷新
  - `app/api/admin/skill-evals/route.ts` — per-scenario 聚合 API（adoptedRate/overruledRate/avgLatencyMs/models，90天滑动窗口）
  - `tests/unit/okr-drift.test.ts` — 加 `invalidateOkrDriftCache()` 测试隔离修复
- **对应 commit**: 未单独 commit（含在后续）

---

### 2026-06-15 ~17:45 PDT  综合评价产品

- **输入原文**: "综合总结和评价我们的产品看看还有哪些遗憾"
- **意图**: 全面盘点现状，找出最高杠杆的缺口
- **执行结果**: ✅ 输出评价报告（对话中）
- **关键结论**:
  - 架构先进性 10/10，商业可用度 2/10 — 极端剪刀差
  - 致命级遗憾：G1(内存数据无持久化) / G2(无 Docker) / G3(无 e2e)
  - 架构级遗憾：G4(26处 router.chat 旁路) / G5(签批硬编码) / G6(data scope stub) / G7(OKR批量占位) / G8(B-025战略引擎0行)
  - 产品级遗憾：G9(外部用户 hub) / G10(主管/老板 dashboard) / G11(WeChat登录stub) / G12(邮件存证0行)

---

### 2026-06-15 ~18:00 PDT  推进优先级修复

- **输入原文**: "推进"
- **意图**: 按评价报告的优先级依次落地 G4 → G5 → G8 → G3
- **执行结果**: ✅ 全部落地，1050/1050 测试通过
- **落地清单**:

  **G4 — ESLint no-direct-router-chat**
  - `.eslintrc.json` — `no-restricted-syntax` warn 规则，基础设施层豁免 overrides
  - 9 处业务层旁路各加 `// eslint-disable-next-line` + 迁移原因注释（migration debt 可跟踪）

  **G5 — deriveSigningAuthority()**
  - `lib/governance/signing-authority.ts` — 从 GovernanceTemplate 职能司 agents[] 派生签批角色
    - 门下省(pillar='review') → team_leader / dept_leader
    - 中书省(pillar='decision') → ceo + clevel（仅 company 级）
    - stewards 表 → steward（全级别）
    - legacy fallback（demo-user 全角色；普通用户 []）
  - `app/api/me/dashboard/route.ts` — `resolveMyRoles` 替换为按每条 promotion.level 动态派生
  - `tests/unit/signing-authority.test.ts` — 6 单测，覆盖四条路径

  **G8 — B-025 战略引擎 realignPersonaToOkr**
  - `lib/events/bus.ts` — 新增 `okr.cycle-activated` 事件
  - `lib/persona/strategy-engine.ts` — `realignPersonaToOkr(tenantId)` 遍历全员 Persona，重对齐 enabledSkills；fail-soft + 幂等
  - `app/api/okr/cycles/[id]/activate/route.ts` — POST 激活周期 → emit `okr.cycle-activated`
  - `lib/events/subscribers.ts` — 订阅 → 异步调 `realignPersonaToOkr`
  - `tests/unit/strategy-engine.test.ts` — 4 单测（assistant+销售OKR解锁/newborn无扩展/无active cycle/幂等）

  **G3 — Playwright e2e 核心场景骨架**
  - `tests/e2e/okr-checkin.spec.ts` — KR check-in 完整流 + rollup 副作用验证
  - `tests/e2e/convergence.spec.ts` — 议题创建/查询/列表/页面冒烟
  - `tests/e2e/governance.spec.ts` — Memory Promotion 签批链路 + cycle activate + dashboard 字段

---

### 2026-06-15 ~18:30 PDT  打开浏览器预览

- **输入原文**: "打开"
- **意图**: 开启 dev server 的浏览器预览
- **执行结果**: ✅ 确认 port 3000 已运行（PID 31764），开启 browser_preview

---

### 2026-06-15 ~19:00 PDT  快速跳板设置

- **输入原文**: "我让你更新的快速跳板设置没有做吗"
- **意图**: 指某次会话中提到过的跳板配置需求
- **执行结果**: ❓ **未找到出处** — 当前会话无相关指令；checkpoint 摘要亦无记录
- **状态**: **待澄清** — 请在下次会话中补充具体需求描述
- **现状**: 首页 LaunchpadSection 已有"管理"链接 → `/admin/launchpad`；后端 CRUD 完整；seed 数据预置于 `seedLaunchpadIfEmpty`

---

### 2026-06-15 ~19:10 PDT  查找昨天沟通记录

- **输入原文**: "查找哦昨天和你的沟通记录"
- **意图**: 找到之前会话里的遗漏需求
- **执行结果**: ❌ **无法执行** — AI 无跨会话记忆，每次会话独立

---

### 2026-06-15 ~19:14 PDT  构建需求时间轴文档

- **输入原文**: "构建一个独立文档。记录所有我给你的输入要求。包括时间轴"
- **意图**: 建立持久化的需求记录，解决跨会话遗忘问题
- **执行结果**: ✅ 本文档 `docs/SESSION-REQUIREMENTS-LOG.md`

---

## 使用说明

- 每次新会话开始时，把未落地项（❓/❌）贴给 AI 作为上下文
- 每次会话结束后，AI 或 Owner 在本文档末尾追加新一节
- 格式：`## YYYY-MM-DD (UTC-7 / 北京时间 YYYY-MM-DD+1)`

---

## 未落地 / 待澄清 事项

| 编号 | 需求 | 状态 | 来源 |
|------|------|------|------|
| P1 | 快速跳板设置（具体内容未知） | ❓ 待澄清 | 2026-06-15 口述 |
| G1 | Drizzle PG 全链路验证（内存→持久化） | ❌ 未动 | 评价报告 |
| G2 | Dockerfile + docker-compose.prod.yml | ❌ 未动 | 评价报告 |
| G6 | 闸 ③ Data Scope（不再是 stub） | ❌ 未动 | 评价报告 |
| G9 | 外部用户专属 hub（/hub 落地页） | ❌ 未动 | 评价报告 |
| G10 | 主管/老板层 Dashboard（KR红绿灯/全公司OKR树） | ❌ 未动 | 评价报告 |
| G11 | WeChat 登录（getWechatProvider 实现） | ❌ 未动 | 评价报告 |
| G12 | 邮件存证回路 | ❌ 未动 | 评价报告 |
