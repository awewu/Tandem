# 增长中枢 / Nexus Growth — 品牌推广数智化平台蓝图

> 板块三定位：**Rhautt Nexus 底座的对内能力域**（非第三对外板块、不进 brand-registry）。
> 一句话：用 AI「魔法」打败算法与内容的「魔法」，把舆情、文案、投放、GEO 全部装上引擎，让集团/总部市场部一个人干一个团队的活。
> 事实源：本文档从属 `PROJECT-CHARTER.md` 第 1.2.1 节；如与宪章冲突以宪章为准。
> 关联平台：瑞诺瓦AI舒适家 · Rhautt Nexus / 瑞合数智枢纽。
> 生效：2026-07-01 · 状态：设计锁定，分期实现。

---

## 0. 为什么要「用魔法打败魔法」

对手的「魔法」是：算法分发（抖音/小红书/知乎/大众点评）、生成式引擎答案（AI 搜索：豆包/文小言/Kimi/DeepSeek/perplexity）、水军与舆情操纵、以及内容工业化产能。传统市场部靠人肉盯舆情、手写文案、拍脑袋投放，必然被降维打击。

我们的反制不是也去买水军，而是**把 AI 装进合规、透明、可审计的营销工作流**，在四个战场用效率与质量碾压：

| 战场 | 对手的魔法 | 我们的反魔法（合规） |
|---|---|---|
| 舆情 | 水军刷屏、危机突袭 | 全网公开源实时监测 + AI 情感/意图分级 + 危机预警与话术库 |
| 内容 | 内容农场量产 | 多平台风格文案矩阵一键生成 + 品牌护栏 + 人工核准 |
| 搜索 | SEO 黑帽 + AI 答案抢占 | GEO（生成式引擎优化）：让 AI 搜索优先引用我方权威内容 |
| 投放 | 盲投烧钱 | 线索归因 + ROI 闭环 + 素材 A/B + 预算再分配建议 |

红线：只采公开数据、不刷量、不抹黑竞品、AI 产出默认「待人工核准」。**赢在效率和真实价值差，不赢在灰产。**

---

## 1. 能力矩阵（四大引擎 + 一个底座）

```text
                    增长中枢 / Nexus Growth（/api/v2/growth）
   ┌──────────────┬──────────────┬──────────────┬──────────────┐
 E1 舆情监测      E2 文案策划     E3 GEO 分析     E4 营销自动化
 Sentiment       Copilot        GEO Analyzer   Campaign Ops
   │ 采公开源      │ 多平台矩阵     │ AI 搜索可见度   │ 归因/ROI/投放
   └──────────────┴──────┬───────┴──────────────┴──────────────┘
                    增长库 growth (PostgreSQL) + Mongo(文档/草稿) + 对象存储(素材)
                    只读：品牌运营库(内容/DAM) · 分析数仓(脱敏指标) · brand-registry
                    AI 网关：@anthropic-ai/sdk（已在依赖）+ 可插拔国内模型适配层
```

### E1 · 舆情监测 Sentiment Radar
- **采集**：公开源接入器（微博/小红书/知乎/抖音评论/大众点评/新闻/贴吧/AI 搜索答案快照）。统一走「connector 适配器 + 速率限制 + 合规白名单」，只取公开可见内容，遵守各平台 robots/ToS。
- **AI 分级**：情感（正/负/中）、意图（咨询/投诉/比价/黑稿）、紧急度（P0 危机→P3 常规）、品牌/产品/门店实体识别。
- **危机预警**：负面加速度触发阈值 → 站内/企业微信/短信告警 + 自动生成「危机应对话术草稿」（待核准）。
- **竞品雷达**：Rheem/Ruud/Everhot vs 竞品的声量、口碑、话题份额对比。

