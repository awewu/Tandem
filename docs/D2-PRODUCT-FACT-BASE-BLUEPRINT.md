# D2 产品事实基座 — 精简蓝图（对标市场物料库 DAM）

> 定位：**基座能力板块**，不是产品管理后台。一句话：把产品「说清楚」（卖给谁 / 哪个渠道 / 哪类用户 / 哪个市场 / 为何设计），并沉淀成**可复用产品事实素材**，供其他板块只读取用、拼出各自完整架构。
> 事实源：从属 `PROJECT-CHARTER.md` 1.2.2 与 `docs/ADMIN-PERMISSION-DOMAINS-AND-RLS.md`（6 域制中的 **D2 产品**）；如冲突以宪章为准。
> 后端归属：`services/api/src/modules/product-catalog/`（`/api/v2/product-catalog`，写归属 D2，主数据平面=品牌运营库）。
> 生效：2026-07-01 · 状态：设计锁定，待实现。

---

## 0. 为什么要进化

现状：D2 只有两张表——`products`（`sku/name/brand/category/spec(jsonb)/list_price/cost_price/status`）+ `price_list_items`（经销商价盘）。它「只像数据库」的根因只有一个：**只存了 SKU / 参数 / 价格，没存「这个产品是给谁、为什么、卖到哪个市场和渠道」**——没把产品*说清楚*，别的板块也就拿不到可用的产品语义。

进化目标：把 D2 重新定位为**产品事实素材基座**，与板块一的**市场物料库(DAM)** 完全同构——一个是内容素材基座，一个是产品素材基座。

| | 市场物料库 DAM（板块一） | 产品事实基座 D2 |
|---|---|---|
| 沉淀什么 | 海报 / 画册 / 视频素材 | 产品事实 + 定位 + 素材引用 |
| 谁消费 | 各品牌站发布取用 | 问诊 / 报价 / BIM / 品牌站 / 增长中枢 |
| 角色 | 内容基座 | 产品基座 |
| 供给方式 | 只读引用 | 只读视图 / 事件（单一事实源，不被反写） |

---

## 1. 范围边界（锁定）

### 1.1 D2 负责（IN）
- **产品事实**：品牌、品类、名称、SKU、核心规格（结构化）。
- **产品定位**：卖给谁 / 渠道 / 用户画像 / 市场区域 / 设计意图与卖点（见 §2）。
- **素材引用**：产品图、参数表、认证文件、BIM 族文件、说明文档——**只存引用**（走 DAM / `file-artifact`），不重复造存储。
- **只读供给**：对外暴露稳定的产品只读视图 / 事件，作为全平台单一产品事实源。

### 1.2 D2 不负责（OUT，明确排除，避免又长成大杂烩）
- **定价 / 折扣 / 审批**：归 `quote`(D4) + 电子合同域（`docs/RHAUTT-NEXUS-DEV-DIRECTION-FINAL.md` D2 电子合同的折扣审批）。基座只提供「牌价/成本」等**事实字段**，不做定价业务逻辑。
- **选型 / 推荐引擎**：规则与推荐归消费方（问诊 / 报价 / BIM）。基座只提供可供筛选的**定位标签**。
- **报价单 / 系统包报价 / 库存 / 履约**：归 D4 各业务模块。
- **精算参数可信链（C2）**：是独立、更高优先级的护城河议题，本蓝图不展开；此处只预留 `spec` 结构可平滑升级的空间，不在本期实现。

> 一句判据：**凡是「产品是什么、给谁、卖到哪」= D2；凡是「怎么卖、卖多少钱、能不能卖」= 消费域。**

---

## 2. 核心补齐：产品「定位」层（让它从数据表变说明书基座）

在现有产品事实之上，加一层结构化定位字段——这是「把产品说清楚」的核心：

| 维度 | 字段（示意） | 取值示意 |
|---|---|---|
| 卖给谁（目标客户） | `target_segments[]` | 家庭 / 别墅 / 商用 / 工程 |
| 哪个渠道 | `channels[]` | 经销商 / 工程项目 / 电商 / 直营 |
| 哪类用户（画像） | `user_personas[]` | 高端改善 / 刚需 / 存量改造 / 新装 |
| 哪个市场（区域/场景） | `markets[]` | 华东别墅 / 南方潮湿区 / 北方采暖区 |
| 为何设计（意图/卖点） | `value_proposition` `pain_points[]` `scenarios[]` | 一句话价值主张 + 解决痛点 + 适用场景 |

