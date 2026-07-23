# Rhautt Comfort Public Surface Function PRD Inventory

> 日期：2026-06-05  
> 状态：重构前页面资产消化清单。  
> 目的：把 `public/` 下 105 个 HTML 页面逐一归类，说明功能价值、PRD 归属、迁移方向和生产门禁。  
> 约束：本文件只定义产品和迁移判断，不批准继续代码开发。任何页面晋级、删除、合并或重写都必须等产品确认后再执行。

## 1. 总结论

当前 `public/` 并不是“没有价值的垃圾页面”，而是多轮开发留下的功能资产池。问题在于它们混合了生产入口、候选模块、历史原型、演示页、跳转页和过期品牌文案。

当前分类：

| 分类 | 数量 | 含义 |
|---|---:|---|
| active | 10 | 当前生产入口或生产兼容入口。 |
| migration-candidate | 21 | 有明确功能价值，应该迁移到生产主入口或后端 facade。 |
| archive | 16 | 有历史参考或局部能力，但 API/品牌/架构不适合直接进入生产。 |
| static-inventory | 58 | 静态库存、演示、跳转页、旧原型或素材页。只作为 PRD/设计/内容素材。 |

核心判断：

- 官网、瑞诺瓦 AI 问诊、客户门户、设计师工作台、Rysnova、员工入口、业务控制台是生产主入口。
- 销售、报价、施工、图纸、Econet/IoT、质量保证、技术支持等页面不能被忽略，它们是功能素材，但必须被主入口吸收。
- 大量旧页面的品牌口径仍停留在“瑞美/瑞诺瓦暖通AI设计平台/智能平台”等阶段，不能直接对外。
- 迁移原则不是删页面，而是抽能力、归 owner、合 API、进测试。

## 2. 用户新增入口需求待确认

用户提出：

1. 官网增加一个轻入口，疑似为“小程序入口”。需要确认正式名称、二维码/AppID、承接路径和展示位置。
2. 官网增加进入 `www.rhautt.com` 的企业工作平台入口。需要确认该域名是否为生产企业平台、是否外链打开、是否与 `login.html` / `staff-portal.html` 合并或并列。
3. 重构后端、数据体系和语言配置按最高标准执行。该要求进入技术栈 PRD，但不等同于马上整体换语言。

待确认前不得继续改首页代码。

## 3. Active 生产入口

| 页面 | 当前功能 | PRD 归属 | 生产判断 | 后续要求 |
|---|---|---|---|---|
| `public/index-ready.html` | 瑞合瑞德集团官网、品牌介绍、案例、问诊入口、客户/员工/Rysnova 链路 | 瑞合瑞德集团官网 | 保留 | 不大改原官网架构；补企业工作平台和轻入口前需确认。 |
| `public/index.html` | legacy 兼容入口 | 兼容入口 | 保留但不做主入口 | 只做跳转/兼容，不承载新 PRD。 |
| `public/pain-diagnosis.html` | 瑞诺瓦 AI 问诊、需求采集、方案、报价、促销、留资 | 瑞诺瓦 C 端问诊 | 保留 | 保持 C 端体验；报价/推荐逻辑后端化。 |
| `public/customer-view.html` | 客户项目进度、合同、施工、服务入口 | 客户项目门户 | 保留 | 接入真实 customer/project/lifecycle 数据。 |
| `public/customer-share.html` | 客户可读方案分享 | 客户分享页 | 保留 | 和报价、客户、方案版本打通。 |
| `public/designer.html` | 2D 设计师工作台、BOM、报价、分享 | 设计师成交工作台 | 保留 | 抽本地目录和报价逻辑到 design/quote facade。 |
| `public/rysnova-bim-designer.html` | Rysnova 3D/BIM 技术支持工作面 | Rysnova 技术支持 / BIM | 保留 | 统一 BIM、图纸、导出、施工交付 owner。 |
| `public/login.html` | 员工与经销商登录 | 员工授权入口 | 保留 | 和企业工作平台入口关系待确认。 |
| `public/staff-portal.html` | 多租户员工入口、角色导航 | 员工/经销商门户 | 保留 | 只链接 active 面和业务控制台，不散链 legacy。 |
| `public/business-console.html` | 多租户业务工作台、CRM、报价、产品、促销、施工、分析 | 业务控制台 | 保留 | 接真实 API、tenant scope、审计和总部汇总。 |