### E2 · 文案策划 Copilot
- **品牌护栏**：以 `DESIGN.md` 品牌语气 + 各设备品牌 VI + 合规词库为 system prompt，杜绝违禁词/绝对化用语（《广告法》）。
- **多平台矩阵**：一个卖点 → 一键产出 小红书种草 / 抖音口播脚本 / 知乎长文 / 公众号 / 官网 SEO 落地页 / 投放短句，各自风格。
- **素材联动**：从 DAM 拉品牌图；调 `file-artifact` 存产出。
- **核准流**：所有产出 status=`draft` → 市场人员/合规审 → `approved` 才能导出/发布。审计留痕。

### E3 · GEO 分析 GEO Analyzer
- **是什么**：Generative Engine Optimization —— 让 AI 搜索（豆包/Kimi/DeepSeek/文小言/perplexity 等）在回答暖通/舒适家问题时**优先引用我方权威内容**。这是 SEO 的下一代战场，项目已有 `guard:geo` 与 everhot GEO 管线做基础。
- **诊断**：对一组目标问题（"上海别墅五恒系统怎么选""Rheem 热水器好不好"）跑多引擎，抓取 AI 答案，分析：我方是否被引用、引用位置、引用的是谁的内容、事实是否准确。
- **优化建议**：结构化数据（schema.org/FAQ/HowTo）、权威内容缺口、被竞品占位的问题清单 → 回流给 E2 生成补齐内容 → 复投站点（板块一）。
- **复用**：`apps/everhot-cn/scripts/geo-build.js` + `scripts/agent-guards/geo-readiness-check.js` 已存在，GEO Analyzer 消费其产物并扩展到多品牌多引擎。

### E4 · 营销自动化 Campaign Ops
- **线索归因**：打通 `ingress`（公域获客）→ `diagnosis`/`crm`，把 UTM/campaign 一路带到成交，算真实 CAC/ROI（不是曝光虚荣指标）。
- **素材 A/B**：同一投放多版本素材 → 回收转化 → AI 给再分配建议。
- **投放计划**：按预算/渠道/受众生成计划草稿（待核准），导出给投放平台执行（本平台不直接烧钱，只出计划与复盘）。

---

## 2. 架构与边界（对齐宪章 1.3 数据平面）

| 项 | 取值 |
|---|---|
| 模块名 | `growth`（NestJS，`services/api/src/modules/growth/`） |
| apiNamespace | `/api/v2/growth`（锁定） |
| moduleNamespace / dataNamespace | `growth` |
| 所属板块 | 底座（对内控制平面能力域） |
| 主数据平面（写） | 增长库（PostgreSQL，RLS 租户隔离；总部租户为主） |
| 文档/草稿 | Mongo（舆情原文快照、AI 草稿、GEO 答案快照） |
| 素材 | 对象存储（经 `file-artifact`） |
| 跨平面只读 | 品牌运营库(内容/DAM)、分析数仓(脱敏)、brand-registry、ingress/crm(归因) |
| 写 API | 走 outbox 事件（`growth.*`），与他域解耦 |
| AI 调用 | 统一 AI 网关 provider（`@anthropic-ai/sdk` + 国内模型适配），带审计与成本计量 |
| IoT | 无关（不涉 lifecycle handoff 之外） |

**只读不越界**：Growth 从不写 crm/diagnosis/brand 的 OLTP；需要业务动作时发 `growth.*` 事件由目标域消费（复用现有 `EventBusService` + `EventConsumersService` 模式）。

### 关键领域事件
- `growth.opinion.crisis_detected` → notification（告警运营）
- `growth.copy.approved` → file-artifact（归档）/ 板块一站点内容管线
- `growth.lead.attributed` → analytics（归因入数仓）

---

## 3. 数据模型（增长库首批表，迁移 009）

```sql
-- 009_growth_marketing_foundation.sql（草案，随实现落地并启用 RLS）
growth_opinion_mention   -- 舆情条目：source, url, author_hash, content, sentiment, intent, severity, entities[], captured_at
growth_opinion_alert     -- 危机预警：mention_ids[], severity, status, playbook_draft_id
growth_copy_asset        -- 文案资产：channel, brand_slug, prompt, draft, status(draft/approved/published), reviewer, model, tokens_cost
growth_geo_probe         -- GEO 探测：question, engine, answer_snapshot, we_cited(bool), citation_rank, competitors_cited[]
growth_campaign          -- 战役：name, channel, budget, utm, status
growth_campaign_metric   -- 战役指标：campaign_id, impressions, clicks, leads, signed, cac, roi, period
```
- 全部带 `tenant_id` + RLS（沿用 `database/postgres/migrations/004/005` 模式）。
- 舆情原文与 AI 草稿正文存 Mongo，PG 只存结构化字段 + 文档引用（与 diagnosis 同构）。
- `author_hash`：作者标识脱敏哈希，遵守 PIPL。

