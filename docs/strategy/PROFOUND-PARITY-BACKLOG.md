# Profound 逐功能补齐 Backlog（GEO 赛道对位 → 可排期）

> 来源：COMPETITIVE-ANALYSIS.md 的 GEO 执行侧对位表 → 拆成可排期 issue。
> 图例：✅ 已具备 · 🟡 部分 · ❌ 缺。P0=卖点立足前置 · P1=竞争力 · P2=规模化。
> 每项标注【真环境门槛】= 需生产/网关/密钥才能真正生效(本机无法验证实现)。

## P0 · 让"执行侧"卖点立得住(补最短板)
| # | 能力 | 现状 | 补齐动作 | 代码接缝 / 门槛 |
|---|---|---|---|---|
| P0-1 | **自动多引擎探测** | 🟡 网关支持 `teamProvider` 多模型,但探测把它写死 env 默认,UI 选的引擎未透传 | 把引擎参数从探测 DTO 透传到 `callHermesCenterAi` 的 `teamProvider`;`byEngine` 记真实引擎 | 接缝:`ai-gateway.service.ts::callHermesCenterAi`(teamProvider 现取 `HERMES_CENTER_AI_PROVIDER` env)+ `growth.service.ts::runHermesCenterAiProbe`。**门槛**:Tandem 网关须真配 doubao/deepseek/gemini/chatgpt 等模型 + 鉴权 |
| P0-2 | **真 AI provider(内容生成)** | 🟡 有 Anthropic + Hermes 网关路径,未配 Key 走确定性兜底 | 生产注入 `ANTHROPIC_API_KEY` 或 `HERMES_CENTER_AI_*`;`model` 如实标注 | 接缝已就位(`generateDraft`);**门槛**:密钥(见 NEXUS-REAL-ENV-CHECKLIST) |
| P0-3 | **来源级引用情报**(Profound 强项) | 🟡 有 citations 字段,未做来源聚合 | 聚合"哪些 URL/来源被 AI 引用"→ 排行 + 我方 vs 竞品来源 | 需探测返回 citations(网关透传)→ 新 read model |

## P1 · 竞争力对位
| # | 能力 | 现状 | 补齐动作 |
|---|---|---|---|
| P1-1 | 引擎覆盖广度(6+) | 🟡 覆盖窄 | 随 P0-1 扩到 ChatGPT/Gemini/Perplexity/Claude/Copilot/AI Overview |
| P1-2 | 情感/准确性监测 | 🟡 有 sentiment/hallucination 雏形 | 补品牌事实准确性核对(对齐产品事实基座) |
| P1-3 | **闭环 lift 实验**(Nexus 独有,Profound 无) | ✅ | 保持并做成对外卖点;补自动复投调度 |
| P1-4 | **自进化策略库**(Nexus 独有) | ✅ 可观测(evolution-B) | 喂真实实验数据后自动学习 |
| P1-5 | AI 引荐流量归因 | ❌ | 接 UTM/referrer → 归因读模型,证明 GEO→线索 |

## P2 · 规模化 / 企业级
| # | 能力 | 现状 | 补齐动作 |
|---|---|---|---|
| P2-1 | 跨租户匿名基准(对标 Ahrefs 476M) | ❌ | 匿名聚合全网策略胜率,补数据劣势 |
| P2-2 | 合规认证(Profound SOC2) | 🟡 有 RLS/审计 | 走 SOC2/等保流程 |
| P2-3 | 定时探测调度 + 告警 | 🟡 手动/排队 | 定时任务 + 出现率下滑告警 |

## 排期建议
1. **先 P0-1 + P0-2**(真多引擎 + 真 AI):否则"执行侧+lift"卖点被"数据不真"反噬 —— 这是能力进化图阶 1 的硬前置。均**受真环境门槛**(网关多模型配置 + 密钥),代码接缝已在上表标明,备好环境即可落地。
2. P1 强化差异化(闭环 lift / 自进化已领先,补引荐归因闭合"GEO→线索"证据链)。
3. P2 规模化(跨租户基准是长期护城河)。
