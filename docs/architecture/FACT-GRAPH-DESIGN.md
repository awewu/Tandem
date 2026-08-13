# 事实图谱设计（Fact Graph）· 自循环的地基

> 对标：**Yext Knowledge Graph**（NYSE 上市 · 管理 340 万实体 · 200+ 渠道）。其与竞品的**结构性差别**是
> "扁平记录 vs 连通知识图谱"，核心价值一句话：**一次更新，流向每一条记录、每一个渠道**。
> 目标：把"产品事实基座"从**数据库表**升级为**连通实体图**，使
> **新增品牌/品类 = 挂接实体 → 自动继承结构与内容路径**（比模板复用更根本地解决自循环冷启动）。
> 关联：`docs/D2-PRODUCT-FACT-BASE-BLUEPRINT.md` · `NEXUS-CAPABILITY-EVOLUTION.md` · `strategy/GTM-STRATEGY-ANALYSIS-LAYER.md`。

## 1. 现状盘点（诚实：我们已有不少图原语，不必推倒重来）
| 已有 | 位置 | 图学意义 |
|---|---|---|
| **`ProductRelationEntity`**（类型化关系 + `inverseRelationType` 反向边） | product-catalog | **边原语已存在**，但仅限 product↔product |
| **`BrandProductCategoryEntity`** 三级分类 + `categoryPath` / `categoryBindings` | brand-product-category | 分类**子图/树**已存在 |
| **`BrandPublishGrantEntity`**（D4 发布投影：经销商按品牌只读已发布事实，**不复制**） | product-catalog | 已是 Yext 式"**单一真相源 + 授权分发**" |
| `ProductContentEntity`（多语言 + SEO + marketing 投影） | product-catalog | **事实→渠道**的投影层已存在 |
| `packages/domain/hvac-kernels`（9 域）+ system-packs | packages | 技术事实，但**游离于图外** |
| `growth_scenario` + `growth_geo_question.source_scenario_id` | growth | 场景/选题链路已建，但**未与产品/内核连通** |

**缺口**：① 边只在 product↔product，**没有跨实体类型的统一边模型**；② 技术内核 / 场景 / 问题 / 经销商未入图；
③ **没有传播（propagation）语义** —— 这正是 Yext 的核心价值所在；④ 新增品牌仍是"重建"而非"挂接"。

## 2. 目标实体模型（节点）
| 实体 | 说明 | 现状 |
|---|---|---|
| `Brand` | 品牌（Rheem/Ruud/Everhot/Lithnova） | brand-registry |
| `ProductCategory` | 三级品类树 | ✅ 已有 |
| `Product` | SKU 级产品事实（规格/证书/图文档） | ✅ 已有 |
| `TechKernel` | 9 域 HVAC 精算内核 | 有实现，未入图 |
| `SystemPack` | 系统包（内核组合） | 有实现，未入图 |
| `Scenario` | 场景（品类×角色×痛点×房型×气候区） | ✅ 新建 |
| `Question` | GEO 选题（prompt） | ✅ 已有（带来源） |
| `ContentAsset` | 生成/审核后的内容 | ✅ 已有 |
| `BrandSitePage` | 品牌站页面（发布产物） | 已有 |
| `Dealer` | 经销商（服务区域×品类） | 已有 |
| `ClimateZone` / `Audience` | GB 气候区 / 角色 | ✅ 新建（词表） |
| `Competitor` | 竞品 | insight |

## 3. 边模型（类型化关系 + **是否传播**）
| 边 | 语义 | 传播 |
|---|---|---|
| `Brand -[OWNS]-> Product` | 品牌拥有产品 | — |
| `Product -[IN_CATEGORY]-> ProductCategory` | 归类（三级） | ✅ 品类事实向下继承 |
| `Product -[BACKED_BY]-> TechKernel` | **产品参数由内核支撑** | ✅ 内核更新 → 影响所有引用产品 |
| `SystemPack -[COMPOSES]-> TechKernel` | 系统包组合内核 | ✅ |
| `Scenario -[TARGETS]-> ProductCategory / Audience / ClimateZone` | 场景锚定 | ✅ 品类新增场景 → 全品牌可复用 |
| `Question -[DERIVED_FROM]-> Scenario` | 选题来源可追溯 | ✅ 已实现 |
| `ContentAsset -[ANSWERS]-> Question` | 内容回答选题 | — |
| `ContentAsset -[CITES]-> Product / TechKernel` | **内容引用的事实出处** | ✅ 事实变更 → 内容标记待复核 |
| `BrandSitePage -[PUBLISHES]-> ContentAsset / Product` | 发布 | ✅ 事实变更 → JSON-LD 自动重生成 |
| `Dealer -[SERVES]-> Region / ProductCategory` | 服务能力 | — |
| `Competitor -[COMPETES_IN]-> ProductCategory` | 竞争面 | — |

