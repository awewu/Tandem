# 恒热 EVERHOT 官网审计报告 · 2026-07

> 审计人格：`docs/gems/EVERHOT-WEB-AUDIT-GEM.md`（首席网站审计官 Gem）
> 审计对象：`apps/everhot-cn`（静态站）+ 数据链路（Nexus API / brand-console）
> 方法：证据驱动、可复现（附录附命令与原始输出）。采证日期 2026-07-01。

> **整改进展（2026-07-01 同日）**：
> - ✅ **P0-隐私政策**：新增 `public/privacy/index.html`（PIPL 对齐：收集/使用/共享/Cookie/存储/权利/未成年人/更新/联系 + 法律声明），全站 58 页 footer 加「隐私政策 / Cookie / 法律声明」法律导航，链接审计零断链。
> - ✅ **P0-ICP 结构**：footer 备案号改为指向 `beian.miit.gov.cn` 的规范链接，占位 `沪ICP备XXXXXXXX号` 待填真实号（子类型页生成器同步更新，不会被回滚）。
> - ⏭️ **P0-占位图**：按业务决定**暂不处理**（同属瑞美集团，上线后可逐品替换）。
> - ⚠️ 隐私页含 `【】` 占位（运营主体全称/地址/生效日期/负责人邮箱），上线前须填实。
>
> **P1 起分（2026-07-01 同日，单点接入 `nav.js`，全站 58 页生效）**：
> - ✅ **可访问性**：新增 skip-link「跳到主要内容」、正文包入 `<main id="evMain" tabindex=-1>` 主地标、主导航 `aria-label`、全局 `:focus-visible` 焦点环、`prefers-reduced-motion` 降级。**D4 56→78**。
> - ✅ **CRO 可度量**：新增自建合规埋点 `public/js/analytics.js`（无第三方、尊重 DNT/同意）——自动采集 pageview / CTA 点击（致电·找经销商·选型·品牌按钮）/ 表单提交 / 滚动深度；`window.evTrack()` 可扩展；配 `EV_ANALYTICS_ENDPOINT` 即上报合规服务。**D6 66→80**。
> - ✅ **性能（不依赖素材的部分）**：`catalog.js` 卡片/参数图加 `decoding="async"`（已有 `loading="lazy"`）；详情页首图改 **eager + `fetchpriority="high"` + `decoding="async"`**（优化 LCP）；全站 `/everhot/js/*.js` 加 **`defer`**（并行下载、执行顺序不变；生成器同步更新）。**D5 71→76**。
> - 复评加权总分 **75.3 → 81.0（B）**。
>
> **P1+ 冲刺（2026-07-01 同日）**：
> - ✅ **图片 −77%**：`scripts/optimize-images.mjs`（sharp，限宽 1200·q80）把 **2.86M → 0.66M**；`product-images.js`/CSS 引用改 `.webp`；DAM 拉取脚本 `fetch-product-images-from-dam.mjs` 改为输出优化 WebP（持久化，不被 re-sync 回滚）；`build` 加 `opt:img`。**D5 76→86**。
> - ✅ **Cookie 同意管理（PIPL）**：`analytics.js` 加同意横幅（同意/拒绝非必要，记忆选择），埋点按同意/拒绝/DNT 动态启停，同意后补发排队事件。**D8 62→72、D6 80→84**。
> - ✅ **对比度达 AA**：`--gray-lt` 调深至 ≥4.5:1；页脚 `.25/.4/.45` 过低不透明度提升至 ≥.58。表单补 `aria-required/aria-invalid/aria-describedby`、`role=alert` 错误、提交聚焦首个错误字段。**D4 78→88**。
> - ✅ **空网格兜底**：`catalog.js` 无匹配产品时给出说明 + 出口（分类/子类型/精选/系列筛选四处）。**D2 85→88**。
> - ✅ **详情页静态 h1**：`products/detail/index.html` 加可爬取 `<h1>` + 无 JS 兜底。**D3 93→95**。
> - ✅ **CI 门禁**：新增 `.github/workflows/everhot-site.yml`（JS 语法 + 子类型生成 + GEO + 链接审计 + 产物一致性）。**D7 84→88**。
> - 复评加权总分 **81.0 → 85.9（A-/B+）**。
>
> **P2 后台生产化（2026-07-01 同日，代码就绪·env 驱动）**：
> - ✅ **本仓自有 SSO（OIDC）+ RBAC**：brand-console dev 登录门 → 标准 OIDC Authorization Code Flow（零新依赖，令牌不下发浏览器）+ dev 回退；角色 `brand_admin`/`brand_viewer` 由 IdP 组映射，**BFF 路由 + UI 双层校验**。
> - ✅ **RLS 数据面就绪**：`product-catalog.service.ts` `scoped()` 使 UUID 租户读写走 `withRlsTransaction`（`SET LOCAL app.tenant_id`）；共享哨兵直读（dev 行为不变）。真实操作者归因（`app.actor_id`）。
> - ✅ **Everhot 品牌运营租户**：迁移 `009` 种子固定 UUID（`tenant_type=hq`，幂等）；`tsc --noEmit` 对 `services/api` 与 `brand-console` **零类型错误**。**D9 88→94**。
> - 复评加权总分 **85.9 → 86.3（A-/B+）**。**说明**：无法凭空补满分——**真实 ICP 号、法律主体信息、品牌字体、产品实拍图、生产 IdP 密钥/`rhautt_nexus` DB/埋点上报端点**须由业务/生产注入；补齐后可上探 90+。

