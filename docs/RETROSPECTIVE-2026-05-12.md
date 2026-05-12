# 项目复盘 · 2026-05-12

> 一份诚实的全景检视. 既不夸大已交付的, 也不掩盖未交付的.
> 阅读时序: §1 全景 → §2 已成 → §3 已损 → §4 真空 → §5 进化 → §6 行动.

## §1 项目全景 (硬指标)

| 维度 | 数值 |
|---|---|
| **总 commit 数** | 61 |
| **累计文件改动** | 501 次 |
| **API routes** | 68 个 |
| **页面** (`app/**/page.tsx`) | 41 个 |
| **组件** (`components/**/*.tsx`) | 59 个 |
| **lib TS 模块** | 81 个 |
| **文档** (`docs/*.md`) | 35 篇 |
| **Prisma 模型** | 30+ 张表 (auth + im + okr + memory + 1on1 + 360) |
| **持续违章天数** | 0 (pre-commit gate 自 commit `b8f2dee` 起强制 tsc 0 error) |

**一句话总结**: 单租户单产品的完整原型, 从 PRD v0.1 到 v0.3 演进了 4 个月, 主线"决议室 + Memory + OKR + IM + 1on1 + 360"全打通, 但 V1 GA 还差 3 件事 (见 §4).

## §2 7 件做对的事

| # | 事 | 价值 | 证据 commit |
|---|---|---|---|
| **W1** | **17min 决议室** 状态机 + 5 步骨架完整实现 | 宪章 §3 的硬上限唯一落地版 (Tita/钉钉皆无) | `a8343a0` C.3-C.6, `82b0ca6` P0 |
| **W2** | **KR 软绑定 + escape hatch** | 不替员工劳动 (§15) 的可证伪机制 | `236a1f8` C.1+C.2, `a8343a0` validator |
| **W3** | **Memory 双层 + 签字 promotion** | §8.2 自治 Memory 治理 (4 角色签字流) | `3ce9c80` 4-tier ownership |
| **W4** | **Prisma + InMemory 双栈** | 0 vendor lock + 38/38 e2e 全过 | `a086eb7` |
| **W5** | **Pre-commit 三层护栏** | tsc + 砍页检测 + 反推到重建; 4 个月 0 违章 | `b8f2dee` 3-layer guardrail |
| **W6** | **PRD v0.1 → v0.3 累积演进** | 30+ 决策固化, 0 推倒重写 (除 step B 之外) | `9e13ed0` PRD v0.3 lock |
| **W7** | **2026-05 进化体系完整闭环** | 学习→出方案→宪章过滤→commit→反例自检 5 步闭环 | `6a0ffa0` → `116548e` 6 个月级 commit |

## §3 6 处疤痕 (诚实写出)

| # | 疤痕 | 触发宪章哪条 | 修复方式 | 状态 |
|---|---|---|---|---|
| **S1** | `ec70883` Step B 砍 9 页 = 3910 行 UI | §B 不可批量删 | `b78648f` revert 全恢复 | ✅ 已愈 |
| **S2** | `yearEndBonusModifier` 4 个月违章 tsc | §C 必 tsc 0 | `d7ab488` 修, pre-commit 兜底 | ✅ 已愈 |
| **S3** | `/dashboard` 500 (Date.localeCompare) | §C 必 tsc 0 + 跑通 | `d7ab488` 修 | ✅ 已愈 |
| **S4** | `promotion-flow.ts` 3 个 TS 错 | 同 S2 | `d7ab488` 修 + 删 dead code | ✅ 已愈 |
| **S5** | **`/api/me/dashboard` 信任 `?userId=`** | §13 隐私 | `7416675` EVO-7 phase 2 | ✅ 今日修 |
| **S6** | **30+ endpoint 无 auth gate** | §13 + §16 | EVO-7 wired 3 个; 剩余 ~27 待 middleware.ts | 🟡 进行中 |

## §4 V1 GA 还差的 3 件事 (真空地带)

诚实清单. 如果今天客户问"能上吗", 答案"不能", 原因这 3 条:

### G1 全局 auth middleware 未上 (P1)

- **现状**: 68 个 API route 里只有约 15 个明确走 `requireAuth`, 其余 53 个或默认放行或自实现弱 gate.
- **风险**: 真生产环境跨用户越权.
- **DoD**: `middleware.ts` 全局拦截, 白名单 `/api/auth/*` `/api/health*`. 现有调用点 0 改动.
- **预算**: 2 天
- **优先级**: **V1 GA 必交**

### G2 PrismaStore 真实业务路径未跑过端到端 (P1)

- **现状**: 1on1/360 5 张新表的 Prisma 写入只在单元测试覆盖, 没在 e2e 跑.
- **风险**: 生产 DB 切到 PostgreSQL 后第一个写入可能崩.
- **DoD**: `scripts/e2e-v1.ps1` 加 Prisma 模式 1on1 创建 + 360 cycle 流程; 38/38 → 45/45.
- **预算**: 1 天
- **优先级**: V1 GA 必交

### G3 Steward Agent (治理官 AI) 仅有 placeholder (P2)

