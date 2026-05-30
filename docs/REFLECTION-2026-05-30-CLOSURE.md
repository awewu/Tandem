# 复盘 · 闭环 / 文档冲突 / 产品自信 (2026-05-30 PT)

> **缘起**: Owner 要求 "复盘闭环 / 检查 docs 矛盾冲突 / 跟其他企业级 AI 差异和借鉴 / 产品自信".
> **风格**: 实证驱动, 不 sycophancy, 不模糊带过.

---

## 一、闭环状态总览 (基于 7 轮 commit + 实际代码)

### 1.1 ✅ 完整闭环 (服务 + API + UI + 测试全有)

| 功能 | 实证 | 状态 |
|---|---|---|
| **决议必锚 OKR** | `lib/types/decision-card.ts:148` `validateOkrAnchor` XOR + audit | ✅ 完整 |
| **议事 17 分钟硬上限** | `HARD_TIME_LIMIT_SECONDS = 17 * 60` + ConvergenceState 'ESCALATED' + `/convergence/[id]` UI | ✅ 完整 |
| **3+1 决策 D 选项 humanOnly** | `lib/decision-layer/three-plus-one-engine.ts` D=ORIGINAL+humanOnly | ✅ 完整 |
| **Memory 4 层 + 三级签批** | `lib/memory/promotion-flow.ts` + `app/memories` UI + audit | ✅ 完整 |
| **TTI 双轨永不挂奖金** | `lib/charter/kpi-tti.ts` + DB readonly false | ✅ 完整 |
| **DOC-2 文档→Memory 升级** | service + API + UI 按钮 + 反链 chip + 8 单测 | ✅ 完整 |
| **DOC-4 文档→议事 (URL 闭环)** | UI 按钮 + URL 信号 + `/convergence` 消费 + 反链 PATCH + 6 单测 | ✅ 完整 (本轮闭) |
| **/tandem deliver handoff** | hook + 3 消费者 (im/mail/memories) + 9 单测 | ✅ 完整 |
| **AI 批量创建 OKR** | service + API + UI dialog + 21 单测 | ✅ 完整 (本轮闭) |
| **OKR Calibration** | service + UI grid + 18 单测 | ✅ 完整 (本轮闭) |
| **5min 日报 → KR 推流** | SSE + LLM + clamp 不倒退 | ✅ 完整 |
| **CompanyBrain OKR 注入** | `buildOkrAnchorContext` 注入 system prompt | ✅ 完整 |
| **OKR Drift 检测** | `lib/governance/okr-drift.ts` embedding + audit 月审 | ✅ 完整 |

### 1.2 🟡 服务/API 在, **UI 缺**

| 功能 | 已有 | UI 缺 |
|---|---|---|
| **KR forecast (季末预测)** | `lib/okr/trend.ts:forecastKr` + `forecastObjective` + 13 单测 | ❌ 没在 `/okr/dashboard` 显示 forecast 列表 |
| **Stat 组件** | `lib/format/stat.ts` + 17 单测 + 5 页铺设 | ⚠️ 还有 5 页数字密集页未铺 (按热度: tti / kpi user / okr-drift / settings 等) |

### 1.3 🟠 服务在, **API + UI 都缺**

| 功能 | 服务 | API | UI |
|---|---|---|---|
| **Recognition Wall** (CFR 中的 R) | ❌ | ❌ | ❌ |
| **OKR Drift 看板月度趋势** | governance 在 | ✅ 数据可拉 | ❌ 月度趋势图未做 |
| **OKR API webhook (B2B)** | ❌ | ❌ | ❌ |

### 1.4 🔴 整块缺 (路线图但未启动)

