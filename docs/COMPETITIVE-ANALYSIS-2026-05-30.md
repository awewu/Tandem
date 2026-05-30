# 企业级 AI Agent 竞品深度对标 (2026-05-30)

> **缘起**: 销售/PR 内部曾用 "**业内首个企业级智能体**" 话术 — 这是营销错误.
> 时间线上 Tandem 落后大厂 1-3 年. 本文锁定真正可讲的差异化, 永久档案.

---

## 一、企业级 AI Agent 时间线 (实证)

| 时间 | 产品 | 类型 | 已落地体量 |
|---|---|---|---|
| **2023-08** | OpenAI ChatGPT Enterprise | 增强版 ChatGPT (企业版) + admin/SOC 2 | Fortune 500 主流 |
| **2024-初** | **Coze (字节跳动)** | Agent 可视化开发平台 | 数百万开发者 |
| **2024** | **Coze 企业版** | 同上 + 企业治理 | 数万家企业 |
| **2024-09** | Anthropic Claude Enterprise | 企业级 frontier model + Claude Code | 全球 enterprise |
| **2024+** | Microsoft Copilot Studio | Agent builder + M365 集成 | M365 客户全覆盖 |
| **2024+** | Microsoft Copilot for M365 | 企业 productivity Agent | 同上 |
| **2024+** | Google Gemini for Workspace | Workspace 集成 AI | Workspace 客户 |
| **2024-09** | Salesforce Agentforce | CRM Agent | CRM 客户 |
| **持续** | Glean Enterprise AI | 企业搜索 + 助手 | 大型企业 |
| **2025-05** | WorkBoard 收购 Quantive (原 Gtmhub) | OKR + AI Agents | 国际 OKR 头部 |
| **2025-08** | Anthropic 加 Claude Code (Team/Enterprise plan) | Coding Agent | enterprise dev 主流 |
| **2025-12** | **Microsoft Viva Goals 退役** | 微软放弃 OKR SaaS 路线 | — |
| **2025-11** | Microsoft Copilot Cowork (Ignite 2025) | 协作 Agent | M365 客户 |
| **2026-05** | **Tandem 牛马搭子** (本产品) | OKR 决议 OS | **0** (上线前) |

**事实**: Tandem 不是首个, 不是第二个, 不是第三个 — 是**晚 1-3 年**的后来者。

---

## 二、4 款主竞品深度对比

### 2.1 vs **Coze 企业版 (字节跳动)**

| 维度 | Coze 企业版 | Tandem |
|---|---|---|
| **GA** | 2024 | 2026-05 (晚 1.5 年) |
| **客户规模** | 数万家企业 / 数百万开发者 | 0 |
| **定位** | Agent **可视化开发平台** (低代码) | OKR 决议 **OS** (产品化协作) |
| **核心用户** | **开发者 / IT 团队** (搭 Agent) | **业务员工 / 管理层** (用 Agent) |
| **开源** | ✅ Coze Studio + Coze Loop (Apache 2.0, 2025) | 部分模块 V2 计划 |
| **生态** | 字节生态 / 飞书集成 / API marketplace | 战略红线: 不集成飞书/钉钉/企微 |
| **AI Agent 编排** | **强** (节点编排 / RAG / Skill) | 弱 (Skill Gateway V2) |
| **OKR 决议链 / 17min 议事 / Memory 三级签批** | ❌ 没有 | ✅ 4 件独家 |
| **决议必锚 OKR 不变量** | ❌ | ✅ 代码层强制 |
| **D 选项 humanOnly 反 AI 欺诈** | ❌ | ✅ |
| **TTI 双轨永不挂奖金** | ❌ | ✅ |

**真相**: Coze **是 Agent 工具**, Tandem **是协作产品**。
- Coze 的客户用 Coze 来 **构建** AI Agent (像 N8N / Dify)
- Tandem 的客户用 Tandem 来 **执行 OKR 协作** (像 Tita / Lattice)

**根本不是同类**。Coze 的客户不会因为 Tandem 出了就换, 反过来也不会。

---

### 2.2 vs **Anthropic Claude Enterprise**

| 维度 | Claude Enterprise | Tandem |
|---|---|---|
| **GA** | 2024-09 | 2026-05 (晚 20 月) |
| **定位** | 企业级 **frontier model** + admin controls | OKR 决议 OS |
| **核心能力** | Claude Opus 4.8 + Claude Code (coding agent) + Computer Use | 议事 17min + 3+1 + Memory 三级签批 |
| **Agent 模式** | Claude Code = autonomous coding agent | 无 coding agent (走 §19 Skill Gateway 接 Claude Code) |
| **治理** | connector permissions / custom roles / SOC 2 | OKR Anchor 强制 + Memory 三级签批 + 议事 audit |
| **市场** | 美国 + 欧洲为主 | 中国民企 |
| **OKR / 议事 / 反 AI 欺诈** | ❌ | ✅ |