---

## 4. AI 护栏（不可绕过）

1. **人工核准闸门**：对外可见产出（文案/话术/GEO 内容）默认 `draft`，非 `approved` 不可导出/发布；审计记录 who/when/model/diff。
2. **合规词过滤**：《广告法》绝对化用语、竞品抹黑、虚假承诺 → 生成即拦截并提示。
3. **来源合规**：舆情只采公开可见内容，尊重 robots/ToS/速率限制；不破解登录墙、不刷量、不伪造身份。
4. **成本与审计**：每次 AI 调用记 token/成本/prompt 版本，进 governance 审计，供总部成本管控。
5. **事实链隔离**：Growth 产出是营销内容，绝不回写精算内核/产品参数可信链（呼应宪章 1.1 红线）。

---

## 5. 前端面（对内工作台）

- 落点：`apps/nexus-console`（已存在的对内控制平面 Next.js 应用），新增 `增长中枢` 导航区，四个引擎四个工作页。
- 设计语言：严格走 `DESIGN.md`（企业级、克制、无渐变/无 emoji 导航），与 C 端 `consumer-diagnosis` 的营销风格分离。
- 角色：仅 `hq_marketing` / `brand_ops` / `admin` 可见（走现有 RBAC，board-three 不对经销商/ C 端开放）。

---

## 6. 分期实现（与 CI 门禁协同推进）

> 提示：`services/api/src/modules/module-boundary.ts` 与 `contracts/`、多个 guard 强耦合。**将 `growth` 提升为受管模块，必须同一批次更新 module-boundary + 相关契约 + guard 期望值**，否则 `guard:target-architecture`/`guard:module-independence`/`guard:route-target-map` 会红。分期即为此设计。

- **G0 · 契约与骨架（1 周）**：登记 module-boundary（growth spec）、契约、`contracts/product-modules/growth.*`、OpenAPI 占位；建 `growth` NestJS 模块骨架（controller/service/entity/module）；迁移 009（不启用写路径）；同批更新 guard 期望值使 `guard:all:nonvisual` 绿。产出：可 boot-smoke 通过的空模块。
- **G1 · GEO Analyzer（2 周）**：最快见效、已有 geo 基础。多引擎探测 + 诊断报告 + 与 E2 缺口回流。产出：一份「多品牌 AI 搜索可见度」周报。
- **G2 · 文案 Copilot（2 周）**：AI 网关 + 品牌护栏 + 多平台矩阵 + 核准流 + DAM/file-artifact 联动。
- **G3 · 舆情雷达（3 周）**：先接 2–3 个公开源 connector + AI 分级 + 危机预警；再逐步扩源。
- **G4 · 营销自动化（2 周）**：ingress→crm 归因闭环 + 战役/ROI 看板 + A/B 再分配建议。
- **G5 · 强化（滚动）**：更多 connector、更多引擎、成本优化、总部跨品牌增长看板并入 analytics。

每期完成判据：对应 guard 绿 + `test:production-readiness` 不回归 + 该引擎产出一份真实可用的运营产物（可上线证据）。

---

## 7. 需要新增/更新的门禁（保持机器纪律）
- `guard:growth-boundary`：growth 只读他域、写走 outbox、AI 产出必须有核准状态字段。
- `guard:growth-ai-guardrail`：检查合规词库与「draft 默认」不可被绕过。
- 更新 `guard:nexus-naming`：增长中枢中文名锁定「增长中枢」，英文「Nexus Growth」，禁止对外品牌化命名。
- 复用 `guard:geo` 覆盖 GEO Analyzer 产物。

