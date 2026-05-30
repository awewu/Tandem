# Tandem 进化路线图 V2 · 2026-05-13

> **整合源**:
> - 既有 EVO-1~12 (EVOLUTION-2026-05.md + APPENDIX-CLAUDE-CODE.md)
> - 新提取 EVO-13~19 (APPENDIX-SKILLS-AND-HERMES.md)
> - 全量审计新发现 (AUDIT-2026-05-13-FULL.md)
> - 前置修复已执行: schema 4 项补全 + seed.ts 1 项 + migration applied
>
> **本文档 = 唯一事实源 (single source of truth)**, 替代之前分散的进化点记录.

---

## 0. 一表览全 (19 进化点 + 8 审计修复项)

### 0.1 进化点 (EVO-1 ~ EVO-19)

| # | 进化点 | 来源 | 优先级 | 工期 | 状态 | 依赖 |
|---|---|---|---|---|---|---|
| 1 | **EVO-1** 决议节奏护栏 (Habits 反向用) | Lattice Habits | V1.5 | 5 天 | ✅ 已交付 | — |
| 2 | **EVO-2** OKR 智能纠偏 (3+1 强约束) | Tita AI 纠偏 | V1 GA | 4 天 | ✅ 已交付 | — |
| 3 | **EVO-3** HRIS Adapter | 飞书 People 压力 | V1.5 | 7 天 | 🔄 待启动 | EVO-15 MCP |
| 4 | **EVO-4** Persona 工作记忆 | OpenAI/Claude Memory | V1.5 | 6 天 | 🔄 基础版待启动 | — |
| 5 | **EVO-5** 员工自助健康仪表盘 | Lattice Employee Health | V2 | 8 天 | ⏸️ 冻结 | 宪章 §13 边界 |
| 6 | **EVO-6** Steward Agent (治理官) | MIT Sloan HR for Agents | V2 | 10 天 | 🔄 待启动 | EVO-14 Subagent |
| 7 | **EVO-7** PII 入栈脱敏 | Ruflo R1 | V1.5 | 5 天 | 🔄 待启动 | — |
| 8 | **EVO-8** Agent Trust Score | Ruflo R2 | V2 | 6 天 | ⏸️ 冻结 | 需外部审计 |
| 9 | **EVO-9** ReasoningBank | Ruflo R3 | V1.5 | 6 天 | 🔄 待启动 | EVO-1/11 |
| 10 | **EVO-10** Workbench Agent View | Claude Code Agent View | V1.5 | 5 天 | 🔄 待启动 | — |
| 11 | **EVO-11** 5-Min Course-Correct Prompt | Claude Code B7 | V1.5 | 4 天 | 🔄 待启动 | — |
| 12 | **EVO-12** Memory 必留项 (/compact) | Claude Code B3 | V2 | 3 天 | ⏸️ 冻结 | Memory 日常化后 |
| 13 | **EVO-13** Agent Skills 目录 | Claude Code Skills | V1.5 | 6 天 | 🔄 待启动 | EVO-18 工具集 |
| 14 | **EVO-14** Steward Subagent 隔离 | Superpowers TDD | V2 | 8 天 | 🔄 待启动 | EVO-6 先跑 |
| 15 | **EVO-15** MCP Gateway | MCP Server 生态 | V1.5 | 7 天 | 🔄 待启动 | — |
| 16 | **EVO-16** Persona 记忆三层化 | Hermes Memory | V1.5 | 6 天 | 🔄 待启动 | EVO-4 基础版 |
| 17 | **EVO-17** 多角色 Profile | Hermes Profile | V1.5 | 5 天 | 🔄 待启动 | EVO-13 Skills |
| 18 | **EVO-18** Agent 工具集动态管理 | Hermes Toolsets | V1.5 | 4 天 | 🔄 待启动 | — |
| 19 | **EVO-19** 中性 IM Gateway (Slack/Teams/Email) | Hermes Gateway | V1.5 | 7 天 | 🔄 待启动 (原“企业 IM Gateway” 含钉钉/企微/飞书 · 2026-05-30 战略红线调整 · 他们是直接竞品永不接) | IM auth 修复 |

