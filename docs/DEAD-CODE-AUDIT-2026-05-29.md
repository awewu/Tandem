# Dead Code Audit · 2026-05-29

**范围**: app/ 路由 + components/ + lib/ 顶层
**方法**: 引用图扫描 (grep import / Link href / router.push)
**已执行清理**: A1 ApiHydrator banner + A2 approveCheckIn 空函数 (本次会话头部已删)

---

## 第 1 档 · 确认死代码 (0 引用, 可安全删)

### 1.1 components/sidebar.tsx (10 KB)

```
@e:\Hermes\components\sidebar.tsx:1-300
```

**证据**:
- `grep "from ['\"]@/components/sidebar['\"]"` 全工程返回 0 匹配
- `app/layout.tsx` 用的是 `AppRail` + `SubSidebar`, 不是 `Sidebar`
- 最后修改 2026-05-27, 但已被新 AppRail 架构取代

**影响**: 删除可减少 ~10 KB 源码, 减少 nav 入口与 nav-modules.ts 的混淆
**建议**: ✅ 直接删

### 1.2 lib/checkin/auto-draft.ts 的 approveCheckIn (已删)

本次会话已清理. ✅ Done

### 1.3 ApiHydrator banner (已删)

本次会话已清理. ✅ Done

---

## 第 2 档 · 高度可疑死路由 (无任何 link / router.push 引入)

### 2.1 /dashboard (app/dashboard/page.tsx)

**证据**:
- nav-modules.ts ❌ 无引用
- sidebar.tsx (即将删) ❌ 无引用
- 全工程 `grep "/dashboard"` 在 app/tsx + components/tsx 范围内 0 匹配
  (注: `okr/dashboard`、`admin/kpi/health-dashboard` 不同路径, 不冲突)

**建议**: 🟡 删之前确认: 是否有书签 / 第三方文档引用？默认建议删

### 2.2 /decision-card + /decision-card/[id]

**证据**:
- 已被 `/convergence` (议事室) 全面取代
- 全工程 0 link/router 引用
- 仅自己内部 link 自己

**建议**: 🟡 删 (与 /convergence 重复)

### 2.3 /admin/skills

**证据**:
- 与 `/admin/tandem-skills` 名字相似, 推测是早期遗留
- 全工程 0 引用 (nav 引用的是 `/admin/tandem-skills`)

**建议**: 🟡 删

### 2.4 /admin/company-brain, /admin/governance/okr-drift

**证据**: 全工程 0 引用

**建议**: 🟡 这两个**功能上有价值** (Steward 治理后台), 应该补 nav 入口 (admin/launchpad 加 link) 而不是删. 这是"功能孤儿", 不是死代码.

### 2.5 /bitable, /bitable/[id]

**证据**:
- nav-modules.ts ❌ 无引用
- 仅 [id] ↔ list 互相 link
- 无外部入口

**建议**: 🟡 决策依赖产品判断 — bitable 是否仍在路线图? 是 → 补 nav 入口; 否 → 删

### 2.6 /okr/calendar, /okr/cascade

**证据**:
- nav-modules.ts ❌ 无引用
- 只在 **即将删的 sidebar.tsx** 和 `components/animated-hero.tsx` 中被引用

**建议**: 🟡 如果删 sidebar.tsx, /okr/cascade 仅剩 animated-hero 一个入口 (首页). 建议:
- 把这两个路由加入 nav-modules 的「事半」组, 或
- 整合到 `/okr` 主页 tab

---

## 第 3 档 · placeholder/未接入脚手架 (保留但要标识)

### lib/integrations/* (7 个文件)

| 文件 | 体量 | 当前 import 数 |
|---|---|---|
| `calcom.ts` | ? | 0 |
| `email-tier1.ts` | ? | 0 |
| `email-tier2.ts` | ? | 0 |
| `minio.ts` | ? | 0 |
| `rocketchat.ts` | ? | 0 |
| `univer.ts` | ? | 0 |
| `yjs-tiptap.ts` | ? | 0 |

**性质判断**: 全部是"启用步骤"说明文档型 stub, 不是真死代码 (是未来接入的脚手架)

