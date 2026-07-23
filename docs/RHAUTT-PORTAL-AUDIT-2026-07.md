# 瑞合瑞德集团官网（public-portal）审计报告 — 2026-07

> 审计对象：`apps/public-portal`（瑞合瑞德集团 Rhautt Group 官网，Next.js 16 App Router，端口 4005）
> 审计框架：沿用 `docs/gems/EVERHOT-WEB-AUDIT-GEM.md` 九维度加权模型，便于与 everhot-cn 横向对比。
> 审计基线：`src/app/{page,about,contact,products,solutions,professional}.tsx` + `layout.tsx` + `globals.css`。
> 日期：2026-07-02 · 状态：**首测**（README 自述 "scaffold only, not production implementation proof"）。

---

## 一、结论摘要

- **总分（首测）58.4 / 100 → 等级 D+（scaffold 级，未达上线门槛）**。
- **强项**：设计系统令牌完整（`globals.css` 三轴品牌色/卡片/按钮/徽章齐备）、视觉调性统一（Rheem 红线 + Earth Day 绿 + 技术青）、信息架构骨架清晰（产品/方案/资源/关于/专业通道）。
- **致命短板（上线前必修）**：
  1. **内容真实性/合规**：高管实名简历（张建国/李明华…）、财务数字（年销 2 亿）、KPI（98% 满意度、6800t 碳减）、经销商名录（含真实地址/电话）**均为占位杜撰**，以「事实」呈现于集团官网 → **法律与商誉风险**。
  2. **品牌叙事自相矛盾**：集团与 EverHot / 瑞诺瓦 的关系三处口径不一（详见 D1）；集团名「瑞合瑞德」与 contact 页「瑞豪特」混用；热线 `400-888-8888` vs `400-800-7288` 不一致。
  3. **生产断链**：全站 `http://localhost:4000~4004`、`4001` 直链（专业通道/经销商台/瑞诺瓦），生产环境全部 404。
  4. **响应式破损**：首页/关于页用**内联** `gridTemplateColumns: repeat(5|6,1fr)`，覆盖了 `globals.css` 的 `.rh-grid-*` 媒体查询 → **移动端多处 5/6 列不塌陷**、横向溢出。
  5. **SEO/GEO 近乎为零**：6 页全 `'use client'`（静态内容却客户端渲染）、无 per-page metadata、无 canonical/OG/JSON-LD/sitemap/robots；集团官网**缺 Organization 结构化数据**。
- **上线前必修 Top 3（P0）**：内容真实性核验（法务）、品牌叙事与 NAP 统一、生产链接与 ICP。

---

## 二、维度评分表

| 维度 | 权重 | 分数 | 一句话 |
|---|---|---|---|
| D1 品牌与 VI 一致性 | 12 | **62** | 令牌/调性统一；但集团-品牌关系口径矛盾、「瑞合瑞德/瑞豪特」混用 |
| D2 信息架构与内容 | 12 | **58** | 骨架清晰；内容多为杜撰占位，资源中心/案例/renovai 路由缺失 |
| D3 SEO / GEO | 15 | **32** | 全 `use client`、无 per-page metadata/JSON-LD/sitemap/robots |
| D4 可访问性 A11y | 12 | **48** | 仅 contact 有 `<main>`；emoji 图标、无 label/skip-link、hover 仅鼠标、t3 对比度不足 |
| D5 性能 / CWV | 15 | **60** | 无图片/轻；但静态页客户端渲染、Google Fonts 外链、内联样式无法缓存复用 |
| D6 转化 CRO | 10 | **55** | CTA 布局到位；但经销商查询/咨询无真实后端，localhost 断链，无埋点 |
| D7 技术与代码质量 | 10 | **58** | 有设计系统；但内联样式泛滥（未用自有类）、数据硬编码、响应式失效 |
| D8 合规与法务 | 8 | **40** | ICP 占位、杜撰实名/财务、无隐私政策/Cookie、商标声明不完整 |
| D9 数据与后台可维护性 | 6 | **35** | 全硬编码，无 CMS/API 接入；经销商/案例/团队应走数据源 |
| **加权总分** | 100 | **58.4** | **D+** |

> 加权：Σ(分数×权重)/100。与 everhot-cn 同权重表，可直接横比（everhot 现 86.3）。

---

## 三、逐维详述（证据 → 发现[分级] → 建议）