**真相**: Claude Enterprise **是 LLM 服务 + admin**, Tandem **是协作产品**。
- Claude Enterprise 是后端的**燃料选项**之一 (可挂在 Tandem 的 TAF router)
- Tandem 是前端的**业务协作层**

**Claude Enterprise 不是 Tandem 竞品, 而是 Tandem 的 LLM provider 之一**。

---

### 2.3 vs **Microsoft Copilot Studio + M365 Copilot + Cowork**

| 维度 | Microsoft 全套 | Tandem |
|---|---|---|
| **GA** | 2024 起 (Copilot Studio), 2025-11 (Cowork) | 2026-05 |
| **定位** | Agent 平台 + M365 全家桶集成 | OKR 决议 OS |
| **覆盖** | Word / Excel / Teams / Outlook / Loop / Office 365 全集成 | Tandem 自有 OS, 不集成大厂套件 |
| **Agent 编排** | **强** (Copilot Studio + 1000+ pre-built agents) | 弱 (4 选项 + Persona) |
| **客户规模** | M365 全球客户 (亿级) | 0 |
| **市场** | 全球 | 中国民企 |
| **OKR 引擎** | ❌ Viva Goals 已退役 | ✅ |
| **议事 / 决议链** | ❌ | ✅ |

**真相**: 不同地理 + 不同生态绑定。
- Microsoft 是 M365 客户的天然选择 (零迁移)
- Tandem 是已有飞书/Tita 但用不爽的中国民企的选择 (主动选择)

**地域 + 客户分层不同, 不正面冲突**。

---

### 2.4 vs **OpenAI ChatGPT Enterprise**

| 维度 | ChatGPT Enterprise | Tandem |
|---|---|---|
| **GA** | 2023-08 | 2026-05 (晚 33 月, 几乎 3 年) |
| **定位** | 增强版 ChatGPT + admin / SOC 2 | OKR 决议 OS |
| **Agent 模式** | GPT-5 + Operator (computer use) + Custom GPTs | 议事 + 3+1 + Decision Card |
| **品牌力** | OpenAI 业内最强 | 0 (新晋) |
| **客户** | 全球 enterprise (Fortune 500 主流) | 0 |
| **OKR / 议事 / Memory** | ❌ | ✅ |

**真相**: ChatGPT Enterprise **是 LLM 终端 + Agent 平台**, Tandem **是协作 OS**。同 Claude Enterprise 一样, 是 Tandem 的 LLM 燃料选项, **不是产品竞品**。

---

## 三、Tandem 真正的"首个" 4 件事 (有实证)

不能讲 "**业内首个企业级智能体**" — 太大 + 错误。
**能讲 "**首个 OKR 决议链 OS**" — 4 件独家事的总称, 据公开资料业内没有同类。

### 3.1 决议必锚 OKR (代码不变量)

- **实证**: `lib/types/decision-card.ts:148-178` `validateOkrAnchor()` XOR 不变量
- **不是 PM 写的 best practice**, 是代码层强制: 议事创建时必填 KR 或 ≥30 字理由 + Steward 月审
- **业内对比**:
  - Coze: ❌ 无 OKR 概念
  - Claude Enterprise: ❌ 无 OKR 概念
  - Copilot Studio: ❌ 无 OKR 概念 (Viva Goals 已退役)
  - Tita: 部分 (KR 存在但非每决策必锚)
  - WorkBoard: 部分 (Strategic Pillars 但非代码不变量)
- **结论**: **可能业内首个**

### 3.2 议事 17 分钟硬上限 + 自动升级

- **实证**: `lib/types/decision-card.ts:124` `HARD_TIME_LIMIT_SECONDS = 17 * 60` + ConvergenceState 'ESCALATED'
- **业内对比**:
  - 飞书议事 / Zoom / Teams: 无硬上限概念
  - Coze: 无议事产品
  - Claude / Copilot: 无议事产品
  - WorkBoard: 无议事产品
- **结论**: **业内首个**

### 3.3 3+1 D 选项 humanOnly 反 AI 欺诈

- **实证**: `lib/decision-layer/three-plus-one-engine.ts` D 选项 `humanOnly: true`, 系统拒绝 AI 提交
- **哲学**: AI 给参考, 员工签字 — 跟其他家"AI 给最佳建议"反向
- **业内对比**:
  - ChatGPT Enterprise / Claude / Copilot: 给单选项 (员工照搬 / AI 替员工劳动)
  - Coze 编排出来的 Agent: 同上
