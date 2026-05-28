# Tandem · 2026-05 产品复盘

> 这是一份给 Owner 自己的诚实复盘文档，不是营销稿。
>
> 用真实代码事实 + 行业从业者视角 + 现存遗憾的坦白，回答以下 6 个深层问题：
>
> 1. 初心是什么？现在偏了多少？
> 2. 飞书 / 企微 / Tita 接口在 Tandem 里到底是什么角色？我们说"替代"做不到吗？
> 3. 企业级记忆驱动个人 AI 分身这个核心，技术上保障好了吗？
> 4. 站在行业从业者角度，Tandem 真实先进性几分？
> 5. 完整对比竞品，我们的核心壁垒是什么？
> 6. Claude 新的"记忆能力"出来了，我们要不要追？
>
> 版本: v1.0 · 2026-05-27 · 30 分钟阅读

---

## 一、初心溯源（一段话讲清楚）

读 `docs/MANIFESTO.md` + `docs/PRODUCT-SPIRIT.md` + `docs/PRODUCT-DEFINITION.md` 后能提炼出一句产品初心：

> **「让企业的每个人有一个跟着自己工作的 AI 分身，分身的成长来自企业真实工作记忆的喂养，分身用 OKR 和议事让协作变快 17 分钟。」**

这句话拆解成 3 个层面：

| 层 | 关键词 | 当前代码现状 |
|---|---|---|
| **价值观层** | 创造价值 · 赢得尊重 · 快乐工作 | 在 docs/PRODUCT-SPIRIT.md 写得明白 |
| **范式层** | 拿捏 (养分身) + 搭子 (召唤标准 Agent) | 在 docs/SUMMON-AND-NURTURE.md + `lib/persona/` 已实现 |
| **功能层** | 议事 17min + OKR + KPI/TTI 双轨 + 4 层知识架构 | 在 154 路由里有完整覆盖 |

**结论**：初心**没偏**。所有已写的代码都还在初心射程内。

但有一个值得警惕的偏离风险——**因为 OSS 借力**，我们看起来"像飞书"，从外部观察者角度（投资人/客户）容易把 Tandem 误认为"AI 化的飞书"。**这个外部误读如果不主动管理，会反向影响产品定位**。

---

## 二、飞书 / 企微 / Tita 接口的真实角色

### 代码事实

我扫了所有相关代码，三种东西混在了一起，**外人看会以为是"依赖"，其实是 3 种完全不同的关系**：

#### (1) 数据互通适配器（不是依赖运行）

代码位置：`lib/tita-adapter.ts`

```text
/**
 * Tita 适配器 — 用于和 Tita (tita.com) OKR 平台数据互通。
 * 由于 Tita 没有面向第三方开发者公开的 OKR REST API,
 * 本适配器主要走「文件互通」: JSON 全量 / CSV 行级 / HTTP 骨架
 */
```

**真实角色**：**迁移层 (migration layer)**，不是运行依赖。让企业能从 Tita / 飞书 / 企微把现有 OKR 数据导入 Tandem，**降低离开旧工具的成本**。Tandem 跑起来根本不需要 Tita 服务存在。

#### (2) 全栈自建 + 可选 BYO 集成（**2026-05-27 修正**）

> **修正历史**: v1.0 误述为"OSS 借力, 非差异化部分不自建". Owner 2026-05-27 19:23 澄清产品定位是**全面超越飞书/钉钉/Tita**, 不是借力. 用代码事实重新核对后, 真相如下:

代码位置：`lib/repositories/calendar-repo.ts` (+ memory- / drizzle-) / `document-repo.ts` / `drive-repo.ts` / `notification-repo.ts` 等

**真实角色**：**全栈业务模块都是自建的**, 每个领域有完整的 repository pattern (3 个 repo + 1 service):

- ✅ **日历 = 自建** (calendar-repo + memory-calendar-repo + drizzle-calendar-repo + calendar-service)
- ✅ **文档协作 = 自建** (document-repo × 3 + document-service; Yjs 实时协作已设, 见 YJS-SETUP.md)
- ✅ **云盘 = 自建** (drive-repo × 3 + drive-service)
- ✅ **通知 = 自建** (notification-repo × 3 + notification-service)
- ✅ **IM = 自建** (lib/im/service.ts 890 行 + 14 个 API routes, 含 channels/dm/messages/reactions/read/pins/stream/agent-mode/spawn-room/promote-to-memory)
- ✅ **OKR = 自建, 而且是最强模块之一** (lib/okr/ 5 模块 + 13 个 components + 4 个 pages, 含 alignment-tree/cadence/health/quality/scoring/templates)