## 4. Migration Candidate 迁移候选页

这些页面有功能价值，但不能原样进入生产导航。它们应该被拆为能力，迁入生产主入口或后端服务。

| 页面 | 已有功能价值 | 目标归属 | 迁移判断 |
|---|---|---|---|
| `public/sales.html` | 销售工作台、客户查询、内容演示、报告、锁客、促销线索 | 业务控制台 / 设计师成交链路 | 高价值。迁入 CRM、销售跟进、内容销售模块。 |
| `public/quotation-pro.html` | 专业报价单、BOM、促销、客户价、材料和服务项 | 设计师 / quote facade | 高价值。报价结构迁入后端成本模型，不保留独立散页。 |
| `public/calculation-demo.html` | 热水、水系统、新风、冷负荷、DOAS、项目完整计算 | design / comfort-system facade | 高价值。作为六大系统计算 PRD 来源。 |
| `public/oneclick-calc.html` | 六大系统一键计算 | design / comfort-system facade | 高价值。作为系统 pack compose 的候选 UI/合同。 |
| `public/doas-demo.html` | DOAS 新风标准、验证、对比 | Rysnova / comfort-system | 高价值。并入新风/全空气专业校核。 |
| `public/device-positioning-demo.html` | 设备安装位置验证和推荐 | design / Rysnova | 高价值。纳入设备布置、安装可行性校核。 |
| `public/house-type-library.html` | 户型库、统计、对比 | 设计师 / 问诊 | 高价值。户型数据应成为共享数据模型。 |
| `public/designer-legacy.html` | 旧设计师大工作台、可视化、反馈、导出 | 设计师 / Rysnova | 有价值但过重。只抽能力，不保留整页。 |
| `public/desktop-layout.html` | 桌面版壳、最近项目、DXF 解析、多个入口 | 入口设计素材 | 仅作桌面/工作台 IA 参考。 |
| `public/bim-viewer.html` | Rysnova BIM 浏览器、项目加载 | Rysnova | 高价值。并入 Rysnova viewer。 |
| `public/cfd-visualization.html` | CFD 气流温度场仿真 | Rysnova | 专业高价值。作为复杂项目高级能力。 |
| `public/construction-management.html` | 施工进度、质量、安全、材料、合同 | 交付 / 业务控制台 | 高价值。迁入 construction/delivery facade。 |
| `public/technical-support.html` | 技术支持团队、结算、材料 | Rysnova / 技术支持 | 高价值。作为技术支持服务台来源。 |
| `public/workorders.html` | 工单管理、诊断转工单 | 生命周期 / IoT / 售后 | 高价值。与 service ticket 和 IoT handoff 合并。 |
| `public/econet-dashboard.html` | Econet 场景、自动化、设备监控 | IoT 生命周期桥 | 高价值。当前主系统只做 handoff，不做实时控制。 |
| `public/customer-journeys.html` | 客户全生命周期、旅程统计和模拟 | lifecycle / CRM | 高价值。作为客户旅程模型来源。 |
| `public/solution-matching-v3.html` | 智能方案推荐、三档方案 | 瑞诺瓦问诊 | 与 `pain-diagnosis.html` 合并，不单独生产。 |
| `public/solution-summary.html` | 方案汇总、workflow complete | 客户分享 / 问诊收口 | 迁入客户报告生成。 |
| `public/quality-dashboard.html` | 风险报告、生产监控、AI 优先级、配置 | 质量门禁 / 运维 | 高价值。作为内部 QA/SRE 页面候选。 |
| `public/agency-agent-demo.html` | 智能代理状态和执行 | 自我进化 / 多 agent 控制面 | 只抽 agent 状态/任务能力，不做 C 端页面。 |
| `public/location-demo.html` | 地理位置、城市/门店定位 | 官网 / 问诊 / 经销商分配 | 迁入线索分配、门店匹配和上门服务区域。 |

## 5. Archive 历史参考页

这些页面含有参考价值，但存在 API 不完整、品牌口径过期、页面职责重复或实现过重的问题。默认不进生产；只能在有明确替代 owner 后抽取能力。

