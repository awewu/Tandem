# 个人 AI × 搭子手抄 · 协同产品 Spec

> 状态: 研讨定稿 (2026-07-13) · 拥有者: Cascade
> 定位: 说清"员工的个人 AI 分身"与"搭子手抄(个人第二大脑)"如何互为飞轮,
> 冻结两形态设计 + 四座桥 + 里程碑, 作为后续 sprint 与 B-021 复活的 SSOT。

---

## 一、现状 (2026-07-13 已落地)

手抄与个人分身各自成熟, 且已有三座桥打通, 但仍是**单向喂养**。

### 1.1 搭子手抄 (`lib/shouchao/service.ts`) — 已是完整"个人第二大脑"

- **CRUD + 多设备同步**: `createNote/updateNote/deleteNote(软删)` + `pushChanges/pullChanges` (LWW + 时钟钳制)。
- **语义检索**: `rankNotesByRelevance` — embedding cosine 优先, 无损回退 Jaccard (解决"年假/休假"同义词漏召回)。
- **跨笔记 Ask** (对标 NotebookLM): `searchNotesForAsk` → 带引用问答, 纯 `ownerId` 隔离。
- **双向链接** (对标 Notion/Obsidian): `extractWikiLinks/getOutgoingLinks/getBacklinks` — `[[标题]]` 语法, 读时解析不改数据模型, 笔记成网。
- **opt-in 喂给分身**: `setSharedToPersona` (默认关, 可撤回, 公司无入口, 全程 audit) + `retrieveSharedNotesForPersona` (语义召回本人已授权笔记)。

### 1.2 个人分身 (`/api/persona/stream`) — 已与中央 AI 双线并存

- `/tandem` 主舞台双召唤: 「我的分身」通道 (`/api/persona/stream`) 与「中央 AI」(`/api/boss-ai/stream`) 并列, 独立会话线程 (`usePersonaChat` / `useBossAi`)。
- 分身产出必过 `governPersonaOutput` §19.5 四闸: L0 企业红线 HARD_BLOCK → L1 组织记忆基线 → L2 OKR 锚 → L4 价值观锚 → **L4.5 手抄语料** 强制注入。
- 感知前置 (`personaPerceptionPass` 只读工具查本人 OKR/决议真值) + 联网 pre-search + B-024 self-hint 召回 + output-guard 出口镜片。

### 1.3 决策防火墙 (已落, 不可动摇)

个人手抄语料仅作**个人上下文**, 优先级低于 L0/L1; 与企业基线冲突一律以企业为准。个人非审批记忆**绝不入组织决策**。

---

## 二、问题 (为什么还不够)

| # | 问题 | 影响 |
|---|---|---|
| P1 | **反向桥缺失** | 分身/中央 AI 对话里产生的洞见、草稿、结论**无法一键回流手抄**。协同是单向的 (手抄→分身), 对话价值随会话蒸发, 第二大脑长不大。 |
| P2 | **B-021 与手抄重复造轮子** | B-021 Persona Builder 的 "Knowledge" 支柱原计划"上传 md/pdf → 切片入 Memory"。但手抄已是成熟的个人知识库 + opt-in 授权闸。再造一套上传 = 两个割裂的个人知识源。 |
| P3 | **外部用户落地缺口** | 手抄是外部用户 (经销商/客户) 的核心品牌入口, 但登录后仍落内部工作台 (`app/page.tsx`), 无专属 hub。 |
| P4 | **手抄语料未汇入中央 AI 组织语料** | 当前 opt-in 只喂"个人工作分身"。员工愿意贡献给组织的沉淀 (需第二道 opt-in + 治理) 无通道, 中央 AI 组织语料飞轮少一个源。 |

---

## 三、两形态设计

手抄一份数据, 承担两个正交形态。**同一 `ShouchaoNote`, 两条消费链, 靠 `sharedToPersona` 授权位 + 决策防火墙隔离。**

### 形态 A · 个人第二大脑 (Personal Knowledge)

- **谁用**: 内部员工 (碎片沉淀) + 外部用户 (品牌粘性主入口)。
- **能力**: CRUD / 同步 / 语义检索 / 跨笔记 Ask / 双向链接。
- **边界**: 纯 `ownerId` 隔离, 公司无入口, 不喂任何 AI 除非本人授权。
- **状态**: ✅ 已完整落地。

### 形态 B · 分身/组织的语料飞轮源 (Corpus Feeder)

- **谁用**: 本人的工作分身 (个人范围) → (未来 opt-in²) 中央 AI 组织语料。
- **能力**: opt-in 授权后, 授权笔记按语义召回注入分身 system prompt (L4.5)。
- **边界**: 双闸授权 (喂分身 / 喂组织独立开关) + 决策防火墙 + 全程 audit + 随时撤回。
- **状态**: 🟡 喂个人分身已落; 喂组织语料 (P4) 待建。