### D1 品牌与 VI 一致性 — 62
- 证据：`globals.css` 设计系统完整（`--rh-red #8B0E04`/`--rh-cyan`/`--rh-green` 三轴 + 卡片/按钮/徽章/圆角令牌）；Rheem 红线、Bebas Neue 展示体、Earth Day 绿区，调性统一。
- 发现：
  - **[P0] 集团-品牌关系三处矛盾**：
    - `page.tsx` BRANDS：EverHot `authorized:true`（外部授权品牌）、Rhautt `自主品牌`、瑞诺瓦「独立第三方·舒适家平台」。
    - `about/page.tsx`：瑞诺瓦是集团「自主品牌」；EverHot 是集团「独家授权经销」的第三方品牌。
    - `everhot-cn`（兄弟站）：EverHot = 「瑞美(Rheem)集团旗下 · 瑞合瑞德集团中国运营」，且集团名为「瑞合瑞德暖通科技集团」。
    → 三处对 EverHot / 瑞诺瓦 / 集团 的归属口径互相打架，**对外口径必须由集团统一**。
  - **[P0] 集团名混用**：正文「瑞合瑞德」，`contact` 经销商名却是「瑞豪特」。
  - **[P1] 品牌字体**：中文回退 `PingFang SC`，无集团品牌字体；英文用 Google Fonts（Inter/Bebas）外链。
- 建议：出一份《集团品牌关系与命名规范》作为唯一事实源，全站与各品牌站对齐；`瑞豪特→瑞合瑞德`统一。

### D2 信息架构与内容 — 58
- 证据：导航 产品/解决方案/资源中心/关于集团 + 专业人员通道；首页含品牌矩阵/五系统/Find a Pro/资源/案例/Earth Day/专业通道，层次完整。
- 发现：
  - **[P0] 内容杜撰**：`about` 团队实名简历、`page` 案例（刘建国别墅 ¥18.6万…）、KPI/财务，`contact` 经销商名录（真实地址/电话）——**均占位杜撰**。
  - **[P1] 路由缺失**：`/resources/*`、`/renovai`、案例详情等被链接但无对应页面（潜在 404）。
  - **[P1] NAP 不一致**：热线 400-888-8888 / 400-800-7288 两版。
- 建议：内容改由数据源（Nexus/CMS）供给；未落实内容用「即将上线」占位而非杜撰；补齐/摘除死链路由。

### D3 SEO / GEO — 32（最低，最高杠杆）
- 证据：`layout.tsx` 仅有全站 `title`+`description`；6 页全 `'use client'`。
- 发现：
  - **[P0] 静态内容客户端渲染**：首屏内容在 JS 后才有 → 爬虫/GEO 抓取弱化；应改**服务端组件**。
  - **[P0] 无 per-page metadata**：about/products/solutions/contact 无独立 `title/description/canonical/OG`。
  - **[P0] 无结构化数据**：集团官网**必须**有 `Organization`/`WebSite` JSON-LD（名称/logo/联系/sameAs 各品牌站）。
  - **[P1] 无 `sitemap.xml`/`robots.txt`**（Next 可用 `app/sitemap.ts`/`robots.ts`）。
- 建议：静态页去 `'use client'` 改服务端渲染 + 每页 `export const metadata`；`layout` 注入 Organization JSON-LD；加 `app/sitemap.ts`、`app/robots.ts`、`metadataBase`。

### D4 可访问性 A11y — 48
- 证据：仅 `contact` 用 `<main>`；`page`/`about` 用 `<div>` 包裹，无 `<main>`/skip-link。
- 发现：
  - **[P1] 无语义地标/skip-link**（除 contact）；**[P1]** 卡片 hover 仅 `onMouseEnter/Leave`，键盘/焦点无等效反馈。
  - **[P1] 表单控件无 label**：contact 城市 `<select>` 无关联 `<label>`；Find-a-Pro 搜索 `<input>` 无 label。
  - **[P1] 图标全用 emoji**（🚿🔥❄️🏆📍📞）→ 屏幕阅读器朗读不当，应 `aria-hidden` 或换 SVG + `aria-label`。
  - **[P2] 对比度**：`--rh-t3 #A1A1AA` 于白底 ≈ 2.6:1，深色区多处低透明度白字，均不达 AA 4.5:1。
- 建议：每页 `<main>` + skip-link；hover 态改 CSS `:hover/:focus-visible`（并去内联 JS hover）；补 label/aria；`--rh-t3` 调深、复核深色区文字。

### D5 性能 / Core Web Vitals — 60
- 证据：几乎无位图（emoji/渐变），体积轻；但全页 `'use client'` + 大量内联 style 对象。
- 发现：
  - **[P1] 静态页强制客户端渲染**：增大 JS hydration、拖累 TBT/LCP。
  - **[P1] Google Fonts 外链**（Inter/Bebas）：`next/font` 已自托管化，但中文无子集、国内访问 gstatic 有风险。
  - **[P2] 内联 style 对象**无法被 CSS 缓存/复用，重复渲染成本高。