### 0.2 审计修复项 (AUDIT-FIX-1 ~ AUDIT-FIX-8)

| # | 修复项 | 级别 | 工期 | 状态 | 阻塞 |
|---|---|---|---|---|---|
| **A1** | IM 13 路由 auth 硬化 (session 取 userId) | 🔴 P0 | 2 天 | 🔄 待启动 | — |
| **A2** | 30+ 裸奔 API 路由加 requireAuth | 🔴 P0 | 1 天 | 🔄 待启动 | — |
| **A3** | store.ts ↔ types/ 重复类型清理 | 🔴 P0 | 2 天 | 🔄 待启动 | — |
| **A4** | fire-and-forget 网络错误处理 | 🟠 P1 | 2 天 | 🔄 待启动 | A3 |
| **A5** | boot.ts 循环依赖解耦 | 🟠 P1 | 2 天 | 🔄 待启动 | — |
| **A6** | 审计日志接入 Prisma 表 | 🟠 P1 | 1 天 | 🔄 待启动 | schema 补全 |
| **A7** | zustand 全量订阅修复 | 🟠 P1 | 1 天 | 🔄 待启动 | — |
| **A8** | file-manager.tsx 拆分 | 🟡 P2 | 2 天 | 🔄 待启动 | — |

---

## 1. 战略分层 (三层推进)

### Layer 1: 安全基线 (本周必做)

**目标**: 消除所有 P0 安全风险和运行时崩溃.

```
A1  IM auth 硬化        2 天
A2  裸奔路由加 auth      1 天
A3  类型重复清理        2 天
EVO-18 Agent 工具集      4 天  ← 安全架构
─────────────────────────────────
Layer 1 总计: 9 天 (可并行 → 实际 5 天)
```

**关键决策**: EVO-18 (Agent 工具集) 从 V1.5 提到 Layer 1, 因为它是所有后续 Agent 功能的安全前提. 没有工具集边界, Skills 目录和 Subagent 隔离都无从谈起.

### Layer 2: 体验跃迁 (本月)

**目标**: 用户可感知的"Agent 变聪明" + "一眼看全".

```
EVO-10 Workbench Agent View      5 天
EVO-13 Agent Skills 目录         6 天
EVO-17 多角色 Profile            5 天
EVO-11 5-Min Course-Correct     4 天
EVO-2 ✅ 已交付
EVO-1 ✅ 已交付
─────────────────────────────────
Layer 2 总计: 20 天 (可并行 → 实际 12 天)
```

### Layer 3: 架构深化 (下月)

**目标**: MCP 标准化 + 记忆升级 + Steward 治理.

```
EVO-15 MCP Gateway               7 天
EVO-16 Persona 记忆三层化        6 天
EVO-4  Persona 工作记忆基础版     6 天
EVO-9  ReasoningBank             6 天
EVO-3  HRIS Adapter (via MCP)    7 天
EVO-19 中性 IM Gateway           7 天
EVO-14 Steward Subagent 隔离     8 天
EVO-6  Steward Agent 基础版      10 天
─────────────────────────────────
Layer 3 总计: 57 天 (可并行 → 实际 25 天)
```

---

## 2. 依赖关系图

```
Layer 1 (安全基线)
├─ A1/A2 (auth 硬化)
│   └─ EVO-19 (IM Gateway) ← 必须等 IM auth 完成
├─ A3 (类型清理)
│   └─ A4 (fire-and-forget 修复)
├─ EVO-18 (工具集管理)
│   └─ EVO-13 (Skills 目录)
│       └─ EVO-17 (Profile 系统)
│           └─ EVO-10 (Workbench) ← 需要 Profile 做视图隔离

Layer 2 (体验跃迁)
├─ EVO-11 (Course-Correct)
│   └─ EVO-9 (ReasoningBank) ← 自评数据汇入 ReasoningBank
├─ EVO-10 (Workbench)
│   └─ EVO-1 (Retro-Pending) ← Workbench 聚合 retro 数据

Layer 3 (架构深化)
├─ EVO-15 (MCP Gateway)
│   └─ EVO-3 (HRIS Adapter) ← 从定制化改为 MCP 标准化
├─ EVO-4 (Persona 基础版)
│   └─ EVO-16 (记忆三层化)
├─ EVO-6 (Steward 基础版)
│   └─ EVO-14 (Subagent 隔离)
└─ EVO-19 (IM Gateway)
    └─ A1/A2 (IM auth)
```

