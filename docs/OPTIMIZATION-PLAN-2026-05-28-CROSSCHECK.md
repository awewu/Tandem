# 三柱优化方案 × Tandem 宪章 / 立项 / PRD 交叉验证报告

**日期**: 2026-05-28
**验证对象**: `docs/OPTIMIZATION-PLAN-2026-05-28.md`
**验证基准**:

- `docs/MANIFESTO.md` (19 条产品宪章)
- `docs/OKR-DRIVEN-ARCHITECTURE.md` (Owner 2026-05-27 立项 6 条初心)
- `docs/SUMMON-AND-NURTURE.md` (拿捏/搭子双范式白皮书)
- `docs/PERSONA-EVOLUTION.md` (FPE 三层结构)
- `docs/CHARTER-FOUR-PILLARS.md` (IM/文档/日历/邮箱协作 4 板块)
- `docs/PRD.md`

**结论**: 三柱体系**方向正确**，但存在 **3 个严重冲突 + 5 个隐性约束漏失 + 2 个产品哲学校准**，必须修正后才能进入 P0 实施。

**v2 增补 (2026-05-28 22:00 PT, Owner 同意)**:

- 校准 1: **「单分身 + 技能模式」模型**取代「主分身 + 子分身」(详见 § 4.5)
- 校准 2: **3+1 抽层通用化**, 所有 AI 拍板场景必经, 不仅议事室 (详见 § 4.6)

---

## 一、宪章谱系定位

```
立项之时 (Owner 2026-05-27 PT, 不可改写)
   │
   ├─ MANIFESTO.md · 19 条不动条款
   │     第 4/5 条 — KPI ↔ TTI 双轨
   │     第 7/8 条 — 4 层知识架构 + 签批闸门
   │     第 9 条   — 分身代参 / 红区 / 24h 否决窗
   │     第 13 条  — 数据归公司 / 尊严归员工
   │     第 15 条  — AI 助员工成长 (24h 否决 + 推演透明)
   │     第 19 条  — 拥抱个人 AI · Skill Gateway 4 道闸
   │
   ├─ OKR-DRIVEN-ARCHITECTURE.md · 6 条立项初心 (Owner 原话)
   │     ④ 事半 = OKR 驱动器 (严格版, 每项必回溯 OKR)
   │     ⑤ 搭子 + 拿捏 = 个人成长 (与 OKR 解耦)
   │     ⑥ 个人 ↔ 组织 双向闭环
   │
   ├─ SUMMON-AND-NURTURE.md · 拿捏/搭子边界白皮书
   │     拿捏 = 个人养成 (训练分身/技能)
   │     搭子 = 工具召唤 (专家 Agent)
   │     7 决议: 命名/治理/代行/隐私/Opt-In/PK 模式/Skill Gateway
   │
   ├─ PERSONA-EVOLUTION.md · FPE 三层
   │     Org / Department / Personal 三层联邦
   │     双引擎: 中央赋能 + 自我进化
   │     萃取流水线: 4 阶段 + K-匿名隐私
   │
   └─ CHARTER-FOUR-PILLARS.md · IM/文档/日历/邮箱
         注: 与三柱不冲突 (前者是协作工具层, 后者是认知 narrative 层)
```

---

## 二、对照矩阵 · 逐条验证

### 标记图例

- ✅ 完全一致 (强化宪章)
- ⚠️ 方向对但需调整措辞/边界
- ❌ 与宪章直接冲突 (必须修正)
- 🆕 宪章未明确，可作为合理扩展

### 2.1 三柱总体定位

| 优化方案条款 | 宪章对照 | 判定 |
|---|---|---|
| 三柱 = 事半 / 搭子 / 拿捏 | OKR-DRIVEN § 三 ④⑤ Owner 原话 | ✅ |
| 事半 = "我要做什么"，OKR 闭环 | OKR-DRIVEN § 三 ④ "牛马 = OKR 驱动器" | ✅ |
| 搭子 = "此刻怎么做" | SUMMON & NURTURE § 一 "搭子=工具召唤" | ✅ |
| 拿捏 = "我成为什么" | SUMMON & NURTURE § 一 "拿捏=个人养成" | ✅ |
| 三柱共享主分身聚合层 | OKR-DRIVEN § 三 ⑥ 双向闭环 | ✅ |

### 2.2 事半模块改造