- 建议：改服务端渲染；把重复内联样式收敛到 `globals.css` 既有类；确认字体自托管、评估国内 CDN。

### D6 转化 CRO — 55
- 证据：Hero 双 CTA、Find a Pro、专业通道、多处「查找经销商/预约咨询」。
- 发现：**[P0]** 专业通道/经销商台/瑞诺瓦为 `localhost:*` 直链，生产断链；**[P1]** 经销商查询/咨询为纯前端假数据，无真实后端/留资；**[P1]** 无埋点，无法度量。
- 建议：链接改环境变量/生产域名；经销商查询接真实数据源；接入合规埋点（可复用 everhot `analytics.js` 思路）。

### D7 技术与代码质量 — 58
- 证据：`globals.css` 设计系统规范；但 `page/about` 用海量内联 style，未用 `.rh-card/.rh-btn/.rh-grid-*` 等自有类。
- 发现：
  - **[P0] 响应式失效**：内联 `gridTemplateColumns: repeat(5|6,1fr)` 覆盖媒体查询类 → 移动端不塌陷。
  - **[P1] 数据硬编码**在组件内（BRANDS/CASES/TEAM/DEALERS…），与视图耦合。
  - **[P2] 混用引号/风格**（`'use client'` vs `"use client"`），无 lint/CI 门禁。
- 建议：网格改用 `.rh-grid-*` 类或 `repeat(auto-fit,minmax())`；数据抽到 `src/data/*` 或 API；加 lint + CI。

### D8 合规与法务 — 40
- 证据：footer `粤ICP备XXXXXXXX号`（占位）；`© 2024`（过期）；商标声明一行。
- 发现：**[P0]** ICP 占位、实名/财务杜撰（见 D2）；**[P0]** 无隐私政策/Cookie 告知（PIPL）；**[P1]** 商标与授权声明需法务定稿；`© 2024` 应动态年份。
- 建议：补隐私政策/Cookie（可复用 everhot 版式）；填真实 ICP；法务核定商标/授权/主体信息；版权年份动态。

### D9 数据与后台可维护性 — 35
- 证据：全部内容硬编码在组件，无 API/CMS 接入。
- 发现：**[P1]** 经销商/案例/团队/KPI 应来自 Nexus 或 CMS，便于运营维护与合规留痕；**[P1]** 与 everhot 已建的 Nexus 底座未打通。
- 建议：经销商网络接 Nexus（`dealers`/`stores` 已在 RLS schema）；案例/团队走 CMS 或数据文件；分阶段接入。

---

## 四、整改路线

### P0（上线前必修）
| 项 | 维度 | 责任链路 | 工作量 |
|---|---|---|---|
| 内容真实性核验（团队/财务/KPI/经销商/案例）去杜撰 | D2/D8 | **业务/法务**提供事实或改占位 | 中 |
| 集团品牌关系与命名（瑞合瑞德/瑞豪特、EverHot/瑞诺瓦 归属）统一 | D1 | **集团**定口径 → 我改文案 | 小-中 |
| NAP 统一（唯一热线/邮箱/地址） | D1/D2 | 业务确认 → 我改 | 小 |
| 生产链接（去 localhost，改 env/域名）+ 真实 ICP + 隐私政策 | D6/D8 | 我（env）+ 业务（ICP/主体） | 小-中 |

### P1（代码可控，我可直接做）
| 项 | 维度 | 工作量 |
|---|---|---|
| 静态页去 `use client` 改服务端渲染 + 每页 metadata | D3/D5 | 中 |
| Organization/WebSite JSON-LD + `sitemap.ts` + `robots.ts` + `metadataBase` | D3 | 小-中 |
| 响应式修复（网格改 `.rh-grid-*`/auto-fit） | D7/D5 | 中 |
| A11y：`<main>`+skip-link、label/aria、hover 改 CSS、`--rh-t3` 对比度 | D4 | 中 |
| 数据抽离到 `src/data/*`（去视图耦合，为接 CMS/Nexus 铺路） | D7/D9 | 中 |

### P2（优化）
埋点接入、经销商接 Nexus、案例/团队走 CMS、lint+CI、字体国内 CDN 评估。

---

## 五、复评方式
整改后重跑：per-page metadata 覆盖、JSON-LD 存在性、`use client` 数、移动端断点截图、localhost 链接数=0、ICP/隐私页、对比度。目标：**总分 ≥ 82（B+）、P0 清零** 方可上线。

---

_首测 2026-07-02 · 框架同 `EVERHOT-WEB-AUDIT-GEM.md` · 与 everhot-cn（86.3）横向可比_