| 页面 | 功能价值 | 不直接生产的原因 | 可抽取内容 |
|---|---|---|---|
| `public/admin-dashboard.html` | 管理后台、门店经营、产品/用户/价格 | 旧后台口径和 API 分散 | 管理指标、价格管理布局。 |
| `public/admin/products.html` | 产品数据库、价格、导入、统计 | API 不完整，权限未闭环 | 产品导入/价格维护需求。 |
| `public/crm-dashboard.html` | CRM 客户、商机、互动、漏斗 | API 不完整，和业务控制台重复 | CRM 360 字段、漏斗动作。 |
| `public/channel-dashboard.html` | 总部渠道赋能、经销商分析 | 旧品牌和数据口径 | 总部汇总、渠道指标。 |
| `public/analytics.html` | 财务/经营 BI | 部分 API 未对齐 | BI 指标体系。 |
| `public/contract-management.html` | 合同模板、电子签、合同统计 | 合同模型未与报价/交付打通 | 合同流程、电子签需求。 |
| `public/material-quotation-system.html` | 材料库、智能报价 | 独立材料报价页，API 不完整 | 材料库和报价结构。 |
| `public/quotation-v2.html` | 智能报价 v2 | 与 `quotation-pro` / active designer 重复 | 报价表单字段和报价项。 |
| `public/ppt-export.html` | PPT 方案导出、文件列表 | 可作为导出能力，不是独立入口 | 客户提案导出格式。 |
| `public/solution-view.html` | 客户方案展示、预约、图纸、报价 | 和客户分享/门户重复 | 客户方案页组件。 |
| `public/mobile-sales-assistant.html` | 移动销售助手 | 旧渠道 API 和演示数据 | 移动销售工作流。 |
| `public/ai-assistant.html` | AI 设计助手 | 旧“AI味”强，API 不完整 | AI 辅助话术和设计解释。 |
| `public/bim-export.html` | IFC/Revit BIM 导出中心 | 独立散页，Rysnova 应统一 | 导出配置字段。 |
| `public/revit-integration.html` | Revit 集成 | 独立散页，插件/后端合同需统一 | Revit family/export 需求。 |
| `public/floorplan-bim.html` | BIM 户型、碰撞、工程量、管道路由 | 过重且部分 API 不完整 | 管道路由、碰撞检查、工程量。 |
| `public/smart-routing.html` | 智能布线 | 旧对标式文案，不适合生产 | 管线自动路由算法需求。 |

## 6. Static Inventory 静态库存页

静态库存不代表无价值。它们大多是内容、原型、演示或跳转页，后续应作为素材进入对应主入口。

### 6.1 C 端、问诊、方案、客户素材

| 页面 | 价值判断 | 目标 |
|---|---|---|
| `public/ai-consultation.html` | 旧 AI 问诊入口，三档方案逻辑素材 | 并入 `pain-diagnosis.html`，不保留独立入口。 |
| `public/pain-diagnosis-v3.html` | 问诊 v3 原型 | 抽痛点/方案逻辑，品牌校正。 |
| `public/package-purchase.html` | 套餐购买和项目信息 | 作为报价/签约后续，不独立上线。 |
| `public/custom-configurator.html` | 定制配置器 | 迁入问诊或设计师配置面。 |
| `public/quick-lock.html` | 快速锁客 | 迁入销售 CRM 和问诊留资。 |
| `public/simple-proposal.html` | 舒适家提案书 | 作为客户报告模板素材。 |
| `public/solutions.html` | 方案库 | 作为方案模板库素材。 |
| `public/solution-matching.html` | 跳转页 | 由 active 问诊替代。 |
| `public/customer-view.html` | 已 active | 见 active 表，不在库存中迁移。 |
| `public/ai-chatbot.html` | AI 客服内容 | 可纳入官网客服或小程序，不做独立页。 |
| `public/help.html` | 帮助中心 FAQ | 可纳入官网/客户门户帮助。 |
| `public/mobile.html` | 移动端入口素材 | 可作为小程序/H5 PRD 参考。 |

### 6.2 销售、营销、渠道、运营素材