---

## 四、四座桥

| 桥 | 方向 | 机制 | 状态 |
|---|---|---|---|
| **桥① 授权喂养** | 手抄 → 分身 | `setSharedToPersona` opt-in → `retrieveSharedNotesForPersona` 语义召回 → `govern-persona` L4.5 注入 → `/api/persona/stream` | ✅ LIVE (`shouchao-persona-feed.test.ts`) |
| **桥② 第二大脑问答** | 手抄 ↔ 手抄 | `searchNotesForAsk` 带引用召回 → Ask 问答 (NotebookLM 式) | ✅ LIVE |
| **桥③ 笔记成网** | 手抄 ↔ 手抄 | `[[标题]]` 双向链接 + 反向链接 (Notion/Obsidian 式) | ✅ LIVE |
| **桥④ 对话沉淀** | 分身/中央 AI → 手抄 | 会话中"存为手抄" + AI 主动建议"要不要把这条记进手抄" → 落 `ShouchaoNote` (source 标 `persona_chat`/`boss_ai`) | ❌ **待建 (本 spec 核心增量)** |

### 桥④ 设计要点 (待建)

- **入口**: 分身/中央 AI 会话气泡上一个「存为手抄」按钮 (逐条 opt-in, 本人操作)。
- **落库**: 复用 `createNote`, `title` 取 AI 建议摘要, `content` = 选中片段 + 原始 query, `tags` 自动加 `来自:分身`/`来自:中央AI`, `sourceUrl` 空。
- **AI 主动建议**: 分身回答含明显"结论/决策/偏好"信号时, 尾部追加轻量提示"要不要记进手抄?" (启发式触发, 不强推)。
- **防环**: 由桥④ 落库的笔记默认 `sharedToPersona=false` — 分身产出不自动回喂分身, 避免自我强化回声。
- **治理**: 落库是纯个人动作 (`ownerId` 隔离), 不写 ProxyAction, 不入 CompanyBrain 飞轮; 全程 audit (`shouchao.saved_from_chat`)。

---

### 已否决方案 · 手抄物化落 Memory 表 (2026-07-13 砍)

曾评估"授权手抄切片写入 Memory 表 (`type='persona_knowledge'`) 成一等记忆"路径, **正式否决**:

- 与已 LIVE 的桥① (运行时 L4.5 注入) **功能重复** — 桥① 已能召回并注入授权笔记。
- 物化引入**撤回同步风险**: opt-in 撤回后需级联删表, 否则违反"可随时撤回"承诺。
- 数据双写 + 去重成本, 收益仅"进 reranker/图谱", 投入产出比最差。
- 结论: 保持桥① 运行时注入为唯一实现; 若未来确需图谱参与, 走轻量适配而非物化双写。

## 五、里程碑

| 里程碑 | 内容 | 依赖 | 状态 |
|---|---|---|---|
| **M0** | 三座桥 (①②③) + 分身双线 | — | ✅ 已落 |
| **M1** | **桥④ 对话沉淀回手抄** (存为手抄 + AI 主动建议 +防环) | 无 (复用 `createNote`) | 待 sprint |
| **M2** | **B-021 复活 · 用手抄做 Knowledge 支柱** (Persona Builder 的知识源 = 手抄授权笔记, 不再另造上传) | 桥① (已落) | 待 sprint |
| **M3** | 外部用户手抄专属落地 hub (登录只显授权模块, 手抄为主入口) | 无 | 待 sprint (见 COMMERCIAL-READINESS-GAP) |
| **M4** | 形态 B 扩到中央 AI · 手抄 → 组织语料 (第二道 opt-in² + 治理 + 决策防火墙) | 桥① + 组织语料签批门 | 远期 |

---

## 六、与 backlog 的关系

- **B-021** (Persona Skill Builder) 由本 spec **复活并改造**: 原 "Knowledge = 上传 md/pdf" 支柱废弃, 改为 **"Knowledge = 手抄授权笔记"** — 手抄成为分身知识库的唯一入口, 消除重复造轮子 (见 P2)。
- **B-024** (反思引擎) 与桥④ 协同: 桥④ 落库的对话洞见可被 `injectSelfHints` 召回, 但走独立个人记忆通道, 不混淆。
- **决策防火墙** 是所有桥的不变约束, 任何桥不得让个人非审批语料越权进组织决策。

---

## 修订记录

- 2026-07-13 · 研讨定稿 · Cascade — 冻结两形态 + 四座桥 + 里程碑; 复活 B-021 接手抄。
