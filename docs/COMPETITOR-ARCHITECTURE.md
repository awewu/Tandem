# 竞品架构深度对照 (Competitor Architecture Teardown)

> **版本**: 2026-06-01 · 一手资料核查 (官网/官方博客/协议规范) + Tandem 真实代码对账
> **目的**: 不学功能名, 学架构灵魂。每个竞品: 灵魂 → 真实架构 → Tandem 真实代码映射 → gap
> **资料来源**: Notion 官方数据模型博客 / 腾讯亿级 IM 架构 / MCP 官方规范 modelcontextprotocol.io / Claude Cowork 官方产品页 / Tita 官方文档 / OpenClaw ClawdHub

---

## 0. 核心结论: 6 灵魂收敛为 2 母题 + 1 护城河

```
母题 A · 存一次 + 指针/索引组织 + 类型即渲染
   Notion 块 / Gmail 标签 / 企微 IM seq        ←→ Tandem 缺 (repository 按类型分仓)
母题 B · 解耦信号 + 沿图事件驱动传播
   Tita rollup+信心 / Persona 进阶 / MCP 三原语  ←→ Tandem 部分有 (event-bus 已存在)
护城河 · 组织主权的 AI 治理
   Claude Cowork=个人主权 ↔ Tandem=组织主权     ←→ Tandem 独有 (§19 4 道闸)
```

---

## 1. Notion · 块即唯一原语

### 灵魂
一个 `block` 原语无限组合; **类型是渲染提示, 不是结构**; 存储与组织解耦。

### 真实架构 (官方博客确证)
- `block = {id, type, properties{}, content[子block_id 指针数组], parent}`
- 段落/页面/数据库行**同构**; `Turn into` 切类型时 properties 不丢
- 层级 = `content[]` 指针 ("render tree"); 缩进是结构操作
- 写入 = 事务 → `/saveTransactions` → 载入 before → 应用 op 得 after → 校验权限/一致性 → commit
- 实时 = 客户端 WebSocket 订阅 record → `MessageStore` 推送版本变更 → 客户端 `syncRecordValues` 拉新数据
- 读取 = `loadPageChunk` 沿 content tree 递归下钻 + 多层缓存
- 异步建 Quick Find 索引 + 版本快照

### Tandem 真实代码映射
- `lib/storage/repository.ts`: ~40 个**按类型分仓**的 `Repository<T>` (decisionCards / memories / materials / origins / objectives / imMessages …)
- 知识 4 层 `origins` / `materials` / `memories` 是**3 个独立 repo**

### Gap (致命)
**没有统一原语**。Origins→Materials→Memory→DecisionCard 转换 = 跨类型搬运 + 丢上下文。无法像 Notion 那样"一条消息 Turn into 决议卡"。

---

## 2. 企业微信/微信 · 用户级单调 seq 是主干

### 灵魂
一个**单调 seq** 派生出: 时序 / 多端同步 / 未读数 / 已读回执 / 响应时效。

### 真实架构 (腾讯架构文确证)
- **写扩散 + 推拉结合**; 群上限 500 = 写扩散代价
- **序列号生成器**: 仲裁服务发号段 (申请 DB 步长) → **用户级递增 seq** (非全局自增)
- 多端同步 = 客户端存 `last_seen_seq`, 拉增量
- 未读数 = `maxSeq − readSeq`; 已读回执 = 每用户一个 **read cursor** (不是每消息每人存一行)
- 钉钉万人群改读扩散; Tablestore 把自增做进 DB 主键列

### Tandem 真实代码映射
- `lib/im/service.ts`: 写扩散 fan-out (L228-239 每成员 `unreadCount + 1`)
- 已读 = 单个 `lastReadAt` 时间戳 (L307) + `unreadCount` 计数器
- **没有 seq 主干, 没有 per-message read cursor**

### Gap (中)
v2.0 要做的"已读回执/响应时效"建在**时间戳游标 + 计数器**上, 不是 seq。时钟偏移/同时间戳排序会出问题, 多端一致性弱。计数器与游标冗余 (重算未读仍要数 lastReadAt 之后的消息)。
**该补**: 会话级单调 seq + per-user seq read cursor; 未读/已读/时效全派生。

---

## 3. Claude Cowork · 组织主权 vs 个人主权 (护城河对照)

### 灵魂
agent 循环是知识工作单元 (非对话); 异步委托; **个人主权的治理**。