---

## 3. 详细执行序 (推荐)

### Week 1 (2026-05-13 ~ 05-19): 安全基线冲刺

| 天 | 任务 | 产出 |
|---|---|---|
| D1 | A1: IM 13 路由加 requireAuth + session 取 userId | PR #1 |
| D2 | A2: 30+ 裸奔路由批量加 requireAuth | PR #2 |
| D3 | A3: store.ts 类型清理 (Objective/KeyResult/Cycle 等) | PR #3 |
| D4 | EVO-18: Agent 工具集动态管理框架 | PR #4 |
| D5 | A1+A2 联调测试 + A3 边界验证 | 测试报告 |
| D6-D7 | Buffer /  Code Review / Merge | 5 PR merged |

### Week 2 (2026-05-20 ~ 05-26): 体验跃迁启动

| 天 | 任务 | 产出 |
|---|---|---|
| D8-D10 | EVO-10: Workbench Agent View (统一行级表) | PR #5 |
| D11-D12 | EVO-13: Agent Skills 目录 (Uplift + Preference) | PR #6 |
| D13-D14 | EVO-17: 多角色 Profile (Session-level 隔离) | PR #7 |

### Week 3 (2026-05-27 ~ 06-02): 体验补全

| 天 | 任务 | 产出 |
|---|---|---|
| D15-D16 | EVO-11: 5-Min Course-Correct Prompt | PR #8 |
| D17-D18 | A7: zustand 全量订阅修复 + A8: file-manager 拆分 | PR #9 |
| D19-D21 | EVO-9: ReasoningBank (与 EVO-1/11 数据闭环) | PR #10 |

### Week 4 (2026-06-03 ~ 06-09): 架构深化启动

| 天 | 任务 | 产出 |
|---|---|---|
| D22-D24 | EVO-15: MCP Gateway (Client + Server) | PR #11 |
| D25-D26 | EVO-4: Persona 工作记忆基础版 | PR #12 |
| D27-D28 | EVO-19: 中性 IM Gateway (Slack/Teams/Email · 不接钉钉/企微/飞书 · 详 OKR-VS-TITA.md §11) | PR #13 |

### Month 2 (2026-06-10 ~ 07-07): 架构完成

| 周 | 任务 | 产出 |
|---|---|---|
| W5 | EVO-16: Persona 记忆三层化 + EVO-3: HRIS via MCP | PR #14/#15 |
| W6 | EVO-6: Steward Agent 基础版 | PR #16 |
| W7 | EVO-14: Steward Subagent 隔离 | PR #17 |
| W8 | Buffer / E2E 测试 / 文档补齐 | V1.5 候选版 |

---

## 4. 与 HVAC 项目的交叉调度

若用户选择中途切换 HVAC 项目:

| HVAC 任务 | 可复用的 Tandem 能力 | 增量工期 |
|---|---|---|
| P0 语音入口 3 天 demo | EVO-13 Skills (hvac-voice-intent) + EVO-15 MCP (设备协议) | 1.5 天 |
| P1 平板中控屏 5 天 | EVO-19 Gateway (推送) + EVO-16 Dialectic (comfort 偏好) | 2 天 |
| P2 施工全流程 7 天 | EVO-15 MCP (BIM 数据) + EVO-14 Subagent (设计-施工-验收隔离) | 3 天 |

