# Everhot × rheem.com 完整对比审计

> 日期：2026-06-29 · 方法：实测 `https://www.rheem.com` 首页/导航 DOM × 现场比对 `apps/everhot-cn`（本地 `:4011/everhot/`）
> 原则（蓝图 §4.2）：**保留 Everhot 暖红美术，补齐 rheem 的内容骨架**；不是抄 VI，是抄信息架构(IA)与组件完整度。
> 评级：✅ 已对齐 · 🟡 部分/弱 · ❌ 缺失

---

## 0. 2026-07-01 复审快照（相对 06-30 的增量 + 剩余差距）

> 方法：实测当前 `apps/everhot-cn`（48 个 `index.html` 页面）× 对照已存档的 rheem.com IA（§3–§6）。

**自上次审计已闭合的差距：**
- ✅ **内容页补齐**：`financing`(68)、`parts`(69)、`careers`(68)、`reliability`(79) 均已建为真内容页（此前全 ❌）。Financing/Parts/Careers/Reliability 四缺口清零。
- ✅ **住宅子类型独立页 ×10** 全部就位（热水 6 + 采暖制冷 4），带 hero + 理由卡 + faceted 网格 + JSON-LD。
- ✅ **产品图策略落地**：卡片 10 张 4:3 海报（横图 cover 正常）+ 详情页 4 张竖长参数图挂到「规格参数」区 + 其余 SVG 回退（此前多为 icon 占位）。
- ✅ **Hero 精修**：高度收紧（560→460px），英文品牌标语提升为显性 brand lockup。
- ✅ **可持续区文案锁定** `Earth Day, Every Day.`（用户 07-01 明确指示，🔒）。

**仍存在的差距（按优先级）：**
1. ✅ **商用子类型独立 SEO 页已补齐（2026-07-01）**：新建 8 个核心设备子类型独立页——采暖制冷 4（风冷热泵/模块机组/燃气采暖炉/新风）+ 热水 4（大功率/空气能/储热水箱/集中热水站），均带 hero+理由卡+faceted 网格+JSON-LD；由数据驱动生成器 `scripts/gen-subtype-pages.mjs` 产出，nav mega 与两品类页 subtype-links 已改指独立页。剩余 4 个纯服务/平台项（楼宇智控/运维服务/主备热备/数字运维）保留 `?series=` 深链（非独立产品品类）。
2. 🟡 **新闻/内容流仍硬编码**：rheem 的「The Latest」是 CMS 文章流（日期/分类/配图）；恒热为静态 3 卡 → 待后台化（Nexus 方案）。
3. 🟡 **真实产品摄影/DAM**：现为 Rheem 海报占位（带字标，用户已接受）+ SVG；正式上线需清底产品图入 DAM。
4. 🟢 **Mega `Resources` 仍为「列」非「Tab 切换」**：内容等价，纯 UI 形态差异，低优先（保持决策）。

**结论**：IA 骨架与内容页完整度已基本追平 rheem（甚至更全）；**唯一显著结构缺口是「商用子类型独立页」**，其余为后台化（新闻/DAM）与 UI 细节。

---

## 1. 总览结论

- **导航骨架**：Everhot 已高度对齐（顶栏图标行 + 四受众主导航 + mega-nav + Find-a-pro CTA）。✅
- **首页区块**：Everhot 区块数甚至更多，但**缺 rheem 两个关键组件**：mega-nav 的 `Products | Resources` 双 Tab、首页三受众卡片中的 **Professionals 第三卡**。🟡
- **产品分类深度**：**最大差距**。rheem 每个品类有**子类型独立页**（Tankless / Heat Pump WH / Boilers / Combi / Pool&Spa / Solar / Air Conditioners / Furnaces…），Everhot 只有两个品类落地页（heating-cooling / water-heating），靠数据列产品、**无子类型页**。❌
- **内容/工具页**：rheem 有 Resources 中心、Financing、Parts、Tax Credits、Careers、Reliability、Help 中心；Everhot 缺多数。🟡/❌
- **遗留冲突**：首页可持续区仍是英文 `Earth Day, Every Day.`，与已定品牌 slogan「大户型选恒热，多点用水没烦恼」不一致，需统一。⚠️

---

## 2. 顶栏图标任务行（utility bar）

| rheem.com | Everhot 现状 | 评级 |
|---|---|---|
| Warranties | 保修与注册 | ✅ |
| Rebates | 节能补贴 | ✅ |
| Tax Credits（联邦补贴） | — | ❌ 缺（国内可改为「以旧换新/国补」） |
| Sustainability | 可持续发展 | ✅ |
| Careers（招聘） | — | ❌ 缺 |
| Help | 帮助与支持 | ✅ |
| —（右侧无） | 为谁选购 / 专业人士 / 集团外链 / 中国·简体中文 | ✅ Everhot 更强 |

