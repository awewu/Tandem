# Tandem 三柱体系完整优化方案

**日期**: 2026-05-28
**作者**: Owner × Cascade（结对推演）
**状态**: 待 Owner 拍板 → 进入实施

---

## 一、背景与触发

Owner 在 2026-05-28 mobile 上线后开启第二轮优化对话。围绕 SubSidebar 中"每日记录"位置的疑问，逐步推演到整个 Tandem 系统的认知重构：

> 当前的「事半 / 搭子 / 拿捏 / ...」9 个模块缺乏清晰的认知分层，员工进 Tandem 后不知道**哪里是工作、哪里是助手、哪里是成长**。

经过五轮对话，确立 **「事半 · 搭子 · 拿捏」三柱体系** 作为产品根骨架，其余模块作为支撑层（沟通/知识/流程/邮箱/内网/组织/管理/设置）。

---

## 二、三柱根本性定位

| 维度 | 🎯 事半 (OKR Engine) | 🤖 搭子 (AI Layer) | 🌱 拿捏 (Growth Layer) |
|---|---|---|---|
| **回答的问题** | 我要做什么 | 此刻怎么做 | 我成为什么 |
| **时间频率** | 季 / 周 / 日 | 实时 / Now | 月 / 季 / 年 |
| **视角** | 外向 · 目标交付 | 即时 · AI 协作 | 内向 · 能力进化 |
| **数据主体** | KR / KPI / TTI / Reports / Insights | Persona主分身 / SkillAvatars / Chat | Skills / Learning / Evolution / 360 |
| **失败信号** | KR off-track / 周报缺席 | 没人召唤 / 分身闲置 | maturity 停滞 / 短板长期不补 |
| **隐喻** | 你的「工作清单」 | 你的「助理 + 团队」 | 你的「成长档案」 |

**判定法则**：
- 看到任何"目标 / 数字 / 推进" → 归 **事半**
- 看到任何"对话 / 召唤 / 执行" → 归 **搭子**
- 看到任何"学了 / 长了 / 评了" → 归 **拿捏**

---

## 三、当前现状审计

### ✅ 已对齐的（不动）

| 项 | 位置 | 状态 |
|---|---|---|
| OKR / TTI / KPI 三层目标体系 | `/okr`, `/tti`, `/kpi` | 完整 |
| 议事室决议沉淀 | `/convergence` | 完整 |
| 5min 智能日报 | `/report` | 已具备 AI 提炼 + 推流到 KR |
| WorkbenchAgentView 多线工作聚合 | 首页 §1.5 | 6 类 Waiting/Running 已实现 |
| 移动端 sticky CTA / 流式 IM | `/report`, `/im` | 上一轮刚交付 |

### ⚠️ 需要 reshape 的

| 当前问题 | 影响 | reshape 方向 |
|---|---|---|
| 5min 日报放在「拿捏 · 每日记录」分组 | 与 OKR 闭环割裂 | **已迁移到「事半 · 每日推进」**（本轮 commit） |
| 「搭子」是大杂烩（AI对话 / Agent 助手 / AI 分身 / 智能信号 / 模型设置） | 没有"工作台"感 | 重构为 **主分身 / 子分身 / 召唤台 / 配置** 四区 |
| 「拿捏」混着分身和技能 | 概念重叠搭子 | 分身全部归搭子，拿捏只留 **画像 / 技能 / 成长里程 / 学习中心** |
| AI 智能信号 (`/insights`) 在搭子下 | 与 OKR 反馈割裂 | 移回 **事半 · 分析洞察组**（已在事半 items 中，搭子下重复，去重） |
| `/persona` 当前是档案页 | 未兑现"AI 分身"承诺 | 重做成**主分身工作台**（聚合 brief + 子分身网格） |
| WorkbenchAgentView 放首页 §1.5 | 与未来主分身 brief 重复聚合 | 搬进 `/persona` 作为主分身 brief 数据源，首页只放 1 行入口卡 |
| `/agents` 通用 Agent 库当主入口 | 与"我"无关 | 降级为搭子下「公共兜底」，子分身才是主路径 |

### 🆕 需要新建的

