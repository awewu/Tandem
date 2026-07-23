# 产品应用场景分类 & 家用/商用差异化运营模型（PRD）

> 2026-07-06 新增。补齐原 D2 产品事实基座缺失的「按应用场景分类」维度，并明确**家用 vs 商用**在
> **推广 / 赋能 / 交付 / 技术支持**四个经营维度上的差异化模式。
> 代码事实源：`services/api/src/modules/product-catalog/product-taxonomy.ts`
> （`APPLICATION_SCENARIOS`、`SEGMENT_OPERATING_MODELS`、`segmentFamily()`），
> 经 `GET /api/v2/product-catalog/taxonomy` 暴露；产品定位 `products.positioning.applicationScenarios`。

---

## 1. 背景与缺口

原产品事实基座（D2）用 `targetSegments`（home/villa/commercial/project）回答「**卖给谁**」，
用自由文本 `scenarios` 描述适用场景——但**缺两样**：

1. **结构化的「应用场景分类」**（可筛选、可驱动策略），
2. **家用 vs 商用差异化的经营模式**（推广/赋能/交付/技术支持完全不同）。

本 PRD 补齐两者：新增受控 `APPLICATION_SCENARIOS`（家用/商用双轨）+ `SEGMENT_OPERATING_MODELS`。

---

## 2. 两个正交维度

| 维度 | 回答 | 字段 | 取值 |
|---|---|---|---|
| 目标客户 targetSegments | 卖给谁 | `positioning.targetSegments` | home / villa / commercial / project |
| **应用场景 applicationScenarios** | **用在什么场景** | `positioning.applicationScenarios` | 见下表（家用/商用双轨） |

> 二者正交：同一产品（如热泵热水/新风）可同时服务家用与商用场景，但**经营模式随场景族切换**。
> `segmentFamily(targetSegment)`：`commercial`/`project` → 商用族；其余 → 家用族。

### 2.1 应用场景分类（受控词表）

**家用 residential**：`res_new_decoration` 新房精装 · `res_villa` 别墅大宅 · `res_retrofit` 存量旧房改造 · `res_apartment` 公寓刚需

**商用 commercial**：`com_office` 办公写字楼 · `com_hospitality` 酒店/民宿 · `com_public` 学校/医院/公建 · `com_retail` 商业综合体/门店 · `com_industrial` 工业厂房/园区

---

## 3. 家用 vs 商用 · 差异化运营模型

| 维度 | 家用（C端消费驱动） | 商用/轻商（B端项目驱动） |
|---|---|---|
| **推广** | C端内容种草(AI问诊/GEO/口碑)、门店/样板间体验、经销商分销获客、品牌矩阵曝光 | B端项目获客(工程渠道/招投标)、行业展会/标杆案例、GEO专业词+技术白皮书、客情与关系营销 |
| **赋能** | 标准化系统套餐、一键精算+AI方案、经销商工作台自助、话术/物料一键取用 | 定制化选型+负荷精算、多专业BIM深化协同、投标报价/技术标书、厂商专家支持 |
| **交付** | 标准化快速交付、生命周期14态、验收打勾、IoT仅移交 | 项目制里程碑交付、深化图纸/工程量/标准符合性、多方分阶段验收、调试与移交 |
| **技术支持** | 远程指导+经销商自服务、保修台账、标准SLA | 驻场/专业工程师、SLA+运维合同、能效优化/长期服务 |

### 3.1 差异的本质

- **决策链**：家用=个人/家庭快决策；商用=多方/招投标长周期。
- **交付形态**：家用=标准化产品化交付；商用=项目制、多阶段、多专业深化。
- **价值锚点**：家用=体验/性价比/口碑；商用=能效/合规/长期运维 ROI。
- **组织**：家用靠经销商网络规模化自助；商用靠厂商专家+驻场重服务。

---

## 4. 各域如何消费此模型

| 域 | 用法 |
|---|---|
| growth（增长中枢） | 按 `segmentFamily` 选推广打法：家用走内容/GEO/口碑；商用走项目/白皮书/客情 |
| dealer/designer 工作台 | 赋能资源分流：家用=套餐+一键精算；商用=定制选型+BIM深化+标书 |
| delivery/lifecycle | 交付模式分流：家用=标准14态；商用=项目里程碑+多方验收 |
| aftersales/tech-support | 支持模式分流：家用=远程+保修台账；商用=驻场+SLA+运维合同 |
| product-catalog / brand-console | 产品编辑页新增「应用场景」多选；公开供给与推荐按场景筛选 |

---

## 5. 落地状态

- **[已交付·代码]** `product-taxonomy.ts`：`APPLICATION_SCENARIOS` + `SEGMENT_OPERATING_MODELS` + `segmentFamily()`；`positioning.applicationScenarios`（受控、软约束 sanitize）；经 `GET /api/v2/product-catalog/taxonomy` 暴露 `applicationScenarios` / `segmentModels`。
- **[已交付·代码]** 场景筛选可驱动：`GET /api/v2/product-catalog/devices?scenario=<code>` 按应用场景过滤（`POS_FILTERS` 白名单，jsonb 存在性，防注入）；`POST /product-catalog/recommend` 支持 `scenarios[]` 参与匹配打分。
- **[待办·P2]** brand-console 产品编辑页加「应用场景」多选控件。
- **[待办·P2]** growth / delivery / aftersales 按 `segmentFamily` 路由差异化打法（当前为受控词表 + 模型常量，供消费方读取）。
