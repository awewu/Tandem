# 竞品一对一深度拆解 · WorkBoard / Asana Agentic / 腾讯 WorkBuddy 企业版 (2026-06-09)

> **定位**: 本文是机制级 (how it actually works) 拆解, 补 `COMPETITIVE-ANALYSIS-2026-05-30.md`
> 的缺口 —— 那篇是时间线 + 叙事 + 4 款主竞品 (Coze/Claude/Copilot/ChatGPT) 的产品哲学对位;
> 本文只深挖三家与 Tandem **赛道最近**的对手, 拆它们的 agent 真实运作方式, 诚实标注 Tandem 哪里输、
> 哪里有防守锚、哪些技术做法可吸收进自用栈 (呼应 §6.4 "学竞品做法、全压自用智能主轴")。
>
> **资料来源**: 2026-06-09 公开官网 + 新闻稿检索 (workboard.com / asana.com/product/ai /
> copilot.tencent.com/work / technode 2026-03-09 报道)。下方"机制"基于公开描述, 非内部资料,
> 凡推断处显式标注 *(推断)*。

---

## 0. 一句话坐标

| 竞品 | 物种 | 主权归属 | 与 Tandem 的关系 |
|---|---|---|---|
| **WorkBoard** | OKR 战略执行平台 + 治理型 agent | 组织 (但 agent=参谋/秘书) | **最危险的正面对手** (同走 OKR 战略执行) |
| **Asana** | 工作管理平台 + 协作型 agent | 组织 (agent=队友) | **侧翼威胁** (工作流编排强, OKR/治理弱) |
| **腾讯 WorkBuddy 企业版** | 桌面执行 agent + 专家团 | **个人主权** (一人指挥专家团) | **不同物种** (执行体 vs 治理大脑), 但有企微分发 |

---

## 1. WorkBoard 深度拆解 (正面对手)

### 1.1 它是什么
企业级**战略执行 + OKR 平台**。2025 收购 Quantive (原 Gtmhub) 整合 OKR 头部资产; 2025 下半年靠
"AI agents" 录得创纪录增长; 与 **Workday + Microsoft** 建立分销/集成伙伴关系。把公司/团队/个人三层
OKR 连成一张图, agent 在这张图上做"战略执行的准备工作"。

### 1.2 Agentic 机制拆解 (公开能力)
WorkBoard 的 agent **不是通用对话助手**, 是**围绕经营节律 (operating rhythm) 的专用 agent 群**:

- **会议准备 agent**: 自动生成 **scorecard / bowler / MBR / QBR 视图**, 并**分发 pre-read** ——
  即开经营回顾会之前, agent 已把"该看哪些数、该讨论哪些缺口"准备好推给与会者。
- **诊断 agent**: 对经营障碍 / 未达标原因 / 团队动态做**即时分析**, 并产出"现在就能执行的改进计划"。
- **跨系统阻塞扫描**: 评估 **Jira / CRM pipeline** 里阻碍 outcome 的 blocker —— 把执行层工具的
  真实信号拉回 OKR 视角。
- **对齐**: company → team → individual OKR 全程级联, agent 在级联结构上推理。

> **机制本质** *(推断)*: WorkBoard 走的是"**结构化数据 + 模板化产物 (MBR/QBR/scorecard)**"路线 ——
> agent 的智能主要花在"把 OKR 真值 + 外部系统信号编排成经营回顾物料", 而非自由推理。这是**窄而深**的
> agent, 对"季度经营回顾"这个高频企业仪式做到了端到端自动化。

### 1.3 真优势 (Tandem 当前不如)
- **OKR 数据资产成熟度**: 收购 Quantive, 多年 OKR 真值结构 + 经营回顾模板沉淀。Tandem 的 OKR 引擎年轻。
- **经营节律产品化**: MBR/QBR/scorecard/bowler 是大企业管理层的刚需仪式, WorkBoard 做成了 agent 产物。
  Tandem 有议事 (单次决策) 但**没有"季度/月度经营回顾"这条线**。
- **分销**: Workday + Microsoft 渠道 = 直达大型企业。

### 1.4 软肋 (Tandem 的反击点)
- **agent 是参谋/秘书, 不是治理者**: 它准备物料、做诊断, 但**不对全员强制红线、不一票否决、不反 AI 欺诈**。
  没有"组织第一人称、执行 Owner 立宪"的治理大脑定位。
