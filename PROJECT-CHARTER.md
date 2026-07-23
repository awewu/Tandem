# Rhautt Nexus / 瑞合数智枢纽 · 立项宪章（单一事实源）

> 版本：v1.5 · 新增第 5.6 章「前端 GEO / 机器可读层（宪章级，全站强制）」+ 第 7 章 GEO 质量门
> 生效日期：2026-06-28
> 上一版：v1.4（2026-06-25，资产盘点裁定回填，REVIEW 65→0，新增第 8.2 资产处置裁定结论）
> 状态：生效。本文档是产品定位、品牌关系、平台架构和工程边界的唯一事实源。
> 取代关系：本宪章统一并取代散落的 PRD-CURRENT.md、PRODUCT-SCOPE.md、docs/ 下多份 PRD/charter 的对外效力。后续如有冲突，以本宪章为准；旧文档降级为历史附录，详见第 11 章。
> 编写依据：现有 PRD、contracts/architecture/rhautt-nexus-target-architecture.json、brand-registry.json、contracts/product-modules/*，以及 2026-06-24 实地抓取的 rheem.com / ruud.com 源码。

---

## 0. 宪章总则

本项目允许完全重构工程体系，但重构对象是代码架构，不是产品定位。重构遵循一条主路线：

> 重写生产主干，迁移已验证资产；不删功能、不丢品牌关系、不打散已收敛的产品边界。

三条不可动摇的总原则：

1. 产品定位锁定：品牌层级、入口职责、业务闭环已经收敛，不被任何工程想象替换。
2. 多品牌可持续扩张是一等公民：平台从第一天起就为"未来不断新增品牌"而设计，新增品牌是配置行为，不是从零开发。
3. 机器强制纪律：架构边界、契约一致性、品牌规范由 CI 门禁和 lint 规则强制，不依赖个人自觉。

---

## 1. 不可变产品宪章（品牌层级）

```text
Rhautt Comfort / 瑞合瑞德暖通科技集团 = 集团英文/中文表述（不是软件名）
Rhautt Nexus / 瑞合数智枢纽          = 集团数字化中枢/管理平台（统筹品牌管理、网站协同、经销商赋能、CRM、分析、资料中心；不承载/不吞并各独立网站）
瑞合瑞德集团官网 / rhautt.com        = 独立网站（集团门户，自有架构与生命周期）
瑞诺瓦 / Rysnova                    = 经销商赋能体系品牌对（瑞诺瓦=中文名，Rysnova=英文名），中立第三方行业软件形态；下辖问诊/CRM/BIM 三件套
Rheem / Ruud / Everhot               = 设备品牌，各自独立官网（进入瑞诺瓦系统方案的设备矩阵）
```

定位关系（不可混淆）：

- 数智枢纽是中枢/管理层，对各独立网站做统筹、注册、协同、互转和共享底座供给；它不是装官网的容器。
- 集团官网、各品牌官网、瑞诺瓦都是独立网站，各有独立架构、独立域名、独立生命周期，可独立上线。
- 瑞诺瓦 / Rysnova 是独立的经销商赋能体系（问诊/CRM/BIM），按需挂接到集团官网、品牌站、经销商工作台等，不被任一站点拥有；其 BIM（Rysnova BIM）可作为专业子品牌单独打出。

边界铁律：

- 设备品牌不能被写成系统品牌；瑞诺瓦不能被写成设备品牌。
- 瑞合瑞德集团官网不能被改造成内部业务工作台或单一软件控制台。
- 设备品牌独立站必须保留独立域名、独立品牌表达和独立内容所有权。
- Rhautt Comfort 是集团表述，不作为软件工程名或软件产品名。中枢/管理平台名锁定为 Rhautt Nexus / 瑞合数智枢纽。
- 数智枢纽不得吞并独立网站：集团官网、品牌官网、瑞诺瓦各自独立，枢纽只做统筹/注册/协同/底座供给。
- 瑞诺瓦官方英文名锁定为 Rysnova；历史英文 slug（如 rysnova）只作为迁移债务，不得成为新增对外文案或新模块命名依据。
- IoT 边界：平台只做 lifecycle_handoff_only（生命周期交接），不接管 IoT 控制平台本体。

### 1.1 赋能线战略定位（阳谋式渠道转化）

经销商赋能线（瑞诺瓦 / Rysnova 体系：瑞诺瓦 AI 问诊 / Rysnova AI Diagnosis、瑞诺瓦舒适家居 CRM / Rysnova Comfort-Home CRM、瑞诺瓦技术支持 BIM / Rysnova BIM）在产品形态上是中立的第三方行业软件，不以集团或设备品牌冠名。这不是品牌混淆，而是定位锁：以独立行业工具的姿态降低渠道戒心，让经销商把全量业务搬进来；底层通过公开、透明、可见的价值落差，正向引导其向我方设备品牌迁移。

这是阳谋，不是木马：规则全部对经销商透明，不靠隐藏、不靠打压第三方产品；靠的是我方产品「更省事、更赚钱、更完整」的真实体验差。落到产品上有四条不可动摇的设定：

1. 形态中立：赋能线对外呈现为独立第三方行业软件，弱位置如实标注资质背书，不主动张扬集团归属，也不刻意否认。
2. 开放录入：经销商不是专营、卖多品牌，且我方设备品牌（Rheem/Ruud/Everhot）覆盖不全整套舒适家居 SKU；必须开放第三方与自有产品录入，否则 BOM 残缺、工具无法落地使用。
3. 公开落差驱动迁移：第三方产品的 BOM 凑数、报价、导出都必须老实好用；只是不享受自动精算、整包质保、物料同源这些增值能力。迁移动力来自可见的价值差，而非功能阉割或暗中降权。
4. 红线：第三方/未验证产品在系统内标「参数未验证」，只进 BOM 与报价，绝不冒充驱动工程精算；不得借第三方数据污染精算内核的可信链。

三层产品目录是该战略的数据落点（详见 PRD 4.5）：①我方认证产品（全自动精算 + 增值能力）；②共享库（总部统一维护带基准价，经销商调用并自设零售价，采集调用量做行业情报）；③租户私有（经销商自录，默认私有）。价格采两层模型：总部给基准价（成本/指导价）作底，经销商在其上自由设零售价。

联合品牌：经销商租户以「品牌-门店」联合身份呈现（如「瑞美-蓝蜗牛（苏州）舒适家居体验官」），落在 tenant 身份层（详见 PRD 4.7），既服务渠道经营，也强化「独立第三方赋能」的对外观感。

---

### 1.2 产品组织：两大板块 + 一个底座

Rhautt Nexus 不再表述为"中枢装一堆并列模块"，而收敛为两大对外板块，Rhautt Nexus 降为支撑二者的对内工程底座（控制平面）：

```text
                 Rhautt Nexus / 瑞合数智枢纽（对内工程底座 / 控制平面）
        多租户 · auth · 品牌注册 · 共享底座（UI/契约/主题）· 总部分析 · 资料中心
            │ 供能（不直接对外冠名）
   ┌────────┴─────────────────────────────┬──────────────────────────────────┐
 板块一 · Rhautt 旗下各品牌运营体系        板块二 · 瑞诺瓦 / Rysnova 经销商赋能阳谋体系
 （对内/对集团：挂集团与设备品牌）          （对外：中立第三方行业软件形态）
   · 集团官网 rhautt.com                    1）瑞诺瓦 AI 问诊 / Rysnova AI Diagnosis（C 端获客）
   · 设备品牌站 Rheem / Ruud / Everhot      2）瑞诺瓦舒适家居 CRM / Rysnova Comfort-Home CRM
   · 品牌站群 / 物料 DAM / 站点协同              （界面默认展示 Rhautt 旗下品牌，经销商可自由加入其他品牌）
                                            3）瑞诺瓦技术支持 BIM / Rysnova BIM（交付深化）
```

三条组织铁律：

- 板块边界即阳谋边界：板块一挂集团/设备品牌（对内底牌），板块二统一以瑞诺瓦 / Rysnova 中立形态对外（对外阳谋）；二者在产品形态上严格分开，不互相冠名。
- Rhautt Nexus 是底座不是门面：它供给多租户、auth、品牌注册、共享底座与总部分析，不作为对外产品名直接示人；"枢纽不是容器"（2.0）由此更纯粹。
- 瑞诺瓦 / Rysnova 是一个体系、三件产品：问诊→CRM→BIM 是经销商一条完整工作流；三者共享体系品牌与赋能定位，BIM（Rysnova BIM）可作为专业子品牌单独打出。

### 1.2.1 增长中枢 / Nexus Growth（对内底座能力 · 2026-07-01 增补 · 锁定）

> 定位裁定（不可变）：增长中枢 / Nexus Growth 是 **Rhautt Nexus 底座的一个能力域**，不是第三个对外板块，不进 brand-registry，不对外冠名，不做成独立第三方产品。它服务集团/总部市场部，与多租户 / auth / 品牌注册 / 共享底座 / 总部分析 / 资料中心并列，同属对内控制平面。

它是"用魔法打败魔法"的品牌推广数智化工具集：把 AI 植入舆情监测、推广文案策划、市场营销与 GEO（生成式引擎优化）分析，让营销人员插上翅膀。它为板块一（品牌运营：集团官网 + Rheem/Ruud/Everhot 品牌站 + DAM）供能，也为板块二（瑞诺瓦 / Rysnova 赋能线）提供获客侧内容与投放素材，但自身不对外露出为产品。

四条铁律：

1. 对内不对外：增长中枢只对总部/集团市场部与被授权运营角色开放；绝不以独立品牌、独立域名对外售卖，也不冠集团/设备品牌主 logo。
2. 供能不越界：它产出舆情研判、文案草稿、GEO 诊断与投放计划，交给板块一各站与板块二问诊消费；它不直接托管任何独立网站，不接管 CRM/报价/BIM 的业务真相源。
3. AI 有护栏：所有 AI 生成文案默认"待人工核准"，不得未经审核直接对外发布；舆情数据只采集公开来源，遵守 PIPL/数据安全法与平台服务条款，不做灰产抓取。
4. 数据平面归位：增长中枢主写"增长库"（营销运营数据），只读品牌运营库（内容/DAM）与分析数仓（脱敏指标），永不在他域 OLTP 写业务。

apiNamespace 锁定为 `/api/v2/growth`；moduleNamespace / dataNamespace 锁定为 `growth`；限界上下文为"增长营销"。详细蓝图见 `docs/BOARD-3-NEXUS-GROWTH-BLUEPRINT.md`。

### 1.2.2 后台权限域（6 域制 · 权限/导航视图 · 2026-07-01 立 · 2026-07-01 修订：产品独立一级 · 锁定）

> 裁定：后台管理与数据库权限按 **6 个权限域** 组织。这是**展示/权限视图层**，映射到板块与数据平面；**不改变任何数据平面的单写归属**（写主仍以 1.3 为准）。域只决定"谁能看/操作哪些菜单与数据行"。
> 修订说明：原 D1「品牌与产品」拆分为 **D1 品牌管理** 与 **D2 产品**（产品升为独立一级域）；其余域顺延重编号。

| 域 | 名称 | 对应板块 | NestJS 模块（写归属） | 主数据平面 | RLS 主键 |
|---|---|---|---|---|---|
| D0 | 平台与系统 | 底座 | auth · tenant · governance · notification · workflow · mdm · compliance · analytics | 底座主库 / 分析数仓 | 平台角色（超域） |
| D1 | 品牌管理 | 板块一 | brand · file-artifact(DAM) | 品牌运营库 | tenant=总部 + brand_scope |
| D2 | 产品 | 板块一 | product-catalog | 品牌运营库 | tenant=总部 + product_line_scope |
| D3 | 用户与体验 | 横切·C端获客 | ingress · diagnosis(public) · notification(触达) | 赋能库 + 公域暂存租户 | **anonymous/public tenant** |
| D4 | 客户与赋能 | 板块二 | crm · quote · design · rysnova-bim · delivery · lifecycle | 赋能库 + Mongo + 对象存储 | **tenant+dealer+store+role** |
| D5 | 推广与增长 | 板块三 | growth | 增长库 | tenant=总部 + hq_marketing |

三条锁定边界：

1. **底座横切单列 D0**：auth/租户/治理/通知/工作流/主数据/合规/分析属平台能力，单独授权，不散落进业务域。
2. **品牌与产品分治**：D1 品牌管理下**各品牌网站为二级模块**（集团官网、Rheem 中国站、Ruud 中国站、Everhot 恒热官网），按 `brand_scope` 站点级授权；D2 产品作为独立一级域，主写产品/规格/SKU/系统包主数据，供 D1 各站与 D3/D4 只读消费。
3. **用户 vs 客户 = 是否绑定租户**：D3（用户与体验）= 匿名/公域获客，落公域暂存租户；D4（客户与赋能）= 已绑定租户（经销商+门店+签约客户）。留资成交经事件从 D3 单向迁入 D4（`lead.assigned`/`lead.converted`），保留获客归因，PIPL 需二次同意。

后台一级导航 = 这 6 个域；每个 API 的域归属唯一，由 `guard:permission-domain` 强制。完整角色×域矩阵与 RLS 策略见 `docs/ADMIN-PERMISSION-DOMAINS-AND-RLS.md`。

### 1.3 模块 × 板块 × 数据平面映射（架构地基）

三套切分法（15 个 NestJS 模块 / 1.2 两大板块 / 5.5 四个数据平面）必须一一对齐，避免跨界模块归属不明。下表为权威映射，模块归属唯一：

| 模块 | 所属板块 | 主数据平面（写） | 跨平面只读 | 限界上下文 |
|---|---|---|---|---|
| auth | 底座 | 底座主库 | - | 身份认证 |
| tenant | 底座 | 底座主库 | - | 租户/组织 |
| governance | 底座 | 底座主库 | - | 治理/审计/演进 |
| notification | 底座 | 底座主库 | - | 通知（横切） |
| workflow | 底座 | 底座主库（Temporal+Outbox） | - | 流程编排（横切） |
| product-catalog | 板块二（跨界） | 赋能库（目录视图/共享库/私有） | 品牌产品库（只读同步认证产品） | 产品目录 |
| diagnosis | 板块二 | 赋能库 + Mongo 文档 | 底座主库（租户/身份） | 问诊 |
| crm | 板块二 | 赋能库 | 底座主库 | 客户关系 |
| quote | 板块二 | 赋能库 | 品牌库（价格快照） | 报价 |
| design | 板块二 | 赋能库 + Mongo 文档 | product-catalog（verified 参数） | 设计计算 |
| rysnova-bim | 板块二 | 赋能库 + Mongo + 对象存储 | design（方案真相源） | BIM 深化 |
| delivery | 板块二 | 赋能库 | 底座主库 | 施工交付 |
| lifecycle | 板块二 | 赋能库 | 外部 IoT 平台（交接） | 生命周期/IoT |
| file-artifact | 板块二 | 赋能库 + 对象存储 | - | 产物/导出 |
| analytics | 横切（读两板块） | 分析数仓（OLAP，只读） | 各库 CDC/ELT 汇入 | 分析（不在 OLTP 写业务） |
| 品牌运营（站群/DAM） | 板块一 | 品牌运营库（各品牌产品库 + 内容/DAM） | 底座主库（brand-registry） | 品牌站点/内容 |

跨界与横切判定（消除归属歧义）：

- product-catalog 归板块二（它服务赋能线选用），但认证产品的权威源在板块一品牌库，catalog 只读同步——写归板块一、用归板块二，不矛盾。
- analytics 是横切只读域：它不属于任一板块的 OLTP，只在分析数仓里 JOIN 两板块的脱敏数据，永不在 OLTP 写业务。
- 底座模块（auth/tenant/governance/notification/workflow）服务两板块，但只写底座主库，板块侧只读副本（MDM 单写）。

### 1.4 事实源仲裁规则（防五处漂移）

边界描述分布在宪章正文与机器可读契约，仲裁链如下，避免同一事实两处定义：

- 原则与定位：以本宪章正文为最终事实源（PRD 冲突以宪章为准，已在 PRD 头部声明）。
- 机器可执行细节：以契约为准——技术栈终态 contracts/architecture/rhautt-nexus-target-architecture.json、品牌与模块边界 brand-registry.json + contracts/product-modules/*、锁定目标 governance/locked-goal.json。
- 仲裁规则：正文定"是什么/为什么"，契约定"机器怎么执行"；同一事实不在正文与契约重复定义其细节，正文只引用契约。若正文原则与契约细节冲突，先判定是原则变更（改宪章为先）还是契约滞后（更新契约对齐宪章），不允许长期并存两个版本。
- 注：第 5 章"以架构契约为准"特指技术栈终态这一机器细节，不与"宪章为单一事实源"冲突——宪章授权该细节由契约承载。

---

## 2. 多品牌平台模型（核心架构）

这是本宪章相对旧 PRD 的核心升级，对标丰田 / 宝洁 / 万豪等多品牌集团的数字化平台模式。

### 2.0 中枢与独立网站的拓扑（先于一切的定位）

数智枢纽是中枢/管理平面，各网站是被统筹的独立平面，二者分层不混淆：

```text
                 Rhautt Nexus / 瑞合数智枢纽（中枢/管理平面）
         品牌管理 · 网站开发协同 · 经销商赋能 · CRM · 分析 · 资料中心 · 共享底座
                 │ 统筹 / 注册 / 协同 / 互转 / 底座供给（不吞并）
   ┌─────────────┼───────────────┬───────────────┬───────────────┐
 集团官网       瑞诺瓦          Rheem 官网      Ruud 官网       Everhot 官网 …
 rhautt.com    （C 端系统/问诊） rheem.com.cn    ruud.com.cn     everhot.com.cn
 独立网站       独立网站/应用    独立网站         独立网站         独立网站
   └──────────── 各站可按需挂接 ── Rysnova（独立 BIM/技术支持软件体系）────────┘
```

三条拓扑铁律：

- 中枢不是网站的容器：枢纽对各站做统筹、注册、协同、互转和共享底座供给，绝不把独立网站塞进自己内部。
- 各网站独立：集团官网、瑞诺瓦、各品牌官网都有独立架构、独立域名、独立生命周期，可独立上线与独立演进。
- Rysnova 独立且可挂接：作为独立软件体系，按需嵌入/挂接到集团官网、品牌站、经销商工作台等，不被任一站点拥有。

下文 2.1 的四层强边界是工程实现视角（契约/设计系统/主题/应用），与本拓扑不冲突：共享底座由中枢供给，应用层的每个独立网站各自取用。

### 2.1 四层强边界

```text
L4 应用层 apps/*           薄层，只做组合与编排，不造轮子
   品牌展示站（SSG 静态导出）：rheem-cn / ruud-cn / everhot-cn / 集团官网 / 未来新品牌
   业务应用（SSR/动态）：瑞诺瓦问诊 / 客户门户 / 设计师台 / 经销商台 / 业务控制台

L3 品牌主题层 packages/tokens   多品牌的"灵魂"，一套组件 + N 套品牌皮肤
   每品牌一份深度 token（色彩梯度/字体阶梯/间距密度/圆角/阴影/图形语言/动效节奏）

L2 设计系统层 packages/ui       一等公民，品牌无关、token 驱动的组件库
   primitives -> components，支持品牌级变体（不止换色，可换形态性格）

L1 契约与领域层 packages/contracts + packages/domain   单一事实源
   OpenAPI（contracts/openapi）-> 生成 client（packages/generated-client）+ 生成类型
   前后端永不漂移；换前端框架/加移动端时后端契约不动
```

共享的是骨架与质量基线，不是长相。L1/L2 共享让每个品牌站从第一天就站在世界级工程质量线上（响应式、可访问性、SEO、性能、导航交互）；L3/L4 差异化让每个品牌表达独立性格与独立页面编排。两者不矛盾，差异化正是靠共享底座才做得起。

### 2.2 两种品牌接入模式

终态：所有品牌官网都进深度托管，由我们重新开发上线，统一进 Nx + Next 设计系统、共享 L1/L2/L3。这是平台对"世界级品质 + 多品牌可持续扩张"的终极保证。

| 模式 | 适用对象 | 接入方式 | 平台职责 |
|---|---|---|---|
| 深度托管（终态，唯一长期形态） | 集团官网、瑞诺瓦、Rheem-cn、Ruud-cn、Everhot-cn、未来新品牌、业务应用 | 进入 Nx + Next 设计系统，重新开发，共享 L1/L2/L3 | 全权开发、统一升级、世界级质量基线 |
| 外链/嵌入（临时占位，过渡态） | rheem.com.cn、ruud.com.cn 现有旧站 | 暂时保留旧站，仅注册接入，不投入开发 | 品牌注册、统一入口、互转跳转、留资/问诊回流 |

定位说明：

- 外链/嵌入只是过渡占位。rheem.com.cn、ruud.com.cn 的现有旧站在我们重新开发的新站上线前临时接入，避免空窗；新站上线即下线旧站、切换为深度托管。
- 终态目标：所有品牌官网（含 Rheem、Ruud）都由我们重新开发为深度托管站点，进入设计系统统一品质与扩张能力，不长期保留任何外链旧站。
- 实地抓取的 rheem.com / ruud.com 真实 VI（第 6 章）是新站重开发的设计依据，不是"保留旧站"的理由。

### 2.3 品牌扩张机制（新增品牌 = 配置，不是开发）

新增一个品牌的标准动作：

1. 在 brand-registry.json 登记品牌（slug / 中英文名 / 域名 / type / token 路径 / app 路径 / 互转关系）。
2. 新建 packages/tokens/<slug>.css 深度品牌 token（基于品牌真实 VI）。
3. 深度托管（终态标准动作）：用 Nx 代码生成器从模板生成 apps/<slug>，复用 L2 组件 + L3 主题，只填品牌内容与页面编排，重新开发上线。
4. 外链（仅过渡占位）：在 product_modules 注册表登记身份、namespace、目标域名与 cross-link，临时接入旧站；新站开发完成即切换为深度托管并下线旧站。
5. 跨链接关系（集团官网 ↔ 品牌站 ↔ 瑞诺瓦问诊 ↔ 兄弟品牌站）自动按注册表生成。

禁止：复制粘贴另一个品牌站的代码改字。品牌差异通过 token + 内容 + 编排表达，不通过 fork 代码。

### 2.4 品牌 logo 与归属规则

- 各设备品牌站与集团官网以本品牌 wordmark 为第一视觉；统一标注 Powered by Rhautt Comfort。
- 赋能线豁免：瑞诺瓦 AI 问诊 / 瑞诺瓦舒适家居管理平台 / Rysnova 暖通 BIM 作为中立第三方行业软件，不标注 Powered by Rhautt Comfort，不冠集团/设备品牌主 logo（理由见 1.1 形态中立）。guard 的 `Powered by Rhautt Comfort` 规则只约束设备品牌站与集团官网，对赋能线豁免，避免误报。
- 设备品牌站禁止以 Rhautt Comfort 或 瑞诺瓦 作为主 logo。
- 集团官网只展示集团层面品牌授权关系，不拥有 Rheem/Ruud/Everhot 的品牌内容；各品牌站内容归各自品牌所有。

---

## 3. 入口与应用架构

下表按 2.0 拓扑分两类：独立网站（集团官网、瑞诺瓦、各品牌官网，可独立上线）与中枢管理应用（经销商台/业务控制台/员工入口等运营平面）。Rysnova 是可挂接的独立软件体系，既有自身工作台，也可嵌入其他站点。

| ID | 应用路径 | 当前面 | 受众 | 风格 | 核心职责 | 不允许偏离 |
|---|---|---|---|---|---|---|
| public-portal | apps/public-portal | public/index-ready.html | C 端 / 合作伙伴 / 行业 | 集团门户 | 集团介绍、设备品牌授权、瑞诺瓦系统品牌、案例、问诊与各入口 | 不能改成控制台，不能丢企业介绍/品牌故事/品牌站入口 |
| consumer-diagnosis | apps/consumer-diagnosis | public/pain-diagnosis.html | 终端业主 / 成交场景 | C 端轻咨询 | 痛点采集、AI 诊断、三档方案、预算/月供/ROI、留资进 CRM | 保持 C 端转化语言，不做工程后台 |
| customer-portal | apps/customer-portal | public/customer-view.html | 已签约/施工/售后客户 | 客户服务门户 | 方案、报价、订单、施工节点、验收、保修、IoT 交接状态 | 不暴露内部经营后台 |
| designer-workbench | apps/designer-workbench | public/designer.html | 暖通设计师 / 销售设计协同 | 专业轻量 | 2D 平面、设备/管路/BOM、报价、促销、客户分享 | 不接管 Rysnova 的 BIM 深化职责 |
| rysnova-bim-workbench | apps/rysnova-bim-workbench | public/rysnova-bim-designer.html | 技术支持 / 经销商技术团队 | 企业级工程工具 | BIM 深化、系统图、施工图、BOM、Revit/CAD、复杂方案 | 不是 C 端，也不替代设计师轻工具 |
| dealer-workbench / business-console | apps/dealer-workbench、apps/business-console | public/business-console.html、public/staff-portal.html、public/login.html | 经销商 / 门店 / 总部 / 员工 | 企业级运营 | 登录、角色路由、多租户 CRM、报价、产品、促销、施工、总部汇总 | 必须按租户/经销商/门店/角色隔离，不混入 C 端主路径 |
| 设备品牌站 | apps/rheem-cn、apps/ruud-cn、apps/everhot-cn | 各站 public/index.html | 各品牌 C 端 / 行业 | 各品牌独立 VI | 品牌展示、产品矩阵、互转入口；留资回流瑞诺瓦问诊 | 各站独立品牌为第一视觉，可独立域名部署 |

兼容入口 public/index.html 仅作 legacy compat，不作产品主入口。

### 3.1 双栖产品模块边界

瑞诺瓦与 Rysnova 可被集团官网导流/嵌入，但保留独立产品、独立数据、独立 API owner 和独立上线能力：

| 模块 | dataNamespace | apiNamespace | standalone alias | 独立上线要求 |
|---|---|---|---|---|
| 瑞诺瓦 AI 问诊 | rysnova | /api/v2/diagnosis | /rysnova、/rysnova-ai、/rysnova-diagnosis | 独立 app shell、独立 logo 策略、外部域名部署证明 |
| Rysnova 技术支持 / BIM | rysnova-bim | /api/v2/rysnova-bim | /rysnova-bim、/rysnova-bim-bim、/rysnova-bim-workbench | 同上 |

共享 tenant / dealer / store / user / audit / outbox / object storage / workflow / CRM / 报价 / 生命周期底座是允许的，但必须保留 moduleNamespace / dataNamespace / productNamespace，为未来独立拆库迁移和单独部署留路径。

---

## 4. 核心业务闭环

```text
Flow 1 · C 端获客到成交
  集团官网 -> 瑞诺瓦 AI 问诊 -> 痛点采集 -> 三档系统方案
   -> 配置 Rheem/Ruud/Everhot 设备 -> 留资进 CRM -> 销售/设计师跟进
   -> 2D 设计/报价/促销 -> 客户分享与签约

Flow 2 · 设计到交付
  设计师工作台 -> BOM/报价/合同 -> Rysnova 深化
   -> 方案 PDF/系统图/施工图/材料 BOM -> 施工/材料/验收/结算 -> 客户门户可见

Flow 3 · 交付到生命周期 IoT
  合同/交付物 -> LifecycleLink -> installed asset/home/device/warranty/service plan
   -> IoT 控制平台衔接（仅交接）-> 运维/保养/故障/服务工单

Flow 4 · 经销商经营到总部分析
  门店/经销商经营 -> CRM 360/商机漏斗/报价转化/促销/施工交付
   -> tenant/dealer/store/role scope -> 总部跨经销商汇总分析
```

闭环判据：线索 -> 痛点问诊 -> 设计 -> 系统方案 -> 报价 -> 合同 -> 施工 -> 验收 -> 生命周期 IoT 关怀。产品价值由闭环衡量，不由零散页面数量衡量。

---

## 5. 目标技术架构（统一定论）

> 重要：本章统一历史文档分歧。旧 PRD-CURRENT.md 正文将后端写为 Express + MongoDB，但 contracts/architecture/rhautt-nexus-target-architecture.json 已把目标态定为 NestJS + Fastify + Postgres。本宪章以架构契约为准，确定下列目标态。Express/JS 主干降级为迁移期兼容主干，不是终态。

### 5.0 不可变工程执行契约

1. **技术栈锁定**：生产前端固定为 Nx + pnpm + TypeScript + Next.js + React；生产后端固定为 TypeScript + NestJS + Fastify + TypeORM；数据与工作流组件仅限本章及机器架构契约已经列明的 PostgreSQL、MongoDB、Redis、对象存储、Temporal + Outbox。不得另行引入其他前端框架、后端框架、编程语言、ORM、数据库或消息技术。Express/JavaScript 仅作为迁移期兼容主干，不得承载新增业务逻辑。任何技术栈变更必须先修订本宪章和机器架构契约，并取得项目所有者明确批准。
2. **前后端数据边界锁定**：前端只能调用 OpenAPI 已声明并由后端实现的 `/api/v2/*` 接口，优先使用 `packages/contracts` 生成客户端。前端不得持有数据库连接串或凭据，不得引入数据库驱动/ORM，不得执行 SQL/数据库查询，不得直连 PostgreSQL、MongoDB、Redis 或对象存储；文件访问只能经过后端授权接口或后端签发的最小权限时效 URL。所有业务数据读写必须由后端完成，并执行认证、授权、tenant scope、审计和错误处理。
3. **软件开发流程锁定**：每个领域迁移必须依次完成需求与 owner 确认 → OpenAPI/DTO 契约冻结 → 合同测试 → 后端实现 → 单元/集成测试 → staging 或影子验证 → 切流 → 旧路由退役 → guard/harness/readiness 与证据归档。任一步未通过不得进入下一步，不得以“先实现后补契约”或长期双写代替正式收口。

### 5.1 前端 / 仓库（定稿：NestJS / Nx / Next 世界级栈）

技术栈终态已确认锁定：Nx + pnpm 单体仓 + Next.js/React 前端 + NestJS/Fastify 后端 + PostgreSQL。下列为终态，迁移期保留兼容主干（见 5.2）。

- 工作区：Nx（主）+ pnpm（包管理），TypeScript。退役并存的裸 workspace 配置。
- 框架：Next.js + React，统一一套框架。
- 应用分两类用法：业务应用走 SSR/动态；品牌展示站走 Next 静态导出（output: export）——既统一技术栈与组件库，又保留静态产物可 python3 -m http.server 跑、可独立域名部署。
- 强制：依赖图（graph）+ affected 增量构建 + Nx module boundary lint（apps 不得越界 import）。

### 5.2 后端

- 服务：services/api，NestJS + Fastify，DDD 模块化单体（modular monolith）。
- 迁移期兼容主干：现有 server-production.js（Express/JS）继续承载，逐模块迁移到 NestJS。
- 模块（与生产路由 catalog 分组一一对应）：
  auth / tenant / crm / diagnosis / product-catalog / quote / design / rysnova-bim / delivery / lifecycle / analytics / governance / file-artifact / notification / workflow
- 模块铁律：
  1. 每个生产 API 必须有 module owner。
  2. 每个生产 API 必须先在 OpenAPI 中表达，前端才能使用（契约优先）。
  3. 写 API 必须有 tenant scope、审计、授权、错误码处理。
  4. 模块边界必须映射到生产路由 catalog 分组。
  5. 在领域/租户/工作流/测试边界稳定前，不拆微服务。

### 5.3 数据与工作流

| 组件 | 角色 | 要求 |
|---|---|---|
| PostgreSQL | 核心关系账本（rhautt_nexus schema） | RLS、tenant-aware schema、审计日志、outbox 事件 |
| MongoDB | 问诊/设计/BIM/图纸/方案文档 | 文档型数据，按 moduleNamespace 分区 |
| Redis | 缓存 / 会话 / 限流 / 短时任务态 | 生产 smoke 证明 |
| 对象存储 | PDF/DWG/DXF/BIM/效果图/报价/验收照片 | 按品牌/模块 namespace 前缀 |
| Temporal + Outbox | 持久化工作流与可靠事件投递 | Outbox **已建成**；**Temporal 为规划**（见 §5.5.6 成熟度矩阵） |

容量目标：经销商并发 500+；设计师/销售/服务 2000+；用户/客户档案 100000+。所有生产业务写入必须具备 tenant scope，杜绝跨经销商数据泄露。

### 5.4 多租户隔离（定稿：世界级混合分层模型）

决策：采用世界级 SaaS 通行的混合分层隔离，而非对全部租户一刀切 schema-per-tenant。理由——本平台是大量经销商租户形态（500+，未来更多），与 Salesforce / Shopify 同类；纯 schema-per-tenant 在该形态下迁移/连接池/备份随租户数线性变重，反而拖累扩张。世界级 = RLS 打底 + 可按需物理隔离。

三档隔离，按租户敏感度分配：

| 档位 | 适用对象 | 隔离方式 | 说明 |
|---|---|---|---|
| 标准档 | 绝大多数经销商租户 | 共享 schema + PostgreSQL RLS 行级安全策略 | 每行带 tenant_id，RLS 策略强制隔离；扩张成本线性可控 |
| 强隔离档 | 强合规/数据主权要求的大客户、集团总部数据 | 独立 schema（schema-per-tenant） | 按需从标准档提升，不默认全量 |
| 物理隔离档 | 极端合规或独立运营要求 | 独立数据库/实例 | 预留能力，按合同触发 |

实现要求：

- 所有业务表默认带 tenant_id 并启用 RLS；写 API 必须在租户上下文内执行，杜绝跨经销商泄露。
- 保留 namespace-extractable 能力（架构契约 futureDatabaseStrategy），支持把任一租户/产品域无损抽取到独立 schema 或库。
- 隔离档位由租户元数据驱动，升级隔离档不需要改业务代码。
- 验收：RLS 策略必须有自动化测试证明跨租户查询被拒；强隔离档需有抽取演练证明。

### 5.5 跨板块数据库体系（世界级工业级，宪章级要求）

对应 1.2 两大板块 + 一个底座，数据库体系按"物理隔离交易、统一契约打通"设计。核心信条：库的数量不是关键，库与库之间用一套统一标准对话才是关键——所有跨库交互必须流畅、标准一致、可长期维护。

#### 5.5.1 库拓扑（物理隔离）

| 数据平面 | 归属 | 库形态 | 角色 |
|---|---|---|---|
| 底座主数据库 | Rhautt Nexus 控制平面 | 独立 PostgreSQL 集群 | 主数据/参考数据唯一事实源：租户树、经销商、门店、用户身份、brand-registry、审计、product_module 注册表 |
| 赋能体系库 | 板块二 瑞诺瓦 / Rysnova | 独立 PostgreSQL 集群（RLS 多租户）+ MongoDB 文档库 | 问诊/CRM/BIM 的交易与文档；500+ 经销商租户主战场 |
| 品牌运营库 | 板块一 各品牌站 + 集团官网 | 各品牌独立产品库（挂网，权威源）+ 内容/物料 DAM | 各品牌 SKU/参数/价格/上新的 system of record |
| 分析数仓 | 集团总部（终态锁定） | 独立分析数据库 / 数仓（OLAP） | 跨板块聚合分析；只读、脱敏；严禁建在任何 OLTP 主库上（**状态：规划，见 §5.5.6**） |

铁律：板块之间禁止跨库直连与跨库 JOIN；任何打通只走"已发布契约 + 事件流 + 同步管道"，不允许一个板块的服务直接连另一个板块的库。

两层隔离关系（与 5.4 三档对齐）：物理分库是"板块级"隔离（板块二独立库集群守住板块边界）；板块二库"内部"500+ 经销商租户仍按 5.4 三档隔离（默认 RLS 行级，按需 schema / 物理库）。物理分库不取代 RLS，二者叠加——板块隔离守边界，RLS 守租户。

#### 5.5.2 三条标准数据流（统一接口，便于使用维护）

1. 主数据下行（MDM）：身份/租户/品牌主数据由底座唯一写入，板块侧只读副本或按 CDC 订阅同步；禁止多处写同一主数据。
2. 产品主数据汇聚：各品牌产品库为权威源（独立挂网、品牌方自维护、独立上新/改价）→ 经产品目录服务（product-catalog）按 API/CDC 同步为"可选用目录"→ 瑞诺瓦在其上选用，选中即 PRD 4.5 第①层 verified、可驱动精算。权威源单写收口：认证产品 SKU/参数/价格只由品牌库写，catalog 只持只读同步副本，不二次录入认证产品；同步前按 PRD 4.5 精算参数契约校验工程字段完整性，缺字段降级 calibrated。品牌库改价刷新目录只影响新报价，已发出/待签报价按 PRD 4.9 价格快照锁定不自动跟涨，杜绝"一物两价"。瑞诺瓦只持只读订阅，不写品牌产品。
3. 分析上行：各库通过 CDC/ELT 单向抽到集团分析数仓 → 总部跨板块聚合分析（我方产品占比、转化漏斗、品类渗透，对应 PRD 4.6 情报）；总部只见聚合/脱敏，不见单一经销商明文经营隐私（守 2.1 铁律与 1.1 阳谋"安全感"承诺）。

物理隔离守住"写入与交易"（OLTP），三条流守住"打通与选用"（OLAP/同步）。集团分析与跨库选用因此与物理隔离不冲突。

#### 5.5.3 统一接口与标准（本次宪章级新增重点）

为保证"接口流畅、标准一致、易维护"，所有跨库/跨板块交互遵守同一套标准，不允许各库各自发明：

- 一套契约：所有跨板块交互走 OpenAPI 已声明的 API + 统一事件信封（event envelope）；不存在私有点对点协议。
- 统一标识：跨库实体用全局统一 ID 规范（tenant_id / dealer_id / store_id / product_id / brand_id 全平台同义同形），主数据 ID 由底座签发，板块不得自造同义主键。
- 统一事件总线：事务性变更经 outbox → 事件总线（含 schema registry 版本化事件），消费方按契约订阅；事件结构变更走兼容演进，不破坏既有消费者。事件总线选型在 P3/P5 定终态（候选 Kafka / NATS / Redis Stream），与 Temporal+Outbox 协同：Temporal 管编排、总线管跨板块事件分发。
- 统一数据契约与字典：跨库共享字段（金额单位、币种、时间戳 UTC、枚举、行政区划编码）定义在共享数据字典，所有库引用同一字典；杜绝口径漂移。
- 统一同步语义：CDC/ELT 管道幂等、可重放、带水位（watermark）与对账（reconciliation），保证最终一致且可审计。
- 可维护性：所有库 schema 版本化迁移（expand-contract 零停机）+ 迁移进 CI 门禁；跨库接口契约纳入 guard，契约不一致即红灯。

#### 5.5.4 工业级运行要素

> **状态提示**：本节多为**规划态**运行要素（HA/DR、故障切换、PITR、pgbouncer 隔离等尚无运行实现）；逐项现状以 §5.5.6 成熟度矩阵为准。

- OLTP/OLAP 分离：每库 OLTP 主库 + 只读副本；分析一律走副本/数仓，不在主库跑报表。
- 高可用：主从复制 + 自动故障切换；连接池（pgbouncer）按板块隔离，单板块打满不拖垮其他板块。
- 容灾备份：跨可用区部署，明确 RPO/RTO，PITR 时点恢复 + 定期恢复演练（备份必须验证可恢复，不是只备不验）。
- 安全合规：静态加密 + PII 列级加密 + 审计；板块二 RLS 多租户；分析层脱敏。落 5.3 隔离与第 5.3 章（PRD）中国合规。
- namespace 可抽取：保留 5.4 的 namespace-extractable 能力，任一板块/产品域可无损拆库迁移或独立部署。

#### 5.5.5 验收（数据库体系）

- 跨板块交互 100% 走契约 API/事件，无跨库直连；guard 校验无跨库连接串。
- 主数据单写源：同一主数据仅底座可写，自动化测试证明板块侧为只读副本。
- 产品目录同步：品牌库改价/上新后，瑞诺瓦可选用目录在约定时延内刷新，有对账报告。
- 分析数仓：总部分析取自数仓且脱敏，跨租户明文不可达，有测试证明。
- HA/DR：故障切换演练 + 备份恢复演练（PITR）留证。

#### 5.5.6 能力成熟度矩阵（诚实化 · 现状 vs 规划）

> **诚实化原则（P3 · 宪章级）**：本章 5.3 / 5.5 描述的是**目标终态架构**。其中相当一部分为**规划态**，尚未落地运行实例。为杜绝"对外声称已建成、被要求展示运行实例即下不来台"的信任风险，此矩阵是**唯一权威的现状口径**：凡本章正文与本矩阵冲突，**以本矩阵为准**。对外尽调/推广材料引用架构能力时，**必须按本矩阵标注 已建成 / 进行中 / 规划**，不得把规划态表述为现状。
>
> 状态定义：**已建成** = 有运行实现 + 自动化证据（测试/guard/smoke）；**进行中** = 有实现但未默认启用或未完成演练；**规划** = 设计意图，尚无运行实现。

| 能力 | 状态 | 证据 / 落地里程碑 |
|---|---|---|
| PostgreSQL 核心账本 + RLS 行级多租户隔离 | **已建成** | `tenant-isolation.test` + `postgres-rls-behavior` guard；跨租户查询被拒有测试证明 |
| Outbox 事务性事件 + 至少一次投递 + 重试/死信 | **已建成** | `event-bus.service` + 单测；跨板块只经事件总线不直连 |
| Redis Stream 事件驱动（消费组互斥投递） | **进行中** | P0-2 已实现（`EVENT_BUS_DRIVER=redis` opt-in），**默认仍 inprocess**；真实 Redis 烟雾 + E2E 通过；未设为生产默认 |
| 签单等关键动作的即时催投（同步实时化） | **已建成** | P2-4 `kickDispatch` + 4 单测；可见反应从 ≤5s 压到毫秒级 |
| MongoDB 文档库 / Redis 缓存 / 对象存储 | **已建成** | 生产 smoke；按 namespace 分区 |
| 产品目录 verified/calibrated 分层 + 价格快照锁定 | **已建成** | P1 精算链 + 报价快照；改价不跟涨已发出报价 |
| schema-per-tenant 强隔离档（按需物理隔离） | **规划** | 仅保留 `futureDatabaseStrategy` namespace 可抽取能力；**未做抽取演练** |
| Temporal 持久化工作流编排 | **规划** | 当前编排由进程内调度器 + Redis Stream 承担；**未接入 Temporal** |
| 事件总线终态选型（Kafka / NATS） | **规划** | 当前为 Redis Stream / inprocess；Kafka/NATS **未落地**（本季度明确不做） |
| OLAP 分析数仓 + CDC/ELT 分析上行 | **规划** | **未建数仓、无 CDC 管道**（本季度明确不做）；跨板块聚合分析尚未实现 |
| 板块级物理分库（独立库集群） | **规划** | 当前单库 + RLS 承载；**未做物理分库**（模块边界未到临界，见进化方案 §0） |
| HA/DR：主从复制 + 自动故障切换 + PITR 恢复演练 | **规划** | **无故障切换/恢复演练留证**；容灾要素为设计意图 |
| pgbouncer 按板块连接池隔离 / schema registry 版本化事件 / PII 列级加密 | **规划** | 设计意图，尚无运行实现 |

> 维护规则：能力状态变更（规划→进行中→已建成）**必须同时更新本矩阵并附证据链接**；`guard:charter-maturity` 校验本矩阵存在且规划项如实标注，防止"偷偷把规划写成已建成"。

---

## 5.6 前端 GEO / 机器可读层（宪章级，全站强制）

定位：本平台所有对外站点（集团官网、Rheem/Ruud/Everhot 品牌站、瑞诺瓦 C 端入口）是面向 AI 生成式引擎被抓取、被理解、被引用的内容资产，不只是给人看的页面。GEO（Generative Engine Optimization）友好是一等公民工程约束，与可访问性、性能同级，由 CI 门禁强制，不依赖个人自觉。

原则（不可动摇）：

1. 服务端可读优先：对外站首屏与核心内容必须存在于服务端 HTML 源码中，不得依赖客户端 JS 渲染才出现。AI 爬虫普遍不执行或弱执行 JS，"看源码即得内容"是被引用的前提。静态站（python http.server 可跑）天然满足；React/Next 区一律走 SSR/SSG，禁止核心内容纯 CSR。
2. 结构化数据强制：每个对外页面必须输出 Schema.org JSON-LD（application/ld+json），让 AI 把内容识别为结构化事实而非猜测。最低覆盖：
   - 首页：Organization（品牌归属瑞合瑞德集团、logo、sameAs）+ WebSite。
   - 产品/列表页：Product / ItemList（型号、类目、品牌）。
   - 支持/FAQ 页：FAQPage。
   - 文章/新闻：Article。
   品牌归属链（Everhot → Rhautt Comfort）必须在 Organization 的 parentOrganization 或 brand 字段显式表达。
3. 语义化骨架：每页唯一 h1、标题层级不跳级、使用 header/nav/main/section/article/footer 地标元素、lang 属性正确、图片 alt 全覆盖。
4. 元信息完整：每页 title + meta description + rel=canonical + Open Graph（og:title/og:description/og:image/og:type）+ Twitter Card，缺一不可。
5. 抓取入口齐备：每个站点根必须有 robots.txt（显式 allow 主流 AI 爬虫：GPTBot、OAI-SearchBot、PerplexityBot、ClaudeBot、Google-Extended，且指向 sitemap）与 sitemap.xml（覆盖全部可索引页面，用各品牌自有生产域名）。
6. 同源生成：JSON-LD、sitemap、OG 元数据由内容/token 源同源生成，内容后台上传型号后自动刷新，杜绝"页面改了结构化数据没改"的漂移。
7. 平台级覆盖（非单站）：GEO 门覆盖 brand-registry.json 中全部对外站（type ∈ group / brand-site / consumer-app），逐站校验。新增品牌登记即自动纳入门禁（新增品牌=配置，不是改门禁脚本）。已登记但尚未建成 public 的对外站标记为 pending（显式追踪，不阻断），一旦建成立即强制。内部工作台 / 平台（dealer / workbench / console）不计入对外 GEO 门。

验收（GEO 门）：

- 对外页面 JSON-LD 覆盖率 100%，且 schema 类型与页面用途匹配（产品页必须有 Product/ItemList）。
- 每页 canonical / OG / Twitter Card / 唯一 h1 / lang 全部存在；图片 alt 覆盖率 100%。
- 站点根 robots.txt 与 sitemap.xml 存在且 sitemap 链接全部可达（无死链）。
- 核心内容在禁用 JS 的抓取下仍可见（SSR/SSG 或静态），有抓取快照留证。
- 上述检查纳入 guard，缺失即红灯，禁止上线。

---

## 6. 品牌 VI 标准（实地抓取，2026-06-24）

下列数据来自当日实地抓取官网源码，不是记忆。深度 token 将基于此构建（当前 packages/tokens/*.css 仅约 10 行占位，必须做深）。

### 6.1 Rheem（rheem.com 实测）

- 技术参照：Vike（React SSR）+ 组件化设计系统，组件统一 Rmc 前缀（RmcAccordion / RmcViewToggle / RmcSpinner / RmcImageAsync），设计 token 用 --rmc- 命名空间。
- 实测 token：--rmc-icon-toggle-color: #1b365d（品牌藏青）。
- 主色板：藏青 #1B365D、近黑 #101828、红色强调 #CF2E2E。
- 字体：Rock Salt（手写体，特定强调）+ 系统无衬线正文。
- 气质：克制、专业、工程感。

### 6.2 Ruud（ruud.com 实测）

- 技术参照：WordPress + 自有主题 ruudnet（/wp-content/themes/ruudnet/theme.css）。
- 主色板（按出现频次）：青 #50C8E8、亮青 #3EB5D4、暗红 #8B0E04 / #7A212E / #BD1305、中性灰 #BDBDBD / #4E5758。
- 字体：签名手写体 a_love_of_thunder + Arial 正文。
- 气质：硬朗、承包商/经销商向、视觉更跳。

### 6.3 Everhot（复刻 Rheem 架构）

- 架构与页面编排复刻 rheem.com 的三受众模式（homeowners / commercial / professional），产品型号后台上传。
- 品牌 token 独立，与 Rheem 区隔；logo 用 Everhot wordmark，禁用 Rheem 主 logo。

### 6.4 token 体系要求

每个品牌 token 做到数百变量级，覆盖：色彩梯度、字体阶梯、间距密度、圆角、阴影、图形语言、动效节奏。三层 token 架构：primitive -> semantic -> component。这是品牌差异化的物理载体，也是 L3 主题层的落地产物。

### 6.5 设计系统雄心（定稿：世界级标准）

决策：按世界级标准建设设计系统，不止做"够用的内部组件库"。这是平台多品牌可持续扩张的核心资产，也是经销商物料下载需求的正解。

交付物：

- Storybook 文档站：packages/ui 全组件可视化文档，含 props、状态、用法、可访问性说明。
- 品牌主题切换预览：同一组件在 Rheem / Ruud / Everhot / 集团 / 新品牌主题下实时切换预览（L3 token 驱动）。
- 可视化回归测试：组件与关键页面的截图基线对比，防止 UI 回归（接入 Playwright 视觉验收）。
- 品牌级组件变体：组件不止换色，可按品牌切换形态性格（边框/圆角/密度/动效）。
- 经销商物料同源生成：各品牌 UI/VI/SI 与市场物料从同一套 token + 组件生成，经销商按品牌权限下载；物料与线上站永远同源，不会出现"下载的物料和官网不一致"。
- token 三层架构落地：primitive -> semantic -> component，配套构建产物（CSS 变量 + TS 类型）。

验收：新增品牌时，Storybook 自动出现该品牌主题预览；物料下载内容与线上渲染一致性有自动校验。

---

## 7. 治理与质量门

- 生产守卫：scripts/agent-guards/*（命名一致性、门户架构边界等）。
- 架构 harness：audit/*-harness.js（arch / consolidation / integrity / operational / evolution）。
- 生产 readiness：test/production-readiness/*。
- 契约门：contracts/openapi/rhautt-nexus-v2.openapi.json 与代码同源（NestJS @nestjs/swagger 自动生成）。
- GEO 门：scripts/agent-guards/geo-readiness-check.js 强制第 5.6 章的机器可读层要求（JSON-LD 覆盖、canonical/OG、robots.txt/sitemap.xml、唯一 h1、alt 覆盖、SSR/静态可读）；任一对外页面缺失即红灯，禁止上线。
- 治理记录：governance/（agent-charter、locked-goal、quality-findings、task-board）。

生产上线前必须提供：npm run guard:all、npm run harness:all、npm run test:production-readiness、npm run guard:geo（GEO 机器可读层报告）、真实 Postgres/Mongo staging 压测报告、浏览器视觉验收截图。

---

## 8. 重构路线：保留 / 迁移 / 淘汰

必须保留：官网原产品架构与企业介绍、品牌站入口、瑞诺瓦问诊 C 端逻辑、设计师 2D 成交链路、Rysnova BIM 能力、多租户经营后台与总部汇总、生命周期 IoT 桥、已跑通的 guard/harness/test 思路、packages/（tokens/ui/contracts/domain/generated-client）共享层、三个设备品牌站资产。

必须迁移/收敛：public/ 约百个 HTML 按 active(10) / migration-candidate(21) / archive(16) / static-inventory(58) 分类消化（依据 docs/PUBLIC-SURFACE-FUNCTION-PRD-INVENTORY.md）；路由向 catalog + facade 归属收敛；engine 从散工具收敛为 quote/design/comfort-system/rysnova-bim/lifecycle 领域服务；前端调用统一到 v2 API 契约；报价从前端硬编码走向后端成本/税费/毛利/促销模型。

必须淘汰/隔离：Express 主干逐步迁 NestJS；并存的裸 pnpm-workspace 配置（统一到 Nx）；Electron、多余 Dockerfile 变体、src/(老 jsx)、frontend/(v2 js) 整体移入 legacy/ 隔离，迁移验证后删除。

不建议：现在整套换 Java/Go/Rust 从零重写。理由——当前主要风险是产品边界/owner/legacy 面/数据库生产化/测试门禁未闭环，不是 Node 表达力不足。Go/Java/Rust 留给未来独立边界服务（IoT 高并发网关、异步 BIM/渲染任务、报表计算、遥测处理）。

未获产品确认前，candidate/archive/static 页面不得挂入生产导航，也不得删除。

---

## 8.1 代码侧反向审计（防止误删已实现能力）

PRD 文字层只抽象描述了部分后端能力，存在"代码里做了但 PRD 没记录"的盲区。为防止重构时误删，已建立以代码为真相的反向审计：

- 审计脚本：audit/reverse-capability-audit.js（仅 Node 内置模块），输出 audit/reverse-capability-audit-report.json 与 .md。
- 首次扫描结果（2026-06-24）：后端共 193 个资产 —— core-engine 93、engine 14、route 56、model 30。
- 已有高质量归属资产：server/modules/routeOwnership.js 已登记 225 条 API 路由前缀的 owner（含 NestJS 迁移目标），是后端 API 侧的事实台账，宪章正式引用之。
- public/ 页面侧已有逐页台账：docs/PUBLIC-SURFACE-FUNCTION-PRD-INVENTORY.md（105 页全覆盖）。

审计暴露的盲区（重构前必须人工裁定，不得在未裁定前删除）：

| 类别 | 数量 | 处置要求 |
|---|---:|---|
| 无宪章模块归属 (UNMAPPED) | 29 | 逐个裁定归入某领域模块，或标记废弃 |
| 归属模糊 (AMBIGUOUS，命中多模块) | 21 | 人工确认主 owner，消除跨域耦合 |
| 疑似死代码 (引用<=1) | 33 | 确认是否仍被使用；废弃前需证明业务价值已迁移 |

重点关注项（疑似未记录但可能有价值的能力）：IoTPlatform、DigitalTwinEngine、LLMDiagnosisEngine、SmartBrainEngine、VoiceInteractionEngine、TriEnergySystem、CFDSimulationEngine、TechnicalDeliveryGenerator、ChinaClimateDB / ChinaCitiesDatabase、FissionTrackingEngine（裂变追踪）、ChannelManagementEngine（渠道管理）。这些在宪章正文未单独记录，重构资产盘点时必须逐个判定 keep/migrate/archive/delete。

server/core 存在多代并存（如 PainPointDiagnosisEngine 与 PainPointDiagnosisEngineV3、QuotationEngine / QuotationEngine-v2 / QuoteEngine / ValueBasedQuotationEngine、RoleSystem 与 RoleSystemV2、LoadCalculationEngine 与 LoadCalculationEngineV3），属于典型的"过程混乱"遗留，需在领域服务收敛时择一为准、其余归档。

能力解耦与重组蓝图：实测 107 引擎/1908 方法、56 路由/599 端点，已产出三层重组方案（领域业务 A / 计算内核 B / 平台基础设施 C）与 15 模块能力归属表，详见 docs/CAPABILITY-DECOMPOSITION-AND-RECOMPOSITION.md（提取工具 scripts/capability-extract.js）。

---

## 8.2 资产处置裁定结论（2026-06-25，REVIEW 已清零）

第 8.1 节暴露的盲区已逐项裁定完毕。裁定不靠文件名猜测，而是用动态接线真相源交叉验证（生成器 scripts/asset-ledger.js + scripts/ref-recount.js，台账 audit/asset-ledger.md）：

- engineRegistry.js / EvolutionMechanism.js：引擎懒加载注册表，登记即活跃 → KEEP。
- productionRouteCatalog.js：路由动态挂载清单，登记即活跃。
- routeOwnership.js：标 legacy-compat 的路由 → LEGACY-COMPAT（过渡兼容，迁移完成后删）。
- ref-recount.json：全仓真实 require/import 接线计数。
- 数据资产白名单：ChinaClimateDB（GB 50736 国标气象参数）等即便零接线也 KEEP。

关键纠偏：反向审计的静态引用计数会漏判两类动态接线（注册表懒加载、catalog 动态挂载），导致大量活跃代码被误判为死代码。裁定层据此把 65 个 REVIEW 全部消解，无一误删风险项。例如 VoiceInteractionEngine 是浏览器端引擎（EnterpriseClosedLoopEngine 注释明确 Node 侧跳过加载），不是孤儿。

后端 193 资产处置终态（接线一致性 + 治理一致性双重校正后）：

| 处置 | 数量 | 含义 | 物理动作 |
|---|---:|---|---|
| KEEP | 158 | 活跃能力，按领域迁入 A/B/C 三层 | 迁移到对应 NestJS 模块/内核/infra |
| MIGRATE | 14 | 平台基础设施(10) + 仍活跃登记的旧版引擎(4，先切引用再退役) | 剥离 infra / 切引用后退役 |
| LEGACY-COMPAT | 13 | 过渡兼容路由（含 3 个上帝路由的承接面） | 端点迁入新模块后删 |
| GOVERNED-RETIRE | 3 | 已纳入 legacy-fusion-registry 退役矩阵的旧版引擎 | 服从 12 门治理流程 |
| SPLIT | 3 | 上帝路由 business-domain/core-api/supreme-api | 按领域拆散后删 |
| ARCHIVE | 2 | 真孤儿（已归档） | 已移入 legacy/ |

两条一致性校正（防止台账与运行时/治理矛盾）：

1. 接线一致性：旧版引擎若仍在 engineRegistry 活跃登记（如 LoadCalculationEngine / QuotationEngine / ValueBasedQuotationEngine），不得直接归档，降级为 MIGRATE——先把注册表与路由探测引用切到 V2/V3，确认零运行引用再退役。
2. 治理一致性：已纳入 audit/legacy-fusion-registry.json 退役矩阵的引擎（HydraulicEngine / QuoteEngine / RoleSystem），标为 GOVERNED-RETIRE，服从既有 12 门治理流程（替代证据 + 租户隔离测试 + 回滚记录 + catalog 不再依赖），不由本台账单方面归档。

本轮已物理执行：仅 2 个真孤儿（solution-visual-packages.routes 未挂载、Construction 模型零接线）移入 legacy/，guard 与退役矩阵保持全绿。其余按上述治理流程推进。

前端/工程层（apps/packages/frontend/src/根级）处置见 docs/STRUCTURE-ASSET-LEDGER.md。三份台账（后端 193 + public 105 + 结构层）合成全仓资产全集，本宪章据此定稿重构动作。

## 8.3 重点能力引擎显式裁定（防误判为孤儿）

下列引擎在宪章正文未单独记录，易被静态审计误判死代码（懒加载 + supreme-api 动态挂载）。经实测接线确认全部活跃，裁定 KEEP，按领域迁入对应模块；其 HTTP 出口 supreme-api.js 为 SPLIT（上帝路由，端点拆散到 lifecycle/analytics/diagnosis 后删）：

| 引擎 | 裁定 | 目标模块 | 实测成熟度（2026-06-25） |
|---|---|---|---|
| IoTPlatform | KEEP | lifecycle | 业务骨架可用（设备注册/上报/指令/订阅/规则引擎/统计，6 端点已挂），约 50-60%；broker/发现/下发为模拟，状态在内存未落库。与 lifecycle_handoff_only 一致，需补外部 IoT 平台交接契约 + 状态落库 |
| DigitalTwinEngine | KEEP | lifecycle | 数据模型与 BIM→场景解析真实（同步/视图/管路/能耗模拟，twin 端点已挂），约 40-50%；3D 引擎 load3DEngine 为占位、摄像头 AI analyzeCameraImage 为随机数 mock、未落库。需接真三维引擎(Three.js) + 真实/外包摄像头 AI |
| LLMDiagnosisEngine / SmartBrainEngine / VoiceInteractionEngine | KEEP | diagnosis | 问诊 AI 能力（VoiceInteraction 为浏览器端引擎）；迁移期保留，AI 端点随 diagnosis 模块收口 |
| TriEnergySystem | KEEP | analytics | 三能源/能耗碳分析能力 |
| CFDSimulationEngine / TechnicalDeliveryGenerator | KEEP | rysnova-bim | BIM 深化侧 CFD 与技术交付生成 |
| ChinaClimateDB / ChinaCitiesDatabase | KEEP | product-catalog | 数据资产（GB 50736 气象/城市），即便低接线也 KEEP（精算内核权威输入） |
| FissionTrackingEngine / ChannelManagementEngine | KEEP | crm | 裂变追踪 / 渠道管理 |

迁移铁律：标「占位/mock」的部分（IoT broker、3D 引擎、摄像头 AI 随机数）在迁入时必须替换为真实数据源或显式标注 demo，不得当成品上线；已实现的业务编排与数据结构按 B 层纯函数抽取。

---

## 9. 验收原则

1. 产品定位、品牌关系、入口职责与本宪章一致。
2. 每个 surface 都能在四层边界中找到归属，无"无 owner"的孤儿代码。
3. 新增品牌走配置流程（第 2.3 节）跑通，证明扩张是配置而非开发。
4. 契约优先：前端只调用 OpenAPI 已声明的 API。
5. 多租户隔离经过验证，无跨经销商泄露。
6. guard / harness / readiness / 视觉验收全绿。

---

## 10. 关键决策（已定稿，世界级标准）

三项核心决策于 2026-06-24 确认锁定：

| 决策 | 选择 | 落地章节 |
|---|---|---|
| 多租户隔离 | 世界级混合分层：RLS 打底 + 按需 schema/库物理隔离（非全量 schema-per-tenant） | 5.4 |
| 设计系统雄心 | 世界级标准：Storybook + 可视化回归 + 品牌主题切换预览 + 经销商物料同源生成 | 6.5 |
| 技术栈终态 | NestJS/Fastify + Nx/pnpm + Next.js/React + PostgreSQL | 5.1 / 5.2 / 5.3 |

宪章据此定稿。资产盘点台账已产出（见下）：对照宪章已把 public 页面（105）+ 后端资产（193，含 93 个 core 引擎）逐个标 keep / migrate / archive / delete，REVIEW 已清零。当前位置在盘点之后——按 PRD 第 9 章 P1（抽计算内核）起进入代码重构。

注：多租户一项原备选纯 schema-per-tenant，经专业评估后改为混合分层模型——在 500+ 经销商租户形态下，混合模型才是真正世界级且可持续扩张的做法（理由见 5.4）。如需回退纯物理隔离，可在此调整。

---

## 11. 文档收敛映射

本宪章为单一事实源。下列文档降级为历史附录/专题参考，其对外效力以本宪章为准：

| 旧文档 | 收敛后定位 |
|---|---|
| PRD-CURRENT.md | 历史 PRD；产品边界并入本宪章第 1/3/4 章；技术栈以第 5 章为准（修正其 Express/Mongo 终态表述） |
| PRODUCT-SCOPE.md | 历史范围定义；入口分层并入第 3 章 |
| docs/PROJECT-CHARTER-AND-PRD.md、docs/FULL-REWRITE-CHARTER-PRD-TECHNICAL-BLUEPRINT.md、docs/INTEGRATED-PRD-AND-DEV-SPECIFICATION-v5.0.md 等 | 历史 charter/蓝图；有效内容已吸收，作专题参考 |
| docs/RUUD-VI-RESEARCH.md、docs/UI-VI-ARCHITECTURE-RHAUTT-COMFORT.md、docs/RYSNOVA-AI-DIAGNOSIS-C-END-UI-VI-ARCHITECTURE.md | VI 专题参考；标准并入第 6 章（以实测数据为准） |
| contracts/architecture/rhautt-nexus-target-architecture.json | 技术架构机器可读契约（保持权威），与第 5 章互为正文/契约 |
| brand-registry.json、contracts/product-modules/* | 品牌与模块边界机器可读契约（保持权威），与第 2 章互为正文/契约 |

资产级文件的逐个 keep/migrate/archive/delete 处置不在本章，而在专门的资产盘点台账中（本章只做文档层收敛，不替代代码资产裁定）。该台账已于 2026-06-25 产出并定稿，三份合为全仓资产全集：

| 台账 | 范围 | 结论 |
|---|---|---|
| audit/asset-ledger.md | 后端 193 资产 | KEEP 158 / MIGRATE 14 / LEGACY-COMPAT 13 / GOVERNED-RETIRE 3 / SPLIT 3 / ARCHIVE 2；REVIEW=0 |
| docs/PUBLIC-SURFACE-FUNCTION-PRD-INVENTORY.md | public 105 页 | active 10 / migration-candidate 21 / archive 16 / static-inventory 58 |
| docs/STRUCTURE-ASSET-LEDGER.md | apps/packages/frontend/src/根级结构 | 工程层处置 |

故"下一步"不再是盘点（已完成），而是按 PRD 第 9 章 P1→P7 里程碑执行代码重构与迁移。