| 模块 | 现状 | 评级 | 90 天计划 |
|---|---|---|---|
| **MAIL-1 v0 统一收件箱** | 仅 SMTP 出站 | D- | 1 周 |
| **MAIL-3 Persona 草稿** | 0 代码 | D- | 2-3 天 |
| **MAIL-4 邮件→议事** | 0 代码 | D- | 3-5 天 |
| **MAIL-6 IMAP 收件互通** | 0 代码 | D- | 2-3 周 |
| **DOC-1 Persona 共编** | 0 代码 | C+ | 1 周 |
| **DOC-3 重大修改→Decision Card** | 0 代码 | C+ | 3-5 天 |
| **DOC-5/6/7** (多 Persona 评审/Memory 反链/知识图谱) | 0 代码 | C+ | 各 1-2 周 |
| **CAL-2~CAL-8** (AI 议事时间/Persona 代约/会议自动准备/复盘/空闲保护/KR 偏差自动插) | 0 代码 | C+ | 各 3-5 天 |
| **IM-1 Persona-aware 频道** (自动调和/缺席代答) | 0 代码 | B+ | 2 周 |
| **IM-5 多 Persona 协作** | 0 代码 | B+ | 2-3 周 |
| **IM-6 跨频道 digest** | 0 代码 | B+ | 3-5 天 |
| **IM-8 敏感性自动判定** | baseline-guard 在 IM 未接 | B+ | 2-3 天 |
| **51 页响应断点清零** | ratchet 已锁 + 2 页修 | — | 5-7 天 |
| **lib/store.ts 拆 slice** (87KB) | 单文件 | — | 1.5-2 天 |
| **lib/im/service.ts 拆** (39KB) | 单文件 | — | 1-1.5 天 |
| **原生移动 App** | Tauri 桌面已搭 | — | 6-8 周 (V2) |

### 1.5 闭环计分

| 维度 | 数 | 占比 |
|---|---|---|
| **完整闭环** (服务+API+UI+测试) | 13 | 33% |
| **服务/API 在但 UI 缺** | 2 | 5% |
| **服务在但 API/UI 缺** | 3 | 8% |
| **整块缺** | 22 | 54% |
| **合计已规划** | 40 | 100% |

**核心 4 件不变量 + OKR 引擎** 100% 闭环。**4 大支柱辅助能力** 大量缺。

---

## 二、文档冲突 / 矛盾 (本轮修正)

### 2.1 ✅ 本轮修复的 4 处战略冲突

| # | 文档 | 冲突 | 修复 |
|---|---|---|---|
| 1 | `OKR-VS-TITA.md` | "完整度 95%" vs Tita 2025 H2 实证 75% | v2.1 修正 + §11 战略红线 |
| 2 | `OKR-FEATURE-MATRIX.md` 11.1 | "钉钉/企微/飞书集成 ✅ V1" | 改成 "❌ 永不接 (战略红线)" |
| 3 | `EVOLUTION-ROADMAP-2026-05-V2.md` EVO-19 | "企业 IM Gateway (企业微信/钉钉/飞书)" | 改成 "中性 IM Gateway (Slack/Teams/Email)" |
| 4 | `EVOLUTION-2026-05-APPENDIX-SKILLS-AND-HERMES.md` | Gateway 适配层 + EVO-19 含飞书/钉钉/企微 | 改成中性渠道, 排除飞书/钉钉/企微 |
| 5 | `TANDEM-vs-FEISHU-GAP-ANALYSIS.md` | "EVO-19 IM Gateway 规划中" | 标 "中性 IM Gateway · 不接钉钉/企微/飞书" |

### 2.2 ✅ 不算冲突 (反例语境)

以下提及"飞书/钉钉/企微"的位置, 都在反例 / 对比 / 不能讲清单, 不冲突:

- `MANIFESTO.md` 序言 (第 14 行) — 列在 "三巨头" 对比表
- `CENTRAL-AI-ARCHITECTURE.md` (33 行) — 列在 "③ 协作平台" 反面例
- `CENTRAL-AI-ENTERPRISE-EDGE.md` 路径 8 (326-330 行) — 说 "飞书做不到 = 我们机会"
- `ARCHITECTURE-AND-CHARTER.md` 32 行 — vs 三巨头对比表
- `AI-RADAR.md` 116 行 — 飞书 AI 助手影响监控 (中性)

### 2.3 ⚠️ 本轮发现但**保留**的小冲突

- `MANIFESTO.md` §17 第 5 段 (民企 sweet spot) 说 "客户继续用飞书/钉钉/企微做 HR 全栈, 加买 Tandem" — 这是商业现实表述, 与"不集成"不矛盾 (客户用飞书 HR ≠ Tandem 集成飞书). **保留**.

### 2.4 ⚠️ 仍残留的 2 个旧档案

| 文档 | 性质 | 处理 |
|---|---|---|
| `AUDIT-2026-05-13-FULL.md:353` 提及 EVO-19 IM Gateway | 历史审计快照, 反映当时状态 | **不修** (审计文档应保持当时真相) |
| `EVOLUTION-2026-05.md` 375 行 (EVOLUTION 老路线) | "客户继续用飞书... 加买 Tandem" | **保留** (跟 MANIFESTO §17 一致) |

### 2.5 ✅ 没有冲突的关键真相

