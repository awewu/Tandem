# `lib/store.ts` 拆 slice 备忘 (P1b)

**status**: 仅分析, 不在本会话动代码 (高风险, 38 文件 import, 单会话改完风险大于收益).
**owner**: 下一会话单独立项 (1-2 天专门做).
**date**: 2026-05-31

---

## 现状

- **大小**: 2331 行, 78.6 KB, 单文件
- **importer**: 38 个 (app/* 22, components/* 14, lib/* 2)
- **8 个 region 共存** (用 `// #region N` 注释, 但仍在同一文件):

| # | region                  | 主要导出                                              | 行数 (估) |
| - | ----------------------- | ----------------------------------------------------- | --------- |
| 1 | Chat / Agent / Task     | `useChatStore` `useAgentStore` `useTaskStore` `PROVIDER_PRESETS` `PRESET_AGENTS` | ~575      |
| 2 | Knowledge               | `useKnowledgeStore` `KNode`                           | ~98       |
| 3 | 三省六部 (Org/Gov)      | `useOrgStore` (Phase 1 fixture, Phase 2 已迁 API)      | ~38       |
| 4 | OKR (UI layer)          | `useOKRStore` + 大量 OKR types (`Cycle/Person/Objective/KeyResult/CheckIn/Initiative/OKRComment/OKRActivity`) | ~898      |
| 5 | App (theme/UI prefs)    | `useAppStore` `ThemeMode`                             | ~22       |
| 6 | Memory (UI simplified)  | `useMemoryStore` `Memory`                             | ~200      |
| 7 | OneOnOne (UI layer)     | `useOneOnOneStore` + 一堆 1on1 types                  | ~258      |
| 8 | Review360 (UI layer)    | `useReview360Store` + 一堆 360 types                  | ~180      |

最大压力来自 region 4 (OKR ~900 行) 和 region 1 (Chat/Agent ~575 行, 含 250+ 行的 `PROVIDER_PRESETS` 和 200+ 行 `PRESET_AGENTS` 字面量).

---

## 痛点

1. **变更耦合**: 改 OKR 行为也要 reload 整个 store 模块, hot reload 慢, persist key 全局共用 (zustand `persist` 中间件已分别配 key, 这一点其实 OK).
2. **认知负担**: 一个文件 8 套 zustand, 跨 region 找 selector 慢.
3. **Tree-shake 边际**: 客户端 bundle 里 `useOneOnOneStore` 跟 `useChatStore` 永远一起进 (即使页面只用一个), 因为 ESM tree-shake 对 zustand `create()` 顶层调用不友好 (有副作用).
4. **diff 噪声**: PR 改一处 OKR 字段, diff 出现在 2300 行的文件中段, review 体验差.

---

## 拆 slice 方案 (建议下个会话执行)

### 目标布局

```text
lib/store/
├── index.ts                # 仅 re-export, 保持 `import { useXStore } from '@/lib/store'` 兼容
├── chat.ts                 # region 1 (Chat / Agent / Task) — 拆完最大收益
├── presets.ts              # PROVIDER_PRESETS + PRESET_AGENTS (纯数据, 无 store)
├── knowledge.ts            # region 2
├── org.ts                  # region 3 (浅层 fixture, 后续整体撤掉迁 API)
├── okr.ts                  # region 4
├── app.ts                  # region 5
├── memory-ui.ts            # region 6 (注意区分 lib/memory 治理层)
├── one-on-one.ts           # region 7
└── review-360.ts           # region 8
```

`lib/store.ts` 改为 1 行 `export * from './store/index';` (临时), 一个 release 后删除.

### 兼容策略

- **第 1 步 (机械拆分, 0 风险)**: 把 region 内容原样剪到对应 `lib/store/<name>.ts`, **不改任何字段/函数**, 仅加 import 和 export. 文件首尾包 `// #region` 注释保留 (作 grep anchor).
- **第 2 步 (re-export 桥)**: `lib/store/index.ts` 重导出全部公开符号. 38 个 importer 不变.
- **第 3 步 (类型分家)**: OKR / 1on1 / 360 region 里的 type interface 已在 `lib/types/*` 有服务端版本. 客户端 store 里的 type 改成 `import type { ... } from '@/lib/types/...'`, 删除重复定义 (要核对字段对齐, 这一步最容易出 bug).
- **第 4 步 (importer 直接走 slice)**: 新写代码用 `from '@/lib/store/chat'` 而不是 `'@/lib/store'`. 老代码留兼容. 一个 release 后批量 codemod.
- **第 5 步 (删除 `lib/store.ts`)**: 跑 `git grep "from '@/lib/store'"` 确认 0 命中后删除桥文件.

### 验证 checklist (执行时必跑)

- [ ] `npx tsc --noEmit` 0 error
- [ ] `npx vitest run` 0 fail (现有 59 个 test)
- [ ] `npm run build` 通过
- [ ] localStorage persist key 跟拆分前完全一致 (不能改名, 否则用户老数据丢):
  - chat-store / agent-store / task-store / knowledge-store / app-store / okr-store / memory-store / 1on1-store / 360-store
- [ ] 跑 dev mode 手动验证: 议事/OKR/1on1/360 各打开一次, hot reload OK
- [ ] e2e smoke (`npx playwright test tests/e2e/smoke.spec.ts`) 通过

### 风险评估

| 风险                                | 概率 | 影响 | 缓解                                  |
| ----------------------------------- | ---- | ---- | ------------------------------------- |
| persist key 漂移 → 用户老数据丢失   | 低   | 高   | 步骤 1 严格机械搬运, 不改 `persist({ name })` |
| 类型冲突 (region 间共享类型断链)    | 中   | 中   | 先全留在 store/index.ts re-export, 后续慢慢提炼 |
| 循环引用 (slice 互相 import)        | 中   | 中   | 拆完跑 `madge --circular lib/store/`  |
| 38 个 importer 路径变更             | 低   | 低   | 桥文件保留 1 个 release, 给 codemod 时间 |

### 工作量预估

- 第 1+2 步 (机械拆分 + 桥): 2-3 小时
- 第 3 步 (类型分家): 2-3 小时 (需对 OKR / 1on1 / 360 server-client 字段细对)
- 第 4 步 (importer 迁移): 1 小时 (codemod)
- 第 5 步 (删桥): 0.5 小时

**总计 6-8 小时, 单人单会话可完成, 但需要专门会话** (本会话已经完成 manifesto + event bus + eval harness, 再叠拆 store 会让 commit 太杂, review 难).

---

## 不做哪些事 (本备忘范围外)

- ❌ 不重写 zustand 为 Jotai/Redux/...
- ❌ 不改 persist storage backend (依然 localStorage)
- ❌ 不动 store 内的业务逻辑 (selector / setter 行为不变)
- ❌ 不优化 PROVIDER_PRESETS / PRESET_AGENTS 字面量 (它们是 SSOT, 改要走单独 PR)

---

## 决策

下次启动 store 拆分会话时, **必须** 先 read 本备忘, 严格按 5 步走. 任何走捷径合并步骤的尝试都视为返工风险.