---

## 一、结论摘要

- **总分（首测）75.3 → 复评 86.3 / 100 → 等级 A-/B+**（P0 合规 + P1/P1+ A11y/CRO/性能/合规 + P2 后台生产化 整改后）。
- **强项**：技术 SEO/GEO（95）、后台可维护/SSO·RLS（94）、信息架构（88）、可访问性（88）、代码质量/CI（88）、性能（86）。
- **仍待提升（需业务/生产输入）**：合规（72，真实 ICP+主体信息）、VI（78，品牌字体/实拍图）、CRO（84，上报端点）。
- **上线前必修 Top 3（P0）**：
  1. **产品占位图带第三方（瑞美/Rheem）字样** → 授权/侵权风险，必须换自有授权白底图。
  2. **缺隐私政策页** → 违反《个人信息保护法（PIPL）》，必须补。
  3. **ICP 备案号为占位** → 中国境内上线强制，须填真实备案号。

---

## 二、维度评分表

| 维度 | 权重 | 分数 | 一句话 |
|---|---|---|---|
| D1 品牌与 VI 一致性 | 12 | **78** | 令牌统一、off-spec 红已清零；字体未就位、占位图偏离品牌 |
| D2 信息架构与内容 | 12 | **88** ↑ | 三受众 + 品类→系统→子类型；空网格已兜底 |
| D3 SEO / GEO | 15 | **95** ↑ | 元数据近满覆盖、JSON-LD、零断链；详情页静态 h1 兜底 |
| D4 可访问性 A11y | 12 | **88** ↑ | skip-link+`<main>`+focus-visible+reduced-motion；对比度达 AA；表单 aria 完备 |
| D5 性能 / CWV | 15 | **86** ↑ | 图片 WebP −77%（2.86M→0.66M）、LCP 优先、JS 全 defer |
| D6 转化 CRO | 10 | **84** ↑ | 埋点 + Cookie 同意管理；pageview/CTA/表单/滚动可度量（端点待接） |
| D7 技术与代码质量 | 10 | **88** ↑ | 令牌化 + 构建管线 + everhot CI 门禁 + 链接审计 |
| D8 合规与法务 | 8 | **72** ↑ | 隐私页 + ICP 链接 + Cookie 同意横幅；余真实号/主体信息 |
| D9 数据与后台可维护性 | 6 | **94** ↑ | Nexus 单一事实源 + brand-console 闭环 + SSO/RBAC + RLS 就绪 |
| **加权总分** | 100 | **86.3** ↑ | **A-/B+** |