| 关键定义 | 哪些文档说 | 是否一致 |
|---|---|---|
| OKR 完整度 75% (vs Tita) | OKR-VS-TITA.md / PITCH-LAUNCH / PITCH-SPEAKER-SCRIPT / COMPETITIVE-ANALYSIS | ✅ 全一致 |
| 4 件独家护城河 (锚点/TTI/议事/Memory) | MANIFESTO + 12 份相关文档 | ✅ 全一致 |
| 战略红线: 不集成飞书/钉钉/企微 | OKR-VS-TITA §11 + PITCH-LAUNCH §13 + OKR-FEATURE-MATRIX 11.1 + COMPETITIVE-ANALYSIS | ✅ 全一致 |
| 17 分钟议事室硬上限 | MANIFESTO §3 + CHARTER-FOUR-PILLARS + decision-card type | ✅ 全一致 |
| TTI 永不挂奖金 | MANIFESTO §4 + CHARTER-KPI-TTI + 代码 readonly | ✅ 全一致 |

**docs 总数 86 份**, 战略层无矛盾。

---

## 三、跟其他企业级 AI 的真差异 + 真借鉴 (产品自信版)

### 3.1 真差异 — 我们独有, 大厂 18-24 月做不出

实证已在 `COMPETITIVE-ANALYSIS-2026-05-30.md` 章 §3 锁定. 简版回顾:

| 独家能力 | 大厂为什么做不出 |
|---|---|
| 决议必锚 OKR (代码不变量) | Coze 是 Agent 平台不关心 OKR · Claude 是 LLM 终端 · Copilot 是 M365 集成 · 都不是产品哲学 |
| 议事 17 分钟硬上限 + 自动升级 | 这是反人性产品决策 (反 "聊到天荒地老" 的会议文化), 大厂不会做 |
| D 选项 humanOnly (反 AI 欺诈) | 跟 ChatGPT/Claude/Coze 的 "AI 给最佳建议" 哲学相反, 它们做了等于自我否定 |
| Memory 4 层 + 三级签批 SLA | 这是组织治理设计, 不是 RAG 算法. 大厂全是 "知识库 + RAG", 没有 "升级签批" |

### 3.2 真借鉴 — 大厂做得好, 我们应该学 (产品自信不等于闭门造车)

#### 借鉴 1 · **Coze 的 Agent 编排可视化** (字节)
- **它做对了什么**: 节点编排 / RAG Pipeline / Skill 标准化 — 让"搭 Agent"门槛降到运营级
- **我们该借鉴**: `§19 Skill Gateway` 应走 Coze 的可视化路线 (拖拽节点, 不是写 TS)
- **不该照搬**: Coze 是 Agent 工具, 我们是协作产品 — 我们的可视化只服务于 **Skill 接入治理**, 不是 "搭 Agent"

#### 借鉴 2 · **Anthropic Claude 的 connector permissions** (custom roles)
- **它做对了什么**: admin 可控制每个 connector / 每个工具是否对每个角色可用 (2026 加的)
- **我们该借鉴**: Skill Gateway 4 道闸的 **Action Scope** 闸应直接复用这种 fine-grained role-based permission 模型
- **不该照搬**: Claude 是 LLM 终端, 我们是协作 OS — 权限模型借, **数据归属不能借** (Claude SaaS 多租户; 我们要私有化)

#### 借鉴 3 · **Microsoft Copilot Cowork** (2025-11 Ignite)
- **它做对了什么**: 多人 + 多 Agent 在同一 canvas 上协作的 UI 模型 (类似 Figma 多人模式)
- **我们该借鉴**: `IM-5 多 Persona 在场协作` 应学 Cowork 的 cursor + 多 Agent UI 范式
- **不该照搬**: Cowork 全靠 M365 套件粘合, 我们要做独立的协作产品

#### 借鉴 4 · **Glean 的 Personalization + Federated Search**
- **它做对了什么**: 企业搜索按个人角色 / 历史检索习惯个性化 + 联邦索引 (跨工具 SaaS 索引)
- **我们该借鉴**: Memory 4 层检索可借鉴 Glean 的 personalization (按 Persona stage / role / 历史)
- **不该照搬**: Glean 索引飞书云文档 / Slack / Confluence 是它的杀手锏, 我们**不索引飞书** (战略红线)

#### 借鉴 5 · **OpenAI Custom GPTs** (2024)
- **它做对了什么**: 让员工自己用自然语言 + 知识库 + Action 自定义 GPT
- **我们该借鉴**: Persona 进化 5 阶段是不是该开放 "员工自定义 Persona Skills" (限制在 §19 Skill Gateway)
- **不该照搬**: Custom GPTs 是个人玩具, 我们的 Persona 是组织资产 — 自定义必走签批闸门