| 新功能 | 路径 | 价值 | 优先级 |
|---|---|---|---|
| 主分身 brief 卡（流式播报） | `/persona` 改造 | AI-Native 体验，每天打开第一眼 | P0 |
| 5 个子分身页（设计/PM/技术/营销/战略） | `/persona/skills/[id]` | 真正的差异化护城河 | P0 |
| 子分身 maturity 评分 | `lib/persona/maturity.ts` | 与技能矩阵双向映射 | P1 |
| 学习中心 (`/learning`) | `/learning/*` | 拿捏的能力输入端 | P1 |
| AI 课程生成器 | `/api/learning/generate` | 不做传统 LMS | P1 |
| 我的代表作 | `/portfolio` | 沉淀产出 + 公司认可 | P2 |
| 我的复盘库 | `/retros/me` | 个人成长元数据 | P2 |
| 主分身夜间 brief 生成 | `/api/persona/brief/generate` | 早上推送今日要事 | P2 |

---

## 四、三柱完整架构

### 🎯 事半 · 目标与反馈

```
事半 (id: okr)
├── KPI 绩效达成 ──── 年度硬指标
│   ├── 我的绩效目标         /kpi
│   └── 部门绩效对比         /kpi?view=dept     (manager+)
│
├── 目标与关键成果法 OKR ─── 季度自主目标
│   ├── 我的目标与对齐       /okr?owner=me
│   ├── 日常推进 (TTI)       /tti
│   └── 团队效能 Dashboard   /okr/dashboard     (manager+)
│
├── 每日推进 ─── KR daily/weekly check-in
│   ├── 5min 智能日报 ★      /report             (CTA)
│   └── 本周回顾             /report/weekly
│
└── 分析洞察 ─── AI 反馈层
    ├── AI 智能信号          /insights
    └── 组织分析             /analytics         (manager+)
```

**核心循环**：定 O/KR → 拆 TTI → 写日报推 KR → 周回顾校准 → 季末打分 → 喂回 KPI

### 🤖 搭子 · 个人 AI 工作台

```
搭子 (id: ai)
│
├── 🌟 主分身 (核心入口) /persona
│   ├── 今日 Brief (流式 LLM 播报)
│   ├── 召唤建议
│   └── 主分身代办          /persona/me/proxy-actions
│
├── 🧬 我的子分身 (专业技能层)
│   ├── 🎨 设计子分身       /persona/skills/design
│   ├── 📦 PM 子分身        /persona/skills/pm
│   ├── 💻 技术子分身       /persona/skills/tech
│   ├── 📣 营销子分身       /persona/skills/marketing
│   ├── 🎯 战略子分身       /persona/skills/strategy
│   └── + 训练新子分身
│
├── 💬 召唤台 (聊天会话)
│   ├── 与主分身对话         /chat?with=main
│   ├── 与子分身对话         /chat?with=<skillId>
│   └── 历史会话            /chat
│
└── ⚙️ 配置
    ├── Agent 库 (公共)      /agents          ← 通用预设, 兜底
    └── 模型设置             /settings/llm
```

**核心循环**：主分身 brief → 用户选要推进的事 → 召唤匹配的子分身 → 子分身带（公司知识 + 本人风格 + 当前 OKR 上下文）生成产出 → 沉淀回主分身记忆

**子分身 = 我自己 + 专业方法论 + 公司记忆 = 不可复制的护城河**

### 🌱 拿捏 · 个人成长 + 学习中心

