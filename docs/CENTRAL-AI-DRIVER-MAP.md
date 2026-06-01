# 中央 AI 驱动全模块复盘 (Central AI Driver Map)

> **版本**: 2026-06-01
> **目的**: 复盘所有开发计划，说明中央 AI（CompanyBrain）如何驱动和介入到所有模块
> **前置**: `MASTER-UPGRADE.md` · `CENTRAL-AI-ARCHITECTURE.md` · `OKR-DRIVEN-ARCHITECTURE.md` · `CONVERGENCE-PRINCIPLE.md`

---

## 一、中央 AI 的第一性原理

### 1.1 存在目的

**Tandem 中央 AI 是一个企业级 Agent，存在目的 = OKR 驱动 / 战略执行。**

- 不是"组织 IQ 放大器"这种抽象抒情
- 一切器官、回路、路径都为 OKR 达成服务
- 任何功能若不能回答"它如何服务 OKR 达成？" = 砍

### 1.2 4 时间尺度回路

```
⚡ 微回路 (秒级)         IM/⌘K 召唤 → Baseline-Guard → LLM 调用 → 输出 → ProxyAction (24h 否决)
🎯 中回路 (议事级)       Convergence 状态机 17 分钟: ALIGN → FRAME → DIVERGE → CONVERGE → COMMIT (3+1 决策)
🌙 长回路 (反思级)       每月 CompanyBrain Reflection: Decision Log → 失败模式分析 → Version 迭代 → 治理签批
🏛️ 超长回路 (组织级)     季/年级沉淀: Memory 4 层 + Persona 5 阶段 + Skill 库 + 决策卡谱系 → 离职带不走
```

### 1.3 18 件器官

| # | 器官 | 状态 | 模块介入 |
|---|---|---|---|
| 1 | 第一人称视角 (CompanyBrain Persona) | ✅ | 全局 |
| 2 | 大脑选择层 (TAF Router 6 family LLM) | ✅ | 全局 |
| 3 | 价值判断 (Baseline-Guard) | ✅ | 全局 |
| 4 | 长期记忆 (Memory 4 层) | ✅ | 知识库 |
| 5 | 社交协同神经 (议事 Convergence) | ✅ | 议事室 |
| 6 | 情景记忆 (DecisionCard 谱系) | ✅ | 议事室 |
| 7 | 元认知 (AuditLog + LlmUsageLog) | ✅ | 全局 |
| 8 | 冲动控制 (ProxyAction 24h 否决) | ✅ | 搭子/IM |
| 9 | 超我 (promotion-flow 3 级签批) | ✅ | 知识库 |
| 10 | 角色成长曲线 (Persona 5 阶段) | ✅ | 拿捏 |
| 11 | 学习与进化层 (Decision Log + Reflection) | 🟡 | 全局 |
| 12 | 主循环精细化 (multi-step ReAct) | ❌ | 议事室 (V2) |
| 13 | 执行肢体 (Tool Calling / MCP) | ❌ | 全局 (V2) |
| 14 | 习惯沉淀 (Skill 库) | ❌ | 搭子 (V3) |
| 15 | OKR Anchor 注入器 | ❌ | 全局 (V1.5) |
| 16 | OKR Drift 检测 | ❌ | 全局 (V1.5) |
| 17 | 个人 AI 产出 Capture 层 | ❌ | 搭子 (V2) |
| 18 | Skill Gateway (4 道闸) | ❌ | 搭子 (V2-V3) |

---

## 二、中央 AI 驱动全模块总图