---

## 8. 竞品对标（2025 公开市场调研）

> 目的：不重造轮子，抄「能力清单」不抄「灰产打法」。以下为公开资料归纳的行业标杆能力，作为本板块补齐依据。

### 8.1 三个范式转移（决定架构方向）
1. **从「生成」到「代理执行」(Agentic)**：标杆平台不再只写文案，而是「人定策略、Agent 编排执行、人工核准闸门把关」。参照 Salesforce Agentforce（"marketers define the strategy, agents handle execution"）、HubSpot Breeze Agents、Copy.ai 15+ GTM workflows、Writer Playbooks。→ 对应本板块新增**底座能力 B2 Growth Agents**。
2. **从 SEO 到 GEO/AEO**：AI 答案成为新流量入口；行业数据「83% 的 AI 引用来自传统搜索前 10 名之外」「AI 引用月度波动 40–60%」→ 必须周期性探测看趋势、按引擎分别优化。→ 对应 **E3 大幅升级**。
3. **从「工具」到「品牌大脑 + 数据闭环」**：品牌语气/事实库训练一次、喂给所有引擎；归因→优化→再分配形成学习回路。→ 对应 **底座能力 B1 品牌大脑**。

### 8.2 标杆能力矩阵
| 领域 | 海外标杆 | 国内标杆 | 关键能力（我们要抄的清单） |
|---|---|---|---|
| 舆情/监听 | — | 数说聚合、乐思舆情 | 短视频 ASR/OCR 语义识别、KOL 影响力分级+高危预警、热点趋势预判（爆发前）、评论区情感、大促节点声量对比 |
| 内容生成 | Jasper、Copy.ai、Writer、Typeface | OClaw、小蚁AI、飞书系「品牌内容营销中枢」 | 品牌语气模型训练、50–90+ 模板、多模态（封面图/短视频脚本/AI 视频）、一稿多态裂变、智能排期、人设/账号矩阵、A/B 变体、本地化 |
| GEO/AEO | OptimizeGEO、GEOnative、GEOlytic、HubSpot AEO | — | AIVS 可见度分、Share of Voice、逐 URL 引用溯源、8 引擎覆盖、per-engine playbook、schema 自动生成、事实错误监测、竞品基准、周探测+90天路线图 |
| 自动化/归因 | Salesforce Agentforce、HubSpot Breeze | — | 预测式线索评分、in-flight 优化+预算再分配（待核准）、营销组合建模(MMM)、next-best-action |
| 私域/SCRM | — | 企业微信生态、SCRM 厂商 | 企业微信+公众号+社群、会员生命周期、自动化 SOP、达人/KOL 匹配投放 |

---

## 9. 能力缺口与新增（在四引擎基础上补齐）

### E1 舆情监测 · 补
- **短视频语义理解**：ASR 字幕 + OCR 封面/花字识别（纯文字工具测不到视频负面）。
- **KOL/达人影响力分级 + 高危预警**：按粉丝/互动/历史传播力分级，高危账号发帖即触发 P0。
- **热点趋势预判**：识别热度上升曲线，在爆发前预警（对标国内工具「提前约 4 小时」）。
- **节点营销声量对比**：618/双11 等大促期间品牌 vs 竞品实时声量。

### E2 文案 Copilot · 补
- **品牌语气模型 (Brand Voice)**：在护栏之上训练可复用语气模型。
- **多模态产出**：封面图（9:16 抖音 / 3:4 小红书）、短视频脚本、AI 口播/视频。
- **一稿多态 (Atomization)**：一个卖点 → 全渠道自动裂变。
- **智能排期**：各平台最佳发布时段。
- **A/B 变体生成 · 本地化/翻译 · 人设/账号矩阵管理**。
- **选题打分回流**：热点/GEO 缺口 → 4R 打分 → 选题（闭环 E3）。