- **无 17min 议事硬上限 / 无 D 选项 humanOnly / 无 Memory 三级签批** (见 §三 4 件独家)。
- **重经营回顾、轻日常决策治理**: 它优化的是"管理层看数开会", 不是"每个员工每次决策都锚 OKR + 过红线"。

### 1.5 可吸收的技术做法 (进自用栈)
> 呼应 §6.4 "学竞品做法、吸收进自有栈":
- **★ 经营回顾 agent 产物 (最高价值)**: Tandem 应补一条 **"月度/季度经营回顾"** 线 —— 复用已有的
  `analyzeOkrHealth()` (`lib/persona/company-brain-reflection.ts`, 已扫承压 KR 产参谋建议) +
  `runToolLoop` 的 `okr.health_digest`, 自动生成"经营回顾 pre-read"。这是把**已有器官**组装成
  WorkBoard 同款仪式, 增量小、杠杆大。
- **跨系统 blocker 扫描**: 远期 (MCP 互通已降级), 但内部 tool-loop 可先做"扫 TTI/行动项里逾期/阻塞项"。

---

## 2. Asana Agentic Work Management 深度拆解 (侧翼威胁)

### 2.1 它是什么
工作管理平台的 agentic 升级。**Agentic Work Management = AI Teammates + AI Studio + Asana Dash +
MCP/AI Connectors**, 全部跑在 Asana 多年的 **Work Graph** (任务/项目/依赖/负责人的关系图) 之上。
2025 收购 **StackAI** 强化 agent 构建能力。

### 2.2 Agentic 机制拆解
- **AI Teammates (协作型 agent)**: 官方定调 —— "agent 的价值在于**与人协作、执行有细微差别的工作**,
  而非纯自主"。Teammate 可被指派任务、@、参与工作流, 像一个能干活的团队成员, 把自动化从"简单任务"
  延伸到"复杂工作流"。
- **AI Studio (无代码工作流编排)**: 让流程负责人 (PM/运营/IT) **不写代码**就能设计"smart workflow" ——
  在 Work Graph 上挂 AI 步骤 (分类、起草、路由、汇总), 把重复劳动委托出去。
- **Asana Dash**: 跨工作流的 AI 概览/驾驶舱 *(推断: 聚合视图)*。
- **MCP + AI Connectors**: 接外部工具/模型, 让人-agent 工作流在一个地方跑。

> **机制本质**: Asana 的护城河是 **Work Graph (结构化的工作关系数据)** + **无代码编排民主化**。
> agent 的智能锚在"已有项目/任务结构"上, 让业务人 (非开发) 自助搭 agent 工作流。这是"**广而浅**"路线 ——
> 覆盖所有团队的日常工作流, 但不深入战略治理。

### 2.3 真优势 (Tandem 当前不如)
- **Work Graph 数据底座**: 海量真实任务/项目/依赖关系, agent 推理有结构化燃料。Tandem 的工作图谱年轻。
- **无代码编排成熟度**: AI Studio 让非开发自助搭工作流, 采纳门槛极低。Tandem 的 Skill Gateway 在 V2, 没有
  面向业务的可视化编排。
- **agent-as-teammate 体感**: 指派/@/协作的产品化做得早且顺。
- **庞大存量客户**: 直接在已付费工作区里开 agent, 零迁移。

### 2.4 软肋 (Tandem 的反击点)
- **OKR 是配角**: Asana 有 Goals, 但**不是每次工作必锚 OKR 的代码不变量**; agent 不会因"没锚 KR"拦你。
- **无组织治理大脑**: agent 是"更能干的队友", 没有红线一票否决 / 组织第一人称 / 反 AI 欺诈。
- **无议事收敛仪式**: 有工作流, 但没有"17min 硬上限 + 3+1 + D humanOnly + 24h 否决"的**跨人决策治理**。
- **协作型 ≠ 治理型**: 它帮你**更快做完**, 不管你**该不该做 / 是否偏离战略红线**。

### 2.5 可吸收的技术做法 (进自用栈)
- **★ agent-as-teammate 的指派/协作 UX**: 搭子 (个人分身) 可借鉴"可被 @、可被指派行动项、在工作流里
  留痕"的体感 —— 已有 ProxyAction + 行动项, 缺的是"分身作为可指派协作节点"的产品化。
- **无代码工作流编排 (远期)**: AI Studio 是 Skill Gateway V2 的产品形态参照 —— 但须经 4 闸治理 (这是
  Tandem 的差异: Asana 编排无组织红线约束, Tandem 编排必过 baseline-guard)。