**建议**: 在 Layer 1 完成后 (Week 1 结束) 切换 HVAC P0, 此时 Agent 内核最干净, 复用成本最低.

---

## 5. 资源估算

| 角色 | 需求 | 说明 |
|---|---|---|
| 后端工程师 | 1.5 FTE | auth 硬化 + API + MCP + Gateway |
| 前端工程师 | 1 FTE | Workbench + Skills UI + zustand 优化 |
| Agent 工程师 | 0.5 FTE | Skills 目录 + Persona + Steward |
| 测试/QA | 0.3 FTE | auth 单元测试 + E2E smoke |

**总工期**: 8 周 (Layer 1~3 全部完成)
**最早 V1.5 候选**: Week 3 结束 (EVO-10/11/13/17 + A1~A3)
**最早 V1 GA**: 已达成 (A2 后端打通 + EVO-1/2 已交付)

---

## 6. 风险登记册

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| IM auth 修复导致前端大量改动 | 高 | 中 | 提供 `useCurrentUser()` hook, 前端统一从 session 取 userId |
| store.ts 类型清理引发连锁类型错误 | 中 | 高 | 分模块渐进迁移, 每模块单独 PR, tsc gate 保护 |
| MCP 生态不成熟 (Server 少) | 中 | 中 | 先内部定义 Tandem MCP Server, 再对接外部 |
| Persona 记忆三层化被宪章否决 | 低 | 高 | L3 画像仅本人可见, 设计文档提前过宪章审查 |
| Week 1 后切换 HVAC 导致 Tandem 进度中断 | 取决于用户 | 中 | Layer 1 完成后再切换, 保留 0.5 FTE 维护 Tandem |

---

## 7. 验收里程碑

### Milestone 1: Layer 1 安全基线 (Week 1 结束)
- [ ] 100% IM 路由过 requireAuth
- [ ] 100% 非 public API 路由过 requireAuth
- [ ] store.ts 重复类型降为 0
- [ ] tsc 0 errors
- [ ] EVO-18 工具集管理框架可用

### Milestone 2: V1.5 候选 (Week 3 结束)
- [ ] Workbench Agent View 上线
- [ ] Agent Skills 目录上线 (≥5 个内置 skill)
- [ ] 多角色 Profile 上线
- [ ] 5-Min Course-Correct 上线
- [ ] ReasoningBank 上线

### Milestone 3: V1.5 正式 (Month 2 结束)
- [ ] MCP Gateway 接入 ≥1 外部系统
- [ ] Persona 工作记忆 + 三层化上线
- [ ] Steward Agent 基础版上线
- [ ] 企业 IM Gateway 上线 (≥1 渠道)
- [ ] E2E 测试覆盖 5 条核心链路

---

## 8. 文档索引

| 文档 | 路径 | 说明 |
|---|---|---|
| 宪章 | `docs/MANIFESTO.md` | 18 条不可违 |
| PRD | `docs/PRODUCT-DEFINITION.md` | 14 项决策 + 6 北极星 |
| 主进化方案 | `docs/EVOLUTION-2026-05.md` | 6 进化点 + 4 观察 |
| Ruflo 附录 | `docs/EVOLUTION-2026-05-APPENDIX-RUFLO.md` | 3 肯定 + 2 反向 + 4 反例 |
| Claude Code 附录 | `docs/EVOLUTION-2026-05-APPENDIX-CLAUDE-CODE.md` | EVO-10/11/12 + 12 模式 |
| Skills + Hermes 附录 | `docs/EVOLUTION-2026-05-APPENDIX-SKILLS-AND-HERMES.md` | EVO-13~19 + 6 源研究 |
| 全量审计报告 | `docs/AUDIT-2026-05-13-FULL.md` | 4 领域审计 + 修复矩阵 |
| **本文档** | `docs/EVOLUTION-ROADMAP-2026-05-V2.md` | 唯一事实源 |

---

**路线图版本**: V2.0
**最后更新**: 2026-05-13
**下次更新**: 2026-05-20 (Week 1 结束后)