| 页面 | 价值判断 | 目标 |
|---|---|---|
| `public/admin/marketing.html` | 营销中心 | 并入业务控制台营销模块。 |
| `public/business-analytics.html` | 智能经营分析 | 并入业务控制台 BI。 |
| `public/marketing-automation.html` | 营销自动化 | 并入营销/触达模块。 |
| `public/marketing-engine.html` | 精准营销引擎 | 抽取千人千面和投放需求。 |
| `public/sales-crm-module.html` | 销售 CRM 对标素材 | 并入 CRM 360。 |
| `public/store-admin.html` | 门店后台 | 并入多租户角色工作台。 |
| `public/hq-admin.html` | 总部后台 | 并入总部汇总分析。 |
| `public/customers.html` | 客户列表 | 并入 CRM。 |
| `public/quotations.html` | 报价单管理 | 并入 quote list。 |
| `public/products.html` | 产品库 | 并入产品/价格管理。 |
| `public/messages.html` | 消息中心 | 并入员工工作台通知。 |
| `public/notifications.html` | 通知中心 | 并入员工工作台通知。 |
| `public/settings.html` | 系统设置 | 并入管理配置。 |

### 6.3 设计、图纸、BIM、技术素材

| 页面 | 价值判断 | 目标 |
|---|---|---|
| `public/technical-drawings.html` | 原理图、布局图、3D 效果图素材 | 高价值。迁入 Rysnova/design renderer。 |
| `public/drawing-engine.html` | 图纸生成系统 | 迁入 Rysnova 图纸 facade。 |
| `public/drawing-sync.html` | 改图联动同步 | 迁入图纸版本/变更影响。 |
| `public/drawing-versions.html` | 图纸版本管理 | 迁入版本历史。 |
| `public/design-review.html` | 多专业协同审查 | 迁入 Rysnova 审查流程。 |
| `public/technical-manual.html` | 技术方案指导书 | 迁入技术交付文档生成。 |
| `public/template-library.html` | 方案模板库 | 迁入模板服务。 |
| `public/workflow-designer.html` | 流程设计器 | 作为内部流程编排素材，不生产。 |
| `public/device-selection.html` | 设备选型跳转 | 由 active designer 替代。 |
| `public/load-calculation.html` | 负荷计算跳转 | 由计算 facade 替代。 |
| `public/bim-advanced-demo.html` | BIM 高级演示 | 仅作演示素材。 |
| `public/3d-walkthrough.html` | 3D 漫游 | 可做客户效果图素材，不作为 P0。 |
| `public/ar-experience.html` | AR 实景体验 | 长期素材，不进生产 P0。 |
| `public/immersive-experience.html` | 沉浸式体验 | 长期素材，不进生产 P0。 |

### 6.4 IoT、运维、服务素材

| 页面 | 价值判断 | 目标 |
|---|---|---|
| `public/construction-dashboard.html` | 施工管理看板，包含施工项目与工单入口 | 迁入业务控制台施工交付模块，不作为独立生产入口。 |
| `public/construction-schedule.html` | 施工排期和进度计划素材 | 迁入交付排期、里程碑和客户可见进度。 |
| `public/delivery-center.html` | 技术交付中心、订单交付文档查询素材 | 迁入 Rysnova 技术交付和客户项目门户。 |
| `public/operation-maintenance.html` | IoT 运维管理 | 作为未来 IoT 控制平台 PRD 输入。 |
| `public/maintenance-schedule.html` | 主动保养计划 | 迁入服务计划。 |
| `public/service-tickets.html` | 维修工单 | 迁入 service ticket。 |
| `public/predictive-maintenance.html` | 预测性维护 | 作为 IoT 平台高级能力。 |
| `public/econet-dashboard.html` | 已列 migration-candidate | 见迁移候选。 |
| `public/rheem-platform-v3.html` | 全生命周期管理旧总览 | 作为生命周期 PRD 参考。 |
| `public/quality-dashboard.html` | 已列 migration-candidate | 见迁移候选。 |
| `public/performance-monitor.html` | 性能监控面板 | 迁入 SRE/运维，不对 C 端。 |

### 6.5 产品、内容、演示和文档素材

