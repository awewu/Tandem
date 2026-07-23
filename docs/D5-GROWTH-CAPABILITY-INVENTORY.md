# D5 增长中枢 · 能力清单（实现 / MVP / 待外接）

> 事实基线：`services/api/src/modules/growth/*`（控制器 + 4 引擎 service + 6 支撑 service）。
> 状态口径：**实现**=有真实逻辑且落库/可用；**MVP**=逻辑真实但为起步版/启发式；**待外接**=契约就绪但需凭证或外部适配器。

## 支撑底座（4 引擎共用）
| 服务 | 能力 | 状态 |
|---|---|---|
| `AiGatewayService` | 统一 AI 网关：配 `ANTHROPIC_API_KEY` → 真实 Claude 生成；未配 → 确定性桩。合规词扫描 + 成本计量 | **实现**（LLM 路径需 Key）|
| `OpinionClassifierService` | 舆情分级：AI(JSON) 优先 + 正则启发式兜底（情感/意图/危机级/实体）| **实现** |
| `OpinionSourceService` | 舆情源连接器注册表 + 就绪度；`manual` 恒可用；`news` 走 RSS 实拉（本次新增，无需凭证）；其余外部源凭证门控 | **实现**(manual/news) · **待外接**(微博/小红书/知乎/抖音/点评)|
| `GeoAnalyzerService` | AIVS 打分、Share of Voice、竞品榜、品牌幻觉检测、信任源、Playbook、问题集、JSON-LD/llms.txt | **实现**（分析）· **待外接**（引擎实时 HTTP 探测）|
| `BrandBrainService` | 品牌事实/语气/禁语接地，构造 system prompt | **实现** |
| `AttributionService` | CAC/CPL/ROI 经济学计算、多触点归因 | **实现** |

## E1 · 舆情监测 Sentiment Radar
| 接口 | 能力 | 状态 |
|---|---|---|
| `POST opinion/mentions` | 录入一条 → 分级 → P0/P1 触发危机预警（含话术草稿）+ 发 `growth.opinion.crisis_detected` 事件 | **实现** |
| `GET opinion/mentions` · `GET opinion/alerts` | 列表（租户隔离 RLS）| **实现** |
| `GET opinion/connectors` | 源就绪度 | **实现** |
| `POST opinion/pull` | 从源拉取并逐条分级入库 | **实现**（manual 空/news 实拉）· 其余源 **待外接** |

## E2 · 文案 Copilot
| 接口 | 能力 | 状态 |
|---|---|---|
| `POST copy/generate` | 品牌大脑接地 → 生成 draft + 合规打标 + 成本 | **实现**（成品级需配 LLM Key）|
| `POST copy/:id/approve` | 人工核准闸门：命中合规词禁止核准；核准发 `growth.copy.approved` | **实现** |
| `GET copy` | 资产列表 | **实现** |

## E3 · GEO 分析
| 接口 | 能力 | 状态 |
|---|---|---|
| `POST geo/probe` | 有答案快照 → 自动判定引用/位次/竞品/AIVS/情感/幻觉；无快照 → 记录回落值 | **实现**（分析）· 快照获取 **待外接** |
| `GET geo/visibility` | 可见度周报：被引率、AIVS、SoV、竞品榜、信任源、幻觉、Playbook | **实现** |
| `GET geo/engines` · `GET geo/onsite-readiness` | 多引擎覆盖 / 站内可引用度 | **实现** |
| `POST geo/question-set` · `POST geo/structured-data` | 全周期问题集 / 品牌 JSON-LD + llms.txt | **实现** |

## E4 · 营销自动化
| 接口 | 能力 | 状态 |
|---|---|---|
| `POST campaigns` | 建战役 | **实现** |
| `POST campaigns/metrics` | 记指标 + 发 `growth.lead.attributed`（幂等，见迁移 014）| **实现** |
| `GET campaigns/roi-board` | 真实 CAC/CPL/ROI 漏斗（非曝光虚荣）| **实现** |
| lead 归因订阅 | 消费 `lead.captured` → 同租户战役归因（幂等去重）| **实现** |

## 结论：要"成品级"还差什么
1. **配 `ANTHROPIC_API_KEY`** → E1 分级 + E2 文案立即从桩升级为真实大模型。
2. **外部舆情源适配器**（微博/小红书/知乎/抖音/点评）→ 需各平台凭证 + fetch 实现。
3. **GEO 引擎实时探测适配器** → 需各 AI 引擎 API Key，自动抓答案快照喂给已实现的分析器。
4. 其余（归因、ROI、合规、问题集、结构化数据、事件流）**已是实现级**，非桩。