#### 借鉴 6 · **Linear / Raycast 的 keyboard-first**
- **它做对了什么**: 全键盘操作, ⌘K 是入口, j/k 导航全局可用
- **我们该借鉴**: ⌘K 命令面板 + `?` 速查表已落, 缺 j/k 全局列表导航 + g+letter 跳页 sequence
- **不该照搬**: Linear 是项目管理, 客户面是开发者. 我们的客户是业务员工, **不能强制全键盘** — 选择性

#### 借鉴 7 · **Notion AI 的内联 Q&A**
- **它做对了什么**: 选段 → AI Q&A → 答案直接插入文档. UI 流畅.
- **我们该借鉴**: DOC-1 Persona 共编 应学 Notion 的内联触发模式
- **不该照搬**: Notion AI 是个人工具 (问 = 我自己的 workspace). Tandem 必须经 §19 Skill Gateway 4 道闸

#### 借鉴 8 · **Stripe Dashboard 数据精确**
- **它做对了什么**: 数字 + 单位 + 趋势 + delta 同框, tabular-nums 精准对齐
- **我们已借**: Stat 组件 + 5 页铺设. **持续铺**.

### 3.3 总结 · 借鉴的边界

> **产品自信 ≠ 闭门造车. 但借鉴有红线**:
>
> 1. **借交互设计, 不借商业模型** (Custom GPTs 借 UI, 不借 SaaS 多租户)
> 2. **借工具能力, 不借战略路径** (Coze 借 Agent 编排, 不借飞书集成)
> 3. **借治理思路, 不借文化哲学** (Claude 借 admin controls, 不借 "AI 给最佳建议")

---

## 四、为什么不怕大厂 (AI 时代的产品自信)

### 4.1 大厂的 5 个结构性短板

| 短板 | 谁中招 | 我们为什么没这问题 |
|---|---|---|
| **AGI 焦虑驱动** | OpenAI / Anthropic / Google | 它们要做 "通用智能", 我们做 "OKR 决议链" — 不卷模型 |
| **生态绑架** | Microsoft / Google | 必须服务现有套件客户, 不能反 DAU. 我们没历史包袱 |
| **不能反人性** | Coze / Slack / 飞书 | 商业模式靠"用户多用", 不能做 17min 硬上限 |
| **不能反 AI 欺诈** | ChatGPT / Coze | 商业靠"AI 替员工写", 不能做 D 选项 humanOnly |
| **不能护员工尊严** | 飞书 / 钉钉 / 企微 | KPI = MAU, 必然 DAU 焦虑. 我们 KPI = 决议命中率 |

### 4.2 AI 时代的 3 个新产品自信

#### 自信 1 · **架构哲学 ≥ 模型能力**

DeepSeek / GPT-4 / Claude / Gemini 之间的差距越来越小 (FollowingMM 测评显示前 5 名差 < 5%). 这意味着:
- **靠模型领先做 SaaS 是死路** (12 个月一波模型迭代, 你的优势归零)
- **靠产品哲学 + 治理架构做 SaaS 是活路** (这些不是技术问题, 是组织问题, 大厂不愿做)

Tandem 的 4 件不变量是**产品哲学**, 不是**模型能力**. 哪怕 GPT-6 / Claude 5 来了, 这 4 件事的价值不衰减.

#### 自信 2 · **中国民企不会被大厂吞**

- **微软**: 进不来 (合规)
- **Anthropic**: 进不来 (合规 + 模型出口管制)
- **Google**: 进不来 (合规)
- **OpenAI**: 进不来 (合规 + 数据本地化)
- **字节 Coze**: 不是直接竞品 (Agent 平台), 而且我们是产品

中国民企的 OKR 协作市场, **国际大厂全部缺席**. 国内只有 Tita / 飞书 People / 北森 — 它们用了 8 年的销售下沉模式, 但从架构上做不出 4 件独家事.

#### 自信 3 · **AI 时代的客户决策权重换位**

| 维度 | AI 之前 | AI 之后 |
|---|---|---|
| **客户买什么** | 功能多寡 | **AI 透明度 + 治理** |
| **谁决定采购** | IT 部门 | **法务/合规/CEO** |
| **核心担忧** | 集成兼容 | **AI 替员工劳动 + 数据漂移** |
| **价值标准** | 效率 ↑ | **决议命中率 ↑ + 员工尊严 ↑** |