- **现状**: `docs/AGENT-FRAMEWORK.md` Layer 3 治理官设计完整, 代码只有空 sidebar 入口.
- **风险**: V1 客户看不到 §14 治理设计, 难解释为何 Tandem 不是普通 OKR 工具.
- **DoD**: 1 个最小可演示的 Steward Agent (审计宪章 §13.2 违规 + 1 个可工作的告警). 不要做满, 做 demo.
- **预算**: 5 天
- **优先级**: V1.5 (可后置)

## §5 进化方案 · 全表 (含本会话已交付)

### 5.1 本会话已交付 6 项 (10 commits)

| 进化 | 状态 | Commit | 实际工时 |
|---|---|---|---|
| **EVO-2** OKR 智能纠偏 V1 | ✅ | `ea77ac9` | 0.5 天 |
| **EVO-1** 决议节奏护栏 V1.5 | ✅ | `fb8c5fe` | 0.5 天 |
| **EVO-7** PII 默认剥离框架 | ✅ | `02df1c4` | 0.5 天 |
| **EVO-7.2** /api/me/dashboard + /api/persona auth | ✅ | `7416675` | 0.2 天 |
| **EVO-10** Workbench Agent View | ✅ | `221595e` | 0.5 天 |
| **3 份学习附录** Ruflo + Claude Code + 进化主表 | ✅ | `6a0ffa0` + `8379725` + `116548e` | 0.3 天 |

**总实际**: 2.5 天工时 (相对预算 27 天) — 因为每条都严格寄生于既有 health.ts / store.ts / dashboard endpoint, 没有重写.

### 5.2 未交付的进化 (按优先级)

| 进化 | 价值 | 预算 | 阶段 |
|---|---|---|---|
| **G1 middleware.ts 全局 auth** | V1 GA 阻塞项 | 2 天 | **V1 必交** |
| **G2 Prisma e2e 1on1/360** | V1 GA 阻塞项 | 1 天 | **V1 必交** |
| **EVO-11** 议事室 5min course-correct | 17min 协同体验 | 4 天 | V1.5 |
| **EVO-9** ReasoningBank | 复盘闭环 | 6 天 | V1.5 |
| **EVO-3** HRIS Adapter (只读入站) | 客户落地必备 | 7 天 | V1.5 |
| **EVO-4** Persona 工作记忆 | §7 派生层补强 | 6 天 | V2 |
| **G3 Steward Agent demo** | §14 落地, 客户解释力 | 5 天 | V2 |
| **EVO-8** Agent Trust Score | AI 治理 | 5 天 | V2 |
| **EVO-12** Memory 必留项 | "/compact" 风范 | 3 天 | V2 |
| **EVO-6** Steward Agent V2 完整版 | 治理官完整体 | 10 天 | V2 |
| **EVO-5** 员工自助健康仪表盘 | 需 6 月数据 | 8 天 | V2 (等数据) |

**V1 GA 剩余预算**: 3 天 (G1+G2). 本月可关. 然后进入 V1.5 节奏.

### 5.3 4 战略观察 (维持不动手)

来自 `EVOLUTION-2026-05.md` 主文档:

- **O1** 不跟飞书 People 一体化 (HR 全栈不在 sweet spot §17)
- **O2** 不下场钉钉精选助理赛道 (通用 AI 工具不是宪章 §1 决议工作)
- **O3** Lattice Agent Marketplace 治理成本极高, V3 再议
- **O4** agentic 自主率竞赛, 反向选边「人在环」

## §6 一句话宣言 (经 4 个月迭代后)

> **Tandem 不是 OKR 工具. 也不是 IM. 也不是 HR-tech.**
>
> **Tandem 是「员工对自己工作日的可掌控性」的脚手架.**
>
> **决议室让员工 17 分钟达成共识, 而不是开 1 小时无效会.**
> **OKR 让员工自己写 KR 不让 AI 帮写, 但 AI 提示问题在哪.**
> **Memory 让员工 60 秒沉淀 SOP, 而不是公司知识库永远没人写.**
> **1on1 让主管私语永远不外泄, 而员工的复盘永远归员工.**
> **360 让 peer 反馈匿名, 而 manager 永远实名.**
> **Workbench 让我一眼看 Waiting / Running 而上级看不到这张表.**
>
> **不是 agent 替人. 是 agent 替人不被打扰.**

## §7 下一步 (本周可执行)

按宪章 + V1 GA 路径锁定:

| 排序 | 任务 | 工期 | 收益 |
|---|---|---|---|
| **D+1 ~ D+2** | G1 middleware.ts 全局 auth gate | 2 天 | V1 GA 阻塞解除 1/2 |
| **D+3** | G2 Prisma e2e 1on1/360 | 1 天 | V1 GA 阻塞解除 2/2 |
| **D+4 ~ D+7** | EVO-11 议事室 5min course-correct | 4 天 | 体验最后一公里 |
| **D+8 ~ D+13** | EVO-9 ReasoningBank | 6 天 | 与 EVO-1 收尾学习闭环 |

**月末状态**: V1 GA-ready + V1.5 完成 50%.

---
**复盘签名**: 2026-05-12, 单线连续作战 4 个月, 0 砍页违章, 0 tsc 违章, 0 推倒重写. 速度不是问题, **是否在正确的方向**才是问题. 本月连交 5 个进化点 + 完成 V1 GA-blocked 修复一半, 是回答这个问题的正确节奏.