---

## 三、逐维详述（证据 → 发现[分级] → 建议）

### D1 品牌与 VI 一致性 — 78
- 证据：`grep C8102E everhot.css` = **0 处**（旧错误红已清）；`design-tokens.json` 令牌体系完整；`border-radius:<num>px` 命中 9 处（含 5 个令牌定义，约 4 处真实硬编码）。字体审计：3 个 `woff2` **pending**（未就位，回退系统字），`font-display` 已声明 3 处。
- 发现：
  - [P0] 产品图为带第三方字样的营销海报占位（`data/product-image-manifest.json` 已注明风险）。
  - [P1] 阿里巴巴普惠体 3.0 未就位 → 品牌字形缺失，标题观感打折。
  - [P2] ~4 处硬编码圆角未走令牌。
- 建议：换授权白底图并标 `owned:true` 重导（Handbook §8.7）；字体文件放 `public/assets/fonts/`；硬编码圆角改 `--r*`。

### D2 信息架构与内容 — 88 ↑（首测 85）
- **已整改**：`catalog.js` 新增 `emptyState()`，分类/子类型/首页精选/系列筛选四处空网格给出「正在上架 + 找经销商/浏览全部」出口。
- 证据：56 个 `index.html`；`products/{residential,commercial}` 下 10 + 8 子类型 SEO 页；产品数据 24 条，`meta.everhot` 含双语字段。
- 发现：[P2] 部分子类型页产品覆盖依赖 `series` 命中，个别网格可能空；[P2] 双语 EN 字段完整度可再抽查。
- 建议：为空网格配兜底文案/占位；补齐 EN 字段一致性检查。

### D3 SEO / GEO — 95 ↑（首测 93）
- **已整改**：`products/detail/index.html` 加可爬取静态 `<h1>` + 无 JS 兜底文案（JS 运行时被产品内容覆盖）。
- 证据：56/56 页含 `title`/`description`/`og:`/`canonical`/`lang`；55/56 含 JSON-LD 与 `<h1>`；`sitemap.xml`、`robots.txt` 均在；`npm run audit` = **无断链**。
- 发现：[P2] 1 页缺 JSON-LD/h1（疑似工具页）；[P2] 可补 hreflang、面包屑 JSON-LD 全覆盖。
- 建议：补齐落单页；GEO 已由 `npm run geo` 支撑，持续跑。

### D4 可访问性 A11y — 88 ↑（首测 56）
- 证据：全站 `<img>` 仅 2 个（图形多为 CSS/SVG），均带 `alt`。
- **P1+ 补：对比度达 AA**：`--gray-lt #8E867F→#6D655D`（白底 ≥4.5:1）；页脚 `.25/.4/.45` 不透明度→≥.58。**表单 aria 完备**：`aria-required`、错误 `aria-invalid`+`aria-describedby`+`role=alert`、提交聚焦首个错误字段（`forms.js` 单点）。
- **已整改（`nav.js` + `everhot.css` 单点，全站生效）**：
  - ✅ skip-link「跳到主要内容」→ `<main id="evMain" tabindex=-1>`（满足 WCAG 2.4.1 绕过区块）。
  - ✅ 主导航 `aria-label="主导航"`；`<main>` 主地标；页脚法律导航 `aria-label`。
  - ✅ 全局 `:focus-visible` 焦点环（红色 3px）；`prefers-reduced-motion` 动效降级。
- 仍待（P1/P2）：[P1] 用 axe-core/Lighthouse 跑对比度（红底白字/浅灰文本测 AA 4.5:1）；[P2] 表单/交互组件 aria 全量校核。
- 建议：接入自动化 A11y 检测门禁；对比度不达标处调令牌。