### 真实架构 (官方产品页确证)
- 桌面 agent, 连本地文件/应用 (computer use), 端到端跑多步
- **异步委托**: 手机发指令 → Claude 在电脑上干 → 回来拿结果
- **Projects**: 持久工作区 (files/links/instructions/memory)
- **Plugins** = Skills(领域知识) + Connectors(MCP接工具) + Sub-agents(专项端到端), bundle 成角色专家
- **Stay in control**: ①你选可访问的 folders/connectors ②默认行动前询问, **可授权免审自动 (your choice)** ③企业版: 工具调用/文件访问/审批态 **流式入 SIEM via OpenTelemetry → Compliance API**

### Tandem 真实代码映射 (逐条镜像)
| Cowork | Tandem |
|--------|--------|
| 选 folders/connectors 访问 | 闸③ `checkDataScope_` (RBAC) |
| 默认 ask, 可授权自动 | 闸④ 绿/黄/红区 + `delegationLevel` + 24h 否决 |
| 工具调用流式入 SIEM | `lib/audit/log.ts` audit() + Steward 审计 |

### 本质差异 (= Tandem 真正的护城河)
**Cowork = 个人主权** (you decide / your choice)。**Tandem = 组织主权** (company 红线一票否决, 个人不能解除; zone 由公司基线+委托级别定, 见 §19.5)。
这是 To C agent 工具 vs To B 企业网关的**本质分野**, 不是功能差距。

### 战略
Tandem 把 Skill Gateway 表达成 **MCP server** → Cowork/Claude Code 作为 Connector 接入穿过 4 道闸。**Tandem 做 Cowork 的企业治理底座, 不与之竞争。**

### Gap (企业就绪)
audit() 需暴露成 **OpenTelemetry 合规事件流** (Cowork 已标配)。

---

## 4. MCP · 薄客户端厚协议, 三原语分权

### 灵魂
能力来自标准协议的三个**分权原语**, 新能力 = 加一个 server。

### 真实架构 (官方规范确证)
- JSON-RPC 客户端-服务器; transport = stdio / Streamable HTTP
- **tools** (model-controlled, 模型决定何时调)
- **resources** (app-controlled, 应用注入上下文; URI + Resource Templates `weather://forecast/{city}`; `resources/list|read|subscribe`)
- **prompts** (user-controlled, 用户触发模板)

### Tandem 真实代码映射 (精确对应)
| MCP 原语 | Tandem 代码 |
|----------|------------|
| tools | 闸④ Action Scope 的企业动作 |
| resources | `govern-persona.ts` L1 组织基线注入 + L2 OKR 锚注入 (`buildOkrAnchorContext`) |
| prompts | 议事室 5 步 / 3+1 模板 (`three-plus-one-engine.ts`) |

### Gap
`runSkillGateway` 是内部库函数, 不是协议边界。**该把它表达成 MCP server**, 让护城河从私有集成升级为带治理的 MCP 标准。

---

## 5. Tita · OKRs-E 执行闭环 + CFR 持续绩效

### 灵魂
OKR 不是"目标设定工具", 而是**从战略到执行的完整闭环系统**。三大灵魂特性：OKR 对齐与目标地图、自动进度传播（rollup 机制）、CFR 持续绩效管理。

### 真实架构 (官方文档确证)

#### 5.1 OKRs-E 框架
- **OKR**: Objectives and Key Results（目标与关键成果）
- **E**: Execute（执行）— 执行是支撑关键成果达成的一系列行动
- 每一个 OKR 都有实施路径（KR），每种实施路径依靠具体的【工作计划】和【项目】来支撑完成
- Tita 开创性地将 OKR 的执行方案化解为具体的【任务】和【项目】

#### 5.2 对齐机制与目标地图
- **多目标对齐**: 一个目标可以对齐多个父目标（支持跨部门协作）
- 可以分别对齐父目标本身或其下的关键成果
- 对齐关系自动生成目标地图
- **OKR 地图**: 企业战略的全局作战图，全局查看企业目标，明确目标之间的上下关联性
- 支持按公司/部门/团队/成员视角查看
- 支持展开 KR 详情，查看 O 与 KR 之间的关联关系
- 支持导出和一键分享

#### 5.3 自动进度传播（rollup 机制）
- Tita 宣称是**唯一一个能上下自动更新的 OKR 系统**
- 进度传播路径：任务进度 → 关键结果进度 → 目标进度 → 顶层目标进度
- **定量任务追踪**: 定量的关键结果可以通过定量的任务进行过程追踪
- 创建定量任务，过程中只需要维护好定量任务的完成值，关键结果的进度就能天然变化
- 如果完整使用 OKRs-E 框架，进度是层层往上传递的
- 顶层目标可以灵活选择按照对齐的目标进行自动更新

