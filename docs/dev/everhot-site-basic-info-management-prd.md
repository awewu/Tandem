# PRD：恒热官网基本信息管理

## 1. 背景

当前恒热官网 `apps/everhot-cn` 已经具备独立品牌站前台，后台品牌官网控制台也已有“产品 / 其他素材 / 资讯”能力。但恒热官网的站点身份、品牌主张、联系方式、备案版权、隐私法务占位、经销商服务入口和默认 SEO 信息仍主要硬编码在静态 HTML / JS 中，运营人员无法在后台统一维护。

本 PRD 只覆盖恒热 Everhot 官网已经实际使用的基本信息，不按通用 CMS 字段盲目扩展。

## 2. 目标

在品牌官网内容控制台中新增第一个 Tab：`基本信息`。

Tab 顺序调整为：

1. 基本信息
2. 产品
3. 其他素材
4. 资讯

运营人员可以在 `恒热 everhot` 官网控制台内维护恒热官网当前前台已经使用的基础信息，并在保存后被官网前台读取。

## 3. 范围

### 3.1 本期包含

- 恒热官网站点身份
- 品牌主张与首页首屏文案
- 首页基础数字/卖点
- 企业与集团关系
- 联系信息
- 经销商/门店服务入口基础文案
- 授权服务标准
- 备案、版权、法律基础信息
- 隐私政策基础信息
- 全站默认 SEO / 分享信息

### 3.2 本期不包含

- 京东、天猫、苏宁等购物链接
- 公众号、微信二维码、社交媒体二维码
- 顶部导航菜单管理
- 页脚栏目菜单管理
- 首页轮播图、品牌故事图、服务 Banner、页脚资质图等素材管理
- 产品管理
- 资讯管理
- 经销商门店明细 CRUD
- 多品牌通用站点配置，本期只做 Everhot

## 4. 用户故事

1. 作为品牌运营人员，我希望在恒热官网后台第一个 Tab 中维护基础信息，这样修改热线、备案号、版权主体、品牌文案时不需要改代码。
2. 作为官网负责人，我希望这些字段只覆盖官网当前真实使用的信息，避免后台出现一堆前台不用的配置项。
3. 作为开发人员，我希望字段结构可扩展，但本期不引入购物链接、公众号、导航页脚和素材管理，避免范围失控。
4. 作为合规负责人，我希望备案号、备案链接、隐私政策主体、注册地址、隐私负责人邮箱等信息可维护，避免官网长期显示占位符。

## 5. 当前官网信息来源

本 PRD 基于以下恒热官网文件梳理：

- `apps/everhot-cn/public/index.html`
- `apps/everhot-cn/public/contact/index.html`
- `apps/everhot-cn/public/find-a-pro/index.html`
- `apps/everhot-cn/public/support/index.html`
- `apps/everhot-cn/public/privacy/index.html`
- `apps/everhot-cn/public/js/nav.js`
- `apps/everhot-cn/public/js/dealers.js`
- `apps/everhot-cn/public/js/forms.js`
- `apps/everhot-cn/public/js/analytics.js`
- `apps/everhot-cn/public/robots.txt`
- `apps/everhot-cn/public/sitemap.xml`

## 6. 功能需求

### 6.1 后台入口

在 `品牌官网管理 -> 恒热 everhot -> 官网内容控制台` 中新增 `基本信息` Tab。

要求：

- `基本信息` 排在第一个。
- 原有 `产品`、`其他素材`、`资讯` 功能不丢失。
- 只在 Everhot 当前控制台内先实现。
- 如果后续进入 Rheem/Ruud，本 PRD 不要求同时适配。

### 6.2 站点身份

字段：

| 字段 | 当前官网值 | 说明 |
| --- | --- | --- |
| `siteTitle` | `恒热 Everhot | 中央采暖·热水·制冷整体解决方案` | 首页 title / 默认标题 |
| `siteName` | `Everhot 中国 Everhot China` | 结构化数据与 OG 站点名 |
| `brandNameCn` | `恒热` | 中文品牌名 |
| `brandNameEn` | `Everhot` | 英文品牌名 |
| `logoUrl` | `/assets/img/brand/everhot-logo.png` | 页眉与结构化数据 Logo |
| `whiteLogoUrl` | `/assets/img/brand/everhot-logo-white.png` | 深色弹层/品牌场景 Logo |
| `favicon16Url` | `/favicon-16x16.png` | favicon |
| `favicon32Url` | `/favicon-32x32.png` | favicon |
| `faviconIcoUrl` | `/favicon.ico` | favicon |
| `appleTouchIconUrl` | `/apple-touch-icon.png` | Apple icon |
| `themeColor` | `#BF1924` | meta theme-color |
| `siteUrl` | `https://www.everhot.com.cn` | 官网基础域名 |
| `localeLabel` | `中国 · 简体中文` | 顶部地区/语言展示 |