Tandem 的产品设计 100% 命中 AI 之后的客户决策维度:
- AI 透明度: `LlmUsageLog` (每条 AI 回复点开看 model + cost + tokens)
- 治理: Memory 三级签批 + 议事 audit + 24h 否决
- 反 AI 替员工劳动: D 选项 humanOnly
- 数据漂移防御: OKR Drift 检测 + Memory 升级签批

**飞书/钉钉/企微的产品设计还在 AI 之前**, 它们要花 18-24 月才能改架构 — **我们正好用这个窗口期做种子客户铺开**.

### 4.3 自信的边界 (不假大空)

**不能讲**:
- ❌ "我们一定能赢飞书" (飞书有 8 年沉淀 + 全家桶 + 现金流, 我们尚未盈利)
- ❌ "AI 时代大厂都要死" (微软靠 M365 一定会撑 10 年+)
- ❌ "客户全都需要 OKR 决议链" (中小微企业不需要, 政企不能要)

**能讲**:
- ✅ "**中国民企 200-2000 人, 已经在用 Tita / 飞书 People 但用得别扭, 这一群体我们能赢**"
- ✅ "**AI 时代客户决策权重换到了治理 + 透明度, 我们 100% 命中, 飞书要 18-24 月才能改架构 — 这是窗口**"
- ✅ "**4 件独家不变量 是产品哲学, 不是模型能力 — 模型迭代不会让我们的优势消失**"

---

## 五、下一阶段的纪律

### 5.1 不再做的事 (永久红线)

- ❌ 接入飞书 / 钉钉 / 企微 (战略红线)
- ❌ 做 OA / 审批 / 考勤 / 印章 / 招聘 / CRM (MANIFESTO §18)
- ❌ 服务政企 / 国企 (MANIFESTO §17)
- ❌ AI 替员工劳动 (D 选项 humanOnly 是不变量)
- ❌ KPI = DAU/MAU (反 DAU 是序言)
- ❌ "业内首个企业级智能体" 营销话术 (落后大厂 1-3 年, 改 "首个 OKR 决议链 OS")

### 5.2 必须做的事 (90 天补丁路线图)

按 ROI 优先级:

| # | 项 | 工期 | ROI | 兑现什么 |
|---|---|---|---|---|
| 1 | **MAIL-1 v0 统一收件箱** | 1 周 | ★★★★ | 邮箱 D- → C+ |
| 2 | **KR Forecast UI** (`/okr/dashboard`) | 2-3 天 | ★★★ | forecast 服务可见 |
| 3 | **Recognition Wall** | 5 天 | ★★★ | CFR 中的 R |
| 4 | **51 页响应断点清零** | 5-7 天 | ★★★★ | 移动端破碎 → 80%+ 覆盖 |
| 5 | **store.ts / im service.ts 拆 slice** | 3 天 | ★★★ | 工程债 |
| 6 | **DOC-3 重大修改→Decision Card** | 3-5 天 | ★★★ | 文档板块 B → B+ |
| 7 | **MAIL-3/4** (Persona 草稿/转议事) | 1 周 | ★★★ | 邮箱 C+ → B |
| 8 | **OKR Bulk Create v1** (SSE 流式 + Memory 接 C 选项) | 3-4 天 | ★★ | UX 升级 |
| 9 | **CAL-4/7** (会议自动准备/KR 偏差插议事) | 各 5 天 | ★★★ | 日历 C+ → B |
| 10 | **IM-6 跨频道 digest** + **IM-8 敏感性自动判定** | 1 周 | ★★★ | IM B+ → A- |

### 5.3 战略级 (3-6 月)

| 项 | 工期 | 兑现什么 |
|---|---|---|
| **原生移动 App** (Tauri Mobile / Capacitor) | 6-8 周 | 中国市场必备 |
| **Tauri 桌面正式打包 (跨平台签名证书)** | 1-2 月 (官僚) | macOS DMG / Linux AppImage 落地 |
| **MCP 协议接 Skill Gateway** | 1-2 月 | §19 兑现, Claude Code/Cursor 反哺企业 |
| **Skill Marketplace** | 2-3 月 | 第三方 Skill 走 MCP + Steward 签批 |

---

## 六、修订历史

| 日期 | 修订 |
|---|---|
| 2026-05-30 PT | v1 创建. 闭环 / 文档冲突 / 借鉴 / 自信 一站式复盘. 修 4 处战略冲突 (EVO-19 IM Gateway 改中性). |