---

## 3. 腾讯 WorkBuddy 企业版 深度拆解 (不同物种 + 分发威胁)

### 3.1 它是什么
腾讯 CodeBuddy 团队出品的**桌面执行 agent** (2026-03-09 上线, 企业版 2026-06 扩展)。
"小龙虾 OpenClaw" 同款路线: **完全兼容 OpenClaw skills**, 20+ 技能包, 支持 **MCP**; 1 分钟装好、连企微,
手机即可"遥控"它在电脑上干活。企业版主打 **"召唤 AI 专家团"** —— 运营/设计/财务/法务/开发等岗位
专家**多专家并行**, 从策略到交付端到端自主完成。

### 3.2 Agentic 机制拆解
- **桌面执行肢体**: agent 真正操作本地桌面应用 (打开文件、analyze 数据、调 API、生成报告), 端到端跑
  完整工作流 —— 这是**真·执行肢体**, 比"对话给建议"重得多。
- **专家团 (multi-agent 角色化)**: 把不同岗位能力封装成"专家", 一条指令拆给多专家并行 (PM 定需求 →
  架构师拆任务 → 工程师批量实现 → QA 验证)。**角色化 + 编排 + 并行**。
- **OpenClaw skill 兼容 + MCP**: 直接复用开源 skill 生态, 扩展性强。
- **企微/钉钉/飞书/QQ 集成**: 在 IM 里直接发指令、拿结果。
- **场景化**: 智能会议管家 (实时转录/纪要/待办分派) / 文档智能中枢 (周报/合同初稿/合规检查) /
  任务自动化引擎 (客户跟进/商机更新)。

> **机制本质**: WorkBuddy = **个人主权的超级执行体** —— "一人指挥, 全行业专家执行"。它的智能花在
> "把一句话指令变成跨应用的实际动作"。主权在**个人**: 你指挥、它执行、结果归你。

### 3.3 真优势 (Tandem 永远拿不到的)
- **★ 企业微信分发**: 腾讯的天然渠道, 触达海量企业。**Tandem 永远没有这个** —— 正面拼"组织级生产力套件"必输。
- **真桌面执行肢体**: 操作真实软件, 比 Tandem 的内部 tool-loop (只读 OKR/Memory) 重得多、广得多。
- **OpenClaw 生态**: 复用开源 skill, 不重造轮子。
- **零部署**: 1 分钟上手, 采纳摩擦极低。

### 3.4 软肋 (Tandem 的防守锚 = 物种差异)
- **个人主权 ≠ 组织治理**: WorkBuddy 提升的是**个人/小团队生产力**, 它的"组织级" = 更多个人 agent + 管理
  后台, **不是**执行 Owner 立宪、治理全员 (含 CEO) 的**组织治理大脑**。
- **无红线一票否决 (个人不可解除) / 无强制 OKR 锚 / 无组织第一人称视角 / 无反 AI 欺诈 D 选项**。
- **执行强、治理空**: 它会**高效替你把事做完**, 但不管"这事是否偏离公司战略红线、是否该由人签字"。

### 3.5 可吸收的技术做法 (进自用栈)
> 这正是 §6.4 主战场 —— **学它的执行肢体做法, 装进受治理的自用栈**:
- **★ 内部 tool-loop 扩面 (最高价值)**: WorkBuddy 证明"执行肢体"是 agent 价值的大头。Tandem 的
  `runToolLoop` (`lib/agent-runtime/tool-loop.ts`) 已建好框架, 但当前工具偏只读 (okr/memory/decision)。
  下一步: 在**红线内**给搭子/中央 AI 加更多**写动作经 ProxyAction 24h 否决**的工具 (起草周报、拟行动项、
  填 KR check-in 草稿) —— 拿 WorkBuddy 的"会干活", 但每个写动作都过 4 闸 + 24h 否决 (这是差异)。
- **专家团 = 多 Persona 编排 (远期)**: WorkBuddy 的"专家并行"对应 Tandem 多分身协作, 但 Tandem 的分身
  受中央 AI 强管控 (§19.5 受控铁律), 不是自由专家团。
- **会议管家**: 议事室可吸收"实时纪要 + 待办自动分派"(已有 ActionItem, 缺实时转录入口)。

---

## 4. 三家 head-to-head (Tandem 视角, 只列决胜维度)