**建议**：补 1 个「国补/以旧换新」入口（替代 Tax Credits 的本地化版本）；Careers 视集团需要可选。

---

## 3. 主导航 + Mega-nav

| 维度 | rheem.com | Everhot | 评级 |
|---|---|---|---|
| 一级受众 | Homeowners / Commercial / Professionals / About | 家用 / 商用 / 专业人士 / 关于恒热 | ✅ |
| 右侧 CTA | Find a pro + 搜索 | 查找经销商 + 搜索 | ✅ |
| **Mega 内 Tab** | **`Products \| Resources` 双 Tab** | 仅 Products 列 | ❌ **缺 Resources Tab** |
| 品类分组 | Heating&Cooling / Water Heaters（含 9–10 子类型链接） | 采暖与制冷 / 热水系统（条目为泛词，非独立子类型页） | 🟡 |
| Featured Innovations | 3 张产品创新卡 + See all featured | 3 张精选创新卡 + 选型向导 CTA | ✅ |
| Warranty Lookup | Warranty & Registration Lookup | 保修与注册 | ✅ |

**建议**：①给 mega-nav 加 `Resources` Tab（技术文档/BIM-CAD/培训/资料下载/FAQ）；②品类子类型链接指向**真实子类型页**（见 §5）。

---

## 4. 首页区块对照

| rheem.com 区块 | Everhot 对应 | 评级 |
|---|---|---|
| Hero | Hero（slogan + 双入口 Air/Water） | ✅ |
| **三受众卡（Homeowners/Commercial/Professionals，各 Air·Water·Parts）** | 双入口卡（家用/商用，各 Air·Water）——**缺 Professionals 卡 + Parts 链接** | 🟡 |
| Featured 产品/创新 | 按品类选购 + 产品中心 | ✅（更丰富） |
| Sustainability 推广 | 可持续区（但文案为英文 `Earth Day, Every Day.`） | ⚠️ 文案需统一 slogan |
| Innovation（Triton 等） | 创新「以工程精度，定义恒热标准」 | ✅ |
| Reliability | 为什么选择恒热（价值条） | ✅ 近似 |
| **The Latest from Rheem（新闻+日期+分类）** | 新闻动态（3 卡 + 查看全部） | ✅（数据待后台化） |
| Find a pro / 经销商 | 经销商网络（就近定位） | ✅ Everhot 更强 |
| Financing / Parts / FAQ 入口 | 快捷服务（保修/补贴/FAQ/联系） | 🟡 缺 Financing/Parts |

**建议**：①双入口补「专业人士」第三卡（呼应三受众）；②可持续区文案改为中文品牌 slogan 或「恒久温暖，节能同行」类，去掉裸英文。

---

## 5. 产品分类深度（最大差距）

**rheem 住宅水加热子类型页**（各为独立 URL）：Tank / Indirect Tanks / Tankless / Heat Pump WH / Point-of-Use / Boilers / Combi Boilers / Accessories / Pool & Spa / Solar。
**rheem 住宅采暖制冷**：Air Conditioners / Furnaces / Cooling Coils / Air Handlers / Heat Pumps / Mini-splits。

**Everhot 现状（2026-06-30 更新）**：四个品类落地页均带 `data-catalog` faceted 网格（按 series 出 chip + `?series=` 深链）。**homeowners** 早已接子类型深链 + 3 个住宅热水子类型独立页；**commercial** 本次补齐——12 个商用条目全部接 `?series=` 钻到对应产品（此前 10 链接同指 2 页的最大缺口已消除）。住宅采暖制冷与商用核心子类型的**独立 SEO 落地页**仍可作 P2 深化。

**影响**：SEO（缺长尾子类型页）、信息层级（用户无法按类型钻取）、与 rheem 深度差距明显。

**建议（分级）**：
- P1：为**已有产品**自动生成「按子类型」过滤视图（复用 `catalog.js` filter）→ ✅ 已实现（`?series=` 深链 + commercial mega 全接）。
- P2：为核心子类型建**独立 SEO 落地页** → ✅ **住宅全部 10 个子类型页已建齐**（2026-06-30）：
  - 住宅热水 6 页：`zero-cold-water`/`heat-pump`/`condensing-boiler`（原有）+ `electric`（电热水器）/`storage`（容积式）/`combo`（采暖热水两联供）。
  - 住宅采暖制冷 4 页：`air-conditioning`（中央空调）/`underfloor-heating`（地暖）/`fresh-air`（新风）/`geothermal`（地源热泵）。
  - 各页含 hero + 选购理由卡 + `data-catalog="cat:sys:series"` 网格 + 完整 GEO/JSON-LD（WebPage + BreadcrumbList）；两品类页 subtype-links + homeowners mega 已全部指向专页（不再用 `?series=`）。
  - **待办**：商用核心子类型独立页（目前走 `?series=` 深链，功能可用）。