#### 5.4 CFR 持续绩效管理
- **CFR = Conversation（对话）+ Feedback（反馈）+ Recognition（认可）**
- CFR 是连续绩效管理的缩写，使管理人员能够定期提供反馈，帮助员工全年改进
- **C: 对话**: 每周或每月发生一次，涵盖 5 个主题（反思目标、更新进度、指导、专业发展、轻量级绩效审查）
- **F: 反馈**: 员工需要了解自己的工作状况，在一对一会议中双向提问
- **R: 认可**: 应该是私人的，也应该是公共的，并应着眼于行动
- OKR 是积极的工作场所文化的催化剂；CFR 是维持它的营养

#### 5.5 复盘方法论
- 复盘不是简单的"总结会议"，而是通过结构化分析找出 OKR 执行中的关键问题
- **复盘前**: 数据准备（OKR 进度、任务完成情况、协作记录自动汇总）+ AI 诊断（自动识别 OKR 健康度）
- **复盘中**: 回顾目标与关键结果（对比视图）+ 分析根因（5Why 分析法）+ 制定行动计划（直接关联改进任务）
- **复盘后**: 更新 OKR（保留历史版本）+ 同步团队（智能生成复盘报告）+ 持续监控（设置关键指标预警）
- **AI 驱动**: 智能诊断 OKR、智能周报、进度热力图、团队协作图谱

#### 5.6 评分机制
- 目前只能在关键结果 KR 上进行评分
- 目标 O 的评分是根据关键结果 KR 的权重和评分来计算的
- **计算公式**: 目标评分 = KR1权重 * KR1评分 + KR2权重 * KR2评分 + KR3权重 * KR3评分 ...
- 如果 KR 未设置权重，则以平均分计算目标得分
- 评分当前只能 0-1
- 只有目标负责人和 KR 负责人可以对 KR 进行评分
- 如果评分时 @他人，则对方也可以评分；如果别人评分了，则前面的评分结果会被覆盖

#### 5.7 与 PDCA 的结合
- Tita 依据 **PDCA 质量管理理论**（Plan-Do-Check-Act）
- Plan: 企业战略目标制定
- Do: 工作计划执行
- Check: 工作结果考核
- Act: 激发员工潜能，实现企业高速增长

### Tandem 真实代码映射
- `lib/events/bus.ts` 已有 `okr.kr-progressed {krId, from, to, source}` 事件 = **传播基础已存在**
- `lib/types/okr-tti.ts`: Cycle / Objective / KeyResult / CheckIn / Initiative 基础数据模型
- `lib/store/okr.ts`: UI 层 OKR store，支持 Objective 父目标对齐（`parentObjectiveId`）、KR 权重、信心度、评分机制
- `lib/okr/scoring.ts`: 评分系统（自评/上级评分/终评）
- 已有 1on1 (`oneOnOneMeetings`) + 360 (`review360Cycles`) repo

### Gap (致命 - 执行层断裂)

#### Gap 1: 执行层断裂
Tita 的 OKRs-E 框架强调"执行落实到位"，Tandem 虽然有 Initiative 模型，但：
- Initiative 与 Task 面板联动薄弱（只有 `linkedTaskId` 字段）
- Task 完成不会自动更新 KR 的 `currentValue`
- KR 进度不会自动 rollup 到 Objective 进度
- **影响**: OKR 停留在"目标设定"层面，无法形成从战略到执行的闭环

#### Gap 2: 对齐机制单一
Tita 支持多目标对齐和目标地图，Tandem 只有：
- 单一父目标对齐（`parentObjectiveId` 是单值）
- 没有对齐关系可视化
- 没有跨部门协作的透明视图
- **影响**: 无法形成企业战略的全局作战图，跨部门协作效率低

#### Gap 3: 持续绩效缺失
Tita 强调 CFR（对话/反馈/认可），Tandem 只有：
- CheckIn（进度更新）的三段式叙述（成就/障碍/下一步）
- 没有专门的 1:1 对话模块
- 没有反馈和认可机制
- **影响**: OKR 容易变成"待办事项"，而不是指导性的力量

#### Gap 4: 复盘能力薄弱
Tita 有 AI 驱动的智能复盘，Tandem 只有：
- 手动填写复盘记录（`retrospective` 字段）
- 没有自动诊断和预警
- 没有复盘报告生成
- **影响**: 复盘沦为形式主义，无法真正驱动改进