## 4. 传播规则（Yext 的核心价值落到我们身上）
1. **内核 → 产品 → 内容 → JSON-LD → 品牌站 → AI 引擎**：一条链贯通。内核参数更新，沿 `BACKED_BY`/`CITES`/`PUBLISHES` 传播，
   自动**重生成 JSON-LD** 并把受影响内容标记为"待复核"（不静默改对外文案，守审核闸）。
2. **品类 → 场景 → 选题**：品类下新增场景骨架，**所有挂在该品类的品牌自动获得选题路径**。
3. **防幻觉硬闸**：`ContentAsset -[CITES]-> Product/TechKernel` 使"**每条事实性断言都有出处**"可校验；
   无出处的数值/认证/质保一律"待补充"（与既有策略库规则一致）。

## 5. 新增品牌/品类 = **挂接**（自循环冷启动）
```
新增品牌 B（既有品类 C）：
 ① Brand(B) 节点入图
 ② B -[OWNS]-> Product(...)（导入 SKU；参数经 BACKED_BY 复用既有 TechKernel，不重建技术事实）
 ③ Product -[IN_CATEGORY]-> C（自动继承三级分类结构与品类事实）
 ④ 自动继承 C 上已有的 Scenario 子图 → 派生初始选题（播种器已实现）
 ⑤ 自动继承策略权重的**品类层先验**（三层收缩已实现 → 开局不从零）
 ⑥ 启动序列 geo.bootstrap 一键起转（已实现）
→ 品牌专属需人工的只剩：品牌事实、禁语、定位话术。
```
**中台成立的判据**：第 N 个品牌必须显著便宜于第 1 个。挂接模型是这条判据的工程实现。

## 6. 实现路径（分阶段，**不引图数据库**）
- **阶段 1（低风险）**：泛化边表 —— 参照 `ProductRelationEntity` 建 `fact_edge(tenant_id, from_type, from_id, edge_type, to_type, to_id, props)`，
  带 RLS + 反向边约定；先把 `Product -[BACKED_BY]-> TechKernel`、`Scenario -[TARGETS]-> Category` 两类边落地。
- **阶段 2**：事实解析器 —— 内容生成从图取事实（替代手工传 sources），并写回 `CITES` 边。
- **阶段 3**：JSON-LD 从图生成（一次更新全站同步），接 `geo:build` 与 `guard:geo`。
- **阶段 4**：变更传播 —— 事实更新经 outbox 事件驱动"受影响内容待复核 + 页面重生成"。
- **技术选型**：PostgreSQL 邻接表 + 递归 CTE（必要时闭包表）。**不引 Neo4j**——避免过度工程与运维负担。

## 7. 约束与红线
- 守 **RLS 多租户** 与 **ABC 边界**：跨模块反应经 outbox 事件，不跨模块直连读表。
- `products` 作为**共享品牌事实**（当前有意未开 RLS）——入图后此语义不变，但需在 `verify-rls-grants` 台账保留说明。
- **经销商 PII 不入图**（只入服务能力/区域等非 PII 属性）。
- 传播**不得静默修改对外已发布文案**：一律走"标记待复核 + 人工核准"（宪章 §12 draft→approved）。
- 不推倒重来：所有阶段都在既有表之上增量演进。

## 8. 与国际对标的差异（为什么值得做）
Yext 的实体是 **location（地址/营业时间/评价）**；我们的实体是 **产品参数 + 9 域 HVAC 技术内核**——
**高决策成本工程品类的技术事实深度**，是其知识图谱不具备的。事实图谱化后，这条差异化才真正变成可复利的资产。