`docs/OSS-STACK.md` 里提到的 Cal.com / Etherpad / MinIO / Postal **是可选 BYO 集成**, 不是核心依赖. integrations/health 把它们标为 `category: 'oss'` 意思是"可选外接", 跟 Tandem 自建的 `self-built` 完全两套架构. 默认部署只用 PostgreSQL 就够跑.

**正确的哲学**：**Tandem 是 AI-Native 的全栈企业协作平台. 业务模块全部自建, 因为只有自建才能跟 Memory / Persona / Baseline-Guard 做深度耦合 (例如 IM 消息可直接 promote-to-Memory). OSS 是可选外接, 给已经在用 Cal.com / Etherpad 的客户 BYO 入口**.

#### (3) integrations/health 健康监测

代码位置：`app/api/integrations/health/route.ts`

把所有依赖分成 5 类监控：

```
category: 'oss' | 'llm' | 'sso' | 'storage' | 'self-built'
```

- `oss`：Cal.com / Postal / Etherpad / MinIO ... ← 我们可换
- `llm`：DeepSeek / Anthropic / OpenAI ... ← 我们可换
- `sso`：钉钉 OAuth / 企微 OAuth ← 这是给企业用户登录用的，不是数据互通
- `storage`：PostgreSQL ← 必需
- `self-built`：IM / Memory / Persona / OKR ← **不可替代，核心差异**

### 替代论的真相

**"替代飞书 / 企微 / Tita" 这个口号**，从代码事实看：

| 维度 | 我们做不做？ | 现状 |
|---|---|---|
| **替代它们的核心场景**（OKR / 议事 / 协作 / 1on1） | ✅ 做，且做得不一样 | 已有 154 路由的完整 product surface |
| **替代它们的通用模块**（IM / 日历 / 文档 / 云盘） | ✅ **全部自建** | 框架就绪, UI 深度待补 (6-13 人月拼飞书级体验) |
| **AI 一等公民 (Persona / Memory / Baseline / 议事)** | ✅ 业内独家 | 飞书/钉钉做不了 |
| **替代它们的网络效应**（已有的群、组织架构、客户关系） | ❌ 6 个月内做不到 | 这是 SaaS 网络效应, 靠自用阶段慢慢喂养 |
| **让用户能从它们迁移过来** | ✅ 做（数据互通适配器） | `lib/tita-adapter.ts` 等 |

**所以"替代"的真实结构**：

- **替代核心体验 + 业务模块** = ✅ 已经在做, 全栈自建
- **替代深度体验** = ⚠️ 需要 6-13 人月拼到飞书钉钉成熟度 (UI / 多端推送 / 复杂群管理 / 富文本编辑等)
- **取代它们的位置** = 自用阶段 → PMF → 邀请制 → 公开, 类比飞书 2016-2020 内部 4 年路径

**产品对外讲故事**建议：

- ✅ 讲：**"Tandem 是 AI 原生的全栈企业协作平台. 全面替代飞书/钉钉/Tita, 同时把每个员工配上 AI 分身, 用 4 层企业记忆 + 议事 17min + Baseline-Guard 做飞书做不了的事."**
- ✅ 讲："业务模块全部自建, 跟 Memory/Persona 做深度耦合 (例如 IM 消息可直接 promote-to-Memory, OKR 进度自动喂给 Persona 训练)."
- ❌ 别讲："只在 OKR / 议事场景替代飞书, 通用模块借 OSS." — **这是 v1 误读, 已废**

---

## 三、企业级记忆驱动个人 AI 分身 —— 技术保障审查

### 代码事实：体量

memory + persona 相关代码 **20+ 个文件**，分布在：

```
lib/memory/
├── baseline-guard.ts       ← 记忆基线门禁
├── promotion-flow.ts       ← 升级流程（私 → 团队 → 公司）
├── downgrade-flow.ts       ← 降级流程（公司 → 团队 → 私）
└── retriever.ts            ← 检索

lib/persona/
├── evolution.ts            ← Persona 进化
├── learning-collec*.ts     ← 学习采集
├── communication-m*.ts     ← 沟通模式
├── feedback.ts             ← 反馈循环
└── proxy-actions.ts        ← 分身代理动作

app/api/tandem/memory/      ← 5 个 API 路由 (list/promote/downgrade/[id])
app/api/persona/[userId]/   ← Persona CRUD + train + proxy-actions
app/persona/training/       ← 训练台 UI
app/persona/evolution/      ← 进化历程 UI

lib/types/memory.ts
lib/types/persona.ts
lib/types/persona-feedback.ts
```