| 页面 | 价值判断 | 目标 |
|---|---|---|
| `public/product-presentation.html` | 产品介绍总览 | 内容素材，品牌口径需重写。 |
| `public/product-showcase.html` | 产品展示和平台价值 | 内容素材，不能作为生产官网替代。 |
| `public/four-brand-demo.html` | 四品牌体系演示 | 品牌信息素材，需按最新品牌关系校正。 |
| `public/water-system-demo.html` | Rheem 全屋水系统 | 高价值。迁入系统 pack/水系统页面。 |
| `public/hvac-dashboard.html` | 暖通专业版旧面板 | 静态素材。 |
| `public/index-premium.html` | Premium 旧首页 | 只作视觉素材，不替代官网。 |
| `public/index-v2.html` | 智能暖通 BIM 平台旧首页 | 旧定位，不直接使用。 |
| `public/api-docs.html` | API 文档页 | 作为文档生成需求，不对公网。 |
| `public/ai-accuracy-test.html` | AI 精度测试 | 迁入测试/评估体系。 |
| `public/ai-command-center.html` | AI 指挥中心 | 作为多 agent 控制面素材。 |
| `public/voice-interaction.html` | 语音交互 | 长期能力素材。 |
| `public/location-demo.html` | 位置服务 | 已列 migration-candidate，迁入门店/服务区域。 |

## 7. 页面资产对 PRD 的补充

### 7.1 官网与 C 端必须补的 PRD

- 官网除问诊、客户入口、员工入口外，需预留小程序/轻入口，但必须先确认名称、二维码/AppID 和正式承接路径。
- 官网需预留 `www.rhautt.com` 企业工作平台入口，但需确认它和本地 `login.html`、`staff-portal.html` 的关系。
- 产品品牌内容不能再沿用旧“瑞美舒适家居 AI 平台”口径。
- `water-system-demo.html` 的全屋水系统内容应进入系统能力或设备品牌内容，不应丢失。

### 7.2 瑞诺瓦 AI 问诊必须补的 PRD

- `ai-consultation.html`、`pain-diagnosis-v3.html`、`solution-matching-v3.html` 的三档方案和智能推荐逻辑要并入 active 问诊。
- `quick-lock.html`、`sales.html` 的锁客和留资逻辑要接 CRM，不再散落页面。
- `package-purchase.html` 的套餐购买逻辑应进入报价/合同链路。

### 7.3 设计师与报价必须补的 PRD

- `quotation-pro.html`、`quotation-v2.html`、`material-quotation-system.html` 表明报价必须覆盖 BOM、材料、人工、税费、毛利、促销、风险预留、客户价。
- `calculation-demo.html`、`oneclick-calc.html` 表明六大系统计算不能只靠前端静态比例。
- `house-type-library.html` 表明户型库应进入共享数据模型。
- `technical-drawings.html`、`drawing-engine.html` 表明效果图、原理图、施工图需要分层输出和版本管理。

### 7.4 Rysnova 必须补的 PRD

- `bim-viewer.html`、`bim-export.html`、`revit-integration.html`、`cfd-visualization.html`、`floorplan-bim.html`、`smart-routing.html` 证明 Rysnova 不只是 3D 展示，而是 BIM 浏览、导出、Revit、CFD、管线路由、碰撞检查和工程量计算的技术支持体系。
- 这些能力必须归入 Rysnova facade，不能散成独立页面入口。

### 7.5 业务控制台必须补的 PRD

- `crm-dashboard.html`、`channel-dashboard.html`、`admin-dashboard.html`、`business-analytics.html`、`sales-crm-module.html` 证明后台必须覆盖 CRM 360、商机漏斗、渠道汇总、门店经营、总部分析。
- `admin/products.html`、`products.html` 证明产品/价格/导入/统计是后台 P0。
- `marketing-*` 页面证明促销和营销不是装饰功能，应进入业务控制台。

### 7.6 交付与 IoT 必须补的 PRD

- `construction-management.html`、`construction-dashboard.html`、`construction-schedule.html`、`delivery-center.html`、`technical-support.html` 证明施工交付要覆盖进度、排期、质量、安全、材料、验收、交付文档和技术支持。
- `workorders.html`、`service-tickets.html`、`maintenance-schedule.html`、`operation-maintenance.html`、`predictive-maintenance.html`、`econet-dashboard.html` 证明售后和 IoT 生命周期必须作为桥接 PRD，而不是售前系统的附带链接。