### 6.3 品牌主张与首页首屏

字段：

| 字段 | 当前官网值 | 说明 |
| --- | --- | --- |
| `heroEyebrow` | `瑞美（Rheem）集团旗下 · 瑞合瑞德集团中国运营` | 首页 Hero 顶部说明 |
| `heroTitleLine1` | `百年恒续` | 首页 H1 第一行 |
| `heroTitleLine2` | `为爱恒热` | 首页 H1 第二行 |
| `heroSloganEn` | `EVERHOT FOR EVERLOVE` | 英文口号 |
| `heroClaim` | `大户型选恒热，多点用水没烦恼` | 首页主张 |
| `ctaSlogan` | `大户型选恒热 · 多点用水没烦恼` | `nav.js` 注入到 CTA 的口号 |
| `primaryCtaText` | `家用产品` | 首页首屏主按钮 |
| `primaryCtaHref` | `#residential` | 首页首屏主按钮链接 |
| `secondaryCtaText` | `商用方案` | 首页首屏次按钮 |
| `secondaryCtaHref` | `#commercial` | 首页首屏次按钮链接 |

### 6.4 首页基础数字/卖点

字段应设计为列表，避免写死为数字 1 / 文字 1。

#### 技术卖点数字

当前官网值：

| 数值 | 标签 |
| --- | --- |
| `≥105%` | `冷凝热效率` |
| `≤5s` | `出热水时间` |
| `COP 4.2+` | `系统能效比` |
| `24h` | `商用连续供热` |

建议结构：

```json
{
  "technicalStats": [
    { "value": "≥105%", "label": "冷凝热效率", "sortOrder": 0, "visible": true }
  ]
}
```

#### 可持续发展数字

当前官网值：

| 数值 | 标签 |
| --- | --- |
| `38%` | `平均能耗降低` |
| `1,200+` | `节能改造项目` |
| `6,800t` | `年减少碳排放` |

建议结构：

```json
{
  "sustainabilityStats": [
    { "value": "38%", "label": "平均能耗降低", "sortOrder": 0, "visible": true }
  ]
}
```

#### 服务网络数字

当前官网值：

| 字段 | 当前官网值 |
| --- | --- |
| `serviceProvinceCount` | `30` |
| `serviceOutletCount` | `200+` |
| `serviceNetworkText` | `覆盖全国 30 省市，200+ 授权服务网点` |

### 6.5 企业与集团关系

字段：

| 字段 | 当前官网值 |
| --- | --- |
| `operatorGroupName` | `瑞合瑞德暖通科技集团` |
| `operatorGroupNameEn` | `Rhautt Comfort` |
| `operatorGroupUrl` | `https://rhautt.com` |
| `parentBrandRelationText` | `瑞美（Rheem）集团旗下 · 瑞合瑞德集团中国运营` |
| `rheemUrl` | `https://www.rheem.com.cn` |
| `ruudUrl` | `https://www.ruud.com.cn` |
| `groupSiteUrl` | `https://rhautt.com` |

### 6.6 联系信息

字段：

| 字段 | 当前官网值 | 说明 |
| --- | --- | --- |
| `customerServiceHotline` | `400-888-8888` | 全国客服热线 |
| `customerServiceTelHref` | `tel:4008888888` | 电话链接 |
| `serviceHours` | `周一至周六 9:00—18:00` | 服务时间 |
| `businessEmail` | `business@everhot.com.cn` | 工程与商务合作 |
| `mediaEmail` | `pr@everhot.com.cn` | 媒体与品牌 |
| `privacyEmail` | `privacy@everhot.com.cn` | 个人信息保护负责人邮箱 |
| `dealerJoinEmail` | `dealer@rhautt.com` | 经销商加盟 |
| `contactFormSuccessText` | `留言已提交，恒热客服将尽快与您联系。` | 联系表单成功文案 |
| `urgentRepairNote` | `提交后将由客服回拨。紧急报修请直接致电 400-888-8888。` | 联系表单底部说明 |

