# 补充设计：参考 Teams 与云协作（Lark / 飞书云协作 / Notion / Google Workspace）

> 配套：`PRD.md` · `OKR-EXPERIENCE.md`
> 版本：v0.1（2026-05-07）
> 目的：吸收 Microsoft Teams 与现代云协作平台的精华，补强拿捏的协作体验。

---

## 0. 一句话总结

**Teams** 教我们如何把"聊天"升级为"工作中枢"（Channels + Tabs + Adaptive Cards + Loop）；
**云协作（Lark/Notion/Google）** 教我们如何让"内容"变成"活的协作对象"（实时光标 + Smart Blocks + Bitable + 锚点深链）。

把这两条注入拿捏，**OKR + IM + AI 分身**才能真正长出"系统级协作中枢"。

---

## 1. 来自 Teams 的 12 项补充

### 1.1 Channels + Tabs 模型（结构化的频道）

**Teams 原创**：Team → 多个 Channel（主题频道）→ 每个 Channel 内可挂多个 Tab（聊天/文件/Wiki/OneNote/自定义应用）。

**对拿捏的补充**：把目前的"群"扩展为：

```
Team（团队/项目空间）
└─ Channel（话题频道）
    ├─ Tab: 💬 聊天（默认）
    ├─ Tab: 🎯 OKR（关联此频道的目标）
    ├─ Tab: 📋 任务（看板）
    ├─ Tab: 📄 文档（协同文档）
    ├─ Tab: 🗂 文件
    ├─ Tab: 🎨 白板
    ├─ Tab: 📊 数据表（Bitable）
    └─ Tab: + 自定义应用（小程序）
```

**意义**：一个项目空间所有产物都聚拢在一起，**OKR 群从此不再是"只能聊天的群"**，而是项目的工作站。

### 1.2 Adaptive Cards（自适应卡片协议）

**Teams 标准**：JSON 描述的可交互卡片，跨设备一致渲染，可包含按钮/输入/表单。

**对拿捏的补充**：制定 **NCard 协议**（Nanie Card），所有 AI 分身回复、外部 Bot、系统消息、OKR 卡、任务卡都遵循统一 schema：

```json
{
  "type": "okr.checkin.draft",
  "version": "1.0",
  "title": "本周 KR 进度草稿",
  "body": [
    { "type": "field", "label": "KR1 留存", "value": "38%", "delta": "+2%" },
    { "type": "field", "label": "障碍", "value": "UX 招聘卡住" }
  ],
  "actions": [
    { "type": "button.primary", "label": "一键发布", "onClick": "checkin.publish" },
    { "type": "button.secondary", "label": "修改", "onClick": "checkin.edit" }
  ]
}
```

**好处**：UI 一致；AI 输出可解析；客户端可深度集成；老版本客户端有 fallback 文本。

### 1.3 Loop Components（聊天里的活组件）

**Teams/Loop**：发到聊天里的组件（投票/表格/任务清单）**多人可同时编辑**，永远是"最新值"。

**对拿捏的补充**：消息可以是"活组件"——尤其结合 OKR：
- 发一个 KR 卡到群里 → 任何人都能在卡里直接更新当前值（带 RBAC 限制）
- 发一个投票（"本周聚焦哪个 KR？"）→ 群成员实时勾选
- 发一个行动项 checklist → 任何人都能勾完成
- 发一个表格 → 多人协同填行

**技术**：Yjs CRDT + NCard 协议双驱动；服务端持久化为对象，消息只是"指针"。

### 1.4 Together Mode + Breakout Rooms（会议体验）

**Teams**：多人会议虚拟会议室视图、可拆分小组讨论再回到主会场。

**对拿捏的补充**：
- **议事室升级**：人 + AI 分身的虚拟"圆桌"视图，分身有头像和发言指示
- **Breakout 议事**：大会议中可拆 3 个 KR 小组分头议事，AI 协调员各自总结后并入主纪要

### 1.5 实时转写 + 翻译

**Teams/Copilot**：会议实时字幕，30+ 语言互译，会后自动 recap。

**对拿捏的补充**：
- 议事室和会议自动 ASR 转写；多租户启用国产 ASR（讯飞/百度）
- 实时翻译（中/英/日/西…），跨国团队基础能力
- 会后自动 recap：决议点 + 行动项 + 关联 OKR + 待 follow up

### 1.6 Praise / Kudos（表扬卡）

**Teams**：发"表扬卡"给同事（成就/创新/团队精神等 prompted 标签 + 文字）。

