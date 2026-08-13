# AI-GTM Nexus · 竞品对标与差异化分析

> 依据：2026-08 全网实况检索 + 本平台 PRD 复盘。目的：明确 Nexus 的独特身位、诚实差距与补齐路线。
> 关联：`NEXUS-CAPABILITY-EVOLUTION.md`(能力进化) · `NEXUS-MARKETING-PLATFORM-BASELINE.md`(基线)。

## 1. PRD 功能体系复盘
- 主轴：两支柱（产品事实基座🛡️ + AI-GEO 引擎🗡️）+ AI 贯穿层 + 十模块 + 线索飞轮 + **闭环 lift 实验**；北极星 = GEO→高意向线索。
- 强项：主线自洽、有**可证伪闭环**（基线→生成→发布→复投→lift）、**受治理动作引擎**（green/yellow/red + 人与 AI 同闸 + 审计 + RLS，Foundry 式）。
- 弱项：AI provider 未全接真模型；GEO 多引擎覆盖窄；自进化数据饥饿；经销商门户占位。

## 2. 赛道对标（2026 实况）
### 2.1 GEO / AI 可见度（核心矛头 · 最卷）
| 产品 | 定位 | 价位 |
|---|---|---|
| Profound | 企业标杆（Sequoia B 轮 · 来源级引用 · SOC2） | $499+/mo |
| Peec AI | 中端 SoV 分析 | €89–199/mo |
| Otterly | 入门 | $29+/mo |
| Scrunch | 2026.6 被 Sitecore 收购并入 DXP | $250+/mo |
| AthenaHQ | 来源引用情报 | $295–499/mo |
| Ahrefs Brand Radar / Semrush AI / HubSpot AEO | SEO 套件 AI 附加（Ahrefs 追 476M+ prompts） | 附加 |

**行业缺口（freshestweb/Okara）：以上这批几乎全是"监测"——不产内容、不改答案。"付了仪表盘，活还得自己干。"**

### 2.1b ⚠️ 更正（2026-08）：执行侧**不是无人区**
初版本文档结论"执行侧无人做"**不成立，特此更正**。多门店/多品牌赛道已有成熟玩家做到闭环执行：
| 产品 | 规模/性质 | 关键能力 |
|---|---|---|
| **Yext** | NYSE 上市 · 年营收 $446M · 管理 340 万门店实体 · 200+ 发布渠道 | **Knowledge Graph 实体图谱**（一次更新流向所有渠道）；**Scout** 做 LLM 引用追踪 + 超本地竞品基准 → 输出**受治理动作** |
| **SOCi** | 1→10 万+ 门店 | **品牌训练过的 AI Agent 代执行**；批量动作 + 审批流 + 分级权限（治理规模化） |
| **Uberall GEO Studio** | 企业级 GEO/AEO | 导入门店自动映射 → **跑数千 AI 查询建基线** → 门店级优先建议 → **一键应用** → 实时追踪可见度提升（**完整执行闭环**） |

"只监测不执行"仅对 Profound / Peec / Otterly 成立。**我方差异化须收窄**至：①**产品参数 + 9 域 HVAC 技术内核的事实深度**（对方是 location 实体，无此工程深度）；②**对照实验算 lift 的严谨度**（对方多为前后分数对比）——但必须跑出数据才算数；③**lift 反哺策略库的自进化**（暂未见对方公开做）。
**规模差距诚实记录**：Yext 近 20 年基础设施积累，广度/渠道网络/数据规模无可比性 → 更不能正面比广度。

### 2.2 Agentic 营销平台（横向巨头）
- Salesforce Agentforce Marketing / Marketing Cloud Next（统一数据 + 对话 agent + guardrails + 交接执行）
- HubSpot Agent Hub + Agent Builder + HubSpot AEO（CRM 上的 GTM agent 群 · 按产出付费）
- Typeface（品牌知识图谱 + 内容生成，插进 Agentforce/Data 360）

### 2.3 归因 / CDP / PRM（Nexus 各占一点）
Dreamdata·HockeyStack·Rockerbox（归因）/ Segment·Salesforce Data Cloud（CDP）/ Impartner·Allbound·Salesforce PRM（经销商赋能）。Nexus 在这三块均为轻量内建。

## 3. GEO「执行侧」功能级对位（Nexus 的楔子）
| 能力 | 监测型工具(Profound/Peec/Otterly) | **Nexus** |
|---|---|---|
| 多引擎出现率/SoV 监测 | ✅ 强（6+ 引擎、规模化） | 🟡 有，引擎覆盖窄 |
| 来源级引用情报 | ✅（Profound/AthenaHQ） | 🟡 部分 |
| **内容生成（研究策略库）** | ❌ 基本不做 | ✅ 7 策略库（论文实证增益） |
| **闭环 lift 实验（证明有效）** | ❌ 无 | ✅ 基线→生成→复投→lift |
| **自进化（lift 反哺策略权重）** | ❌ 无 | ✅ 机制已通、可观测（待数据） |
| **受治理 agentic 执行** | ❌（监测无执行） | ✅ green/yellow/red 同闸 |
| 跨客户基准 | ✅（Ahrefs 476M） | ❌ 无 |

## 4. 差异化定位（护城河在"组合"，且已按 §2.1b 收窄）
纯监测赛道（Profound/Peec/Otterly）是点解决方案；但**多门店赛道（Yext/SOCi/Uberall）已做到闭环执行且规模远超我方**。
我方成立的差异化只剩三条，且每条都有前置条件：
1. **工程品类的事实深度**：产品参数 + 9 域 HVAC 技术内核（对方实体是 location，无此深度）——**最硬的一条**。
2. **对照实验 lift 的严谨度**：须真跑出数据，否则只是纸面优势。
3. **lift 反哺策略库的自进化**：暂未见对方公开做，但也可能只是未对外讲。
外加：**品牌→经销商成交闭环**（AI 出候选、人成交，符合 HVAC 高决策成本 + 必装特性）。

## 5. 诚实差距
| 维度 | 国际领先 | Nexus |
|---|---|---|
| 多引擎深度 | Profound/Peec 6+ 引擎 | 以 Hermes 中心 AI 为主 |
| Agentic 成熟度 | Agentforce/HubSpot 生产级 | 动作引擎在，自进化缺数据 |
| 数据规模/基准 | Ahrefs 476M prompts | 单租户无基准 |
| 合规认证 | Profound SOC2 | 有 RLS/审计，无外部认证 |

## 6. 战略与补齐路线
1. **押执行侧楔子**：把 GEO 闭环 lift + 自进化策略库做成对外独家卖点（Profound 们做不到）。
2. **不比横向广度**：守垂直 + 事实基座护城河，不摊大做通用 CDP/PRM。
3. **补最短板（进化图阶1硬前置）**：接真多引擎 + 真 AI provider，否则"执行侧"卖点被"数据不真"反噬。
4. **跨租户匿名基准（阶3）**：以网络效应补规模数据劣势（对标 Ahrefs 规模）。