| 优化方案条款 | 宪章对照 | 判定 |
|---|---|---|
| 5min 日报迁到事半 | OKR-DRIVEN § 五 Q1 "每项必回溯 OKR" | ✅ 强化 |
| 「每日推进」分组（日报+周回顾） | 同上，日报本质是 KR check-in | ✅ |
| TTI 让出 cta，5min 日报为 cta | MANIFESTO §4 KPI/TTI 双轨；日报是高频入口 | ✅ |
| AI 智能信号回归事半 · 分析洞察组 | 同上 | ✅ |

### 2.3 搭子模块重构

| 优化方案条款 | 宪章对照 | 判定 |
|---|---|---|
| **搭子下设主分身/子分身/召唤台/配置 4 区** | SUMMON & NURTURE § 一 "搭子=工具召唤" | ❌ **冲突 1** |
| **5 个固定子分身（设计/PM/技术/营销/战略）** | MANIFESTO §19 "❌ Tandem 自研个人 AI Coder/Writer" | ❌ **冲突 2** |
| 子分身 = 我 + 专业 + 公司知识 | PERSONA-EVOLUTION § 1.3 + Skills Registry 体系 | ⚠️ 需重定义为 Persona × Skill 组合 |
| 子分身调企业数据 → 公司 SOP/OKR 上下文 | MANIFESTO §19 必经 Skill Gateway 4 道闸 | ⚠️ **漏 1** |
| `/agents` 降级 | SUMMON & NURTURE § 二 2 "管理员配置 + 个人 Fork" | ⚠️ 不能简单降级，是治理主体 |
| 主分身 brief 聚合 OKR/IM/议事 | MANIFESTO §13.2 数据可见性 | ⚠️ **漏 2** 默认私有 |

### 2.4 拿捏模块重构

| 优化方案条款 | 宪章对照 | 判定 |
|---|---|---|
| **分身全部归搭子，拿捏只留画像/技能/学习** | SUMMON & NURTURE § 一 "**拿捏=个人养成 (训练分身)**" | ❌ **冲突 3** |
| 删除 `/persona/training` (训练台) | SUMMON & NURTURE § 三 B1 "训练台是拿捏 V1 必交付" | ❌ 同冲突 3 |
| 个人档案 / 360 / 9-Box | MANIFESTO §10 9 宫格人才矩阵 | ✅ |
| 学习中心新增 | 宪章未明确，但不矛盾 | 🆕 合理扩展 |
| 学习内容 AI 自动生成 | MANIFESTO §15 "AI 助员工成长" | ✅ |
| 合规必修过期锁权限 | MANIFESTO §8 防基线漂移 | ✅ |
| 子分身 maturity ↔ 技能等级 | PERSONA-EVOLUTION § 5.1 Skills Registry | ✅ |
| 学习训练数据 Opt-In | SUMMON & NURTURE § 二 5 "100% 自愿 Opt-In" | ⚠️ **漏 3** 必须显式 |

### 2.5 主分身设计

| 优化方案条款 | 宪章对照 | 判定 |
|---|---|---|
| 主分身夜间 brief，早上推送 | MANIFESTO §11 "AI Digest 集中处理" | ✅ |
| 主分身可以"代办"低风险动作 | MANIFESTO §9 红/黄/绿区代行 | ⚠️ **漏 4** |
| 主分身建议召唤子分身 | MANIFESTO §15 "可被员工否决" | ✅ |
| WorkbenchAgentView 整合到主分身 | MANIFESTO §13.2 "我"视角原则 | ✅ |

### 2.6 学习中心架构

| 优化方案条款 | 宪章对照 | 判定 |
|---|---|---|
| 课程内容来自 /knowledge + /memories | MANIFESTO §7 4 层知识架构 | ✅ Material→课程，不污染 Memory |
| 学习完成 → 子分身 maturity↑ | PERSONA-EVOLUTION § 4 萃取流水线 | ⚠️ 必经签批/认证再入 Memory |
| 完成认证 → KR 进度↑ | OKR-DRIVEN § 三 ④ "每项必回溯 OKR" | ✅ |
| AI 课程生成器 | 宪章未禁，可做 | 🆕 |

---

## 三、严重冲突清单（必须修正后再动）

### ❌ 冲突 1 · "分身归搭子，拿捏不留分身"违反 SUMMON-AND-NURTURE 命名权威