### 技术推演：Tita 的自动进度传播本质
Tita 的自动进度传播本质上是 **Notion 式的 relation + rollup 机制**：
- 任务（Task）与 KR 是 relation 关系
- KR 的 `currentValue` 是 rollup，聚合其下任务的完成值
- Objective 的进度是 rollup，聚合其下 KR 的进度
- 顶层 Objective 的进度是 rollup，聚合对齐子目标的进度

这与 UNIFIED-TECH-DESIGN.md §2.5 的"relation+rollup 引擎统一"完全一致。

### 差异化
日报→KR **反虚报闭环** (§1) 是架在 Tita rollup 之上的 Tandem 独有层，这是 Tandem 的护城河，不应放弃。

---

## 6. Gmail · 标签即指针, 搜索代替层级

### 灵魂
存储与组织解耦 (label = 多对多指针, 非文件夹); 搜索代替目录树; header 串线程。

### 真实架构 (确证)
- 消息存一份; label 是多对多 tag (一封信多 label 零拷贝)
- 线程 = `Message-ID` / `In-Reply-To` / `References` header (RFC 2822); Gmail API `threads` resource
- 导航以 per-user 倒排索引搜索为主
- 推送 = IMAP IDLE / Gmail API watch → Pub/Sub

### Tandem 真实代码映射
- §18: 邮件 = 腾讯企邮 + Outlook API (联邦, 不自建存储)

### Gap / 该吸收
v2.0 IMAP 收件**不建文件夹模型** → 归一化进母题 A 的统一节点 (type=email) + label 指针 + header 串线程 → 一封邮件可 Turn into Material → Decision Card。

---

## 7. OpenClaw · 开放 agent 技能生态 (反证 Tandem 网关价值)

### 灵魂
开放技能市场 (ClawdHub) + 可安装能力包 (ClawdBot skills)。

### 真实架构 (核查确证)
- agent 技能生态; skills 为可安装包 (`@openclaw/gamification-xp` 只是其中一个技能)
- 技能含 XP/levels/badges/streaks (养成) / agent-audit-trail (hash 链审计) / memory metabolism 等
- **关键风险**: 评论指出 ClawdHub "**~80% 技能是垃圾或恶意的**"

### Tandem 真实代码映射 (已有更强治理版)
- Persona evolution (`lib/persona/evolution.ts`): 5 阶段 newborn→apprentice→assistant→deputy→partner
- `STAGE_TO_DEFAULT_SKILLS`: **阶段解锁技能** = 受治理的技能树 (红区 human-only 永不解锁)
- `bossCaptureScore` (`feedback.ts`): 阶段基础分 + 否决率奖励 + 反馈奖励 = XP analog
- `STAGE_UPGRADE_CRITERIA`: minDays/minDecisions/maxVetoRate 门槛
- 自动升级 scanner + autonomy 守门 (newborn/apprentice 静默自动, assistant+ 需员工确认)

### 洞察
OpenClaw 的"80% 恶意技能"**恰是 Tandem 4 道闸/Skill Gateway 存在的最强论据**。Tandem 的技能树比 OpenClaw 多了"治理 + 委托分级 + autonomy 守门"。养成感 (XP) Tandem 已有 (`bossCaptureScore`), 缺的是事件化/可视化。

---

## 8. 总表: 灵魂 → Tandem gap → 优先级

| 竞品 | 灵魂 | Tandem 现状 | Gap | 优先级 |
|------|------|------------|-----|--------|
| Notion | 块统一原语 | 按类型分仓 | 致命 | **P0** |
| 企微 | seq 主干 | 计数器+时间戳 | 中 | P1 |
| Cowork | 组织 vs 个人主权 | 4 道闸已有, zone 调用方声明 | zone 须组织判定 | **P0** |
| MCP | 三原语分权 | gateway 是库函数 | 表达成 MCP server | P1 |
| Tita | 对齐图+信心解耦 | event-bus 已有 kr-progressed | 传播引擎+信心列 | P1 |
| Gmail | 标签指针 | 邮件联邦 | 归一化进统一节点 | P2 |
| OpenClaw | 开放技能市场 | persona 技能树更强 | 事件化/可视化 XP | P2 |

---

## 9. 收敛: 最高杠杆 = 母题 A 的统一节点原语

Notion(指针)、Gmail(标签)、企微(seq timeline) **全是"存一次 + 指针/索引组织"**。Tandem 的 P0 是引入统一 `TandemNode` 原语 (type 解耦), 让 4 层知识/邮件/消息收敛到一个引擎。详见 `docs/UNIFIED-TECH-DESIGN.md`。

---

_本文档为竞品架构深度学习的团队参考存档。功能层对标见 MASTER-UPGRADE.md, 技术落地见 UNIFIED-TECH-DESIGN.md。_