- **结论**: **业内首个 (反 AI 欺诈架构)**

### 3.4 Memory 4 层 + 三级签批 SLA

- **实证**: `lib/memory/promotion-flow.ts` Lv1/2/3 SLA + 公示期 7 天 / 24h 紧急通道
- **业内对比**:
  - Coze 知识库 / Glean: RAG 检索, 无升级签批
  - Notion AI / 飞书云文档 AI: 同上
  - Claude Projects: 项目级知识, 无升级签批
- **结论**: **业内首个 (4 层签批架构)**

---

## 四、修正叙事 (能讲 / 不能讲)

### ❌ 不能讲

- ❌ "**业内首个企业级智能体**" — Coze 2024 / Claude 2024-09 / Copilot 2024 / ChatGPT 2023-08 都早于我们
- ❌ "**业内独家 AI Agent 平台**" — Coze / Copilot Studio 都是更成熟的平台
- ❌ "**首个企业 AI 协作 OS**" — Microsoft Copilot Cowork (2025-11) 已抢这个词
- ❌ "**完全超越 Coze**" — 不是同类产品, 命题错位
- ❌ "**完全超越 Claude Enterprise**" — Claude 是 LLM, Tandem 是协作产品, 命题错位

### ✅ 能讲 (有实证差异化)

- ✅ "**首个 OKR 决议链 OS**" (4 件独家事的总称, 据公开资料业内没有同类)
- ✅ "**首个把决议必锚 OKR 做到代码不变量层**" (单一最强声明)
- ✅ "**唯一把 D 选项强制 humanOnly 反 AI 欺诈**" (差异化凸出)
- ✅ "**唯一把知识沉淀做到三级 SLA 签批**" (Memory 4 层)
- ✅ "**唯一议事 17 分钟硬上限 + 24h 否决**" (反疲劳决策 + 反 AI 替员工签字)
- ✅ "**Coze / Claude Enterprise 是 LLM 工具, 我们是协作产品 — 不正面冲突**"

### 真实差异化叙事 (3 句钉死)

> **"Tandem 不跟 Coze 抢 Agent 平台, 不跟 Claude Enterprise 抢 LLM 终端, 不跟 Copilot 抢 M365 全家桶。**
>
> **我们做大厂不愿做的事: OKR 强制锚定每次协作 + 17 分钟议事硬上限 + D 选项必员工原创 + Memory 三级签批。**
>
> **这 4 件事 Coze/Claude/Copilot/飞书 18-24 月都做不出 — 不是技术问题, 是产品哲学问题。"**

---

## 五、客户对话脚本 (Q&A 备用)

### Q1: "你跟 Coze 比有什么优势?"
**A**: "我们不正面跟 Coze 比。Coze 是 Agent **开发平台** — 你雇程序员搭 AI Agent。Tandem 是 OKR **协作产品** — 你的业务员工直接用。如果你想搭一个 '客服 Agent', 应该选 Coze 或 Dify。如果你想让公司 OKR 真正驱动每次协作, 选 Tandem。"

### Q2: "你跟 Claude Enterprise 比?"
**A**: "Claude Enterprise 是 LLM 服务, Tandem 是产品。Claude Enterprise 实际上是我们 TAF router 的一个**燃料选项** — 你可以让 Tandem 后端跑 Claude Enterprise 的 model, 也可以跑 DeepSeek / OpenAI / 私有 Hermes。我们做的是协作产品, 不是 LLM。"

### Q3: "你跟 Copilot Studio 比?"
**A**: "Copilot Studio 是 M365 生态的 Agent builder, 你公司是 M365 客户的话天然选 Microsoft。Tandem 是中国民企已经在用飞书 / Tita 但用不爽的客户的选择 — 我们不集成 M365, 也不集成飞书。"

### Q4: "Tandem 算 AI Agent 平台吗?"
**A**: "**不是**。我们是 **OKR 决议 OS** — 把 OKR 决议链植入每次协作的产品。如果你想要 Agent builder, 看 Coze / Dify / N8N。如果你想要企业级 LLM 终端, 看 Claude Enterprise / ChatGPT Enterprise。如果你想要 OKR 真正驱动协作 + 议事 17min + Memory 三级签批 + 反 AI 欺诈, 看我们。"

---

## 六、修订历史

| 日期 | 修订 |
|---|---|
| 2026-05-30 PT | v1 创建. 锁定时间线 + 4 款主竞品对比 + 修正 "业内首个" 营销错误 + 真定位 "首个 OKR 决议链 OS" 4 件独家 |