**建议**: 🟢 保留. 但应该:
- 在每个文件头明确标 `@status stub` JSDoc tag
- README/路线图记录"何时启用"
- 不要让初次接触代码的人误以为这些在用

---

## 第 4 档 · @deprecated 但仍被使用 (需要迁移再删)

### 4.1 `validateKrBinding` (lib/types/decision-card.ts:178-179)

**调用方** (3 处):
- `@e:\Hermes\app\convergence\page.tsx:18-84` (运行时使用)
- `@e:\Hermes\tests\unit\decision-card.test.ts:4` (测试)
- `@e:\Hermes\lib\convergence\orchestrator.ts:65` (仅注释)

**迁移**: 改 import 名为 `validateOkrAnchor` → 删 alias 行

### 4.2 `TTI` interface (lib/types/okr-tti.ts:127)

**已 @deprecated 2026-05-20**, CHARTER-KPI-TTI §6.1 明确替代方案为 `Objective(level:'individual') + KeyResult`

**调用方**: 需进一步扫描 (我本次会话未做)

**建议**: 🟡 单独排期 — TTI 是个概念性大重构, 不是简单 rename

### 4.3 `LegacyOKR` (lib/store.ts:959-963)

**性质**: v1→v2 持久化 migration 用, **不是死代码**, 是 schema 迁移路径

**建议**: 🟢 保留. 可以在头部加注释说明"v3 schema 发布后才能删, 需考虑老版本 localStorage 用户"

---

## 第 5 档 · 我本次会话新增的 mock / stub (开发期标识)

| 文件 | 性质 | P6 何时替换 |
|---|---|---|
| `components/persona/PersonaBrief.tsx` MOCK_BRIEF_ITEMS | UI 占位 | P1 真聚合时 (1-2 天) |
| `lib/persona/maturity.ts` getMockProficiencies | UI 占位 | P3 接 store 时 (2 天) |
| `lib/learning/fixtures.ts` | UI 占位 | P2 接真 lesson store (3-5 天) |
| `app/api/learning/generate/route.ts` stub 响应 | API 占位 | P2 接真 LLM (3-5 天) |
| `lib/decision-layer/three-plus-one-engine.ts` StubMemoryRetriever | 测试用 | 长期保留 (单元测试需要) |

**性质**: 全部不是死代码, 是 P0-P5 骨架的明示占位. UI 上已显示「P1/P2 MVP · mock 数据」徽标

---

## 立刻可执行的清理动作

### Quick Wins (~10 分钟, 0 风险)

1. ✅ 删 ApiHydrator banner (本会话已完成)
2. ✅ 删 approveCheckIn 空函数 (本会话已完成)
3. ⏳ 删 `components/sidebar.tsx` (10 KB, 全工程 0 引用)

### 中等清理 (~30 分钟)

4. ⏳ 删 `/dashboard` 路由
5. ⏳ 删 `/decision-card` + `/decision-card/[id]`
6. ⏳ 删 `/admin/skills` (与 /admin/tandem-skills 重复)
7. ⏳ `validateKrBinding` → `validateOkrAnchor` 全工程改名后删 alias

### 需要产品决策 (不立即做)

- `/bitable` 是否在路线图?
- `/admin/company-brain` + `/admin/governance/okr-drift` 怎么挂 nav (这两个**不是死代码, 是功能孤儿**)
- `/okr/calendar` `/okr/cascade` 整合到 `/okr` 还是补 nav?
- `TTI` interface 重构排期

### 单独排期 (大工程)

- TTI → Objective+KeyResult 合并 (CHARTER-KPI-TTI §6.1)
- `lib/integrations/*` 各 stub 接入计划

---

## 估算

| 类别 | 工时 | 减少 LoC |
|---|---|---|
| Quick Wins 1-3 | 10 分钟 | ~350 行 |
| 中等清理 4-7 | 30 分钟 | ~600 行 |
| 产品决策项 | 取决于决策 | — |
| 单独排期 | 数天-数周 | — |

**本档可立刻交付**: Quick Wins + 中等清理 = ~40 分钟, ~950 行死代码减少