## 8. 生产门禁

在用户批准正式开发前，只允许做以下工作：

- 读取和分析页面。
- 更新 PRD、架构、迁移计划、数据模型文档。
- 更新不改变运行行为的审计报告。

禁止：

- 新增页面入口。
- 删除页面。
- 改生产导航。
- 改后端 route。
- 改数据库模型。
- 改 UI/VI 实现。

开发恢复条件：

- 用户确认本页面资产 PRD。
- 用户确认小程序/轻入口的正式名称和位置。
- 用户确认 `www.rhautt.com` 企业工作平台与当前员工入口的关系。
- 用户确认哪些 migration-candidate 先迁入生产主干。

## 9. 批准后的建议迁移批次

以下只是产品确认后的开发排序建议，不代表已经批准开发。

### Batch 1：成交与报价闭环

优先迁移：

- `public/sales.html`
- `public/quotation-pro.html`
- `public/material-quotation-system.html`
- `public/quotation-v2.html`
- `public/quick-lock.html`
- `public/package-purchase.html`

目标：

- CRM 线索、销售跟进、锁客、报价、促销、套餐购买、合同前置形成闭环。
- 报价必须进入后端 quote facade，覆盖 BOM、设备、材料、人工、税费、毛利、促销、风险预留、客户价。

### Batch 2：设计精度与图纸输出

优先迁移：

- `public/calculation-demo.html`
- `public/oneclick-calc.html`
- `public/house-type-library.html`
- `public/device-positioning-demo.html`
- `public/technical-drawings.html`
- `public/drawing-engine.html`
- `public/drawing-versions.html`

目标：

- 六大系统计算、户型、设备布置、原理图、效果图、施工图和版本管理进入 design/Rysnova facade。
- 设计师工作台只保留轻量成交体验，深度图纸能力交给 Rysnova。

### Batch 3：Rysnova 工程深化

优先迁移：

- `public/bim-viewer.html`
- `public/cfd-visualization.html`
- `public/bim-export.html`
- `public/revit-integration.html`
- `public/floorplan-bim.html`
- `public/smart-routing.html`
- `public/design-review.html`
- `public/technical-manual.html`

目标：

- Rysnova 从 3D 页面升级为 BIM 浏览、导出、Revit/CAD、CFD、管线路由、碰撞检查、工程量、技术手册的一体化技术支持体系。

### Batch 4：交付、服务与 IoT 生命周期

优先迁移：

- `public/construction-management.html`
- `public/construction-dashboard.html`
- `public/construction-schedule.html`
- `public/delivery-center.html`
- `public/technical-support.html`
- `public/workorders.html`
- `public/service-tickets.html`
- `public/maintenance-schedule.html`
- `public/econet-dashboard.html`
- `public/operation-maintenance.html`
- `public/predictive-maintenance.html`

目标：

- 施工交付、技术支持、工单、服务计划、IoT handoff 和未来 IoT 控制平台衔接形成生命周期闭环。

### Batch 5：后台经营与总部汇总

优先迁移：

- `public/crm-dashboard.html`
- `public/channel-dashboard.html`
- `public/admin-dashboard.html`
- `public/admin/products.html`
- `public/business-analytics.html`
- `public/sales-crm-module.html`
- `public/store-admin.html`
- `public/hq-admin.html`
- `public/admin/marketing.html`
- `public/marketing-automation.html`
- `public/marketing-engine.html`

目标：

- 多租户后台补齐 CRM 360、渠道汇总、总部分析、产品价格、促销营销、门店管理。

### Batch 6：内容、帮助、移动端与 AI 评估

优先迁移：

- `public/product-presentation.html`
- `public/product-showcase.html`
- `public/water-system-demo.html`
- `public/help.html`
- `public/mobile.html`
- `public/ai-chatbot.html`
- `public/ai-accuracy-test.html`
- `public/ai-command-center.html`
- `public/location-demo.html`

目标：

- 官网内容、系统能力说明、移动端/小程序素材、AI 评估和多 agent 控制面进入正式 PRD。