```
                    ┌──────── OKR / 战略目标 ────────┐
                    │     (一切的源头, 不可绕过)       │
                    └──────────────┬──────────────────┘
                                   │ 注入 / 锚定
                                   ▼
              ┌─────────────────────────────────────┐
              │   CompanyBrain (中央 AI)            │
              │   ┌─────────────────────────────┐   │
              │   │ Skill Gateway (4 道闸)       │   │
              │   │ ① Baseline-Guard            │   │
              │   │ ② OKR Drift Detection       │   │
              │   │ ③ Data Scope                │   │
              │   │ ④ Action Scope              │   │
              │   └─────────────────────────────┘   │
              └─────────┬───────────────────────────┘
                        │
        ┌───────────────┼───────────────┬───────────────┐
        ▼               ▼               ▼               ▼
   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
   │ 事半    │    │ IM      │    │ 文档    │    │ 邮箱    │
   │ (OKR)   │    │         │    │ /知识库 │    │         │
   └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘
        │              │              │              │
        ▼              ▼              ▼              ▼
   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
   │ 议事室  │    │ 搭子    │    │ 拿捏    │    │ 组织    │
   │ (决策)  │    │ (召唤)  │    │ (成长)  │    │ (治理)  │
   └─────────┘    └─────────┘    └─────────┘    └─────────┘
```

---

## 三、中央 AI 介入各模块详解

### 3.1 事半（OKR 板块）

**核心原则**: 牛马 = OKR 驱动器，严格版。每一项任务/自动化/通知/ToDo 必须可回溯到当前 OKR。

#### 中央 AI 介入点