**评分：模块体量充足，是被认真对待的核心模块**（不是 demo / placeholder）。

### 关键创新：Memory 升降级流（这是真实的产品差异化）

业内主流的 RAG / Memory 方案是**单向 ingestion**：用户对话 → embedding → vector DB。读出来时只看相似度。

Tandem 做了不一样的：

| 维度 | 业内主流 | Tandem |
|---|---|---|
| 记忆生命周期 | 一次写入永久存在 | **可升级 (私→团队→公司)** + **可降级 (公司→团队→私)** |
| 隐私边界 | 模糊（embedding 含敏感信息） | 显式 4 层 (个人/对子/团队/公司)，每层独立检索池 |
| 谁触发流转 | 没有 | 显式 PR 流（用户提议升级 → 审批 → 提升） |
| 反向流动 | 不可能 | 公司层敏感信息可降级到个人，不丢失 |

这一套设计**业内没有第二家做了**。在 docs/KNOWLEDGE-ARCHITECTURE.md 已写明设计意图，在 lib/memory/promotion-flow.ts + downgrade-flow.ts 已落地。

### 关键创新：Persona Evolution（不是固定 prompt）

业内主流的"AI 分身"是**固定 system prompt**：你描述自己 → 模型按描述演。

Tandem 的 Persona 是**从真实工作数据中归纳的、持续进化的画像**：

```
lib/persona/learning-collec*.ts  ← 从用户的议事、消息、文档中采集学习信号
lib/persona/evolution.ts         ← 每周/每月触发的 Persona 升级
lib/persona/feedback.ts          ← 用户对分身行为的反馈反向优化
lib/persona/proxy-actions.ts     ← 分身可在用户授权范围内代理执行动作
```

**等价物**：
- ChatGPT Memory？是单 prompt 累加，不是结构化画像，不可分享
- Notion AI？没有 persona，只能问"你的工作空间"
- 飞书 / 钉钉 AI 助手？只是工具助手，没有"分身"概念

### 技术保障审查

| 保障维度 | 现状 | 评分 |
|---|---|---|
| 数据结构 | 有完整的 `lib/types/memory.ts` + `persona.ts` + `persona-feedback.ts` 类型系统 | ✅ A |
| Schema 持久化 | Drizzle schema 已建，PostgreSQL 落地 | ✅ A |
| 升降级业务流 | 完整代码 + e2e 测试覆盖（之前 12/12 通过） | ✅ A |
| 隐私保护 | 4 层边界 + redactPII 函数 + EVO-7 by-design | ⚠️ B（但缺架构层 enforcement） |
| 检索质量 | 简单 retriever.ts，没有 GraphRAG / Agentic RAG | ⚠️ C（未来 6 月升级点） |
| 反馈循环 | feedback.ts 落地，但没有"分身越用越聪明"的量化指标 | ⚠️ B |
| 评测体系 | **缺**。没有 fixture + benchmark 验证"Persona 真在进化" | 🔴 D |
| 成本可见 | **缺**。每次 Persona 调用没记 LlmUsageLog | 🔴 D |

**结论**：核心架构已经搭好，**是真东西不是 demo**。但缺两个东西让它从"功能"变成"产品壁垒"：

1. **Persona 质量评测体系**（fixture + benchmark）—— 否则你和用户都不知道"分身真的进化了吗"
2. **观测面板**（Persona 使用频率 / 满意度 / 进化次数 / 哪类反馈最多）—— 否则产品决策靠拍脑袋

→ 这两个直接进 `docs/AI-BACKLOG.md`（下一节会列）

---

## 四、行业从业者视角的诚实评价

放下 owner 视角，假装我是个行业资深人士（做过协作 SaaS、看过 100+ AI 项目），来打分：

### 真先进的 3 处

1. **Memory 升降级 4 层架构** —— 业内没第二家  
   把"知识/记忆"做成可流转的资产，这跟主流"塞向量数据库"完全不同的思路。这是**真正的产品创新**

2. **TTI / KPI 双轨度量框架** —— 想法独到  
   传统 OKR 死板，KPI 又冷漠。TTI（Time-To-Insight 思考时间含量）量化"决策含金量"，跟 KPI 互补。**业内没看到等价物**