### 6.7 联系页入口卡片

当前联系页存在以下入口卡片。基本信息管理应允许维护卡片文案，但不做表单字段设计器。

| 类型 | 标题 | 说明/动作 |
| --- | --- | --- |
| 客服 | 全国客服热线 | 产品咨询、使用指导、售后报修，展示热线和服务时间 |
| 售后 | 预约上门维修 | 链接 `/find-a-pro/`，按钮 `立即预约` |
| 商务 | 工程与商务合作 | 展示商务邮箱 |
| 加盟 | 经销商加盟 | 链接 `/professionals/residential/partner-programs/`，按钮 `加盟申请` |
| 媒体 | 媒体与品牌 | 展示媒体邮箱 |
| 集团 | 集团与其他品牌 | 链接 `https://rhautt.com`，按钮/链接 `访问集团官网` |

建议结构：

```json
{
  "contactCards": [
    {
      "tag": "客服",
      "title": "全国客服热线",
      "body": "产品咨询、使用指导、售后报修",
      "linkText": "400-888-8888",
      "href": "tel:4008888888",
      "sortOrder": 0,
      "visible": true
    }
  ]
}
```

### 6.8 经销商/门店服务入口基础信息

字段：

| 字段 | 当前官网值 |
| --- | --- |
| `dealerLocatorButtonText` | `查找经销商` |
| `dealerLocatorPageTitle` | `查找授权经销商 | 恒热 Everhot` |
| `dealerLocatorDescription` | `覆盖全国 30 省市，200+ 授权服务网点，专业安装工程师，完善售后保障。` |
| `dealerSearchPlaceholder` | `输入城市 / 区域 / 地址，如：上海 浦东` |
| `nearestDealerButtonText` | `离我最近` |
| `dealerJoinTitle` | `成为恒热授权经销商` |
| `dealerJoinDescription` | `加入恒热经销商网络，获取独家授权、培训支持与市场资源` |
| `dealerJoinButtonText` | `申请加盟` |
| `dealerJoinHref` | `mailto:dealer@rhautt.com` |

本期不管理经销商门店明细。`apps/everhot-cn/public/js/dealers.js` 中的门店列表保持现状。

### 6.9 授权服务标准

当前 `find-a-pro` 页面存在四个授权标准：

| 数值/标题 | 标签 |
| --- | --- |
| `Rheem认证` | `官方认证安装工程师` |
| `5年质保` | `整机售后保障` |
| `48h响应` | `售后上门时效` |
| `正品承诺` | `官方渠道授权货源` |

建议结构：

```json
{
  "authorizedServiceStandards": [
    {
      "value": "Rheem认证",
      "label": "官方认证安装工程师",
      "sortOrder": 0,
      "visible": true
    }
  ]
}
```

### 6.10 备案、版权、法律基础信息

字段：

| 字段 | 当前官网值 |
| --- | --- |
| `icpNumber` | `沪ICP备XXXXXXXX号` |
| `icpUrl` | `https://beian.miit.gov.cn/` |
| `copyrightText` | `© 2026 Everhot 恒热 · 瑞合瑞德暖通科技集团 · Everhot 为注册商标` |
| `copyrightYear` | `2026` |
| `copyrightOwner` | `瑞合瑞德暖通科技集团` |
| `trademarkText` | `Everhot / 恒热 为注册商标` |
| `privacyPolicyHref` | `/privacy/` |
| `cookiePolicyHref` | `/privacy/#cookie` |
| `legalStatementHref` | `/privacy/#terms` |

### 6.11 隐私政策基础信息

字段：

| 字段 | 当前官网值 |
| --- | --- |
| `privacyEffectiveDate` | `2026-XX-XX` |
| `privacyLastUpdatedDate` | `2026-XX-XX` |
| `privacyVersion` | `v1.0` |
| `legalOperatorName` | 当前为占位：`【运营主体全称】` |
| `registeredAddress` | 当前为占位：`【注册地址】` |
| `privacyContactEmail` | `privacy@everhot.com.cn` |
| `privacyContactHotline` | `400-888-8888` |

验收时必须确认隐私政策页不再显示 `【运营主体全称】`、`【注册地址】` 这类占位文本，除非后台字段明确为空且产品决定允许占位。

### 6.12 全站默认 SEO / 分享信息

字段：

