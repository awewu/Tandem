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
| **2026-03** | **腾讯 WorkBuddy** | 个人主权桌面执行 Agent | 接企微/钉钉/飞书/QQ |
| **2026-06** | **腾讯 WorkBuddy 企业版 + Agent Suite** | 个人→组织级转向 | 20+ 垂直场景 |
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

## 六、中央 AI = 组织治理大脑 (代理 Owner 立的宪法, 非代理 CEO 个人) (2026-06-07 增补)

> Owner 2026-06-07 定调核心命门: **"我们的核心是中央 AI 要足够聪明, 代理 CEO 治理公司。"**
> §三 的 4 件独家事 (OKR 锚 / 17min 议事 / D humanOnly / Memory 签批) 都只是这个 Agent 的
> **器官表现**; 真正的护城河是底下那个东西 —— 中央 AI (CompanyBrain) 本身的智能 + 治理权威。

### 6.1 中央 AI 权力模型 (防变形, 必须先钉死)

> ⚠️ 退役"代理 CEO"措辞 (Owner 2026-06-07 指出歧义)。"代理 CEO"会被误读成"代理 CEO 这个人/
> 这个岗位的拍板权"。**中央 AI 代理的不是 CEO 这个人, 是 Owner 立的组织宪法 (红线/OKR/价值观)。**
> 拆成三层, 一切歧义消解:

**① 权力来源层 · 宪法**: 中央 AI 的治理权威来自**组织宪法**, 宪法由 **Owner / 老板 (创始人)** 设定与
修订, **只有 Owner 级权限能改它的宪法** (红线/它治理什么/它的边界)。Steward 只执行审计, 不能改宪法。

**② 治理执行层 · 运营**: 中央 AI 对**全体成员一视同仁**执行宪法 —— **包括 CEO 本人**。CEO 是组织
成员/员工 (有自己的搭子), CEO 的拍板只是流程的一个环节, 同样过红线、同样锚 OKR、同样受 24h 否决。
CEO 是**被治理的节点, 不在治理之上**。

**③ 认知参谋层 · 超级智能体**: 结合公司全貌回答问题、给 3+1 参考, 但**不 originate 核心重大决策**。
回答能力分三档:

| 问题类型 | 中央 AI 行为 |
|---|---|
| 普通问题 | 结合全貌**全量作答** (超级智能体) |
| 核心重大决策类 | 给 **3+1 参考, 不替人拍板** (`humanOnly`, `lib/decision-layer/three-plus-one-engine.ts`) |
| **宪章约束类** (红线话题: 个体薪资/裁员名单/法律责任认定/对外正式承诺/资金条款等) | **不作答, 转人/转流程** |

> "**有限度回答**" (Owner 2026-06-07 定义) = 第三档: **宪章约束的问题, 中央 AI 不作答**。
> 关键: 这个"限度"的来源 = 同一部宪法 (层①) —— 同一套红线既定义"什么动作被拦"(治理), 也定义
> "什么问题不答"(认知边界), **一个 SSOT**。

> 一句话: 中央 AI 不"代理 CEO 这个人", 而是**执行 Owner 立的组织宪法**: 治理所有人 (含 CEO) /
> 超级参谋但不拍板 / 宪法只有 Owner 能改。它是"治理大脑 + 超级参谋", 不是"独裁 CEO"。
> (守 `/atlas` §2 "不替高管拍板")

### 6.2 这一层的竞品对标 (没人这么定位)

| 维度 | Glean | M365 Copilot | Agentforce | 飞书智能伙伴 | 钉钉 AI 助理 | 腾讯 WorkBuddy 企业版 | **Tandem 中央 AI** |
|---|---|---|---|---|---|---|---|
| 组织第一人称视角 (代表公司发言) | ❌ | ❌ | 🟡 | ❌ | ❌ | ❌ | ✅ CompanyBrain |
| 红线一票否决 (个人不能解除) | 🟡权限 | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 | ✅ governedChat L0 |
| 每决策强制锚 OKR | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ B-014 |
| 跨人协同决策治理 (议事) | ❌ | ❌ | ❌ | 🟡纪要 | 🟡 | ❌ | ✅ 17min FSM |
| 自我反思迭代组织 IQ | ❌ | ❌ | 🟡 | ❌ | ❌ | ❌ | ✅ CA-13 (骨架) |
| **组织治理大脑定位 (代理 Owner 立宪)** | ❌助手 | ❌助手 | ❌按角色 | ❌助手 | ❌助手 | ❌执行体 | ✅ **独家定位** |

**结论**: 别家全是"更强的个人助手 / Agent 开发平台 / 执行体", **没有一家把自己定位成
"执行 Owner 立宪、治理全员 (含 CEO) 的组织治理大脑"**。这是 Tandem 最深、也最难被抄的差异化。

### 6.3 诚实自评: 我们"够聪明"了吗? (治理权威已立, 智能深度未到)

按 `docs/CENTRAL-AI-ARCHITECTURE.md` 自评 (企业 Agent 11/14 器官):