**对拿捏的补充**：
- 季末表扬可与 OKR 评分关联："这位帮我达成了 KR3"
- 表扬留痕到员工 Profile，HR 看绩效时可用
- 与 Persona 联动：经理 Persona 可建议"本周该表扬谁"

### 1.7 Shifts（排班，一线场景）

**Teams**：零售/医疗/制造的一线员工排班、换班、打卡。

**对拿捏的补充**：
- 与 OKR 整合：销售大区班次自动关联"客户拜访 KR"
- 排班变更可触发 OKR 影响评估（例："这周少 3 个销售在岗，预计 KR 完成率 -X%"）
- 一线 OKR 模板（销售周拜访、客服平均响应等）默认随排班生成

### 1.8 Tags / 子组（精准 @）

**Teams**：在 Team 里建标签（如 `@产品组`、`@值班`）→ @ 标签时仅推送给该子集。

**对拿捏的补充**：
- 大群里 `@OKR_Owners` `@值班经理` 等
- 标签可由 Persona 自动建议（基于行为模式聚类）

### 1.9 Approvals 作为一等公民

**Teams**：审批从 OA 中抽出来，作为聊天里直接审的卡片，附决策日志。

**对拿捏的补充**：
- 审批卡（请假/报销/合同）以 NCard 直接发到相关群
- AI 分身可预审：自动校对金额/政策/与 OKR 关联
- 审批结果自动归档，关联 OKR（预算消耗 vs KR 完成）

### 1.10 Power Automate 等价物（事件流自动化）

**Teams**：基于事件触发流程（"群里有人 @我 → 创建任务 → 发飞书提醒"）。

**对拿捏的补充** —— **拿捏 Flow**：
- 视觉化流程编辑器（已有 `/workflows` 模块基础）
- 触发器：消息 / OKR 状态变更 / Check-in 发布 / 健康度告警 / 议事室结束
- 动作：发消息 / 创建任务 / 调用 Skill / 通知 / 写入 Bitable / 调外部 webhook
- 模板库：销售 / HR / 工程经典自动化

### 1.11 Status / Out-of-Office（状态 + OOO）

**Teams**：状态自动跟日历同步（开会、出差、休假），消息可设"我现在不在，紧急找 X"。

**对拿捏的补充**：
- Status 自动从日历 + 设备活动推断
- OOO 期间分身可代替接收并起草回复（按委托级别）
- OKR 也可设"OOO 期间不计入 cadence 逾期"

### 1.12 Phone System / PSTN（可选）

**Teams**：可作为企业总机，接打外线电话。

**对拿捏的补充**：留接口，**优先级低**。中国市场客户更多用钉钉电话/腾讯会议电话。先不自研，留 SIP 外接能力。

---

## 2. 来自云协作（Lark / 飞书 / Notion / Google）的 11 项补充

### 2.1 协同文档（Doc）—— 一等公民

**飞书/Notion**：实时多人编辑、多种块类型、嵌入 OKR/任务/Bitable。

**对拿捏的补充**：
- 协同文档作为独立模块（V2 必交付）
- Yjs CRDT；多人光标 + 头像追踪
- 块类型：标题/段落/表格/代码/图片/视频/思维导图/白板/嵌入卡（OKR / 任务 / 投票 / Bitable）
- AI 注入：分身可在文档里写草稿，由人审；选中段落可让 Persona 解释/扩写/翻译

### 2.2 Bitable（多维表格）

**飞书 Bitable**：Airtable 等价物——结构化表格 + 视图（看板/日历/甘特/统计图）+ 自动化。

**对拿捏的补充**：
- 适合做"客户 CRM 简版"、"招聘进度"、"竞品追踪"等结构化数据
- 与 OKR 联动：每行可关联 KR；进度自动汇总到 KR

### 2.3 Smart Blocks（文档里的智能块）

**Notion**：embed 块——文档里嵌入数据库视图、日历、视频、第三方工具。

**对拿捏的补充**：
- 任何拿捏对象都可作为 Smart Block 嵌入文档：OKR 卡、任务、Bitable 视图、视频、白板
- "@ 嵌入"语法：在文档里输入 `/okr Q1` 选择目标自动嵌入

### 2.4 Wiki / Knowledge Space（知识空间）

**飞书 Wiki / Notion / Google Sites**：组织级长青知识库。

**对拿捏的补充**：
- 与"协同文档"区分：Doc 是讨论中的、Wiki 是定稿的
- 全文检索 + 语义检索；Persona 可基于 Wiki 答员工问题
- 部门/项目可有自己的 Wiki Space
- "新员工 Onboarding Wiki" 模板内置