```
拿捏 (id: me)
│
├── 📊 自我画像 ─── 我是谁
│   ├── 个人档案             /persona/profile
│   ├── 360° 评估           /360
│   └── 9-Box 定位           /nine-box
│
├── 🎓 技能矩阵 ─── 我会什么
│   ├── 我的技能图谱         /skills          (含子分身 maturity 映射)
│   └── 学习路径推荐         /skills/learning
│
├── 🚀 成长里程 ─── 我长了什么
│   ├── 成长路径             /persona/evolution
│   ├── 我的复盘库           /retros/me        🆕
│   └── 我的代表作           /portfolio        🆕
│
└── 📚 学习中心 ─── 我在学什么 🆕
    │
    ├── 我的学习台 (默认页)  /learning
    │
    ├── 入职必修             /learning/onboarding
    │   ├── 公司文化与价值观
    │   ├── 组织架构          ← 来自 /org
    │   ├── 产品线总览
    │   ├── IT/办公环境
    │   └── 30/60/90 天目标   ← 喂事半 KR
    │
    ├── 合规与红线 (季度必修) /learning/compliance
    │   ├── 数据安全          ← 来自 /memories?type=redline
    │   ├── 反贿赂            ← 来自 /intranet/ethics
    │   ├── 信息保密
    │   └── 安全生产
    │
    ├── 产品学院             /learning/products
    │   ├── 产品 A/B/C 深潜    ← 来自 /knowledge?cat=products
    │   └── 行业知识
    │
    ├── 流程与标准           /learning/processes
    │   ├── 决议流程 SOP     ← 来自 /memories?type=sop
    │   ├── 报销与采购
    │   ├── 招聘与绩效
    │   └── 项目管理标准
    │
    ├── 专项进阶 (selective) /learning/tracks
    │   ├── 新晋经理训练营
    │   ├── 高级技术准入
    │   └── 跨部门轮岗
    │
    ├── 我的认证             /learning/certifications
    │   └─ 时效: 一年/季度续期
    │
    └── 学习社区             /learning/community
```

**核心循环**：360 → 短板 → 学习中心补课 → 完成认证 + 训练子分身 → 子分身 maturity↑ + 技能等级↑ + KR 进度↑ → 9-Box 重新定位 → 推荐下一阶段课程

---

## 五、三柱数据流闭环

```
┌────────── 事半 (OKR 引擎) ──────────┐
│  O / KR / TTI / 日报 / Check-in        │
└──────┬─────────────────────┬───────────┘
       │ KR 进度 + 卡点         │ 日报内容 + 进展样本
       │ → 喂主分身 brief       │ → 喂子分身训练
       ▼                       ▼
┌──────────── 搭子 (AI 工作台) ─────────┐
│  主分身 brief / 子分身执行              │
└──────┬─────────────────────┬──────────┘
       │ 召唤记录 + 产出沉淀      │ 子分身 maturity
       │ → 喂代表作 / 评估       │ → 映射技能等级
       ▼                       ▼
┌──────────── 拿捏 (成长 + 学习) ───────┐
│  Skills / 360 / Evolution / Learning    │
└──────┬─────────────────────────────────┘
       │ 短板信号 + 课程完成
       │ → 反哺 OKR 推荐新挑战 / 反哺训练样本
       ▼
   (回到 事半 + 搭子)
```

### 一日认知循环（员工视角）

```
06:00 主分身夜间生成今日 brief (基于昨日 OKR + 今日日程 + 议事 backlog + 学习计划)
  └─ push 通知

08:00 员工打开 Tandem
  ├─ 进搭子: 读 brief → "今天该推 KR-3 卡点 + 14:00 复盘 + 完成《数据安全》必修"
  └─ 主分身建议: 召唤 PM 子分身 起草复盘提纲

10:00 进事半: 看 KR 状态 → 点 KR-3 ✏️ → 跳到 /report?krId=KR-3
  ├─ 写 3 行进展 → AI 提炼 ActionPlan
  └─ 推流到 OKR (KR-3 进度 +5%, 状态从 off-track → at-risk)

11:00 召唤设计子分身: 起草 UI mockup
  ├─ 子分身用本人审美风格 + 公司设计 SOP
  └─ 产出沉淀: maturity +1, 技能矩阵设计项 +1 分

15:00 进拿捏 · 学习中心: 完成《数据安全 v3.2》
  ├─ 主分身做导师答疑
  ├─ 5 题考核, 错 1 题 → 主分身用本人项目讲解
  └─ 系统: 合规认证 +1, KR-onboarding 进度 60%→80%

18:00 进拿捏 · 技能矩阵: 看今日成长
  ├─ skills 显示 "设计 +1, 接近高级"
  ├─ 学习路径推荐 "下一步: 学交互动效"
  └─ 复盘库 prompted: "你今天解了 KR-3 卡点, 写 50 字复盘?"

22:00 主分身夜间汇总
  └─ 生成明日 brief
```

---

## 六、IA 重排（`components/nav-modules.ts`）