| 字段 | 当前官网值 |
| --- | --- |
| `homeMetaTitle` | `恒热 Everhot | 中央采暖·热水·制冷整体解决方案` |
| `homeMetaDescription` | `恒热 Everhot —— 百年恒续，为爱恒热。专注家用与商用中央采暖、热水、制冷整体解决方案，瑞美集团旗下品牌。` |
| `homeMetaKeywords` | `恒热,Everhot,壁挂炉,热水器,中央热水,中央采暖,空气能,商用热水,家用采暖` |
| `ogSiteName` | `Everhot 中国 Everhot China` |
| `defaultOgImage` | `https://www.everhot.com.cn/assets/img/hero-poster-desktop.webp` |
| `defaultTwitterImage` | `https://www.everhot.com.cn/assets/img/hero-poster-desktop.webp` |
| `canonicalBaseUrl` | `https://www.everhot.com.cn/` |
| `organizationName` | `Everhot 中国 Everhot China` |
| `organizationLogo` | `https://www.everhot.com.cn/assets/img/brand/everhot-logo.png` |
| `parentOrganizationName` | `Rhautt Comfort 瑞合瑞德暖通科技集团` |
| `parentOrganizationUrl` | `https://rhautt.com` |
| `sameAs` | `https://rhautt.com` |
| `sitemapUrl` | `https://www.everhot.com.cn/sitemap.xml` |

本期不要求提供每个页面独立 SEO 编辑器。只做恒热官网默认信息与当前基础页面已使用的全局信息。

### 6.13 Cookie / 匿名统计基础配置

当前 `analytics.js` 已存在 Cookie 同意横幅、匿名统计和可配置 endpoint。

字段：

| 字段 | 当前官网行为 |
| --- | --- |
| `analyticsEndpoint` | 当前读取 `window.EV_ANALYTICS_ENDPOINT`，默认不上报 |
| `analyticsConsentEnabled` | 当前可通过 `window.EV_ANALYTICS_CONSENT=false` 关闭 |
| `cookieConsentText` | `本站使用 Cookie 与匿名统计以保障基本功能并改善体验。继续浏览即表示同意，您也可拒绝非必要统计。详见隐私政策。` |
| `cookieDenyText` | `拒绝非必要` |
| `cookieAcceptText` | `同意` |

## 7. 数据模型建议

优先在 `tenant_brand_sites` 现有站点主数据外，新增一个站点设置模型，避免把大量长期配置塞进 `site_note`。

建议新增表：

`brand_site_basic_settings`

核心字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid | 主键 |
| `tenant_id` | uuid | 租户隔离 |
| `site_id` | uuid | 关联 `tenant_brand_sites.id` |
| `site_code` | text | 冗余 `everhot`，便于本地静态消费 |
| `identity` | jsonb | 站点身份 |
| `brand_claims` | jsonb | 品牌主张 / 首页首屏 |
| `stats` | jsonb | 首页数字 |
| `organization` | jsonb | 企业与集团关系 |
| `contact` | jsonb | 联系信息 |
| `dealer_service` | jsonb | 经销商服务入口 |
| `legal` | jsonb | 备案版权 |
| `privacy` | jsonb | 隐私基础信息 |
| `seo` | jsonb | 默认 SEO / 分享 |
| `analytics` | jsonb | Cookie / 匿名统计配置 |
| `created_by` | uuid | 创建人 |
| `updated_by` | uuid | 更新人 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

约束：

- `tenant_id + site_id` 唯一。
- 启用 RLS，遵循现有租户隔离。
- 所有 URL 字段必须允许相对路径 `/...` 或安全的 `https://...` / `mailto:` / `tel:`。
- 后台保存时执行最小校验，不允许 `javascript:`、危险 HTML、脚本片段。

## 8. API 建议

新增受保护 API：

- `GET /api/v2/brand-sites/:siteCode/basic-settings`
- `PUT /api/v2/brand-sites/:siteCode/basic-settings`

权限建议：

- 读取：`brand.library.read`
- 更新：`brand.library.update`
- 资产上传仍复用现有文件资产能力

公开前台消费 API 可二选一：

1. 直接提供 `GET /api/v2/sites/:siteCode/basic-settings` 公开只读投影。
2. 本地静态站继续使用生成/同步后的 JSON，例如 `/assets/site-settings/basic-settings.json`。

如果短期仍采用恒热静态站本地闭环，允许先同步为 JSON，但源数据必须来自后台保存结果，不应继续手改 HTML。