- 全部为**受控标签 + 少量自由文本**，标签集中管理（供各消费域一致筛选）。
- 定位字段与 `spec` 分离：`spec` 讲「产品是什么参数」，定位讲「产品给谁用」。

---

## 3. 素材引用层（DAM 同构）

- 每个产品挂**素材引用清单**：`asset_refs[] = { type, dam_id/uri, role }`。
- `role` 示例：主图 / 场景图 / 参数表 PDF / 认证 / BIM 族 / 说明书。
- 存储统一走对象存储（`file-artifact`）；D2 只持有引用与角色标注，不复制文件。

---

## 4. 只读供给（从孤岛变基座的关键）

D2 是**单一产品事实源**，只读供给、绝不被下游反写（呼应宪章可信链隔离红线）：

| 消费方 | 取用什么 | 用途 |
|---|---|---|
| 问诊 D3 | 定位标签 + 卖点 | 按用户画像 / 市场筛推荐产品 |
| 报价 D4 | 产品事实 + 卖点 + 素材 | 报价单有产品说明，不再是干巴巴 SKU |
| 设计/BIM D4 | 规格 + BIM 族引用 | 选型与建模取几何/规格 |
| 品牌站 D1 | 定位 + 卖点 + 主图 | 只读展示 |
| 增长中枢 D5 | 定位 + 卖点 | 喂文案/GEO（对标 Nexus Growth 蓝图 B1 品牌大脑） |

- 供给形态：稳定的产品**只读视图**（`product_view` 无 PII、无成本敏感字段的对外版）+ 领域事件（`product.published` 等）。
- 谁消费谁映射：owner 已在 `services/api/src/modules/module-boundary.ts` 标注，导航/授权据此对齐。

---

## 5. 来源、产权与回流（上游闭环）

> 背景：现实代码里方向是**反的**——`apps/everhot-cn/public/js/products-data.js` 是事实上的录入源，`apps/everhot-cn/scripts/sync-products-to-nexus.mjs` 把它 **push 进** D2，并用 `meta.everhot` 存完整原对象做无损往返；`database/postgres/migrations/009_everhot_brand_tenant.sql` 注明 products 目前是「HQ 共享目录」（varchar tenant_id，非 RLS）。本节收口「谁是写主、从哪来、怎么回流」，与 §4「不被反写」对齐。

### 5.1 产权裁决（写主）
- D2 是产品**事实 + 定位**的唯一 master-of-record。
- 品牌站 `products-data.js` 从「写主」降级为**一次性 seed 来源**；`meta.everhot` 无损往返是安全的迁移垫脚石。
- **判据**：「谁能改产品事实与定位」= 只有 D2；品牌站 / 脚本只能 **seed** 或 **只读消费**，不得成为长期写主。

### 5.2 录入归属
- **事实**（sku / 规格 / 品牌 / 品类）：可由品牌站 seed，或 `product_manager` 在 D2 录入。
- **定位**（卖给谁 / 渠道 / 用户 / 市场 / 卖点）：`products-data.js` 给不出，**必须由总部 `product_manager` 在 D2 录入**——这正是 D2 该当 master 的核心理由。

### 5.3 多品牌来源策略
- **everhot**：现有 `products-data.js` seed → D2；此后以 D2 为准。
- **rheem / ruud**：外链占位站，产品**不强制入库**；如需营销/GEO 引用，仅登记「轻量事实卡」（名称 / 品类 / 定位），不建完整 SKU 目录。
- 门牌裁定见 §5.6：产品目录以**品牌运营租户 UUID** 为唯一门牌（RLS 隔离），`rhautt_shared` 哨兵为历史 dev 残留、已退役。（本条更正 009「non-RLS 共享」的过时表述，与 §9.3 运行时拓扑 `tenant = EVERHOT_TENANT_ID` 对齐。）

### 5.4 迁移路径（seed → D2 为准 → 回流）
1. **seed**：保留 `sync-products-to-nexus.mjs` 做一次性 / 低频幂等导入。
2. **切主**：定位字段在 D2 录入后，D2 成为事实源；`products-data.js` 冻结为构建产物，或改为**从 D2 拉取生成**。
3. **回流**：品牌站 / 问诊 / 报价改为从 D2 只读视图消费（**反转当前 push 方向**）。

### 5.5 稳定产品标识（MDM-lite）
- 现状 `sku=slug`，跨品牌无统一身份。基座引入稳定 `product_key` + 去重规则（呼应宪章 M15 / MDM），避免同一产品在多站 / 多源重复。

