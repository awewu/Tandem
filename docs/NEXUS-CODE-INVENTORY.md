# Nexus 代码明细清单（实查·剥离后现状）

> 本文件是实查代码产出的**代码资产明细清单**，反映客户赋能剥离后的真实状态。
> 版本：2026-08-06。数据来源：`services/api/src/modules`、`app.module.ts`、`apps/`、`packages/`、`database/postgres/migrations`。
> 状态：✅活跃(营销中台已挂载) · ⏸️剥离(客户赋能·停挂载·目录留存·可逆) · 🧩基础设施 · 🚧未接线/占位。

## 0. 概览
- 后端 NestJS 模块目录：31（含 `common` 基础库）。其中**活跃挂载 24** · **客户赋能剥离 5** · 未接线 1(react-candidate) · 共享库 1(common)。
- 前端应用：6（dealer-workbench + 4 品牌站 + public-portal）。
- 共享包：ui / shared-auth / engines（+ domain/hvac-kernels、tokens 相对引用）。
- 暖通技术内核：9 域（+__tests__）。
- 数据库迁移：75（001–075，curated SQL·RLS FORCE·rhautt_app 非超级用户）。

---

## 1. 后端 NestJS 模块清单（services/api/src/modules）
| 模块 | .ts 文件 | 状态 | 十模块归属 | API |
|---|---|---|---|---|
| auth | 20 | ✅ | M10 底座(认证/RBAC) | /api/v2/auth |
| tenant | 5 | ✅ | M10 底座(多租户) | /api/v2/tenants |
| audit-log | 5 | 🧩 | M10 审计 | — |
| compliance | 5 | ✅ | M10 合规(PIPL) | /api/v2/compliance |
| entitlement | 6 | ✅ | M10 商业化 | /api/v2/entitlement |
| mdm | 9 | ✅ | M10 主数据+事件总线 | /api/v2/mdm |
| event-consumers | 2 | 🧩 | M10 事件消费 | — |
| notification | 4 | ✅ | M10 通知 | /api/v2/notification |
| workflow | 4 | ✅🚧stub | M10 工作流 | /api/v2/workflow |
| file-artifact | 10 | ✅ | M3 DAM/资产 | /api/v2/file-artifact |
| governance | 2 | ✅🚧scaffold | M10 治理 | /api/v2/governance |
| common | 13 | 🧩 | 共享库(rls/guards/testing) | — |
| product-catalog | 20 | ✅ | 🛡️M4 产品事实基座(D2) | /api/v2/product-catalog |
| brand-product-category | 5 | ✅ | M4 产品分类 | /api/v2/brand-product-categories |
| system-packs | 5 | ✅ | M4 系统包 | /api/v2/system-packs |
| analytics | 4 | ✅ | M9 度量 | /api/v2/analytics |
| growth | 18 | ✅ | 🗡️M7 需求生成(AI-GEO)+M9 cockpit | /api/v2/growth |
| brand | 3 | ✅ | M3 品牌事实抓取 | /api/v2/brand |
| brand-registry | 17 | ✅ | M3 品牌站管理(39端点) | /api/v2/brand-sites |
| site-materials | 4 | ✅ | M3 站点素材 | /api/v2/site-materials |
| wechat-publishing | 4 | ✅ | M7 社媒发布 | /api/v2/marketing/wechat |
| ingress | 3 | ✅ | M5 获客(接缝·留营销中台) | — |
| diagnosis | 17 | ✅ | M8 获客口 AI问诊(接缝·留营销中台) | /api/v2/diagnosis |
| crm | 5 | ✅ | M5/M8 线索池(接缝·留营销中台) | /api/v2/crm |
| dispatch | 4 | ✅ | M6 线索派单(接缝·留营销中台) | /api/v2/dispatch |
| quote | 8 | ⏸️剥离 | 客户赋能 报价CPQ | (停挂载) |
| design | 5 | ⏸️剥离 | 客户赋能 选型/方案 | (停挂载) |
| delivery | 4 | ⏸️剥离 | 客户赋能 交付+lifecycle+aftersales | (停挂载) |
| contracts | 5 | ⏸️剥离 | 客户赋能 合同 | (停挂载) |
| bim | 4 | ⏸️剥离 | 客户赋能 BIM | (停挂载) |
| react-candidate | 5 | 🚧未接线 | — | — |

活跃挂载(24)：auth·tenant·crm·diagnosis·product-catalog·brand·brand-product-category·brand-registry·compliance·mdm·event-consumers·analytics·governance·file-artifact·site-materials·notification·wechat-publishing·ingress·dispatch·system-packs·growth·entitlement·workflow·audit-log。
剥离(5·客户赋能)：quote·design·delivery(含lifecycle/aftersales)·contracts·bim。

