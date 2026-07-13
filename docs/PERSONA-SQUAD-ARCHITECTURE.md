# 分身编队架构 · Persona Squad (拿捏)

> 状态: 愿景定稿 (2026-07-13) · 拥有者: Cascade
> 一句话: 每员工拥有 **1 主分身 + ≤5 个完全独立的技能分身**, 从公司/市场的基础 Agent 模板 fork 而来,
> 在使用中各自独立进化, 由主分身带领组成"战斗小组", 在 OKR 工作台灵活调用; 困惑时问中央 AI。
> 前置阅读: `PERSONA-EVOLUTION` · `MANIFESTO` 第十三/十六/十九条 · `docs/MODULE-BOUNDARIES`(待建)

---

## 一、愿景 (Owner 澄清, 2026-07-13)

1. 每员工 = **1 主分身 + N 技能分身** (独立个体, 非临时视角)。
2. 训练起点 = **基础 Agent 模板** (公司配置 / 内部市场 / 外部公开市场引入)。
3. 员工在**使用+训练中, 让每个分身独立进化**。
4. **主分身管理/带领技能分身 → 战斗小组**。
5. **OKR 工作台灵活调用**不同分身干活。
6. **困惑时问 Tandem 中央 AI**。

## 二、三个岔路的决策 (已定)

| 岔路 | 决策 | 含义 |
|---|---|---|
| **① 技能分身多重程度** | **重 · 完全独立个体** | 每个技能分身有**独立的 stage 成长曲线 / delegationLevel / 升阶 / reflexion / styleProfile**, 不共享主分身状态。 |
| **② 基础 Agent 模板来源** | **外部 import + 公司构建内部市场** | 双轨: 公司策展**内部市场** (curated) + 引入**外部公开市场**智能体 (经 §19 出站合规闸)。 |
| **③ 每人技能分身上限** | **5 个** | 主分身不占额度; 技能分身硬上限 5, 战斗小组并行调用沿用 expert-panel 的 rateLimit + cap。 |

> ⚠️ 选"重"的代价 (须正视, 见 §六): 5× 独立进化 → LLM 成本 + 治理面 + stage 累积门槛都要专门设计, 否则技能分身永远升不了级 / 成本失控。

---

## 三、实体设计

### 3.1 `AgentTemplate` (基础 Agent 模板 · 新实体, 公司资产)

```ts
interface AgentTemplate {
  id: string;
  tenantId: string;
  name: string;                 // 例: "资深财务分析师"
  specialty: string;            // design|pm|tech|marketing|strategy|finance|sales|hr|legal|...
  origin: 'internal' | 'external_market';   // ② 双轨
  externalRef?: string;         // 外部市场来源标识 (origin=external_market 时)
  basePrompt: string;           // 人格与专业基线 (fork 后成为技能分身 system 基底)
  defaultSkills: string[];      // 初始 enabledSkills (受 stage 门槛约束)
  defaultKnowledgeTags: string[]; // 关联知识/记忆检索标签
  status: 'draft' | 'published' | 'archived';
  createdBy: string;
  reviewedBy?: string;          // 外部 import 必须经审 (skill-gateway)
  createdAt: string; updatedAt: string;
}
```

- **内部市场**: admin/champion 策展, `origin='internal'`, `status='published'` 后员工可 fork。
- **外部市场**: `origin='external_market'`, **必须经 §19 出站合规闸 + skill-gateway Data/Action Scope 审查** 才能 published。红区能力永不随模板解锁。

### 3.2 `Persona` 扩展为父子结构 (复用现有表)

现有 `lib/types/persona.ts` 的 `Persona` 加字段:

```ts
kind: 'primary' | 'skill';       // 默认 primary (向后兼容: 旧数据无此字段 = primary)
parentPersonaId?: string;        // kind='skill' 时指向主分身
templateId?: string;             // fork 来源的 AgentTemplate
specialty?: string;              // 技能分身的专业域
```

- **主分身 (primary)**: 每员工恰好 1 个 (现有 `createPersona` 产出), 是"班长"。
- **技能分身 (skill)**: `parentPersonaId` 指向主分身, `MemoryScope.agentId = 该分身 id` → **独立记忆 / reflexion / 决策历史**。
- **独立进化 (岔路①=重)**: 每个技能分身独立跑 `stage` / `delegationLevel` / `STAGE_UPGRADE_CRITERIA` / `styleProfile` / `growthAreas`。复用现有 `evolution.ts` 全套, 只是按 personaId 而非 userId 检索。