- ✅ **治理脚手架强** (8-9/10): `governedChat` 4 闸 + 红线一票否决 + OKR 锚 + Memory 三级签批。
- 🔴 **"聪明" (像 CEO 一样推理判断) 弱**:
  - 微回路还是 single-shot (CA-5 multi-step 未补) → 判断深度不够。
  - tool calling / MCP 业务未接 (CA-6/7) → 不能真去查数据再判断, 只能凭注入的上下文说话。
  - CA-13 反思闭环代码已落但**缺决策数据** → "自我迭代组织 IQ"还没转起来。

> **判读**: 现在是"**严格但还不够聪明的代理治理者**"。要做到 Owner 要的"足够聪明",
> 缺的正是 CENTRAL-AI 的 3 件器官 (#12 主循环精细化 / #13 执行肢体 / #11 学习数据)。
> 治理权威是骨架, 智能深度是血肉 —— 骨架立住了, 血肉是下一阶段的主战场。

### 6.4 WorkBuddy 企业版 (2026-06-05) 的信号 (补 §一 时间线缺口)

`COMPETITIVE-ANALYSIS` v1 (5-30) 写在 WorkBuddy 企业版 (6-05) 之前, 故缺。补上:

- **WorkBuddy** = 腾讯 CodeBuddy 团队的桌面执行 Agent (2026-03-09), 个人主权"一句话替你上班",
  本地跑、接企微/钉钉/飞书/QQ; **2026-06-05 发企业版 + Agent Suite**, 从"超级个体"往"组织级"爬。
- **信号 (印证我们)**: 连腾讯都在确认"个人 Agent 提升的是个人生产力, 企业要的是组织级跃升"
  —— 印证 Tandem"组织主权"赛道是真需求, 不是臆想。
- **但它不是同物种**: WorkBuddy 的"组织级" = 更多个人 Agent + 管理后台, **不是**执行宪法、治理全员的
  组织治理大脑。它没有红线一票否决 / 强制 OKR 锚 / 组织第一人称视角。
- **威胁**: 腾讯有**企业微信分发** (Tandem 永远没有)。正面拼"组织级生产力套件"必输。
- **应对 (Owner 2026-06-08 修正)**: 不押"做竞品的治理底座 (Skill Gateway 当 MCP server, WorkBuddy/Cowork
  当受治理 Client 穿 4 闸)" —— **竞品产品不会自愿当你网关下的 client, 这不是真护城河**。整条 MCP/对外互通线
  **降为远期可选**。真应对 = **学竞品的技术做法, 吸收进我们自己的栈, 全压自用智能主轴**: 搭子装执行肢体
  (内部 tool-loop) + S2 多步推理 + B-024 反思学习, 把"治理强/智能弱"补成"会查会推会学"的自有组织治理大脑。
  > 注: 给中央 AI/搭子**自己**装手的**内部**工具回路 (`runToolLoop` 调 `okr.health_digest`/`memory.search`,
  > S1 已落) 是**自用**, 不在降级范围; 降的是"与竞品产品做产品级 MCP 互通"。

### 6.5 能讲 / 不能讲 (本层)

- ✅ "中央 AI 是**执行 Owner 立宪**的组织治理大脑 (治理含 CEO / 超级参谋不拍板 / 宪法只 Owner 能改), 业内无同定位"
- ❌ "中央 AI **代理 CEO 个人 / 代替 CEO 决策**" (违背 §6.1 权力模型 + §2 + 反 AI 欺诈哲学, 且智能深度未到 —— 诚实底线)
- ✅ "腾讯 WorkBuddy 企业版印证组织级赛道, 但它做**执行 Agent**, 我们做**自有的组织治理大脑** (治理全员+超级参谋)"
- ❌ "完全超越 WorkBuddy / Copilot" (分发体量碾压我们, 命题错位)
- ❌ "做 Cowork/WorkBuddy 的治理底座 (它们当我们 MCP Client 穿 4 闸)" (Owner 2026-06-08 修正: 竞品不会自愿当你网关 client, 非真护城河; 整条对外 MCP 互通线降远期, 资源压自用智能主轴)

---

## 七、修订历史

| 日期 | 修订 |
|---|---|
| 2026-05-30 PT | v1 创建. 锁定时间线 + 4 款主竞品对比 + 修正 "业内首个" 营销错误 + 真定位 "首个 OKR 决议链 OS" 4 件独家 |
| 2026-06-07 PT | v2 增补 §六: 中央 AI 治理大脑层对标 (6 维竞品表 + 诚实自评"治理强/智能弱") + WorkBuddy 企业版 (6-05) 转向信号 + 治理底座应对 |
| 2026-06-07 PT | v2.1 §6.1 退役"代理 CEO"歧义措辞, 重写为三层权力模型 (①宪法=Owner立宪唯一可改 ②治理执行=含CEO一视同仁 ③认知参谋=超级智能不拍板) + 回答三档 (普通全量答/决策给3+1/宪章约束类不作答转人); 全文措辞同步对齐 |
| 2026-06-08 PT | v2.2 §6.4/§6.5 Owner 纠偏: 退役"做 Cowork/WorkBuddy 治理底座 (它们当 MCP Client 穿4闸)"应对 —— 竞品不会自愿当你网关 client, 非真护城河; 整条对外 MCP 互通线降为远期可选, 资源全压自用智能主轴 (搭子内部 tool-loop / S2 / B-024)。保留区分: 自用内部 tool-loop (S1) 不降级。同步 DAZI-BEYOND-COWORK §五⑤/§六 |