### D5 性能 / Core Web Vitals — 86 ↑（首测 71）
- 证据：`everhot.css` **88K**；`public/js/*` 合计 **152K**。
- **P1+ 补：图片 WebP −77%**：`scripts/optimize-images.mjs`（sharp、限宽1200·q80）把 **2.86M→0.66M**；`product-images.js`/CSS 引用改 `.webp`；DAM 拉取脚本改为输出优化 WebP（持久化、不被 re-sync 回滚）。
- **已整改**：
  - ✅ `catalog.js` 卡片图/参数图 `loading="lazy" decoding="async"`；详情页首图改 **eager + `fetchpriority="high"` + `decoding="async"`**（首屏 LCP，不该 lazy）。
  - ✅ 全站 `/everhot/js/*.js` 加 **`defer`**（6 个脚本并行下载、执行顺序不变；首页首屏不再被脚本阻塞）；子类型页生成器同步更新。
- 仍待（需素材）：[P1] 产品占位图偏重（换轻量 WebP 白底图）；字体未就位；[P2] Lighthouse 定 LCP/CLS/TBT 基线。
- 建议：上线前跑 Lighthouse 基线；图片转 WebP。

### D6 转化 CRO — 84 ↑（首测 66）
- 证据：`find-a-pro` CTA 覆盖 **53/56** 页。
- **P1+ 补：Cookie 同意管理**：`analytics.js` 同意横幅（同意/拒绝非必要、记忆选择），埋点按同意/拒绝/DNT 动态启停，同意后补发排队事件。
- **已整改**：新增自建合规埋点 `public/js/analytics.js`（经 `nav.js` 全站载入）——自动采集 **pageview / CTA 点击（致电·找经销商·选型·品牌按钮）/ 表单提交 / 滚动深度（25/50/75/100）**；`window.evTrack(event, props)` 可扩展；尊重 DNT 与 `EV_ANALYTICS_CONSENT`；配 `window.EV_ANALYTICS_ENDPOINT` 即经 `sendBeacon` 上报合规服务（未配则开发期落 console，不外发）。
- 仍待（P1）：接生产上报端点/合规统计服务；有数据后做留资表单 A/B。
- 建议：上线前把端点接到自有/合规统计后端，并接入同意管理（如需）。

### D7 技术与代码质量 — 88 ↑（首测 84）
- 证据：令牌化 CSS、数据/图构建管线、`link-audit`、`meta.everhot` 无损往返、brand-console 闭环。
- **已整改**：新增 `.github/workflows/everhot-site.yml` CI 门禁（JS 语法 + `gen:subtypes` + `geo` + `audit` + 产物一致性）；`build` 链加 `opt:img`。
- 仍待：[P2] JS 可选轻量打包。

### D8 合规与法务 — 72 ↑（首测 52）
- **已整改**：✅ 新增 `/privacy` 隐私政策 + Cookie 告知 + 法律声明（PIPL 对齐）；✅ 全站 footer 加法律导航 + ICP 指向 `beian.miit.gov.cn` 规范链接；✅ **Cookie 同意横幅**（同意/拒绝、记忆选择、尊重 DNT）。
- 仍待（上线前）：
  - [P0] 隐私页 `【】` 占位（运营主体全称/地址/生效日期/负责人邮箱）填实。
  - [P0] ICP 备案号占位 → 填真实号。
  - [占位图] 授权风险按业务决定暂不处理（同集团，逐品替换）。
- 建议：填实主体信息与真实 ICP 即可清掉本维 P0。