### 2.5 思维笔记 / 白板（头脑风暴）

**飞书 MindNote / Miro / FigJam**：脑图、白板、便签墙、流程图。

**对拿捏的补充**：
- 白板作为 Tab/Smart Block 内嵌
- 议事室/会议室自动配白板
- AI 协助：手画→识别→规整为脑图；选中节点让 Persona 扩写

### 2.6 实时多人光标 + 评论锚点

**Google Docs / 飞书**：能看到他人光标位置；评论锚定到具体段落、对象、像素。

**对拿捏的补充**：
- 文档/Bitable/白板/OKR 详情页**全部支持**多人光标
- 评论锚点 = 可分享深链
- 评论支持线程、@ 提及、表情、投票

### 2.7 版本历史 + 时间旅行

**Google / Notion**：任何编辑都可回溯，能 diff 不同版本。

**对拿捏的补充**：
- 文档/Bitable 默认开启
- OKR 也支持"时间旅行"：周一的 KR 状态 vs 周五的，自动 diff
- 配合 Activity Feed（已实现）形成完整审计

### 2.8 订阅 / 动态推送（Subscribe / Watch）

**Notion / 飞书**：订阅页面 → 变更自动推送到收件箱/IM。

**对拿捏的补充**：
- 订阅对象：文档、OKR、Bitable 视图、群、人
- 推送方式：拿捏 IM 系统消息 / 邮件 / 移动端推送
- 频率：实时 / 每日汇总 / 每周汇总

### 2.9 Magic Share 权限模型

**飞书 / Notion**：一键生成可分享链接，带可读/可评论/可编辑/有效期等细粒度权限；可对企业外。

**对拿捏的补充**：
- 任何对象（文档/OKR/Bitable）都可生成分享链接
- 权限矩阵：仅查看 / 可评论 / 可编辑；指定人 / 部门 / 全员 / 外部 email
- 可设过期、可撤销
- 外部访客界面（无账号也能查看，但水印 + 审计）

### 2.10 Anchor 深链（万物可链）

**飞书 / Slack / Notion**：每个段落、消息、任务都有唯一 URL，复制即可粘贴。

**对拿捏的补充**：
- 所有对象都有 deep-link：`nanie://okr/o-uuid` `nanie://msg/m-uuid#para-3`
- IM/文档/邮件中粘贴即自动展开为预览卡（unfurl）
- 跨模块跳转一键到位

### 2.11 智能寻找时间（Smart Find Time）

**Google Calendar / 飞书**：会议邀请时自动找所有人都空闲的时间段。

**对拿捏的补充**：
- 1:1 / 议事室 / 会议预约时自动调度
- 考虑：日历空闲 / 时区 / 会议室容量 / OKR 优先级（关键 OKR 议事优先排在所有人黄金时段）
- AI 协调：自动建议 3 个最优时段

---

## 3. 优先级建议（按价值密度排）

### P0 — V1 MVP 内必做

1. **Channels + Tabs 模型**（1.1）→ OKR 群升级为完整工作空间
2. **Adaptive Cards / NCard 协议**（1.2）→ 所有卡片协议统一
3. **协同文档 v1**（2.1）→ 与 OKR 深度联动
4. **Anchor 深链**（2.10）→ 跨模块跳转基础
5. **订阅 / 动态推送**（2.8）→ OKR/文档变更通知
6. **Magic Share 权限**（2.9）→ V1 多人协作基础

### P1 — V2 优先做

7. **Loop / 活组件**（1.3）→ 消息=可编辑对象
8. **实时转写 + 翻译**（1.5）→ 议事室升级
9. **Wiki / Knowledge Space**（2.4）→ 公司知识沉淀
10. **实时多人光标 + 评论锚点**（2.6）
11. **版本历史 + 时间旅行**（2.7）
12. **拿捏 Flow（自动化）**（1.10）→ 复用 `/workflows` 模块扩展
13. **Smart Find Time**（2.11）→ 议事室预约必需

### P2 — V3 可补

14. **Bitable**（2.2）→ Airtable 替代品，独立大模块
15. **Smart Blocks**（2.3）→ Bitable 就绪后才有意义
16. **白板 / 思维笔记**（2.5）→ 议事室深化
17. **Together Mode + Breakout**（1.4）→ 会议体验升级
18. **Praise / Kudos**（1.6）→ 软文化能力
19. **Tags 子组**（1.8）
20. **Approvals 卡片化**（1.9）

### P3 — 视市场再定