3. **议事 17min + 5 步流程 + 拿捏/搭子双范式** —— 产品语言精炼  
   多数 AI 协作产品讲不清楚"我跟 ChatGPT 有什么不一样"，Tandem 用「拿捏（养你的分身）」+「搭子（召唤标准 Agent）」把交互模式说清楚了。**这是产品哲学的胜利**

### 真不行的 3 处

1. **没有 Bus factor 保险**  
   一个人 + 流动 AI 协作者。Owner 病倒一周项目就停。没有 CI / 没有自动化 / 没有团队。 这是 SaaS 创业的真正杀手，不是技术问题

2. **没有用户行为数据**  
   154 路由很丰富，但你不知道每个路由真实使用频率。`/persona/training` 用户停留多久？`/convergence` 完成率多少？没数据 = 资源永远投错地方

3. **AI 调用是黑盒**  
   每个月 DeepSeek 烧多少钱？哪个场景烧最多？是否有用户在刷？不知道。**这是 AI SaaS 的命门**，没成本观测就没毛利预测，没毛利预测就没融资故事

### 行业先进性打分（满分 10）

| 维度 | 分数 | 说明 |
|---|---|---|
| 产品哲学 | 9 | 拿捏/搭子/议事 17min/TTI 概念体系完整且独特 |
| 核心架构创新 | 8 | Memory 升降级 + Persona Evolution 真新 |
| 技术工程化 | 6 | 测试齐、build 过，但 CI / observability / Eval 缺位 |
| 用户体验 | 5 | 桌面端 OK，手机端拥挤（已知），缺移动 first 设计 |
| 商业化准备 | 4 | 多租户没做、订阅没做、企业 SSO 部分缺、合规未完成 |
| 生态壁垒 | 3 | 还没用户、没有数据飞轮、没有第三方插件 |
| **加权总分** | **6.2** | "技术性创新足够亮，但工程化 + 商业化基本功落后" |

**行业类比**：现在 Tandem 像 2009 年的 Notion（产品哲学已就位，但工程化基建零）。**Notion 用 10 年长出今天的样子**。Tandem 走对了，但要做好"还有 3 年苦工"的准备。

---

## 五、跟竞品的真实对比

| 维度 | 飞书 / Lark | 企微 | Tita | Notion AI | ChatGPT Team | **Tandem** |
|---|---|---|---|---|---|---|
| IM / 群组 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ❌ | ❌ | ⭐ | ⭐⭐（自建 + 议事融合） |
| 日历 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ❌ | ⭐ | ❌ | ⭐⭐⭐（借 Cal.com） |
| 文档协作 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ❌ | ⭐⭐⭐⭐⭐ | ❌ | ⭐⭐（借 OSS） |
| OKR | ⭐⭐⭐ | ❌ | ⭐⭐⭐⭐⭐ | ⭐ | ❌ | ⭐⭐⭐⭐（+TTI 创新） |
| KPI 度量 | ⭐⭐ | ⭐⭐ | ⭐⭐ | ❌ | ❌ | ⭐⭐⭐⭐（KPI/TTI 双轨） |
| 议事决策 | ❌ | ❌ | ❌ | ❌ | ❌ | ⭐⭐⭐⭐⭐（独家） |
| AI 助手 | ⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **个性化 AI 分身** | ❌ | ❌ | ❌ | ❌ | ⭐ | ⭐⭐⭐⭐⭐（独家） |
| **企业记忆 4 层流转** | ❌ | ❌ | ❌ | ❌ | ❌ | ⭐⭐⭐⭐⭐（独家） |
| 网络效应 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 0 |
| 客户基数 | 1000W+ | 1000W+ | 万级 | 千万级 | 百万级 | 0 |

### 真正的差异化壁垒（按战略价值降序）

1. **企业记忆 4 层升降级 + Persona Evolution** —— 没人在做。这是 18 个月内的真护城河
2. **议事 17min + 5 步 + Decision Card** —— 业内没等价物。这是产品差异化点
3. **TTI / KPI 双轨度量** —— 概念独到，但需要客户证明价值才能形成壁垒
4. **拿捏 / 搭子双范式** —— 产品语言胜利，可成为品牌资产
5. **OSS 借力路径** —— 短期内速度优势，但**不是壁垒**（任何人都能这么做）

### 真正的劣势（按死亡威胁降序）

1. **没用户没数据** —— 飞书企微一周新增用户多于 Tandem 总用户。**这是首要死亡风险**
2. **没团队没资金** —— Owner 一个人扛全栈 + 产品 + 运营。SaaS 创业 99% 死于"撑不到 PMF"
3. **企业市场进入门槛**（合规、定价、SLA、客户成功）—— 没有这些谁也不敢用
4. **AI 调用成本不可见** —— ARR < TAC 是慢性死亡