### 5.6 共享三律 · 门牌裁定（🔒 锁定 · 模型 B · 2026-07-03）

> 背景：线上盘点证实真产品（24 个 everhot，带定位/素材）落在**品牌运营租户 UUID** `e5e4…0001` 下；`rhautt_shared` 门牌仅有 10 行早期 dev 占位（瑞合/Rheem/Ruud）。故采纳「模型 B：品牌运营租户 = 主数据平面」，与 §9.3 运行时拓扑一致。**读路径不动**（env 已指向 UUID，零数据搬迁）。

- **第 1 律 · 单一门牌 = 品牌运营租户 UUID。** 产品目录以品牌运营租户 UUID 为唯一门牌，RLS 隔离；品牌间靠**租户**隔离，`brand` 列只在租户内细分。`rhautt_shared` 哨兵**退役归档**，不再作为读写门牌。**写闸强制**：`upsert` 与 seed 脚本的产品门牌必须是 UUID，禁止写入 `rhautt_shared`（`guard:product-authoring` + 服务层 `requireWriteTenant` 双重兜底）。
- **第 2 律 · 定价永远私有。** `price_list_items`（真 `tenant_id`+`dealer_id`，FORCE RLS）保持不变——共享事实 + 私有定价。
- **第 3 律 · 素材跟随产品，在租户内共享。** 产品素材（主图/参数表/BIM 族）挂 `asset_refs` 引用，归属**该品牌运营租户**（`file-artifact` 同租户 RLS 内可读，`dealer_id` 空=租户内共享，不落经销商私有）；经销商私有素材（客户单据附件）**不得**挂到产品上。
- **判据一句话**：「产品是什么」= 品牌运营租户内共享一份；「卖多少钱」= 各经销商私有；「产品素材」= 跟产品同租户共享，客户素材才落经销商私有。
- **遗留隐患（记录待办）**：`product-catalog.service.ts` `get(id)` 无租户过滤——模型 B 下产品已按租户隔离，此裸读为潜在越权面，后续应叠加门牌校验。

---

## 6. 数据模型演进（在现有表上增量，不推翻）

- `products`：保留；`meta` 拆出结构化 **定位字段**（§2）。
- 新增 `product_asset_ref`：产品 ↔ DAM 素材引用（§3）。
- 新增/沉淀 `product_taxonomy`：定位标签受控词表（segments / channels / personas / markets）。
- RLS 沿用 6 域制：`tenant_id`=总部 + `product_line_scope`；`product_manager` 写本产品线，其余业务域只读产品视图（`docs/ADMIN-PERMISSION-DOMAINS-AND-RLS.md` §3.4）。
- 发布态：产品事实/定位 `draft → published`；只有 `published` 进只读视图对外供给，全程可审计。

---

## 7. 分期（精简，先见效）

- **P1 · 定位模型** ✅ 已交付：`products.positioning` jsonb 结构化定位 + `product-taxonomy.ts` 受控词表（segments/channels/personas/markets）；`GET product-catalog/taxonomy`；brand-console 产品编辑页可「把产品说清楚」（卖给谁/渠道/用户/市场/价值主张/痛点/场景）。迁移 `011_product_positioning.sql`。
- **P2 · 素材引用** ✅ 已交付：`products.asset_refs` jsonb（{role, artifactId, ...}，只存引用）+ 与 `file-artifact`/DAM 打通（brand-console 按角色上传：卡片图/参数表/认证/BIM族/说明书）。迁移 `012_product_asset_refs.sql`。
- **P3 · 只读供给** ✅ 已交付：公开端点 `brand/:brand/products` 合并 `positioning`/`assetRefs` 回流；首个消费方=品牌站（everhot-cn 详情页「为谁而生」渲染价值主张/痛点/场景）。
- **P4 · MDM-lite + 消费筛选** ✅ 首批交付：稳定 `product_key`（`computeProductKey`，upsert 自动回填）+ 去重候选只读诊断 `GET product-catalog/dedupe-candidates`（不自动合并）；`GET product-catalog/devices` 支持按定位维度筛选（`?segment=/channel=/persona=/market=`），供问诊/报价等消费方一致筛选。
  - 推荐原语已备：`POST product-catalog/recommend`（画像约束 segments/channels/personas/markets + 可选痛点文本 → 加权打分排序，公开安全投影/不含成本）。边界：诊断内部字段 → 定位 code 的映射由消费方传入，D2 不感知消费方语义。
  - 滚动待办：问诊/报价在其引擎侧生成 `criteria` 调用 `recommend`（当前问诊用 tier 模型，需产品侧 tier↔画像映射决策后再接）；`spec` 结构为未来 C2 精算可信链预留升级位（不在本蓝图范围）。