## 2. GEO 护城河资产（growth 模块内·零丢失）
`geo-analyzer.service`(三层可见度) · `geo-engines`(多引擎) · `geo-strategies`(策略库+自进化) · `geo-actions`(受治理动作) · `geo-attribution`(分渠道归因) · `cockpit.service`(北极星/漏斗/geo-loop) · 端点 `/api/v2/growth/geo/*`。脚本 `geo:build` + `guard:geo`。

## 3. 前端应用与路由
### apps/dealer-workbench（营销中台工作台，Next，:5000）
路由(page.tsx)：/dashboard · /accounts · /analytics · /brand · /cockpit · /comfort/[[...section]] · /products · /growth/[[...section]](+/copywriter /materials) · ⏸️/dealer · ⏸️/presale(后两者页面留存但已从导航移除，归客户赋能)。
导航(WORKBENCH_NAV)：驾驶舱 · 品牌官网管理 · 市场增长 · 产品 · 账号权限。
### 品牌站(对外发布产物·静态)
rheem-cn(:5014) · ruud-cn(:5015) · everhot-cn(:5011) · lithnova-cn(:5013) · public-portal(Next :5005)。

## 4. 共享包（packages/）
ui(设计系统·index.ts/tsx 重复待清) · shared-auth(SSO/token) · engines(re-export server/core) · domain/hvac-kernels(9域) · tokens(品牌VI css)。

## 5. 暖通技术内核（packages/domain/hvac-kernels·9域）
hot-water · heating · air-conditioning · fresh-air · load-calculation · hydraulic · quotation · noise · water-system。经 `design.service` 合规闸调用。

## 6. 遗留 Express 表面（server/·待退场）
`server-production.js` 生产入口 + `server/modules/productionRouteCatalog.js`：7 路由组/21 路由，13 条(72%)与 NestJS v2 重复(quotation/calc/crm/exports/marketing/reports…)，属技术债。

## 7. 数据库（database/postgres/migrations·75）
schema `rhautt_nexus`；RLS FORCE + `current_tenant_id()`；app 用 `rhautt_app`(NOBYPASSRLS)，迁移用超级用户；curated SQL(SHA锁·只加新号)。核心：tenants/dealers/stores/users · products(+positioning/asset_refs/content) · brand_product_category · mdm_outbox_events · growth_geo_*/funnel_event(channel)/north_star/dealer_success。

## 8. 关键治理文件
`module-boundary.ts`(活跃边界+plannedApiInterfaces[含剥离的7个dealer模块]) · `governance/permission-domains.json`(D0–D5 六域·D4=客户赋能) · `server/modules/routeOwnership.js`(遗留路由归属)。

## 9. 代码规模（实测·2026-08-06）
| 区域 | LOC | 体积 |
|---|---|---|
| 后端活跃(NestJS 25 模块) | 21,716 | 1.03 MB |
| 前端工作台(dealer-workbench) | 29,993 | 1.23 MB |
| 暖通内核 hvac-kernels(9域) | 6,704 | 239 KB |
| **营销中台核心合计** | **≈58,400** | **≈2.5 MB** |
| 遗留 Express `server/`(待退场·最大技术债) | 48,421 | 1.66 MB |
| 客户赋能剥离(停挂载·可逆) | 2,218 | ~0.1 MB |

后端活跃模块 LOC 前5(占 69%)：growth 5,302 · product-catalog 2,953 · brand-registry 2,404 · auth 2,325 · diagnosis 1,956。

## 10. 从代码反读的产品功能体系
- 🛡️ 护城河(事实基座)：product-catalog + hvac-kernels(9域计算) + brand-product-category + system-packs —— 技术密度最高。
- 🗡️ 矛头(需求生成)：growth(占后端 24%)=GEO全套+文案/舆情/战役/物料+cockpit 北极星。度量与 GEO 同源。
- 品牌资产：brand-registry(品牌站,第3大)+site-materials+brand+wechat-publishing。
- 获客飞轮(接缝·保留)：diagnosis(问诊)+ingress→crm(线索池)→dispatch(派单)。
- 底座：auth(第4大,权限重)+tenant/mdm/compliance/entitlement/audit/file-artifact/notification/workflow。
- 真相：①代码重心与新定位一致(GEO+事实基座+品牌站+获客飞轮≈70%)；②前端(30k)>活跃后端(21.7k)，后端偏薄(CDP/多触点归因/渠道营销缺后端)；③遗留 server(48k)>整个新后端，双栈未收敛=最大减重机会。

_维护约定：模块挂载/剥离、路由增减、规模变化时同步更新本清单。_