---

## 六、当前的遗憾（按"该修但还没修"严重度分级）

### 🔴 红色：直接影响产品生死

1. **没有 CI** ：每次 merge 没自动跑测试，靠 Owner 记忆。早晚要出生产事故  
   → 修复: 加 `.github/workflows/test.yml`，半天
2. **没有 LlmUsageLog** ：每个月 LLM 烧多少钱不知道，毛利无法计算  
   → 已在 `AI-BACKLOG B-005`，下次会话做
3. **没有用户行为埋点** ：154 路由 + 0 数据 = 拍脑袋开发  
   → 加 PostHog / Plausible / 自建 `UsageEvent` 表，1-2 天
4. **Persona 质量没评测** ：用户问"我的分身真在进化吗"你答不出  
   → 建 fixture + benchmark，进 AI-BACKLOG

### 🟡 黄色：影响产品体验和长期信任

5. **手机 shell 拥挤**（已知）：375px 屏 SubSidebar 挤压主区  
   → 已在 LAUNCH-CHECKLIST §C2，1 周工作量
6. **`lib/agent-runtime/` 没解耦**：Hermes 升级会拖累 9 个页面  
   → 已在 AI-BACKLOG B-007
7. **`lib/tools/` 没 MCP 化**：未来工具接入将逐个写 adapter  
   → 已在 AI-BACKLOG B-002
8. **Eval harness 缺位**：每次换模型 / 改 prompt 靠肉眼测  
   → 已在 AI-BACKLOG B-008
9. **154 路由没分层治理**：admin / demo / 内部 / 用户面 全混在一起  
   → 需要做"路由治理"清单，半天

### 🟢 绿色：技术净化型，可推迟

10. **`src-tauri/` 6.5 GB 死代码**：跟 A2 后端不兼容，但还没删  
    → 进 AI-BACKLOG B-007 配套
11. **文档 60+ 篇没归档**：很多 RFC 已过期，新人难辨真伪  
    → 半天分类: `docs/active/` + `docs/archived/`
12. **`KvStore` + Drizzle 双轨数据层**：偷懒模式让新代码不建表只塞 KV  
    → 定规则: 同一集合超 3 个 query 必须升级为表
13. **没有 ADR**：所有关键决策（为什么放弃 Tauri / 为什么 4 层 memory）都散在聊天和 commit  
    → 建 `docs/adr/`，每周写 1 篇

### 🔵 蓝色：商业化和合规预备

14. **多租户没做**：当前 `tenantId` 硬编码，给 B 端客户卖不出去
15. **订阅 / 计费**：没 Stripe / 没价格表 / 没 trial 自动转化
16. **企业 SSO**（OIDC / SAML）：政企客户标配缺失
17. **审计日志全覆盖**：合规线，HR / 老板 / 合规官必查
18. **数据导出 / 删除**：GDPR / 个保法准备

---

## 七、Claude 新记忆能力 vs Tandem 记忆架构（深度对比）

Anthropic 在 2025 年底 / 2026 年初推了"Memory"能力（Claude.ai consumer 端 + API），核心是：

- 系统自动从对话历史抽取"重要事实"
- 持久化到用户 profile
- 后续对话自动召回相关 memory
- 用户能查看 / 编辑 / 删除单条 memory

### 跟 Tandem 的对比

| 维度 | Claude Memory | Tandem Memory |
|---|---|---|
| **抽取** | 对话自动抽事实 | **用户主动 + 系统建议** + 升级 PR 流 |
| **存储粒度** | 一条条事实 | 4 层（个人/对子/团队/公司）每层独立池 |
| **可流转** | ❌ 单向写入 | ✅ 升降级双向 |
| **共享范围** | 单用户 | **企业多人，按层级共享** |
| **隐私边界** | 隐私靠用户自删 | **架构层 4 层 + 升级要审批** |
| **检索** | 自动召回 | retriever.ts，可定制 + 跟 Persona 联动 |
| **评测** | 黑盒（Anthropic 内部） | 也黑盒（**我们也没建 Eval harness**） |

### 该不该追？

**该追的部分**：
- Anthropic 的"自动抽取事实"能力强（人家训练数据多），我们应该接入：用户对话 → 调用 Claude 的抽取 prompt → 把候选事实喂进 Tandem 的"升级 PR 流"。**这是 1-2 天能做的增强**