> 写主纪律（已落地）：定位/素材/`product_key` 仅当 upsert 显式传入时才改写；`sync-products-to-nexus.mjs` seed 不含这些字段，故重复 seed 不覆盖 D2 录入。

### 7.1 问诊 → `recommend` 映射方案 ✅ 已接（建议默认）

已落地：`diagnosis-recommend-map.ts::buildRecommendCriteria` + `DiagnosisService.completeDiagnosis` 完成后调 `ProductCatalogService.recommend`，将推荐产品挂到 `result.recommendedProducts`（失败软化，不影响问诊主流程）。当前采用下表**建议默认**（阈值①=200㎡；城市分类表②内置常见城市；`balanced` 不加 persona）——待权威清单替换 `diagnosis-recommend-map.ts` 中的城市数组即可微调，无需改 D2。

问诊引擎（`server/modules/diagnosis/diagnosis.service.js`）产出 3 档 tier（`essential`/`balanced`/`premium`，本质预算倍率）+ 原始输入 `systems` / `home.area` / `home.city` / `painPoints`；产品未与 tier 绑定。消费方接入时，在问诊引擎侧把这些映射为 D2 `recommend` 的 `criteria`：

| criteria 维度 | 来源 | 映射规则（建议默认） |
| --- | --- | --- |
| `personas` | tier id | `essential`→`essential`(刚需)；`premium`→`premium_upgrade`(高端改善)；`balanced`→不加约束 |
| `segments` | `home.type` / `home.area` | 别墅或面积 ≥ **阈值①** → `villa`，否则 `home`；商用/工程另判 |
| `markets` | `home.city` | 按**城市分类表②** → `south_humid`/`north_heating`/`tier1_city`/`east_villa` |
| `painPoints` | `normalizePainPoints(payload)` | 原样透传（对定位 `painPoints`/`scenarios`/`valueProposition` 做文本命中） |
| `channels` | 线索来源 | 问诊线索默认 `dealer`（可省略） |

**需产品侧拍板的 3 项**：
1. **阈值①**：别墅 segment 的面积下限（如 200㎡？）。
2. **城市分类表②**：哪些城市归 `south_humid`/`north_heating`/`tier1_city`（需一份权威清单）。
3. **tier↔persona 对应**：`balanced` 是否也给 persona，及 `retrofit`/`new_build` 如何从 payload 判定（当前 payload 未显式携带新装/改造标记）。

> 拍板后，映射适配器落在**问诊引擎侧**（生成 `criteria` 调 `recommend`），D2 不感知问诊语义，边界不破。`painPoints` 透传部分无需决策，可先行接入。

---

## 8. 门禁（保持机器纪律）
- `guard:product-fact-base` ✅ 已实现（`scripts/agent-guards/product-fact-base-check.js`）：静态强制 D2 为单一产品事实源——(A) 除 product-catalog 与 module-boundary 外，其它模块不得 import `ProductEntity` / 调用 `.upsert()`（不被下游反写）；(B) 公开控制器只读（无写动词），公开读方法（`listBrandPublic`/`recommend`/`list`）投影不得出现 `costPrice`/`cost_price`/`dealerPrice`/`dealer_price`（无成本/无 PII）；(C) 写入闸 `upsert` 仅经 AuthGuard 保护的控制器暴露。证据：`evidence/architecture/product-fact-base.json`。
- `guard:product-authoring` ✅ 已实现（`scripts/agent-guards/product-authoring-check.js`）：静态强制品牌站脚本（`sync-products-to-nexus.mjs`）——只经 D2 upsert 端点（`POST /product-catalog/devices`）且带鉴权写入；不得直连 DB 绕过 D2（禁 `pg`/`typeorm`/`DataSource`）；不得写 D2-录入字段（`positioning`/`assetRefs`/`productKey`）；不得用破坏性动词（DELETE/PUT/PATCH）。证据：`evidence/architecture/product-authoring.json`。
- 复用 `guard:permission-domain`：product-catalog 唯一归属 D2 产品域。

---

## 9. 完整层级架构（分层总览）

