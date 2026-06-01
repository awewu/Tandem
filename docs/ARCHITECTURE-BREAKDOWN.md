# Tandem 7 大核心思路 · 功能与架构详细拆解

> **版本**: 2026-06-01
> **用途**: 需求拆解、技术方案设计、排期依据、团队分工参考

---

## 目录

1. [思路 ① 中央 AI](#一中央-ai)
2. [思路 ② 事半 OKR](#二事半-okr)
3. [思路 ③ 知识库](#三知识库)
4. [思路 ④ IM](#四im)
5. [思路 ⑤ 邮箱](#五邮箱)
6. [思路 ⑥ 搭子工作台](#六搭子工作台)
7. [思路 ⑦ 拿捏](#七拿捏)
8. [综合优先级矩阵](#八综合优先级矩阵)

---

## 一、中央 AI

> 中央 AI（Tandem）对标 Claude cowork，要驱动整个软件建构，并作为中央大脑可以在线回答居于公司基线培训的高级人工智能体。

### 1.1 核心要求拆解

| 要求 | 含义 | 验收标准 |
|------|------|----------|
| 驱动软件建构 | AI 是骨架，非插件。自然语言操控界面 | 说"生成 Q3 销售 KR 跟踪表"直接出 Bitable |
| 中央大脑在线问答 | 全员可见、随时唤起 | 任意页面 3 秒内唤起，回答引用公司 Memory |
| 公司基线培训 | 回答强注入 Baseline，非通用闲聊 | 命中 company-level Memory 时显示引用来源 |

### 1.2 当前代码资产

- `lib/persona/company-brain.ts` — CompanyBrain system prompt 拼装
- `lib/memory/baseline-guard.ts` — 三级门禁 (PASS/SOFT/HARD)
- `lib/memory/output-guard.ts` — LLM-as-judge 输出矫正
- `lib/types/company-brain.ts` — Decision / Version / Metrics 全链路
- `app/admin/company-brain/page.tsx` — Steward 治理看板
- `lib/decision-layer/three-plus-one-engine.ts` — 3+1 决策引擎

### 1.3 缺失能力与填补方案

| 缺失项 | 填补方案 | 工期 | 风险 |
|--------|----------|------|------|
| 全员可见入口 | 首页顶部 `Ask Tandem` 栏 + 全局 `Cmd+K` | 3-4 天 | 低 |
| 自然语言操控 UI | AI View Generator: NL -> JSON schema -> 动态渲染 | 2-3 周 | 中 |
| 上下文感知召唤 | 浮动球/命令面板，按模块推荐技能 | 1 周 | 低 |
| AI 驱动工作流编排 | NL -> Workflow DSL -> 存入 /flow | 2-3 周 | 中 |
| 全员问答历史 | 独立 `ai_conversations` collection，支持搜索 | 3-4 天 | 低 |

### 1.4 架构分层

```
用户界面层 (Ask Tandem / Cmd+K / 上下文悬浮球)
    |
意图识别 + 路由层 (qa / generate / execute / summarize)
    |
    ├─ 问答模式 -> NL + RAG 召回 Memory + Baseline
    ├─ 生成模式 -> NL -> schema -> 动态渲染
    └─ 执行模式 -> NL -> workflow DSL -> 触发 action
    |
4 道闸安全层 (Baseline-Guard / OKR Drift / Data Scope / Action Scope)
    |
LLM 调用层 (本地 Hermes 4 / 云端 DeepSeek V3，按复杂度升级)
```

---

## 二、事半 OKR

> 对比 Tita 的完整功能，增加搭子驱动工作效率和准确性，以议事达成决议驱动进展为精髓。

### 2.1 核心要求拆解

| 要求 | 含义 | 验收标准 |
|------|------|----------|
| Tita 完整功能 | 制定->对齐->跟进->复盘 + 1on1/360/脉动 | 一季度完整闭环 |
| 搭子驱动效率 | 分身自动推日报、预警滞后、推荐方案 | 日报 AI 预填 >=80%，滞后 24h 预警 |
| 议事驱动决议 | 进展必须通过 17min 议事收敛为 DC+AP | 90% 以上 KR 关联至少 1 个 DC |
| 反虚报 | 日报自动算 KR 进度，禁人工填假进度 | 日报提交后 KR 自动更新，偏差 >10% 标红 |

### 2.2 当前代码资产

- `lib/store/okr.ts` — Objective / KR / Initiative / CheckIn 模型
- `lib/services/okr-calibration.ts` — 经理一屏校准
- `app/okr/calibration/page.tsx` — 校准 UI
- `app/okr/cascade/page.tsx` — 五级级联视图 (只读)
- `app/convergence/page.tsx` — 17min 议事室
- `app/report/page.tsx` — 5min 智能日报
- `lib/decision-layer/three-plus-one-engine.ts` — 3+1 选项引擎

### 2.3 缺失能力与填补方案

| 缺失项 | 填补方案 | 工期 | 风险 |
|--------|----------|------|------|
| 级联编辑 | `/okr/cascade` 增加 inline 编辑 + 拖拽对齐 | 1-2 周 | 中 |
| 季度复盘流 | `/okr/review` 自动聚合 DC + 日报 + 偏差 + AI 摘要 | 1 周 | 低 |
| 1on1 与 OKR 联动 | 会前自动拉取下属 OKR + 高偏差项 + 生成议程 | 3-4 天 | 低 |
| 脉动调查 | `/pulse` 5 题快速问卷 + AI 汇总 + 匿名趋势 | 3-4 天 | 低 |
| 多周期对比 | `/okr/compare` 同部门/人跨周期进展对比 | 2-3 天 | 低 |
| 信心指数趋势 | KR 信心指数折线图 (每周 check-in) | 2-3 天 | 低 |
| 绩效面谈模板 | 1on1 内置结构化模板库 | 2-3 天 | 低 |

### 2.4 增强闭环

```
季度启动 -> OKR 制定 -> 级联对齐 -> 1on1 会前议程
                              |
日报 <- 搭子 AI 预填 <- 1on1 回顾
  |
KR 自动进度 -> 滞后预警 -> 17min 议事室
                              |
DC + AP -> 追踪执行 -> 季度复盘 -> 下一轮启动
```

---

## 三、知识库

> 知识库对标 Notion 的完整功能和逻辑。

### 3.1 核心要求拆解

| 要求 | 含义 | 验收标准 |
|------|------|----------|
| 块编辑器 | `/` 命令呼出块，拖放重组 | 15+ 块类型支持 |
| 无限嵌套页面 | Sidebar 树状导航，任意子页 | 面包屑自动追踪 |
| 反向链接 | 双向引用，自动发现关联 | 被引用页显示"被 X 页引用" |
| Database 多视图 | 表格/看板/日历/画廊切换 | Bitable 至少 grid+kanban+calendar |
| 模板库 | 快速复制标准结构 | 内置 10+ 模板 |
| 全站搜索 | 跨文档/表格/Memory/IM 搜索 | 1 个搜索框 + operators |

### 3.2 当前代码资产

- `app/documents/[id]/page.tsx` — Tiptap + Yjs 协同文档
- `app/bitable/[id]/page.tsx` — 多维表格 (grid)
- `lib/types/bitable.ts` — BitableTable / Column / View
- `lib/services/bitable-ai-compute.ts` — AI 计算列 (独有)
- `app/knowledge/page.tsx` — 知识图谱
- `app/memories/page.tsx` — 企业 Memory (三级签批)

### 3.3 缺失能力与填补方案

| 缺失项 | 填补方案 | 工期 | 风险 |
|--------|----------|------|------|
| 块编辑器 | Tiptap Block Extension: 块级拖拽 + `/` Slash Menu | 2-3 周 | 中 |
| 统一知识空间 | 新 `/workspace` 路由，统一 Sidebar 树导航 | 1 周 | 低 |
| 看板视图 | KanbanView: 按 select 列分组，拖拽卡片 | 3-4 天 | 低 |
| 日历视图 | CalendarView: 按 date 列渲染日历 | 3-4 天 | 低 |
| 反向链接 | 解析 `[[页面名]]` / `@页面名`，建立双向关系表 | 3-4 天 | 低 |
| 模板库 | TemplateGallery: 内置 + 用户自建 + 一键复制 | 3-4 天 | 低 |
| 全站搜索 | `/api/search?q=` 跨文档/Memory/IM/OKR/DC | 1 周 | 低 |

### 3.4 统一空间架构

```
/workspace
├── Sidebar 树状导航
│   ├── 我的文档 (无限嵌套)
│   ├── 企业 Memory
│   ├── 多维表格 (grid/kanban/calendar)
│   └── 知识图谱
├── Main Area
│   ├── 块编辑器 (/ 命令 + 拖拽)
│   ├── 反向链接面板
│   └── 全局搜索 (Cmd+Shift+F)
```

---

## 四、IM

> IM 沟通对标企业微信的完整沟通功能体系。

### 4.1 核心要求拆解

| 要求 | 含义 | 验收标准 |
|------|------|----------|
| 7 种群型 | 部门/项目/跨部门/私聊/公告等 | 所有群型可用，部门群自动建 |
| 音视频会议 | 群内一键发起 | 腾讯会议 ISV 已打通 |
| 文件存储 | 发送文件持久化 | MinIO 已接入 |
| 协同文档 | 群内共创 | Tiptap+Yjs + Univer 已接入 |
| 消息沉淀 | 一键转 Memory/决议 | 悬浮条: 开议事室 / 沉淀 (已有) |
| @AI 分身 | @Persona 流式回复 | 已有 |

### 4.2 当前代码资产

- `lib/types/im.ts` — ImChannel (7 种) / ImMessage
- `app/im/page.tsx` — IM 主界面
- `lib/infra/embedding.ts` — 消息语义 embedding
- `app/api/im/*` — 群/消息/文件/表情 API

### 4.3 缺失能力与填补方案

| 缺失项 | 填补方案 | 工期 | 风险 |
|--------|----------|------|------|
| 移动端响应式 | IM 列表可折叠，消息气泡适配窄屏 | 3-4 天 | 低 |
| 语音消息 | Web Audio 录制 + 语音转文字 | 1 周 | 中 |
| 已读名单详情 | 点击已读人数弹窗显示具体名单 | 1-2 天 | 低 |
| 消息搜索 | `/api/im/search?q=` 按关键词+时间+发送人 | 2-3 天 | 低 |
| 审批 Bot 卡片 | 审批推送到 IM + 卡片内同意/驳回 | 3-4 天 | 低 |
| 移动端 PWA | Service Worker + 推送通知 + 桌面图标 | 1 周 | 中 |

---

## 五、邮箱

> 邮箱对标 Google Mail 的价值体现。

### 5.1 核心要求拆解

| 要求 | 含义 | 验收标准 |
|------|------|----------|
| 收件箱 | IMAP 收信，线程视图 | 配置后能正常收信 |
| 写邮件 | SMTP 出站，富文本 | 已有 |
| 标签系统 | 多标签分类 | 一封邮件多标签 |
| 智能分类 | 自动分类邮件 | AI 分类 (primary/social/promotions) |
| 智能撰写 | AI 辅助写邮件 | Persona styleProfile 调口吻 |
| 邮件->决议 | 外部邮件转内部工作流 | 收件界面一键 spawn DC |

### 5.2 当前代码资产

- `app/mail/page.tsx` — 邮箱主界面
- `app/api/mail/send/route.ts` — SMTP 出站
- `hooks/useHandoffPrefill.ts` — 决议/议事室一键转邮件草稿

### 5.3 缺失能力与填补方案

| 缺失项 | 填补方案 | 工期 | 风险 |
|--------|----------|------|------|
| IMAP 收件 | node-imap 定时拉取 + 存入 Message 表 | 1-2 周 | 中 |
| 线程视图 | 按 Message-ID/References 聚合对话 | 3-4 天 | 低 |
| 标签系统 | 用户自定义标签 + AI 自动标签 | 2-3 天 | 低 |
| 智能撰写 | Compose AI: 主题->正文草稿 | 3-4 天 | 低 |
| 邮件搜索 | `/api/mail/search?q=` 全文索引 | 2-3 天 | 低 |
| 邮件->决议 | 收件界面一键 spawn Decision Card | 2-3 天 | 低 |

---

## 六、搭子工作台

> 搭子工作台可以召唤技能加持工作能力。

### 6.1 核心要求拆解

| 要求 | 含义 | 验收标准 |
|------|------|----------|
| 工作台主界面 | 每日工作一屏掌握 | 今日待办/关键 KR/最新消息/快速入口 |
| 技能召唤 | 低门槛调用 Skill | 一句话或快捷键召唤 |
| 技能加持 | AI 增强现有工作 | 写文档时自动摘要，OKR 页自动生成日报 |
| 技能市场 | 浏览/安装/管理 | 分类浏览，评分，一键安装 |
| 技能组合 | 多技能串联 (宏) | 用户自定义 workflow |

### 6.2 当前代码资产

- `app/tandem/page.tsx` — "1 舞台 + 2 召唤"
- `app/agents/page.tsx` — Agent 列表
- `app/atlas/page.tsx` — 技能市场
- `lib/taf/skills/builtin.ts` — 内置技能注册
- `lib/persona/govern-persona.ts` — 4 道闸卡点

### 6.3 缺失能力与填补方案

| 缺失项 | 填补方案 | 工期 | 风险 |
|--------|----------|------|------|
| 统一召唤入口 | 全局 `Cmd+K` 技能面板，Raycast 式 | 1 周 | 低 |
| 工作台 Dashboard | 今日工作流卡片: 待办 + 滞后预警 + 快速召唤 | 3-4 天 | 低 |
| 技能推荐 | 上下文感知: 文档->摘要, OKR->日报 | 3-4 天 | 低 |
| 技能连招 | Macro Builder: 可视化拖拽技能节点 | 2-3 周 | 中 |
| 技能使用统计 | 使用频率/成功率/节省时间 | 3-4 天 | 低 |
| 技能评分 | 安装后评分 + 评论 + 排序 | 2-3 天 | 低 |

---

## 七、拿捏

> 拿捏是员工成长平台，类似养 OpenClaw 的技能增长。

### 7.1 核心要求拆解

| 要求 | 含义 | 验收标准 |
|------|------|----------|
| 养成感 | 可视化成长 | 技能树/经验值/进度条 |
| 收集感 | 解锁技能/成就 | 成就系统 + 已解锁技能展示 |
| 进化感 | 从弱到强可感知 | 5 阶段有明确里程碑和庆祝 |
| 个性化 | 成长路径不同 | 根据岗位/OKR/兴趣推荐 |
| 游戏化 (不卷) | 自我超越导向 | 无排行榜，有个人成就 |

### 7.2 当前代码资产

- `lib/types/persona.ts` — Persona / StyleProfile / GrowthArea
- `lib/persona/stage-meta.ts` — 5 阶段元数据
- `app/persona/*` — 分身主页/训练台/进化/权限
- `app/learning/page.tsx` — 学习中心
- `lib/persona/govern-persona.ts` — L0-L5 统一卡点

### 7.3 缺失能力与填补方案

| 缺失项 | 填补方案 | 工期 | 风险 |
|--------|----------|------|------|
| 技能树可视化 | `/persona/evolution` 升级为星图/技能树 UI | 1 周 | 低 |
| 经验值系统 | 每次决议/学习/训练 +XP，即时 toast | 3-4 天 | 低 |
| 成就/徽章 | 里程碑徽章 (首次决议/首次升阶/连续日报...) | 3-4 天 | 低 |
| 成长仪表盘 | `/me` 首屏: 本周成长/累计 XP/技能掌握度/距离下阶段 | 3-4 天 | 低 |
| 成长预测 | AI 预测 "预计 3 周后达到 deputy" | 2-3 天 | 低 |
| 个性化路径 | 根据岗位/OKR/薄弱项推荐课程和技能 | 1 周 | 中 |
| 匿名百分位 | "决议质量超过 73% 同岗位" (无具体排名) | 2-3 天 | 低 |

---

## 八、综合优先级矩阵

| 优先级 | 模块 | 关键动作 | 工期 | 影响 |
|--------|------|----------|------|------|
| **P0** | 邮箱 | IMAP 收件 V2 | 1-2 周 | 否则邮箱不可用 |
| **P0** | 中央 AI | 首页 Ask Tandem + Cmd+K | 3-4 天 | 产品灵魂落地 |
| **P1** | 知识库 | 块编辑器 + 统一空间 | 2-3 周 | Notion 基础体验 |
| **P1** | 搭子 | Cmd+K 技能面板 + 工作台 Dashboard | 1-2 周 | 用户核心诉求 |
| **P1** | 事半 | 级联编辑 + 季度复盘 | 2-3 周 | Tita 对标关键 |
| **P2** | 拿捏 | 技能树 + XP + 仪表盘 | 1-2 周 | 员工粘性 |
| **P2** | IM | 响应式 + 语音 + 审批卡片 | 1-2 周 | 沟通闭环 |
| **P2** | 邮箱 | 线程 + 标签 + 智能撰写 | 1-2 周 | 锦上添花 |
| **P3** | 知识库 | 看板/日历 + 反向链接 + 模板 | 1-2 周 | 深度体验 |
| **P3** | 拿捏 | Avatar + 社交学习 | 3-4 天 | 可选增强 |

---

_本文档为功能架构详细拆解，用于指导开发排期。建议按 P0->P1->P2 顺序推进。_