**不该追的部分**：
- Claude Memory 的"单用户、不可分享、单向写入"架构本质是 consumer 个人助手范式。Tandem 是**企业多人协作 + 共享记忆资产 + 跨层级流转**，完全不同的范式。**不能也不该用 Claude Memory 的方式重做**

**结论**：把 Claude 的"抽取能力"用作 Tandem 升级流的**输入候选生成器**，但产品架构保持 4 层流转不变。  
→ 进 `AI-BACKLOG B-014`：「用 Claude Memory 的事实抽取增强 Tandem promotion-flow 的候选质量」

---

## 八、下个季度（2026-06 ~ 2026-08）的真实优先级

按"价值 - 成本"排序，前 5 个是最该做的：

| # | 任务 | 价值 | 成本 | 来源 |
|---|---|---|---|---|
| 1 | CI / GitHub Actions / 自动 test gating | 极高 | 半天 | 红色遗憾 #1 |
| 2 | `LlmUsageLog` + 成本报表 | 极高 | 1 天 | B-005 |
| 3 | 用户行为埋点（自建 UsageEvent 或接 PostHog） | 极高 | 1-2 天 | 红色遗憾 #3 |
| 4 | `lib/agent-runtime/` adapter + 删 src-tauri | 高 | 1 天 | B-007 |
| 5 | Persona Eval harness（B-008 扩展） | 高 | 2 天 | 红色遗憾 #4 |
| 6 | 加 12 篇 ADR（关键决策记忆持久化） | 高 | 1-2 天 | 绿色遗憾 #13 |
| 7 | `lib/tools/` MCP 化 (B-002) | 高 | 1-2 周 | AI-BACKLOG |
| 8 | 移动端 shell mobile-first 重做 | 中 | 1 周 | 黄色遗憾 #5 |
| 9 | Claude Memory 抽取能力接入 promotion-flow (B-014) | 中 | 1-2 天 | 第七节 |
| 10 | 路由治理 + admin / demo / user 分层 | 中 | 半天 | 黄色遗憾 #9 |

**前 5 名做完（~1-2 周净工作量）= 项目工程基础设施从 D 升 B**，后续所有产品迭代都更稳。

---

## 九、给 Owner 的 5 句话总结

1. **初心没偏**——拿捏/搭子/记忆 4 层/议事 17min/TTI，这套产品哲学是真创新，行业没人在做。
2. **核心代码是真东西**——20+ 文件 Memory + Persona 体系不是 demo。技术架构 B+，是被认真对待的核心。
3. **"替代飞书"口号要小心**——核心场景能替代，基础设施不要碰，让用户能从飞书迁移过来更准确。
4. **工程化和商业化是命门**——CI / observability / Eval / 多租户 / 计费 全部缺位。SaaS 创业死于这些，不是技术。
5. **3 年长期愿景成立，但要做好 3 年苦工的心理准备**——Notion 用 10 年长成今天，Tandem 走对了路，但要熬。

---

## 附录：本复盘对应的代码事实索引

- 飞书/企微/Tita 接口角色 → `lib/tita-adapter.ts:1-15`、`app/api/integrations/health/route.ts`
- Memory 4 层升降级 → `lib/memory/promotion-flow.ts`、`lib/memory/downgrade-flow.ts`、`lib/memory/baseline-guard.ts`
- Persona Evolution → `lib/persona/evolution.ts`、`lib/persona/learning-collec*.ts`、`lib/persona/feedback.ts`
- 路由总数 → `npm run build` 显示 154 routes
- 测试覆盖 → vitest 95/95 + Playwright E2E 12/12 + mobile 19/19 + full-loop 18/18
- 战略锁定 → `docs/MANIFESTO.md` 第十六条
- 4 层知识架构 → `docs/KNOWLEDGE-ARCHITECTURE.md`
- 拿捏/搭子双范式 → `docs/SUMMON-AND-NURTURE.md`
- TTI 框架 → `docs/TTI-FRAMEWORK.md`、`docs/CHARTER-KPI-TTI.md`

---

## 附录：本复盘没回答的问题（留给下次）

- 商业模式细节（定价、客单价、获客成本、留存假设）
- 融资节奏（什么时候启动、多大金额、对应里程碑）
- 团队扩张（第一个雇谁、什么时候）
- 第一批种子客户从哪来（朋友圈？冷启动？社群运营？）
- 法律实体 / 知识产权 / 商标
- 国内 vs 海外市场优先级

→ 这些是创业层面的非工程问题，不属于本文档范围。