> 目的：把上文分散的范围/分期/供给收敛成一张「自顶向下」的层级图，便于对齐与评审。

### 9.1 平台域层级（6 域制 · D2 的位置）
事实源：`docs/ADMIN-PERMISSION-DOMAINS-AND-RLS.md` + `PROJECT-CHARTER.md`。

```
瑞合数智枢纽 / Rhautt Nexus
├── D0 平台与系统    登录 · 运营 · 底座（auth / tenant / RLS / 事件）
├── D1 品牌管理      集团站 · Rheem · Ruud · Everhot（内容基座 = DAM）
├── D2 产品与策略 ★  产品事实基座（本蓝图主体）—— 唯一产品事实源
├── D3 用户与体验    C 端获客 · AI 问诊 · 匿名公域
├── D4 客户与赋能    承接→设计→报价→施工→服务 闭环
└── D5 增长中枢      文案 / GEO / 品牌大脑
```
D2 与 D1(DAM) **同构**：D1 是内容素材基座，D2 是产品素材基座；两者都「只读供给、不被下游反写」。

### 9.2 D2 内部分层（自底向上 6 层）
```
D2 产品事实基座（services/api/src/modules/product-catalog/）
┌────────────────────────────────────────────────────────────┐
│ L6 消费层  recommend 加权推荐 · devices 维度筛选 · dedupe 去重诊断  │ ← 消费方调用
│ L5 供给层  公开只读投影（无成本/无PII）+ 事件 product.published     │ ← 单一事实源出口
│ L4 标识层  product_key（computeProductKey）· MDM-lite 去重规则       │
│ L3 素材层  assetRefs[]{role,artifactId} → DAM/file-artifact（只引用）│
│ L2 定位层★ positioning{segments/channels/personas/markets/vp/pain/scene}│ ← 把产品说清楚
│ L1 事实层  products: brand/category/sku/spec(jsonb)（保留原表）       │ ← 基础
└────────────────────────────────────────────────────────────┘
  受控词表 product-taxonomy.ts 横切 L2（segments/channels/personas/markets/assetRoles）
  发布态 draft → published 横切全层（只有 published 进 L5）
```
文件映射：L1–L4 实体=`product-catalog.entity.ts`（迁移 `011`/`012`）；L2 词表=`product-taxonomy.ts`；核心服务=`product-catalog.service.ts`；L5 公开出口=`product-catalog.public.controller.ts`（`@Public` 脱敏只读）；L6 写入/管理=`product-catalog.controller.ts`（AuthGuard 保护，唯一写闸 `upsert`）。

### 9.3 运行时拓扑（服务 · 端口）
```
浏览器
 ├─ :3000  legacy Express（server/index.js）── 静态门户 index.html / products.html
 │           └─ /api/v2/diagnosis/public/*  同源代理 ─┐
 ├─ :4012  brand-console（Next.js）── D2 录入台 Console │  （L2/L3 录入 UI）
 │           └─ /api/products · /api/images ─────────┐│
 │                                                    ▼▼
 └─ :3300  NestJS API（Fastify）── product-catalog 模块（L1–L6）
             └─ PostgreSQL rhautt_nexus.products（+positioning/assetRefs/product_key）
                  tenant = EVERHOT_TENANT_ID（品牌运营主数据平面）
```

### 9.4 鉴权分层（deny-by-default）
- 全局 `APP_GUARD` = `AuthGuard` → `RolesGuard`，默认拒绝所有请求。
- `@Public()`（`common/public.decorator.ts`）标注真正的匿名端点；两道守卫均 `getAllAndOverride(IS_PUBLIC_KEY, [handler, class])` 放行。
- L5 公开控制器 `EverhotPublicController` 类级 `@Public()` → 覆盖 `products`/`recommend`；投影脱敏由 `recommend` + `guard:product-fact-base` 双重兜底。
- 待办：公开面补 rate-limit（防匿名滥用）。

### 9.5 数据流与写主纪律（方向已反转）
```
录入（唯一写主）                       供给（只读，绝不反写）
product_manager ─upsert─▶ D2 ═══════▶ D1 品牌站  取 定位+卖点+主图
brand seed(sync脚本)─┘(不写定位/素材)  D3 问诊    取 定位标签 → recommend
                                       D4 报价/BIM 取 事实+卖点+素材/BIM引用
                                       D5 增长     取 定位+卖点 → 文案/GEO
```
写主判据：能改产品事实与定位的只有 D2；品牌站/脚本只能 `seed` 或只读消费。`sync-products-to-nexus.mjs` 不含 positioning/assetRefs/productKey → 重复 seed 不覆盖 D2 录入（`guard:product-authoring` 静态兜底）。