**宪章原文**:
> SUMMON-AND-NURTURE § 一: "拿捏 = 个人养成 (Persona Nurturing) — **养我自己的"龙虾与分身"**"
>
> § 二 1 "命名与心智对齐": "**拿捏**：解决的是"自我掌控与职业成长"——我如何**训练我自己的分身**、积累技能"

**冲突点**:
我的方案把所有分身相关功能（包括训练台 `/persona/training`）归到搭子，拿捏只剩"画像 / 技能 / 学习"。这等于**抽掉了拿捏的核心载体**。

**正确边界**:

- **训练 ∈ 拿捏** ："养"分身的过程
- **召唤 ∈ 搭子**："用"分身/Agent 干活的过程
- 分身实体本身**不属于任何一方**，它是横跨两柱的资产

**修正方案**:

```
拿捏 (养)
├── 我的分身档案     /persona               ← 主分身资料 + 五阶段 + 代行边界
├── 分身训练台       /persona/training      ← B1 训练对话纠偏 (SUMMON & NURTURE 必交付)
├── 养料仪表盘       /persona/data-source   ← B2 透明展示 Opt-Out
├── 五阶段进化       /persona/evolution     ← B3 龙虾/Hermes 里程碑
├── 代行边界设置     /persona/delegation    ← B4 绿黄红区配置
└── (画像/技能/里程/学习中心 同前)

搭子 (召)
├── 主分身工作台     /persona (主页 brief)  ← 召唤入口, brief 聚合
├── 子分身召唤网格    /summon/skills/[id]   ← 调用 Persona × Skill 组合
├── Agent 超市       /agents                ← 公司预配标准 Expert
├── 召唤台 (chat)    /chat                  ← A2 作战室 + 一键沉淀决议
└── (Skill Gateway 网关) (隐式, 走 § 4 道闸)
```

---

### ❌ 冲突 2 · "5 个固定子分身"违反 MANIFESTO §19

**宪章原文**:
> MANIFESTO §19: "**❌ Tandem 自研个人 AI Coder/Writer 跟 Claude Code/Cursor 竞争 (重新发明轮子)**"
>
> SUMMON & NURTURE § 二 7: "**Tandem 不重发明个人 AI, Tandem 做组织级网关, 不做个人 AI 竞品**"

**冲突点**:
"5 个固定预设子分身（设计/PM/技术/营销/战略）"听起来像 Tandem 自研一组角色化 Agent，违反第十九条。

**正确定位**:
子分身 ≠ 新建 Agent 实体。子分身 = **(员工 Persona) × (公司 Agent Marketplace 预配的 Expert) × (该领域历史样本) × (Skill Gateway 4 道闸)** 的运行时组合。

**修正措辞**（关键差异）:

| ❌ 原方案描述 | ✅ 修正后描述 |
|---|---|
| "5 个固定子分身" | "5 个**专业召唤组合**(Persona Skill Pack)" |
| "Tandem 内建设计子分身" | "调用公司 `/admin/launchpad` 预配的设计 Agent + 注入员工 Persona + 该领域产出样本" |
| "子分身可独立训练" | "子分身的"成熟度" = Persona 在该领域的样本量 + 公司 Skill 的 Maturity (FPE 三层注入)" |
| "子分身和 Agent 库并存" | "子分身 **是** Agent + Persona 的组合呈现，Agent 库是其底座" |

**实施意义**:

- 不需要新建 5 个 schema 实体
- 复用 `/admin/launchpad` 已有 Expert + `/skills` Registry + `/persona` Persona Profile
- 调用时通过 Skill Gateway 包一层 Persona 上下文即可

---

### ❌ 冲突 3 · 删除 `/persona/training` 违反拿捏 V1 必交付

**宪章原文**:
> SUMMON & NURTURE § 三 2 拿捏功能清单: "**B1. 训练台对话界面 (Training Ground)**：员工和分身纠偏、标注"这不像我"反向校正的对话流"

**修正**: 训练台**保留并强化**在拿捏，是"养"分身的核心交付（已在冲突 1 修正方案中处理）。

---

## 四、需要强化的隐性约束（5 个漏失）

### ⚠️ 漏 1 · 子分身调用必经 Skill Gateway 4 道闸

**宪章原文** (MANIFESTO §19):
> "个人 AI 的 skill (MCP / Function Calling 协议) 接入 Tandem 时, 必须挂在 4 道闸之后"

**应补**: 主分身/子分身调用任何企业数据（OKR、Memory、Material）或工具（IM 发消息、文档创建、Decision Card）必经：