## 9. 前台接入要求

恒热官网前台应逐步从硬编码读取基本信息：

- 首页 title / meta / JSON-LD
- 首页 Hero 文案
- CTA 口号
- 联系页卡片、热线、邮箱、服务时间
- 支持页热线
- 查找经销商页标题、描述、加盟 CTA
- 隐私政策主体、注册地址、生效日期、更新时间、版本
- footer 版权、备案号、备案链接
- Cookie 横幅文案与统计配置

不要求本期一次性重构所有静态页面模板，但验收范围内的前台展示必须能消费后台配置。

## 10. 后台交互要求

### 10.1 页面结构

`基本信息` Tab 分为以下区块：

1. 站点身份
2. 品牌主张
3. 首页数字
4. 企业与集团关系
5. 联系信息
6. 经销商服务
7. 备案版权
8. 隐私法务
9. SEO / 分享
10. Cookie / 统计

### 10.2 编辑体验

- 每个区块可折叠。
- 列表型字段支持新增、删除、排序、启停。
- URL 字段保存前校验。
- 热线字段支持展示文本和实际 `tel:` 链接分开维护。
- 邮箱字段支持展示邮箱和 `mailto:` 链接自动生成。
- 保存后显示成功/失败状态。
- 重新进入页面必须回显已保存数据。

### 10.3 默认值

如果后台尚未保存配置，接口应返回从当前恒热官网代码提取的默认值，使页面可直接编辑现有内容。

## 11. 验收标准

1. `恒热 everhot` 官网内容控制台第一个 Tab 是 `基本信息`。
2. 原有 `产品`、`其他素材`、`资讯` Tab 仍可用。
3. 后台可读取并编辑本 PRD 中定义的恒热官网基础信息。
4. 保存后刷新后台，字段能正确回显。
5. 首页 Hero 文案、热线、联系邮箱、经销商入口、备案号、版权文案、隐私政策主体等验收字段能由后台配置驱动。
6. 官网不再需要为这些基础信息改静态 HTML。
7. 隐私政策页的运营主体和注册地址不再长期显示占位符。
8. URL、邮箱、电话字段有基础校验。
9. 不出现购物链接、公众号、二维码管理入口。
10. 不影响现有产品、素材、资讯管理功能。
11. 不破坏恒热官网现有视觉风格。
12. 不引入跨品牌数据串读，Everhot 配置只影响 Everhot 官网。

## 12. 测试与门禁

建议验证：

- 后台基本信息 Tab 渲染测试或静态检查。
- 基本信息 API 单测：默认值、保存、读取、租户隔离、URL 校验。
- Everhot 前台 smoke：读取配置后首页、联系页、隐私页、footer 展示正常。
- 若触及品牌官网控制台：运行相关 dealer-workbench 构建/静态测试。
- 若触及后端模块：运行相关 NestJS 单测或品牌站点服务测试。

按项目规则，涉及品牌官网/backend 变更时，完成实现后应至少评估并报告以下门禁是否运行：

- `npm run harness:arch`
- `npm run harness:consolidation`
- `npm run harness:integrity`
- `npm run test:production-readiness`

如未运行，必须说明原因。

## 13. 实施建议

### Phase 1：PRD 与字段确认

- 本文档作为字段基准。
- 用户确认需要保留/删除的字段。

### Phase 2：数据模型与 API

- 新增基本信息设置表或等价持久化模型。
- 新增后台读写 API。
- 加默认值投影。

### Phase 3：后台 Tab

- 调整 Tab 顺序。
- 新增 `基本信息` 页面。
- 接入读写、校验、回显。

### Phase 4：恒热官网消费

- 先接首页、联系页、隐私页、footer。
- 再接经销商入口、Cookie 横幅、默认 SEO。

### Phase 5：验收与清理

- 清理长期占位符。
- 保留现有静态 fallback。
- 输出验收记录。

## 14. 待确认

1. `ICP备案号` 的真实值。
2. `运营主体全称` 的真实值。
3. `注册地址` 的真实值。
4. 客服热线是否继续使用 `400-888-8888`。
5. 商务邮箱、媒体邮箱、隐私邮箱、经销商加盟邮箱是否使用当前占位值。
6. 首页技术数字和可持续发展数字是否需要保留。
7. `Rheem认证`、`5年质保` 等授权标准是否符合当前恒热品牌口径。