### 3.3 记忆层 (已 ready)

`MemoryScope.agentId` 注释已预留 "主分身 / 子分身"。每个分身的产出/自省挂各自 `agentId`, personal scope。**决策防火墙不变**: 任何分身的 personal 记忆不自动进组织决策。

---

## 四、战斗小组编排 (主分身带领)

`lib/persona/expert-panel.ts` 从"同一分身多视角临时草稿"**升级**为"主分身 dispatch 给真实技能分身实体":

- **调度**: 主分身接议题 → 选定若干技能分身 → 并行各起草 (`Promise.all`, fail-soft, 沿用 cap + rateLimit)。
- **各分身带自己进化出的** basePrompt(来自模板) + styleProfile + enabledSkills + reflexion 教训。
- **合稿**: 主分身汇总 → 员工工作台审定 → 经 `DeliverCard` / `proposeAction` 受治理交付。
- **受控铁律不变** (§19.5): 只产草稿, 不写业务库, 不对外, 不拍板; 服务 OKR; 红区硬禁。

## 五、OKR 工作台调用

- workbench 加 **persona-picker**: 主分身 (默认) / 各技能分身 / 战斗小组模式。
- `/api/persona/stream` 加 `personaId` 参数 → 路由到指定分身的 prompt/skills/reflexion。
- 困惑时一键切中央 AI (`/tandem` 双线, 已落)。

---

## 六、选"重"的必须专门设计的三件事 (否则闭环假)

1. **技能分身如何累积 stage?** `STAGE_UPGRADE_CRITERIA` 需 minDecisions。技能分身决策量天然少 →
   方案: 技能分身的"决策"= 被调用起草且被主分身**采纳合稿**的次数 (采纳=正信号, 复用 CA-13 飞轮 adopt)。
   未被采纳不计。这样"越被用越进化"。
2. **成本护栏**: 5× 分身 + 战斗小组并行 → 沿用 expert-panel `rateLimit` + `maxTokensPerExpert`; 战斗小组单次并行数 cap; 低敏场景走 `high_frequency` 便宜档。
3. **治理面**: 每个技能分身独立 `delegationLevel` → 主分身可 partner 而技能分身 newborn。
   `governPersonaOutput` 4 闸 + `proposeAction` 对**每个分身独立生效**; 红区对所有分身永不解锁。

## 七、边界与治理 (护城河, 全部不变)

- **裁判非选手**: 中央 AI 永不当任何员工的主分身 (宪法 A)。
- **数据归公司, 尊严归员工** (§13): 所有分身 (主/技能) 数据归公司; 离职匿名化对全部分身生效; 员工保留 ORIGINS 导出权。
- **决策防火墙**: 分身 personal 记忆 → 组织决策 单向阻断。
- **外部模板合规**: `origin='external_market'` 必经 §19 出站闸 + skill-gateway 审查。

---

## 八、落地里程碑

| M | 内容 | 关键交付 |
|---|---|---|
| **M1 数据模型** | `AgentTemplate` 实体 + 存储三件套注册; `Persona` 加 kind/parentPersonaId/templateId/specialty (幂等 DDL); admin 内部市场配置 UI | schema + 迁移脚本 + 单测 |
| **M2 fork + 独立进化** | 员工从模板 fork 技能分身 (≤5 硬上限); `evolution.ts` 改按 personaId 检索; §六.1 采纳=决策信号 | fork API + 上限校验 + 进化单测 |
| **M3 编队** | `expert-panel` 升级为真实技能分身 dispatch + 主分身合稿 | 编排 + 受控铁律回归 |
| **M4 工作台调用** | OKR workbench persona-picker + `/api/persona/stream` 带 personaId | UI + 路由 |
| **M5 外部市场** (远期) | 外部公开市场 import 经 §19 出站 + skill-gateway 审查 | 合规闸 + 审查流 |

---

## 修订记录

- 2026-07-13 · 愿景定稿 · Cascade — 三岔路决策: 重(独立个体) / 外部+内部市场 / 上限5; 冻结实体+编排+边界+里程碑。