1. **Baseline-Guard** — 是否违反公司 Memory 红线
2. **OKR Drift Detection** — 跟当前 active OKR 对齐度 ≥ 阈值
3. **Data Scope** — RBAC 4 级 (个人/团队/部门/公司)
4. **Action Scope** — 红区拒/黄区签批/绿区+ProxyAction 24h 否决窗

**实施意义**: 主分身 brief 调企业数据时必须经网关；后端已有 `lib/skill-gateway/` (检查后补)。

### ⚠️ 漏 2 · 主分身 brief 默认私有

**宪章原文** (SUMMON & NURTURE § 二 4):
> "默认 100% 隐私... Steward, Admin 和主管在后台均无权检索或查看"
>
> MANIFESTO §13.2: "尊严归员工"

**应补**: 主分身 brief 内容（聚合 OKR/IM/议事/卡点 + LLM 包装文本）默认**只员工本人可见**。Steward/Admin/主管在后台无法检索。只有员工主动"沉淀为决议卡 / Material 收藏"才入公域。

### ⚠️ 漏 3 · 训练数据 Opt-In + 一键擦除

**宪章原文** (SUMMON & NURTURE § 二 5):
> "100% 自愿 Opt-In, 允许一键自助关停或抹除... 满足数据可携权与遗忘权"

**应补**:

- 子分身训练样本来源（日报/周报/PRD/IM 高赞回复/设计稿）每类必须**显式 Opt-In**
- `/settings/privacy` 提供"一键擦除我的分身记忆链"
- 学习中心训练样本同样 Opt-In

### ⚠️ 漏 4 · 主分身代办必经 9 条铁律

**宪章原文** (MANIFESTO §9):
> 红/黄/绿区代行 + 24h 否决窗 + 红区禁用分身 + 显式标识

**应补**: 主分身"代办"功能必须：

- 三区分级（红=拒、黄=起草+签批、绿=直接代行+24h 否决）
- 任何代办产出**显式打标** "AI 代理"
- `/persona/me/proxy-actions` 已有审计页（V0 已建）

### ⚠️ 漏 5 · 学习成果反哺 Persona 必经签批

**宪章原文** (MANIFESTO §8 + PERSONA-EVOLUTION § 4):
> "Memory 的写入和降级都必须经严肃流程, 不允许任何自动化判定"
> 萃取流水线 4 阶段: 脱敏 → K-匿名阈值 → 双审 → 发布

**应补**: 完成学习/认证后，子分身 maturity 上升属于**Personal Layer 内动**（不入 Memory），无需签批。但若员工的产出沉淀为公司 SOP/案例 → 必走 §8 签批闸门。当前方案隐含两者混淆，需在文档明确分层。

---

## 五、修订后的优化方案要点

### 5.1 三柱定位语句（修正版）

> **事半** (OKR 驱动器, 严格版): 每项任务必可回溯 OKR
> **搭子** (个人 AI 工作台 + 个人 AI 网关): 召唤主/子分身 + 接入市面智能体, 走 4 道闸
> **拿捏** (个人养成 + 学习中心): 训练我的分身 / 积累我的技能 / 学习公司知识

### 5.2 关键术语对照表 (v2 终稿)

| ❌ 弃用 | ✅ 正式 | 理由 |
|---|---|---|
| 子分身 | **技能模式 (Skill Mode)** | 同一分身的不同形态, 不是新 Agent 实体 |
| 5 个子分身 | **主分身的 5 种技能模式** | 数量描述清晰, 强调单分身 |
| 召唤设计子分身 | **分身 · 设计模式上身** (或 "切到设计模式") | 动作 = 切换模式, 不是切换实体 |
| 子分身 maturity | **该模式专长度 (Mode Proficiency)** | 主分身只有 1 个总 stage(1-5), 各模式有独立 0-100 专长度 |
| 子分身训练 | **拿捏 · 分身训练台** | 训练 ∈ 拿捏, 整体训练而非按模式分训 |
| 召唤组合 (Persona Skill Pack) | **技能模式 (Skill Mode)** | v1 提法过渡词, v2 统一为 Skill Mode |
| AI 课程生成 | **Material 衍生学习包** (走 §7 不污染 Memory) | 与 4 层架构对齐 |

**主分身的两层数据模型**:

```
主分身 (Persona, 唯一)
├── overallStage: 1-5         ← 整体进化阶段 (SUMMON-AND-NURTURE 五阶段)
└── modeProficiency:           ← 各模式专长度 (员工是谁决定起点)
    {
      design:    85,           ← 0-100, 设计模式有多懂张伟
      pm:        60,
      tech:      95,
      marketing: 30,
      strategy:  70,
    }
```

**视觉差异化但底层统一**: 不同模式可有不同 emoji/语气/推荐工具, 但**不可**显示不同名字、不同 maturity、隔离训练数据。

### 5.3 修订 IA（nav-modules.ts）

```
事半 (id: okr) — 不变, 已 commit
└── (KPI / OKR / 每日推进 / 分析洞察)

搭子 (id: ai) — 重构
├── group: '🌟 主分身工作台'
│     · 主分身 (今日 brief)        /persona             accent: cta
│     · 主分身代办审计              /persona/me/proxy-actions
├── group: '🧬 我的分身 · 技能模式'
│     · 设计模式                    /persona?mode=design     ← 同一 /persona, 参数切换
│     · PM 模式                     /persona?mode=pm
│     · 技术模式                    /persona?mode=tech
│     · 营销模式                    /persona?mode=marketing
│     · 战略模式                    /persona?mode=strategy
├── group: '🌉 个人 AI 接入'  🆕
│     · 接入市面智能体              /summon/external    (Cursor/ClaudeCode/ChatGPT...)
│     · Skill Gateway 审计          /summon/audit
└── group: '⚙️ 召唤台 + 配置'
      · 作战室对话                  /chat
      · Agent 超市 (公司标准)       /agents
      · 模型设置                    /settings/llm

拿捏 (id: me) — 修正版（保留分身训练）
├── group: '🤖 我的分身'
│     · 我的分身档案                /persona             ← 主分身资料 (V1)
│     · 分身训练台                  /persona/training    ← B1 必交付
│     · 养料仪表盘                  /persona/data-source ← B2 Opt-Out
│     · 五阶段进化                  /persona/evolution   ← B3
│     · 代行边界                    /persona/delegation  ← B4
├── group: '📊 自我画像'
│     · 个人档案 / 360 / 9-Box
├── group: '🎓 技能与成长'
│     · 我的技能 / 学习路径 / 复盘库 / 代表作
└── group: '📚 学习中心'              🆕
      · 学习台 / 入职必修 / 合规必修 / 产品学院 / 流程标准 / 专项 / 我的认证
```

### 5.4 实施约束补强

每个 Phase 验收前必过：

- [ ] **Skill Gateway 4 道闸验证**：所有主/子分身调用企业数据/工具，必经网关，Audit 留痕
- [ ] **隐私默认私有**：brief / 对话 / 学习记录 Steward/Admin 后台无权检索
- [ ] **Opt-In 显式**：训练数据来源勾选页 + 一键擦除按钮
- [ ] **代行三区**：红区拒/黄区签批/绿区+24h 否决窗
- [ ] **不重发明**：所有"技能模式"必须复用 `/admin/launchpad` Expert + `/skills` Registry，不新建 Agent schema
- [ ] **Material vs Memory 区分**：学习内容是 Material 衍生包，不直接入 Memory；员工产出沉淀必走 §8 签批
- [ ] **3+1 通用化**: 所有 AI 拍板场景 (日报推流/TTI 拆解/周回顾/brief 推荐/学习答题) 必经 `lib/decision-layer/`, 不仅议事室
- [ ] **单分身一致性**: UI 上无论调用哪个模式, Persona 名字/总 stage/代行边界配置必须一致, 禁止按模式分裂

---

## 六、对原 OPTIMIZATION-PLAN-2026-05-28.md 的 patch list (v2)