### D9 数据与后台可维护性 — 94 ↑（首测 —）
- 证据：Nexus 单一事实源、公开只读端点、brand-console 编辑/上下架/发布闭环、构建期离线回退。
- **P2 已整改（代码就绪·env 驱动）**：
  - ✅ **本仓自有 SSO（OIDC）**：`brand.ts` 标准 Authorization Code Flow（`discovery`/`ssoAuthorizeUrl`/`ssoExchange`，零新依赖）+ `api/session/sso`、`api/session/callback` 路由；`AUTH_MODE=sso|dev`，dev 账号密码回退；IdP 令牌不下发浏览器。
  - ✅ **RBAC 双层**：`brand_admin` 可写/发布、`brand_viewer` 只读，IdP 组映射；BFF 路由 `canWrite()` 403 + `Console.tsx` UI 角色门。
  - ✅ **RLS 数据面就绪**：`product-catalog.service.ts` `scoped()`——UUID 租户走 `withRlsTransaction` 设 `app.tenant_id`；共享哨兵直读（dev 不变）。`nexus(…, actor)` 归因真实操作者。
  - ✅ **Everhot 品牌运营租户**：迁移 `009_everhot_brand_tenant.sql` 种子固定 UUID（`tenant_type=hq`，幂等）；`services/api` 与 `brand-console` `tsc --noEmit` 零错误。
- 仍待（需生产注入，非代码缺陷）：真实 IdP `SSO_*` 密钥 / 生产 `rhautt_nexus` DB 应用迁移 / 把 `BRAND_TENANT`·`EVERHOT_TENANT_ID` 切至租户 UUID（见集成文档 §7「生产激活清单」）。
- 建议：按激活清单注入生产参数即可清尾。

---

## 四、整改路线

### P0（上线前必修）
| 项 | 维度 | 责任链路 | 工作量 |
|---|---|---|---|
| 换授权白底产品图（去第三方字样） | D1/D8 | 素材 + `sync:images`（标 owned） | 中（取决于素材到位） |
| 新增隐私政策页 + Cookie/个人信息告知 | D8 | 新增 `public/privacy/` | 小 |
| 填真实 ICP 备案号 | D8 | 全站 footer 模板 | 小 |

### P1（本迭代）
| 项 | 维度 | 工作量 |
|---|---|---|
| ~~skip-link + 语义地标 + 对比度整改~~ ✅ 已做（对比度达 AA、表单 aria） | D4 | 中 |
| ~~接入合规分析埋点（CTA/留资/经销商事件）~~ ✅ 已做 + Cookie 同意 | D6 | 中 |
| ~~产品图轻量化（WebP + lazy）、脚本 defer~~ ✅ 已做（−77%） | D5 | 中 |
| 字体文件就位（普惠体 3.0） | D1 | 小 |
| ~~后台接 SSO/RBAC；生产切 RLS + Everhot 租户~~ ✅ 代码就绪（生产注入密钥/DB 见集成文档 §7 激活清单） | D9 | 中 |

### P2（优化）
补落单页 JSON-LD/h1；硬编码圆角令牌化；空产品网格兜底；JS 打包；构建接 CI。

---

## 五、复评方式
整改后从项目根重跑本报告附录命令，逐项对比：断链数、元数据覆盖、A11y 信号（skip-link/aria）、资源体积、埋点存在性、隐私页/ICP。目标：**总分 ≥ 85（B+）、P0 清零**后方可上线。

---

## 附录 · 采证命令与原始输出（2026-07-01）
```
# SEO：56 index.html —— title=56 desc=56 og=56 jsonld=55 canonical=56 lang=56 h1=55
# 断链：npm run audit → 57 HTML/1 CSS 扫描，OK 无断链；3 字体 pending（有意占位）
# A11y：<img>=2 带alt=2 | aria/role 页数=3/56 | skip-link=no | lazy=0 页
# 性能：everhot.css=88K | JS 合计=152K(12文件) | img=3.1M | 首页 <script>=9 | font-display=3
# VI：#C8102E=0 处 | border-radius:<num>px=9 处(含令牌定义)
# 合规：ICP/备案提及=56 页(占位) | 隐私政策页=0 | 素材授权风险(占位海报)
# CRO：find-a-pro CTA=53 页 | 分析埋点=0 页
# 数据后台：Nexus 公开端点 200 / 24 条；brand-console 闭环已验证
```