21. **Shifts 排班**（1.7）→ 仅一线场景客户
22. **Status / OOO 自动同步**（1.11）→ 体验糖
23. **PSTN / 外线电话**（1.12）→ 留接口

---

## 4. 与现有 PRD / OKR-EXPERIENCE 的整合点

### 4.1 PRD §14（IM 平台）需要扩展的部分

- **§14.4.1 消息类型**：增加 `NCard` 标准卡片类型 + `LoopComponent` 活组件类型
- **§14.4.4 协同 OA**：协同文档升级为一等模块，加 Wiki / Bitable / Whiteboard 三个子模块
- **§14.5 技术挑战**：增加"NCard 跨客户端一致渲染"、"Loop 组件 CRDT 与消息流的一致性"、"Magic Share 链接的访客 RBAC 边界"
- **§14.4.5 平台与扩展**：增加"拿捏 Flow（自动化引擎）"

### 4.2 OKR-EXPERIENCE 需要扩展的部分

- **§4 信息架构中枢**：增加"OKR 嵌入文档（Smart Block）"、"OKR 锚点深链"
- **§2.3.2 OKR 原生群聊** → 升级为 **OKR Channel**：含 OKR Tab / 任务 Tab / 文档 Tab / 白板 Tab
- **§3 五种角色**：每个角色的工作台增加"订阅推送"和"Magic Share 对外汇报"两条体验
- **§7.2 跨模块外键**：新增 `Channel.tabs[]`、`Doc.smart_blocks[]`、`Subscription.target_type/target_id`

### 4.3 新增独立模块文档（待写）

- `docs/MODULE-CHANNELS.md` — Channel + Tab 完整规格
- `docs/MODULE-DOC.md` — 协同文档 + Smart Blocks 设计
- `docs/MODULE-BITABLE.md` — 多维表格设计
- `docs/MODULE-FLOW.md` — 自动化流程引擎（基于现有 `/workflows`）
- `docs/SPEC-NCARD.md` — Adaptive Card 协议规范

---

## 5. 拿捏的差异化没变，反而强化了

引入这些能力**不冲淡**拿捏独家差异化，反而让它们更有杀伤力：

| 拿捏独家 | 借力新能力 | 化学反应 |
|---|---|---|
| **OKR 原生群聊** | + Channels + Tabs | OKR 群升级为完整项目工作空间 |
| **AI 自动 Check-in** | + Loop 活组件 | Check-in 是消息也是可编辑卡片 |
| **AI 分身议事室** | + 实时转写 + Together Mode | 议事室体验对标 Teams 顶级会议 |
| **Baseline 价值观注入** | + NCard 标准 | 所有 AI 输出走标准协议，可审计 |
| **Drift 真相分** | + Bitable + 自动化 | 数据交叉源更广（CRM/BI/Git） |

---

## 6. 我的最终建议

### 6.1 V1 MVP 必须把这 6 件事做对

> 否则 V1 会像"加了 OKR 的旧 IM"，而非"OKR-原生协作系统"。

1. **Channels + Tabs**（不只是聊天，是项目工作站）
2. **NCard 协议**（统一所有卡片）
3. **协同文档 v1**（含 Smart Block 嵌入 OKR）
4. **Anchor 深链 + Magic Share**（跨模块和对外协作的基础）
5. **订阅 / 动态推送**（OKR 变化让相关人立刻知道）
6. **AI 自动 Check-in 配合 Loop 活组件**（OKR 体验关键差异化）

### 6.2 不要做的事（避免 V1 难产）

- ❌ V1 不做 Bitable（投入大、独立性强，V3 再做）
- ❌ V1 不做白板（Whiteboard 体积大，V3 做）
- ❌ V1 不做 PSTN / 外线（永远不要自研）
- ❌ V1 不做 Shifts（仅一线客户需要，按需做）
- ❌ V1 不追求 Together Mode 等会议视觉糖（先把 1:1 + 小会跑通）

### 6.3 文档落地

- 本文档已 `docs/SUPPLEMENT-TEAMS-COWORK.md`
- 建议接下来增量更新到 `PRD.md §14` 和 `OKR-EXPERIENCE.md §4`，把上面 P0 的 6 件事**正式纳入 V1 出闸条件**

---

> **一句话**：拿捏不是抄 Teams 抄 Lark，而是在它们已经验证过的"协作语法"之上，注入 **OKR 中枢 + AI 分身 + 公司基线** 这三味独家秘药。Teams + Lark + 拿捏独家 = 下一代企业操作系统。