### 三柱顺序（不变）
1. 首页
2. **事半** ★
3. 沟通
4. 知识
5. 流程
6. **拿捏** ★
7. **搭子** ★
8. 邮箱 / 内网 / 组织 / 管理 / 设置

### 关键变更点

**事半 (`okr`)**：
- ✅ 已添加「每日推进」分组（5min 日报 + 本周回顾）— 本轮已 commit
- ✅ 已去掉 TTI 的 `accent: 'cta'`，让位给日报 — 本轮已 commit
- 待办：`/insights` 在搭子下的重复入口去掉

**搭子 (`ai`)**：
- 重构 items：
  ```
  group: '🌟 主分身'
    · 主分身工作台      /persona              accent: cta
    · 主分身代办        /persona/me/proxy-actions
  group: '🧬 我的子分身'
    · 设计子分身        /persona/skills/design
    · PM 子分身         /persona/skills/pm
    · 技术子分身        /persona/skills/tech
    · 营销子分身        /persona/skills/marketing
    · 战略子分身        /persona/skills/strategy
  group: '💬 召唤台'
    · AI 对话           /chat
    · Agent 库          /agents
  group: '⚙️ 配置'
    · 模型设置          /settings/llm
  ```
- 移除：`AI 智能信号` 入口（事半已有）

**拿捏 (`me`)**：
- 重构 items：
  ```
  group: '📊 自我画像'
    · 个人档案          /persona/profile
    · 360° 评估         /360
    · 9-Box 定位        /nine-box
  group: '🎓 技能矩阵'
    · 我的技能          /skills
    · 学习路径推荐      /skills/learning
  group: '🚀 成长里程'
    · 成长路径          /persona/evolution
    · 我的复盘库        /retros/me            🆕
    · 我的代表作        /portfolio            🆕
  group: '📚 学习中心'                           🆕
    · 我的学习台        /learning             accent: cta
    · 入职必修          /learning/onboarding
    · 合规与红线        /learning/compliance
    · 产品学院          /learning/products
    · 流程与标准        /learning/processes
    · 专项进阶          /learning/tracks
    · 我的认证          /learning/certifications
  ```
- pathPrefixes 加 `/learning`, `/360`, `/nine-box`, `/portfolio`, `/retros`

---

## 七、分 Phase 实施路径

| Phase | 范围 | 关键交付 | 时间 | 风险 |
|---|---|---|---|---|
| **P0 · IA 正本清源** | nav-modules 三柱重排 + stub 页 | 用户进 Tandem 看到清晰三柱；点开新链接不 404 | **1 天** | 低 |
| **P1 · 主分身工作台 MVP** | `/persona` 改造为 brief 卡片 | 复用 WorkbenchAgentView 聚合，套 LLM 流式播报；5 子分身网格（先 stub maturity） | **2-3 天** | 中（LLM 提示词需调） |
| **P2 · 学习中心 MVP** | `/learning/*` + AI 课程生成器原型 | 输入 1 篇 SOP → 自动生成讲解 + 5 题；onboarding 跑通 1 个员工 | **3-5 天** | 中（生成质量不稳定时需人工兜底） |
| **P3 · 子分身真训练** | 训练台 + maturity 算法 | 喂样本 → 子分身 maturity 评分；与 skills 双向同步 | **3-5 天** | 中 |
| **P4 · 合规强校准** | 红线必修 + 锁权限 + 季度刷新 | Steward 审计闭环：未学完 → 自动锁敏感访问 | **1 周** | 高（涉及权限系统改动，需小步验证） |
| **P5 · 三柱真闭环** | 学习 ↔ 子分身 ↔ KR 数据通路 | 完成认证 → KR 进度自动 +N；子分身 maturity → 技能等级双向 | **1 周** | 中 |
| **P6 · 长尾深化** | 代表作 / 复盘库 / 学习社区 / 主分身代办 | 沉淀员工数字资产 | **2-4 周** | 低（独立功能，可并行） |

**预估**：P0 - P3 = 2 周内可完成 MVP；P4 - P6 = 4-6 周深化。

---

## 八、需 Owner 拍板的决策项