| 介入点 | 中央 AI 动作 | 技术实现 |
|--------|------------|----------|
| **OKR 锚定注入** | CompanyBrain 每次回复前嵌入当前 active 公司 OKR + 战略主题 | `lib/persona/company-brain.ts` system prompt 动态注入 (器官 #15) |
| **OKR Drift 检测** | 检测 intent 是否偏离当前 OKR，不偏离 → PASS，边缘 → SOFT_WARN，远离 → 询问 | Baseline-Guard 加第二种判断 (器官 #16) |
| **级联编辑** | AI 辅助级联 inline 编辑，自动对齐父目标 | `app/okr/cascade/page.tsx` + AI 推荐对齐 |
| **季度复盘流** | AI 自动聚合 DC + 日报 + 偏差 + AI 摘要 | `/okr/review` 自动复盘 |
| **1on1 会前议程** | AI 自动拉取下属 OKR + 高偏差项 + 生成议程 | 1on1 与 OKR 联动 |
| **信心指数趋势** | AI 分析每周 check-in 信心指数变化 | KR 信心指数折线图 |
| **多周期对比** | AI 对比同部门/人跨周期进展 | `/okr/compare` AI 分析 |
| **绩效面谈模板** | AI 生成结构化面谈模板 | 1on1 内置模板库 |

#### 数据流

```
OKR 设定 → CompanyBrain 注入 OKR 锚 → 所有 AI 回复锚定 OKR
    ↓
日报 AI 预填 → 自动算 KR 进度 → 反虚报闭环
    ↓
滞后预警 → AI 发现偏差 → 自动 spawn 议事室
    ↓
议事室决策 → Decision Card → 关联 KR → 执行追踪
    ↓
季度复盘 → AI 聚合 DC + 日报 → 自动生成复盘报告
```

---

### 3.2 IM（沟通协同）

**核心原则**: IM 沟通对标企业微信的完整沟通功能体系。

#### 中央 AI 介入点

| 介入点 | 中央 AI 动作 | 技术实现 |
|--------|------------|----------|
| **@AI 分身** | 员工 @Persona，中央 AI 调用 govern-persona (闸① + L2 + L4) → LLM 调用 → ProxyAction (24h 否决) | `lib/im/service.ts` `invokePersonaReply()` |
| **消息沉淀** | IM 消息自动识别议题 → 一键 spawn Decision Card | 悬浮条: 开议事室 / 沉淀 |
| **审批 Bot 卡片** | 审批推送到 IM + 卡片内同意/驳回 | AI 生成审批卡片 |
| **已读回执** | 中央 AI 监控已读状态 → 响应时效计算 | seq 主干 + per-user read cursor |
| **消息搜索** | AI 按关键词+时间+发送人搜索 | `/api/im/search?q=` |
| **智能分类** | AI 自动分类消息 (primary/social/promotions) | embedding + 分类模型 |

#### 数据流

```
IM 消息 → embedding 语义索引 → 全局搜索
    ↓
@Persona → govern-persona (4 道闸) → LLM 调用 → ProxyAction (24h 否决)
    ↓
消息沉淀 → 一键 spawn Decision Card → 关联 OKR
    ↓
审批 Bot 卡片 → AI 生成卡片 → IM 推送 → 同意/驳回
```

---

### 3.3 文档 / 知识库

**核心原则**: 知识库对标 Notion 的完整功能和逻辑，但加 Tandem 独特价值（AI 原生 + 决策闭环 + 知识治理）。

#### 中央 AI 介入点

| 介入点 | 中央 AI 动作 | 技术实现 |
|--------|------------|----------|
| **@ 文件进上下文** | chat / 议事 / persona 任何对话都能 @ 一个文件，LLM 拿到原文 | D-01: DocumentMentionPicker + resolveDocumentMentions |
| **上传即提议升级** | 用户传 PDF/Word，自动塞进"待提议升级 Memory"队列，走宪章 §8.1 三级签批 | D-04: promoteDocumentToMemory |
| **AI 列计算** | Bitable AI 列真调 LLM 跑每行 | D-02: `ai_compute` 列 + LLM 调用 |
| **行级议事派生** | Bitable 行右键"发起议事" → 复用 `/convergence?fromBitableRowId=...` | D-02: 行 → 议事室 |
| **行 → Memory** | 任意行可"沉淀为 Memory" (D-04 流程) | D-02: 行 → Memory 签批 |
| **反向链接** | AI 解析 `[[页面名]]` / `@页面名`，建立双向关系表 | 反向链接面板 |
| **全站搜索** | AI 跨文档/表格/Memory/IM 搜索 | `/api/search?q=` |
| **块编辑器** | AI 辅助块编辑 (`/` 命令呼出块) | Tiptap Block Extension |

#### 数据流

```
Document 创建 → MATERIALS 层 (全员可见，可编辑)
    ↓
员工/Steward 发起升级 → 三级签批 (业务 Leader → Steward → CEO → 公示)
    ↓
Memory 入库 → 向量库 (RAG) → CompanyBrain 引用
    ↓
Bitable AI 列 → LLM 调用 → 聚合计算
    ↓
Bitable 行 → 议事室 → Decision Card → OKR 执行
```

---

### 3.4 邮箱

**核心原则**: 邮箱对标 Google Mail 的价值体现。

#### 中央 AI 介入点

| 介入点 | 中央 AI 动作 | 技术实现 |
|--------|------------|----------|
| **IMAP 收件** | node-imap 定时拉取 + 存入 Message 表 | `/api/mail/imap/fetch` |
| **线程视图** | 按 Message-ID/References 聚合对话 | 线程聚合算法 |
| **标签系统** | AI 自动分类邮件 (primary/social/promotions) | AI 分类 |
| **智能撰写** | AI 辅助写邮件 (Persona styleProfile 调口吻) | Compose AI |
| **邮件 → 决议** | 外部邮件转内部工作流，收件界面一键 spawn Decision Card | 一键 spawn DC |
| **邮件搜索** | AI 全文索引 | `/api/mail/search?q=` |

#### 数据流

```
IMAP 收信 → 线程视图 → AI 分类 (primary/social/promotions)
    ↓
智能撰写 → AI 辅助写邮件 (Persona 口吻)
    ↓
邮件 → 决议 → 一键 spawn Decision Card → 关联 OKR
```

---

### 3.5 搭子（召唤工作台）

**核心原则**: 搭子工作台可以召唤技能加持工作能力，开放接入市面智能体。

#### 中央 AI 介入点

| 介入点 | 中央 AI 动作 | 技术实现 |
|--------|------------|----------|
| **Cmd+K 技能面板** | 全局 `Cmd+K` 技能面板，Raycast 式 | 统一召唤入口 |
| **工作台 Dashboard** | AI 生成今日工作流卡片: 待办 + 滞后预警 + 快速召唤 | 工作台 Dashboard |
| **技能推荐** | AI 上下文感知: 文档→摘要, OKR→日报 | 上下文感知推荐 |
| **技能连招** | AI 可视化拖拽技能节点 | Macro Builder |
| **技能使用统计** | AI 统计使用频率/成功率/节省时间 | 技能使用统计 |
| **技能评分** | AI 安装后评分 + 评论 + 排序 | 技能评分 |
| **Skill Gateway 4 道闸** | 个人 AI 调用任何外部 skill 都要经中央 AI 4 道闸过滤 | 器官 #18 |

#### 数据流

```
员工召唤技能 → Skill Gateway 4 道闸 (Baseline / OKR Drift / Data / Action)
    ↓
4 闸全过 → 外部 skill 真的执行
    ↓
产出 → Capture 层 (器官 #17) → 反哺组织: Memory promotion / Skill 提议 / DecisionCard
```

---

### 3.6 拿捏（员工成长平台）

**核心原则**: 拿捏是员工成长平台，类似养 OpenClaw 的技能增长。

#### 中央 AI 介入点

| 介入点 | 中央 AI 动作 | 技术实现 |
|--------|------------|----------|
| **技能树可视化** | AI 生成星图/技能树 UI | `/persona/evolution` 升级 |
| **经验值系统** | AI 每次决议/学习/训练 +XP，即时 toast | XP 系统 |
| **成就/徽章** | AI 生成里程碑徽章 (首次决议/首次升阶/连续日报...) | 成就系统 |
| **成长仪表盘** | AI 生成本周成长/累计 XP/技能掌握度/距离下阶段 | 成长仪表盘 |
| **成长预测** | AI 预测 "预计 3 周后达到 deputy" | AI 预测 |
| **个性化路径** | AI 根据岗位/OKR/薄弱项推荐课程和技能 | 个性化推荐 |
| **匿名百分位** | AI 计算 "决议质量超过 73% 同岗位" (无具体排名) | 匿名百分位 |

#### 数据流

```
Persona 5 阶段进化 (newborn→apprentice→assistant→deputy→partner)
    ↓
每次决议/学习/训练 +XP → 阶段升级
    ↓
技能树可视化 + 成就系统 + 成长仪表盘
    ↓
AI 个性化推荐课程和技能
```

---

### 3.7 议事室（决策收敛）

**核心原则**: 17 分钟议事室 + 3+1 决策框架，AI 给员工 3+1 选项，不替员工决策。

#### 中央 AI 介入点

| 介入点 | 中央 AI 动作 | 技术实现 |
|--------|------------|----------|
| **ALIGN 校准** | AI 提供前情摘要 / 关联 KR 状态 | 议事室 Step 1 |
| **FRAME 界定** | AI 识别决策类型 / 提示原则 | 议事室 Step 2 |
| **DIVERGE 发散** | AI 生成 🅰🅱🅲 / 检索 SOP/案例 | 议事室 Step 3 |
| **CONVERGE 收敛** | AI 检测分歧 / 暴露根源 | 议事室 Step 4 |
| **COMMIT 落地** | AI 生成 Decision Card 草稿 | 议事室 Step 5 |
| **3+1 决策框架** | AI 给 🅰 SOP / 🅱 推演 / 🅲 经验 / 🅳 自创 | 3+1 Decision Framework |
| **multi-step reasoning** | AI 走 Memory 召回 → 历史决策回顾 → 风险评估 → 利益相关人识别 → 时机判断 → 选项生成 | 器官 #12 (V2) |

#### 数据流

```
议事室创建 → 锚定 KR → 5 步骨架 (17 分钟)
    ↓
AI 生成 🅰🅱🅲 → 员工填 🅳 → 投票表决
    ↓
分歧 → AI 暴露根源 → 再讨论 1 轮 → 仍分歧 → 升级
    ↓
Decision Card 生成 → 关联 KR → 行动项追踪
    ↓
回溯 review → 反哺 Memory → CompanyBrain 学习
```

---

### 3.8 组织治理

**核心原则**: 组织治理三省六部协同，审计可见。

#### 中央 AI 介入点

| 介入点 | 中央 AI 动作 | 技术实现 |
|--------|------------|----------|
| **1on1 与 OKR 联动** | AI 自动拉取下属 OKR + 高偏差项 + 生成议程 | 1on1 联动 |
| **全链路审计可见** | AI 生成审计报告 (采纳率/成本/延迟全可见) | AuditLog + LlmUsageLog |
| **治理看板** | AI 生成阻断率 / 误判率 / 灰区数 / Top 命中 Memory | `/admin/governance` 看板 |
| **月报自动产出** | AI 自动生成治理月报 | CA-3 |
| **Baseline-Guard 灰区 LLM 仲裁** | sim ∈ [0.2, 0.45] 调 claude-opus-4-5 判定 | CA-2 |
| **Reflection loop** | 每月 CompanyBrain 复盘上月决策准确率，自动调阈值 | CA-9 |

#### 数据流

```
AuditLog + LlmUsageLog → AI 生成审计报告
    ↓
治理看板 → 阻断率 / 误判率 / 灰区数 / Top 命中 Memory
    ↓
月报自动产出 → CompanyBrain Reflection
    ↓
自动调阈值 → Baseline-Guard 优化
```

---

## 四、3 里程碑演进（中央 AI 角色变化）

### M1 连通（4-5 周）— 5 体系打通最小闭环

| 体系 | 升级动作 | 中央 AI 角色 |
|------|----------|------------|
| **AI 赋能** | 全员 Ask Tandem 入口 + Cmd+K 面板 + 问答历史 | 中央 AI 成为全员可见入口 |
| **战略执行** | 级联 inline 编辑 + 季度复盘流 + 1on1 会前议程 | 中央 AI 辅助 OKR 管理 |
| **知识治理** | `/workspace` 统一空间 + 全局搜索回归 | 中央 AI 驱动知识检索 |
| **沟通协同** | 邮箱 IMAP 收件 + 审批→IM 闭环 | 中央 AI 辅助邮件处理 |
| **组织治理** | 1on1 与 OKR 联动 + 全链路审计可见 | 中央 AI 生成审计报告 |

### M2 深化（3-4 周）— AI 成为默认交互层

| 体系 | 升级动作 | 中央 AI 角色 |
|------|----------|------------|
| **AI 赋能** | 上下文感知推荐 + AI 生成日报/复盘/邮件 (Persona 口吻) | 中央 AI 上下文感知 |
| **战略执行** | 信心指数趋势 + 多周期对比 + 绩效面谈模板 | 中央 AI 深度分析 OKR |
| **知识治理** | 块编辑器 (Tiptap Block) + 看板/日历视图 | 中央 AI 辅助文档编辑 |
| **沟通协同** | IM 响应式 + 语音消息 + 邮箱线程视图 | 中央 AI 语音识别 |
| **组织治理** | 成长仪表盘 + XP 系统 + 成长预测 | 中央 AI 个性化推荐 |

### M3 涌现（3-4 周+）— 体系联动产生涌现

| 联动 | 涌现效应 | 中央 AI 角色 |
|------|----------|------------|
| 战略 × AI | OKR 自动发现偏差 → 自动 spawn 议事室 → 自动生成复盘 | 中央 AI 自动闭环 |
| 知识 × AI | 文档自动提取 Memory 候选 → 自动 propose 升级 | 中央 AI 自动知识治理 |
| 沟通 × AI | IM 消息自动识别议题 → 一键 spawn DC | 中央 AI 自动决策提取 |
| AI × 知识 | 问答自动沉淀 Memory → 反哺 Baseline | 中央 AI 自动学习 |
| 组织 × AI | 1on1 前自动议程 → 会后自动成长建议 | 中央 AI 自动辅导 |

---

## 五、中央 AI 的 4 道闸（Skill Gateway）

**这是中央 AI 最核心的介入点，所有个人 AI 调用都要经过。**

```
员工调用市面 AI 技能
(Claude Code skill / OpenClaw skill / Hermes skill / Cursor MCP / ChatGPT plugin / ...)
                    │
                    ▼
       ┌──────────────────────────────────┐
       │  Tandem Skill Gateway             │
       │  (CompanyBrain 拦截层)             │
       └────────────────┬─────────────────┘
                        │
                        ▼
       ┌────────────────────────────────────────────────┐
       │  4 道闸 (任何一道挡住即拦截或降级):                │
       │                                                │
       │  ① Baseline-Guard                              │
       │     是否违反公司 Memory                          │
       │                                                │
       │  ② OKR Drift Detection (新, 器官 #16)           │
       │     intent 是否偏离当前 OKR                      │
       │                                                │
       │  ③ Data Scope (数据边界)                        │
       │     这个 skill 能读哪些数据 / 能写哪些数据         │
       │                                                │
       │  ④ Action Scope (行为边界)                       │
       │     这个 skill 能调哪些工具                       │
       │                                                │
       └────────────────┬───────────────────────────────┘
                        │ 4 闸全过 ✅
                        ▼
                 外部 skill 真的执行
                        │
                        ▼
                 产出 → Capture 层 (器官 #17)
                        │
                        ▼
                 反哺组织: Memory promotion / Skill 提议 / DecisionCard
```

**这意味着什么**：

- Tandem 不是"组织自己的 AI"（跟 Claude Code 平行）
- Tandem 是"**个人 AI 的组织级网关**"（Claude Code 在它之下）
- 员工用 Claude Code 写代码 OK，但 Claude Code 调任何工具/读任何数据/改任何文件，都要先经过 Tandem 4 道闸

---

## 六、中央 AI 的统一 chokepoint（governedChat）

**这是中央 AI 的唯一强制出口，把"无旁路治理"从纪律变架构。**

```typescript
// lib/governance/governed-chat.ts (新增)
export async function governedChat(input: GovernedChatInput): Promise<GovernedChatResult> {
  // 1. 输入闸: govern-persona (闸① + L2 + L4) → systemPrompt
  const gov = await governPersonaOutput({ ... });
  if (!gov.allowed) return blocked(gov.blockReason);

  // 2. 动作闸: 若有 action, 跑 skill-gateway 闸②③④
  if (input.action) {
    const sg = await runSkillGateway({ ...input.action, derivedZone: await deriveActionZone(input) });
    if (sg.verdict === 'HARD_BLOCK') return blocked(sg.blockReasons);
  }

  // 3. LLM 调用 (注入治理后的 systemPrompt)
  let answer = await router.chat({ messages: [{role:'system', content: gov.systemPrompt}, ...input.messages], scenario });

  // 4. 输出闸: output-guard 内联
  const out = await checkOutput({ query: input.intent, response: answer, actorUserId, source: input.agentKind });
  if (out.verdict === 'HARD_CONFLICT') answer = await revise(answer, out.revisionPrompt);

  // 5. autonomous 路径: fail-closed (闸故障=拦截, 非放行)
  return { answer, gates: {...}, checkId };
}
```

**关键修正点**：

- **zone 内容判定**: caller 声明 → `deriveActionZone()` 按内容+委托级别判定（组织主权，非个人主权）
- **autonomous fail 行为**: 全 fail-open → autonomous 路径 fail-closed（闸崩=拦截）
- **output-guard 内联**: 手动接 → governedChat 内强制串联
- **无旁路**: 库函数自觉调 → ESLint 规则禁业务代码直调 `router.chat`

---

## 七、中央 AI 的 OKR 锚定（器官 #15）

**这是中央 AI 最基础的器官，必须先做。**

```typescript
// lib/persona/company-brain.ts
export async function buildCompanyBrainSystemPrompt(context: CompanyBrainContext): Promise<string> {
  const activeOkr = await getActiveOkrCycle(context.tenantId);
  const okrAnchor = buildOkrAnchorContext(activeOkr); // 器官 #15

  return `
你是 Tandem 中央 AI，代表整个组织发言。

当前 OKR 锚点：
${okrAnchor}

公司 Memory 基线：
${baselineContext}

回答时必须：
1. 锚定当前 OKR，所有建议必须可回溯到具体 KR
2. 引用公司 Memory，不违反基线
3. 不替员工决策，给 3+1 选项让员工选
`;
}
```

**验收标准**：

- CompanyBrain 每次回复前嵌入当前 active 公司 OKR + 战略主题
- 所有 AI 回答必须可回溯到具体 KR
- 任何自动化触发前 verify "这跟哪个 OKR 关联"

---

## 八、中央 AI 的演进路径

### V1.5 · 补齐元认知与学习器官（1-2 月）

| # | 改进 | 工作量 | 状态 |
|---|---|---|---|
| **CA-1** | CompanyBrain Persona 骨架 | 3-5h | ✅ 2026-05-27 落地 |
| **CA-2** | Baseline-Guard 灰区 LLM 仲裁 | 1 周 | ⏳ 待启动 |
| **CA-3** | /admin/governance 看板 | 1 周 | ⏳ 待启动 |
| **CA-4** | IM-7 trace 升级 | 3 天 | ⏳ 待启动 |
| **#15** | OKR Anchor 注入器 | 2-3h | ⏳ 待启动 |
| **#16** | OKR Drift 检测 | 1 周 | ⏳ 待启动 |

### V2 · 补齐主循环 + 执行肢体（3-6 月）

| # | 改进 | 技术选型 | 工作量 |
|---|---|---|---|
| **CA-5** | 议事 multi-step reasoning | Mastra | 1 个月 |
| **CA-6** | 接入 MCP | MCP SDK | 2-3 周 |
| **CA-7** | 完整 tool calling | TAF Router | 2 周 |
| **CA-8** | lib/agent-runtime/ adapter | 适配器层 | 2 周 |
| **#17** | 个人 AI 产出 Capture 层 | IDE 插件 | 1 月 |
| **#18** | Skill Gateway 4 道闸 | governedChat | 1-2 月 |

### V3 · 补齐习惯沉淀 + 组织 IQ 离线化（6-12 月）

| # | 改进 | 技术选型 | 工作量 |
|---|---|---|---|
| **CA-9** | Reflection loop | cron | 2-3 周 |
| **CA-10** | Correction-based fine-tune | dataset builder | 1-2 月 |
| **CA-11** | Knowledge distillation | LoRA | 2-3 月 |
| **CA-12** | Multi-Agent Tandem | LangGraph | 2-3 月 |

---

## 九、一句话总结

> **中央 AI（CompanyBrain）通过 4 时间尺度回路、18 件器官、4 道闸、统一 chokepoint（governedChat）、OKR 锚定，驱动和介入到所有模块：事半（OKR）、IM、文档/知识库、邮箱、搭子、拿捏、议事室、组织治理。中央 AI 不是"组件集合"，是企业级 Agent，存在目的 = OKR 驱动 / 战略执行。**

---

_本文档为中央 AI 驱动全模块复盘，与 `MASTER-UPGRADE.md`、`CENTRAL-AI-ARCHITECTURE.md`、`OKR-DRIVEN-ARCHITECTURE.md`、`CONVERGENCE-PRINCIPLE.md` 联动。_