| 章节 | 原内容 | 修订 |
|---|---|---|
| § 三 现状审计 表 1 | "拿捏混着分身和技能 → 分身全部归搭子" | 改为"分身**训练**留拿捏，分身**召唤(切换技能模式)**入搭子" |
| § 四 搭子架构 | "5 个固定子分身" | 改为"主分身 1 个 + 5 种技能模式 (参数切换, 不是新 Agent)" |
| § 四 拿捏架构 | 缺分身相关分组 | 新增「我的分身」分组（档案/训练/养料/进化/代行边界） |
| § 五 数据流 | 缺 Skill Gateway + 缺 3+1 节点 | 加入网关节点 + AI 输出强制走 3+1 (lib/decision-layer/) |
| § 六 IA 重排 搭子 items | 4 区结构 | 改为 5.3 修订版（技能模式参数化 URL + 多"个人 AI 接入"区） |
| § 七 Phase 列表 | P1 主分身 MVP | 加 P0.5 前置: 抽 `lib/decision-layer/` 通用化 3+1; P1 加约束: Skill Gateway + 默认私有 + 单分身一致性 |
| § 八 决策项 A | "子分身基础人格来源" | 改为"技能模式底座 Agent 来自 /admin/launchpad" |
| § 八 决策项 B | "搭子 vs 召唤台合并" | 改为"技能模式在 /chat 与 /persona 的呈现方式" |
| § 八 决策项 新增 H | — | "市面 AI 接入清单首批 (Claude Code/Cursor/ChatGPT/Notion AI/Kimi)" |
| § 八 决策项 新增 I | — | "3+1 在 5min 日报 / TTI / brief / 学习答题 的呈现密度 (展开/折叠/默认隐藏)" |
| § 九 风险 | 6 项 | 新增"Skill Gateway 性能瓶颈"、"代行 24h 否决用户教育成本"、"3+1 通用化 UX 疲劳风险" |

---

## 七、验证结论

### 总体方向 ✅

三柱体系（事半/搭子/拿捏）与 Owner 2026-05-27 立项 6 条初心**完全对齐**，是宪章的具体实现而非偏离。学习中心是宪章未明确的合理扩展，且不与 4 层知识架构冲突（Material 衍生学习包，不污染 Memory）。

### 关键修正（合并到 P0 之前）

1. **术语终稿**: "子分身" → **"技能模式 (Skill Mode)"** (v1 提法 "召唤组合/Persona Skill Pack" 已废弃)
2. **单分身模型**: 主分身 1 个 + 5 种技能模式参数切换 (`/persona?mode=design`), 禁止新建独立 Agent
3. **拿捏保留分身训练**: 训练台/养料/进化/代行边界 4 项是 SUMMON-AND-NURTURE V1 必交付
4. **搭子加"个人 AI 接入"区**: 宪章 §19 拥抱市面 AI 是核心立项条款
5. **3+1 通用化** (P0.5 前置): 抽 `lib/decision-layer/`, 所有 AI 拍板场景必经

### 隐性强化（5 项）

每个 Phase 验收必过的合规清单（5.4）必须写入实施流程。

---

## 八、修订路径

**A. 同意全部修订** → 我立刻：

1. 修订 `OPTIMIZATION-PLAN-2026-05-28.md` 应用 patch list
2. 启动 P0 IA 落位（三柱 nav 重排 + stub 页 + 合规清单作为 PR checklist）

**B. 部分修订** → Owner 指出哪条不接受，我重新校准

**C. 进一步对照其它文档** → 还有 `CHARTER-CHEATSHEET.md` / `SELF-USE-FIRST.md` / `PRODUCT-DEFINITION.md` / `PRD.md` 未细看，可继续验证

---

**附录 · 立项铁律备忘**

> Owner 2026-05-27 PT 22:25 原话:
>
> "牛马 (事半) 板块的每一项任务/自动化/通知/ToDo 都**必须**可回溯到当前 OKR. 跟不上 OKR 的事**不该进事半板块**."
>
> "搭子 + 拿捏板块跟 OKR **解耦**, 是给员工个人成长的. **开放接入市面所有个人 AI 智能体**, 不是封闭的 Tandem 内 Agent."
>
> "Tandem **不重发明个人 AI**, Tandem 做组织级网关."

这三句话是三柱方案不可触碰的宪法底线。

---

**附录 · 2026-05-29 实现锚点速查**

| 本文档章节 | 代码模块 | IMPL-NOTES 模块 |
|---|---|---|
| §四 搭子架构 / 主分身 5 模式 | `lib/persona/skill-modes.ts` + `compose-prompt.ts` | 模块 3 |
| §四 主分身 maturity | `lib/persona/maturity.ts` | 模块 4 |
| §五 数据流 / 3+1 通用化 | `lib/decision-layer/` | 模块 1 |
| §五 数据流 / Skill Gateway | `lib/skill-gateway/runSkillGateway()` | 模块 2 |
| §七 学习中心闭环 (KR 推流 + Mode Proficiency 加分) | `lib/learning/closure.ts onLessonCompleted()` | 模块 5 |

详见 `docs/IMPL-NOTES-2026-05-29.md`. 实施状态见 `docs/EVOLUTION-STATUS-2026-05-28.md`.