### E3 GEO 分析 · 大幅升级
- **AIVS 可见度分 + Share of Voice + Sentiment + 逐 URL 引用溯源**。
- **引擎扩至 8 个**：豆包/Kimi/DeepSeek/文小言/Grok/ChatGPT/Perplexity/AI Overviews（按可合规访问性分期接入）。
- **Per-engine Playbook**：不同引擎权重不同（Perplexity 重新鲜度、ChatGPT 偏「best-of」列表）。
- **结构化数据自动生成**（schema.org / FAQ / HowTo）+ 一键修复建议。
- **品牌事实错误监测**：基于自建事实库，抓 AI 说错我方信息即告警。
- **周探测 + 90 天路线图**（应对 40–60% 波动，看趋势而非单点）。

### E4 营销自动化 · 补
- **预测式线索评分**：热/温/冷阈值驱动自动化。
- **In-flight 优化 + 预算再分配**：建议暂停低效素材/渠道（待核准执行）。
- **营销组合建模 (MMM)**：从单点 UTM 到多触点归因。
- **Next-Best-Action / Offer** 推荐。

### 新增底座能力（喂给全部引擎）
- **B1 · 品牌大脑 (Brand Brain)**：品牌语气 + 产品事实库 + 合规词库，单一真相源。数据来自 `DESIGN.md`、`brand-registry.json`、产品域只读快照。对标 Jasper Brand Voice / HubSpot Brand Identity / GEOnative Facts DB。
- **B2 · Growth Agents 编排层**：把「舆情→选题→文案→排期→投放→复盘」串成可编排、带审批的工作流。对标 Agentforce / Breeze / Writer Playbooks。所有对外动作走 `growth.*` outbox 事件，人工核准闸门不可绕过。
- **B3 · 记忆/知识库学习系统**：沉淀运营经验与效果数据，越用越懂账号与受众（对标 OClaw 记忆系统），作为组织资产。

### 候选引擎（中国市场价值高、海外栈没有）
- **E5 · 私域 & SCRM 运营**（候选 G6）：企业微信 + 公众号 + 社群 + 会员生命周期自动化 SOP。直接服务经销商/门店，价值最高。
- **E6 · 达人/KOL 匹配与投放**（候选 G7）：影响力营销的选人—报价—效果闭环。

> 分期建议：E5/E6 列为 G6/G7 候选，在 G0–G5 稳定后按业务优先级启动；B1/B2 作为底座能力在 G0 骨架期即预留接口，随 E2/E3 落地逐步充实。

---

## 10. 治理与技能强化（不可绕过）
- **合规审查 Agent**：《广告法》绝对化用语、竞品抹黑、虚假承诺——生成即拦截（现有护栏升级为独立 agent）。
- **审批链 + 版本留痕 + 成本计量**：每次 AI 调用记 token/成本/prompt 版本进 governance（BCG/IDC 强调 measurement 是规模化前提，却最常被忽视）。
- **红线不变**：只采公开源、不刷量、不抹黑、默认待核准、事实链隔离（营销产出绝不回写精算内核）。
- 新增门禁 `guard:growth-brand-brain`：品牌大脑事实库为只读消费源，不可被营销产出反写。

---

## 11. 参考来源（2025 公开调研）
- IDC MarketScape: Worldwide AI-Enabled Marketing Platforms for Enterprise 2025。
- BCG《How CMOs Are Scaling GenAI in Turbulent Times》(2025)：agentic 工作流、measurement、护栏。
- HubSpot《State of Marketing AI Report 2025》；HubSpot Breeze / AEO 产品页。
- Salesforce Agentforce / Next-Gen Marketing Cloud 产品页（agentic marketing、in-flight 优化）。
- GEO 工具：OptimizeGEO、GEOnative.ai、GEOlytic、Rankeo、Forzeo（AIVS/SOV/引用溯源/多引擎/事实监测）。
- Jasper / Copy.ai / Writer 能力对比（品牌语气、模板、GTM workflows）。
- 国内：数说聚合、乐思舆情（短视频舆情/KOL分级/热点预判）；OClaw、小蚁AI、飞书系「品牌内容营销中枢」skill（多平台矩阵/排期/人设/多模态）。