### A. 子分身基础人格来源
- ☐ 选项 1（推荐）：复用现有 `PRESET_AGENTS` 5 个固定预设 — 简单、可立即上线
- ☐ 选项 2：员工自定义子分身类型与数量 — 灵活但前期复杂

### B. 搭子 vs 召唤台的合并粒度
- ☐ 选项 1（推荐）：`/chat` 默认显示我的子分身，"通用 Agent" 折叠到次级
- ☐ 选项 2：`/persona` 是子分身入口，`/chat` 仍是通用 Agent

### C. 学习中心课程内容来源
- ☐ 选项 1：纯 AI 生成（输入文档 → 主分身生成讲解+题）— 极轻、可立刻上线
- ☐ 选项 2：HR/Steward 编辑器手动建课 — 重、扩展慢
- ☐ 选项 3（推荐）：混合（AI 起草 + 人工审核）

### D. 合规必修过期处置
- ☐ 选项 1（推荐分级）：红线/合规过期锁权限；产品/流程仅提醒
- ☐ 选项 2：全部仅提醒（缓和）
- ☐ 选项 3：全部锁权限（强硬）

### E. 培训 ↔ KPI 联动
- ☐ 选项 1（推荐）：必修不完成 → KPI 减分；选修完成 → 加分；专项完成 → 解锁晋升路径
- ☐ 选项 2：完成必修是 KPI 加分项
- ☐ 选项 3：不影响 KPI

### F. 命名最终方案
- ☐ 选项 1（推荐）：「主分身」+「专业子分身」
- ☐ 选项 2：「AI 分身」+「专业搭子」
- ☐ 选项 3：其他

### G. 学习中心导航位置
- ☐ 选项 1（推荐）：作为拿捏的子分组（保持三柱清晰）
- ☐ 选项 2：升级为独立模块「学院」

---

## 九、风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| LLM 生成的 brief / 课程内容质量不稳 | 高 | 中 | 输出可被员工编辑；保留人工兜底；接入 Steward 审计 |
| 子分身 maturity 算法不科学 | 中 | 中 | 先用样本量 × 时间衰减简单公式；后期接 360 反馈校准 |
| 合规锁权限误伤业务 | 中 | 高 | 灰度推进；红线类先用 24h grace period |
| 员工觉得"培训是负担"不愿用 | 高 | 高 | 强绑定子分身 maturity，让"学习 = 分身能力升级"，不是孤立任务 |
| 三柱重构破坏现有模块 | 中 | 高 | 路由全部保留旧路径（仅 nav 入口换组），数据 schema 0 改动 |
| 主分身夜间 brief 生成失败 | 中 | 低 | 失败静默；只是用户当天少一个 brief |

---

## 十、对外口径

> **Tandem 三柱体系：事半让你跑得快、搭子让你跑得轻、拿捏让你跑得远。**
>
> - **事半**（OKR 引擎）：定目标、推进度、写日报、看反馈，不跑偏才能事半功倍
> - **搭子**（AI 工作台）：主分身做你的助理 brief，子分身做你的专业团队，越用越像你自己
> - **拿捏**（成长 + 学习）：画像 / 技能 / 里程 / 学习中心，让能力增长可见可量化
>
> **三柱共享一个核心：以"我"为单位、以"我的 AI 分身"为聚合层，构成员工真正不可替代的数字资产。**

---

## 附录 A · 已完成（本轮 commit）

1. ✅ Mobile 6 项优化（IM 流式 / report sticky CTA / 首屏紧凑 / OKR 反向锁定 / chat 抽屉 / drawer 用户区）
2. ✅ 「每日记录」从「拿捏」迁移到「事半 · 每日推进」
3. ✅ 「日常推进 (TTI)」让位 CTA 给「5min 智能日报」

## 附录 B · 关联文档

- `docs/PRODUCT-DEFINITION.md` — Tandem 产品定义
- `docs/MOBILE-VS-GPT-KIMI.md` — Mobile 差异化策略
- `docs/REFLECTION-2026-05.md` — 5 月反思（同日推进）
- `docs/MANIFESTO.md` — §13 "我"视角原则

---

**下一步**：等 Owner 在 §八 拍板 A-G 7 个决策点后，启动 **P0 IA 正本清源**（1 天内见效）。
