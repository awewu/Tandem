# Nexus A/B/C 域映射矩阵

> 治理基线（Phase 0）。把每个 DDD 域 + 端点归位到 A(品牌营销) / B(经销商赋能三件套) / C(共享治理底座)，保证解耦有据、功能无阉割。
> 事实源：`docs/NEXUS-VISION-AND-PRD.md` + MegaPlan（`~/.devin/plans`）。本矩阵是"产品视图↔工程域"的对照，**工程仍按 DDD 域，7P/三件套是挂在域上的心智分类（多对多）**。

## 铁律
- `Product/Price/Brand/Physical` 真相住 **C**（`mdm`/`product-catalog`/`brand-registry`）；A/B **只读消费**。
- 跨域**发事件不互写 OLTP**（经 `mdm/EventBusService` outbox）；引用用全局 ID（`mdm.global_product_id`）。
- 遗留 `server/routes` 为兼容层，逐条迁入对应 NestJS 域，`routeOwnership.js` 标 `migrated-to-nestjs`，保兼容路由至契约测试过再退役。

## 现役 API 域（services/api · 56 控制器 · 335 端点）
| 层 | 子域 | 域/控制器 | 单写/只读 | 事件(生产→消费) |
|---|---|---|---|---|
| **C** | 身份/治理/数据 | auth · tenant · entitlement · mdm · compliance · governance · audit-log · analytics · notification · file-artifact · workflow · dispatch · event-consumers · health · cdp | 主数据单写 | `dealer.success.recomputed`(analytics→A/cockpit) |
| **A** | 营销中枢 | growth(intel/studio/channel/campaign/assets/**geo**/cockpit/experiments) · insight(竞品情报/SoV·按品类) · channel(渠道招募/分层认证/返利毛利闸/绩效) · gtmplan(战役预算MROI/三级OKR) · content(内容工厂:brief→审核→发布·基座4) · activation(活动运营:券/拼团/秒杀/裂变/转介绍) | 只读消费 catalog/brand | `growth.lead.attributed`→B①；`growth.geo.gap_detected`→studio；`growth.copy.approved`→channel/file-artifact |
| **A** | 品牌资产/官网 | brand-registry(brands/brand-sites/site-news/site-inquiry/site-basic-settings/site-product-assignment) · brand · brand-product-category · positioning(定位 messaging house) | 品牌真相单写(registry) | 官网发布→GEO 复测 |
| **A** | 产品(营销读) | product-catalog(public + devices/content/relations 营销读侧) | 只读(真相在 mdm) | schema 输出供 GEO |
| **A** | 社媒/渠道 | wechat-publishing(→收编 channel connector) · site-materials(→assets) | — | `social.post.published`→GEO/归因 |
| **B①** | AI问诊 | diagnosis(painpoints/consult/quote/deposit/reports) · ingress(lead) | 只读 catalog/packs | 消费 `growth.lead.attributed` |
| **B②** | CRM过程 | crm(leads/customers/pipeline/opportunities/sign) · quote(quotation) · contracts | 只读 catalog | `crm.deal.signed`→C/analytics |
| **B③** | 技术支持 | design · bim · system-packs · delivery(delivery/aftersales/lifecycle) · react-candidate(devices/projects) | 只读 catalog/packs | `delivery.handover.completed`→lifecycle |

## 遗留 server/routes（25 文件 · 309 端点）→ 迁移归位
| 目标层 | 遗留路由 | 备注 |
|---|---|---|
| B② | quotations · quotation-v2 · oneclick-api · threeTier · packagePurchase · customQuotation · crm.js · contracts.js · front-office-runtime(quick-session) | 报价计算/合同/CRM/快速开单 → 合并入 quote/crm/contracts |
| B③ | calculation-api(HVAC全算) · workorders · materials · projects · devices · standards.routes · core-api(设计引擎+house-types户型库) | 计算/施工/项目/设备/标准/户型库 → design/delivery/system-packs |
| A | marketing(优惠券/拼团/秒杀/分销裂变/转介绍；**砍会员/积分/佣金金融**) · promotion.routes | 促销/裂变 → growth/campaign |
| C | reports · exports · ops-runtime · admin.routes · page-aliases · business-domain(验收/结算/IoT运维预测→B③；AI助手→收口Tandem) | 报表/运维/管理/兼容 |

## ⚠️ 遗留独有能力（NestJS 无等价 → 退役前必迁，防阉割）
- `business-domain.js`：验收(acceptance)/结算(settlement) → B③交付；IoT 运维预测(RUL/energy/dashboard) → B③终身；AI助手 → 收口 Tandem。
- `core-api`：户型库 house-types → B①问诊 & B③设计输入；HVAC 设计引擎 → B③（与 hvac-kernels 对齐）。
- `calculation-api`：HVAC 计算全集 → B③（统一到单一计算内核，其余转薄封装）。

## 被物理删除待恢复（`b9377fa`，Phase 3）
后端：`rysnova-bim`(50) · `design`富引擎(dxf/calc-gate/hot-water/auto-route) · `ai-design` · `lifecycle`富 · `delivery`富(construction/esign) · `governance` controller/service · `aftersales` 独立模块。
前端：dealer-workbench 的 `bim/crm/design/aftersales` 页 · app `consumer-diagnosis`(B①获客钩子,提 Phase1) · `brand-console`/`customer-portal`(核对是否被 everhot/rheem/ruud 重构)。