---

## 6. 内容/工具页缺口

| rheem 页面 | Everhot | 建议 |
|---|---|---|
| Resources 中心（mega Tab） | 散落在 professionals/* | 🟡 聚合一个 Resources 入口 |
| Financing（金融分期） | ❌ | 视业务，P2 |
| Parts（配件商城/查询） | ❌ | 配件/耗材查询，P2 |
| Tax Credits/Incentives | ❌（有 rebates） | 本地化「国补/以旧换新」，P1 |
| Careers | ❌ | 集团统一招聘，可外链 rhautt.com，P2 |
| Reliability | 🟡（价值条覆盖） | 可建独立「可靠性/质保」页，P2 |
| Help & Support 中心 | ✅ support/ | 保持 |
| Find a pro | ✅（更强，就近定位） | 保持 |

---

## 7. SEO / 技术

- ✅ Everhot：canonical、JSON-LD（家用热水页）、双语 alt、字体 preconnect、hero poster + 懒加载视频。
- 🟡 子类型页缺失 → 长尾关键词覆盖弱（见 §5）。
- 🟡 新闻为硬编码（rheem 为 CMS 文章流，有日期/分类/配图）→ 待后台化（见 `EVERHOT-NEXUS-BACKEND-IMPLEMENTATION-PLAN.md`）。
- 🟡 产品图多为占位（icon 回退）→ 需 DAM 接入真实产品图（同后台方案）。

---

## 8. 品牌 / VI（保留 Everhot 美术，不抄 rheem 观感）

- ✅ 暖中性色系 + 品牌红 + 网格地板 + EVERHOT 幽灵字水印 = Everhot 差异化资产，**保留**。
- ⚠️ **slogan 不一致**：首页可持续区 `Earth Day, Every Day.` vs 已定「大户型选恒热，多点用水没烦恼」。建议全站统一为后者（英文版可作辅助标语，但不应裸用在主视觉）。
- ✅ **品牌红已统一（2026-06-30 复核）**：off-spec 红 `#E4002B/#C8102E` = 0，全站主红收敛为 `#BF1924`；红场单一真相源 `--baseplate-bg`。

---

## 9. 优先级建议（投入产出）

**P0（即可做，低成本）**
1. 统一 slogan：去掉裸 `Earth Day, Every Day.`，可持续区改中文主 slogan。
2. 首页双入口补「专业人士」第三卡 → 完整三受众。
3. ~~顶栏补「国补/以旧换新」入口~~ → 已被现有「节能补贴」入口 + `rebates/`（节能补贴与以旧换新）页覆盖，无需新增。

**P1（结构补强）**
4. Mega-nav 加 `Resources` Tab（技术文档/BIM-CAD/培训/FAQ 聚合）。
5. 产品子类型**过滤视图**（`?type=`）补层级 + 内链。
6. 定主品牌红 token，全站收敛。

**P2（深度内容，配合后台）**
7. 核心子类型**独立 SEO 落地页**。
8. 新闻流 + 产品图**后台化/DAM**（见 Nexus 后台方案）。
9. Financing / Parts / Reliability / Careers 视业务补齐或外链集团站。

---

## 10. 快速可落地清单（本次可直接改）

- [x] 首页可持续区文案 → **🔒 LOCKED（2026-07-01 用户明确指示）**：锁定为「每一天，都是地球日 / Earth Day, Every Day.」。**请勿再改**（此前一度改为「恒久温暖，节能同行」已按用户要求回退）。index.html 已加 `LOCKED` 注释。
- [x] 双入口第三卡「专业人士」→ `entry-pro` 已在首页
- [x] 顶栏「国补/以旧换新」入口 → **已由现有「节能补贴」入口覆盖**：`rebates/` 页标题即「节能补贴与以旧换新」，正文含国家/地方补贴+以旧换新+家电下乡，顶栏已直达；无需新增（2026-06-30 决策：保持现状，政策不写死数字）
- [~] Mega-nav `Resources`：每个受众 mega 已含「工具与资源 Resources」**列**（内容齐），rheem 的 `Products|Resources` **Tab 切换**为纯 UI 形态，暂以列形态呈现（决策：内容等价、风险更低）
- [x] 产品子类型钻取：**commercial mega 已接 `?series=` 深链**（6 商用采暖制冷 + 6 商用热水，全部钻到对应产品；catalog.js facet 引擎复用），homeowners 早已有 `?series=` + 子类型独立页（zero-cold-water/heat-pump/condensing-boiler）

> 与后台/数据相关项（新闻、产品图、子类型页内容管理）并入 `docs/EVERHOT-NEXUS-BACKEND-IMPLEMENTATION-PLAN.md` 里程碑。