| 维度 | WorkBoard | Asana | WorkBuddy 企业版 | **Tandem** |
|---|---|---|---|---|
| 物种 | OKR 执行平台 | 工作管理平台 | 桌面执行 agent | **OKR 决议 + 组织治理 OS** |
| 主权 | 组织 (agent=参谋) | 组织 (agent=队友) | **个人** | **组织 (执行 Owner 立宪)** |
| 每决策强制锚 OKR | 🟡 战略支柱非不变量 | ❌ Goals 是配角 | ❌ | ✅ 代码不变量 `validateOkrAnchor` |
| 红线一票否决 (个人不可解除) | ❌ | ❌ | ❌ | ✅ governedChat L0 |
| 跨人决策治理 (议事收敛) | ❌ | 🟡 工作流非决策仪式 | ❌ | ✅ 17min FSM + 3+1 |
| 反 AI 欺诈 (D humanOnly) | ❌ | ❌ | ❌ (反而全自动) | ✅ |
| 知识沉淀治理 (三级签批) | ❌ | ❌ | ❌ | ✅ Memory 4 层 SLA |
| 自我反思迭代组织 IQ | ❌ | 🟡 | ❌ | ✅ CA-13 (本次补燃料, 见 §5) |
| **真执行肢体 (操作真实软件)** | 🟡 限经营回顾物料 | 🟡 限工作流步骤 | ✅ **强 (桌面全场景)** | 🔴 弱 (内部只读 tool-loop) |
| **无代码 agent 编排** | 🟡 | ✅ **强 (AI Studio)** | ✅ (skill 生态) | 🔴 弱 (Skill Gateway V2) |
| **OKR 数据资产成熟度** | ✅ **强 (并 Quantive)** | 🟡 | ❌ | 🟡 年轻 |
| **分发渠道** | ✅ Workday/MS | ✅ 存量客户 | ✅ **企微 (碾压)** | 🔴 无 |

**读法**:
- Tandem 的**护城河列** (强制 OKR 锚 / 红线一票否决 / 议事治理 / 反 AI 欺诈 / 三级签批 / 自反思) —— **三家全空**。这是真差异化, 难被抄 (是产品哲学不是技术)。
- Tandem 的**短板列** (执行肢体 / 无代码编排 / OKR 数据成熟度 / 分发) —— **三家各有一项碾压**。这是要补的血肉。
- **战略含义**: 不在短板列正面拼 (尤其分发, 必输); 把护城河列做到无可争议, 同时**吸收执行肢体做法进受治理的自用栈** (§6.4 主轴)。

---

## 5. 对 Tandem 的行动项 (本轮已落 + 待办)

### ✅ 本轮已落 (2026-06-09)
- **CA-13 学习闭环补燃料**: 三家都没有"自反思迭代组织 IQ", 这是 Tandem 独家但**之前缺决策数据没转起来**。
  本轮把**议事 COMMIT/VETO 的选项采纳信号自动回灤** CompanyBrain `meeting_advice` 决策 + 即时反馈
  (`lib/persona/company-brain-decision.ts recordMeetingAdviceOutcome` + `lib/convergence/orchestrator.ts`):
  选 B→adopted / 选 D 或 VETO→overruled / 选 A·C→modified。让月度反思有稳定的采纳/推翻梯度 ——
  **把独家器官真正点亮**。(单测 11/11 绿, tsc 0 错)

### 🔜 待办 (按杠杆排序, 对位本拆解)
1. **执行肢体扩面** (对位 WorkBuddy §3.5): `runToolLoop` 加"写动作经 ProxyAction 24h 否决"的工具 ——
   拿 WorkBuddy 的"会干活", 但每写动作过 4 闸。**最高杠杆补血肉**。
2. **经营回顾 agent 产物** (对位 WorkBoard §1.5): 复用 `analyzeOkrHealth` + `okr.health_digest` 自动生成
   月度/季度回顾 pre-read。**用已有器官组装、增量小**。
3. **agent-as-teammate UX** (对位 Asana §2.5): 搭子作为可 @ / 可指派的协作节点产品化。

---

## 6. 修订历史
| 日期 | 修订 |
|---|---|
| 2026-06-09 PT | v1 创建. 三家 (WorkBoard/Asana/WorkBuddy 企业版) 机制级一对一拆解 + 决胜维度 head-to-head + 行动项对位 (本轮 CA-13 补燃料已落)。补 COMPETITIVE-ANALYSIS-2026-05-30 的机制深度缺口。 |