---

## 10. L7 营销供给层（i18n + SEO/GEO + 富营销内容）— 🔒 设计锁定 · 2026-07-05

> 决策来源：用户裁定「模型 A（D2 扩 L7，营销内容归产品域）· 本轮 MVP 一步到位含 SEO/i18n · Rheem/Ruud 完整目录升级延后」。
> 定位：在 L1–L6 事实基座之上加**营销供给层**——沉淀「世界级品牌+营销」所需的**结构化营销事实**（多语言、SEO/GEO 结构化数据、富营销内容），仍归 D2 单一事实源；D5 只做**生成/分发**、D1 只做**渲染**、D2 不做定价/履约。

### 10.1 为什么加 L7（世界级差距）
事实基座只回答「产品是什么/给谁」，但世界级营销还需要：多区域多语言（Rheem/Ruud 是美国品牌）、SEO 结构化数据（schema.org `Product`/`Offer` JSON-LD、GTIN/MPN）、AI 答案引擎可发现性（GEO）、结构化富文案（标题/卖点-利益/FAQ）。这些是「产品的营销事实」，介于 D2 与 D5 之间——**归 D2（模型 A）**，避免散落品牌站（现状混乱根因）。

### 10.2 数据模型（新增 `product_content`，per 产品 × locale）
- **表**：`rhautt_nexus.product_content`，`UNIQUE(tenant_id, product_id, locale)`；`tenant_id` 跟随产品的品牌运营租户（模型 B），**FORCE RLS**（对齐 018）。
- **L7a i18n**：`locale`（BCP-47，如 `zh-CN`/`en-US`）· `name`（本地化显示名）· `display_currency`（展示币，不做定价）。
- **L7b SEO/GEO**：`seo` jsonb `{metaTitle, metaDescription, canonical, ogImage, keywords[]}` · `gtin` · `mpn`（schema.org 全球贸易标识）。**JSON-LD 不落库**——由服务 `buildJsonLd()` 在读时从 `products + product_content` 计算投影（避免漂移）。
- **L7c 富营销内容**：`marketing` jsonb `{headline, subhead, featureBenefits[{feature,benefit}], highlights[], faq[{q,a}]}`（本轮建结构，内容可后续填）。
- **发布态**：`status` draft/published · `published_at`——**只有 published 进公开只读供给（L5）**，全程可审计。

### 10.3 端点（受保护写 + 公开本地化读）
- 受保护（AuthGuard + 写闸 `requireWriteTenant`）：`POST /product-catalog/devices/:id/content`（upsert 某 locale 营销内容）· `GET /product-catalog/devices/:id/content`（列本产品各 locale 内容）。
- 公开脱敏只读（`@Public` + 限流）：`GET /brand/:slug/products?locale=`（本地化投影 + 内联 JSON-LD）· `GET /brand/:slug/products/:sku?locale=`（单品 + JSON-LD）。
- **回退链**：请求 locale 无内容 → 回退默认 locale → 回退 L1/L2 基础事实（保证任何品牌任何 locale 都有可渲染投影）。

### 10.4 边界（不破单一事实源）
- L7 只存**营销事实/内容**；文案**生成**归 D5（吃 L7 结构化输入产出成稿），**渲染**归 D1，**定价**永远归 price_list_items/D4。
- 公开投影延续 `guard:product-fact-base` 脱敏红线：不得出现 `cost_price`/`dealer_price`/PII。
- **Rheem/Ruud**：§5.3「轻量事实卡、不建完整目录」**本轮维持**；世界级完整本地化目录待用户提供品牌站代码后另立子任务升级。

### 10.5 分期
- **P0（本轮 MVP）**：事实基座契约+客户端+测试收口 **+** L7 表/实体/服务/端点 + i18n 回退 + SEO/JSON-LD 计算投影 + 全端点 OpenAPI + 契约测试。
- **P1+**：L7c 富内容录入 UI（brand-console）· 发布工作流（draft→review→published+定时+审计）· 产品关系（配件/替代/对比）· 营销效果闭环。

### 10.6 L7 层级补充（并入 §9.2）
```
│ L7 营销供给★ product_content(locale × 产品): i18n + SEO/GEO(JSON-LD计算) + 富营销内容 │ ← 世界级营销输入
```
