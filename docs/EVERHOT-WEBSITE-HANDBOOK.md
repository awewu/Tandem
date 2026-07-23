# 恒热 EVERHOT 官网 · 专项建设手册（总纲）

> **单一事实源（SSOT）**：本文件是恒热官网（`everhot.com.cn`）建设、运维、迭代的**总纲**。
> 标准细节分散在若干专项文档中（见 §2 索引），本文负责**串起全局 + 给操作方法**。
> 后续任何人接手：先读本文 → 按 §8 SOP 操作 → 遇到问题查 §9 FAQ。
>
> 维护约定：每次结构性变更后，更新本文对应章节的日期戳与「当前状态」。
> 最近更新：2026-07-01（后台数据打通 P1–P5 全部落地）。

---

## 1. 定位与不可变铁律

### 1.1 品牌定位
- **恒热 EVERHOT** = 集团旗下独立品牌站，自有域名 `everhot.com.cn`，基路径 `/everhot`。
- 内容调性：复刻 `rheem.com` 的**三受众架构**（家用 / 商用 / 专业人士），Everhot 暖红主色。
- 品牌叙事：**「百年恒续 · 为爱恒热」**；隶属 Rheem 集团、由**瑞合瑞德集团**在华运营；**弱化澳洲来源**，强调集团背书与本土服务。

### 1.2 解耦铁律（来自 `RHAUTT-NEXUS-MANAGEMENT-HUB.md`，必须遵守）
1. 官网是**纯静态站**，独立 UI/VI、独立部署；**不依赖运行时后端**即可渲染。
2. 官网**不直连数据库**；一切数据经 **Nexus API**（`/api/v2`）在**构建期**拉取，落成静态文件。
3. 后台（brand-console）是**内部 admin 工具**，可有自有 UI，但**不吞并**官网、不共享 UI 组件库。
4. 依赖单向向下：`官网(静态) → 构建脚本 → Nexus API(骨架) → 领域服务 → 数据`。
5. 事实源单一：产品数据事实源是 **Nexus `products` 表**；产品图事实源是 **DAM（file-artifact）**。静态文件（`products-data.js` / `product-images.js`）是**构建产物**，不手改。

---

## 2. 关联文档索引（各司其职）

| 文档 | 职责 |
|---|---|
| **本文 `docs/EVERHOT-WEBSITE-HANDBOOK.md`** | 总纲：架构、标准、SOP、FAQ、路线图 |
| `apps/everhot-cn/VI-SPEC.md` | VI 规范（官方手册吸收版）：标准色/辅助色/字体/logo 用法 |
| `apps/everhot-cn/DESIGN-TOKENS-README.md` | 设计令牌说明（CSS ⇄ Figma Tokens Studio 双向） |
| `apps/everhot-cn/design-tokens.json` | 令牌事实源镜像（供 Figma 导入） |
| `docs/EVERHOT-RHEEM-PARITY-AUDIT.md` | 对标 Rheem 的差距审计 + UI/VI 审计结论 |
| `docs/gems/EVERHOT-WEB-AUDIT-GEM.md` | **审计 Gem**：可复用的「首席网站审计官」专家人格（9 维评分/方法/模板） |
| `docs/EVERHOT-WEBSITE-AUDIT-2026-07.md` | 首次落地审计报告（总分 75.3 / B，含 P0/P1/P2 整改路线） |
| `docs/EVERHOT-NEXUS-INTEGRATION-DESIGN.md` | 后台数据打通设计（P0–P5，含已实现记录） |
| `docs/EVERHOT-NEXUS-BACKEND-IMPLEMENTATION-PLAN.md` | 后端实现计划 |
| `docs/RHAUTT-NEXUS-MANAGEMENT-HUB.md` | 管理中枢架构 + 解耦铁律 + brand-console 定位 |

---

## 3. 系统架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│  数据/事实源（Nexus 控制平面）                                     │
│   • PostgreSQL: public.products (目录) · public.uploaded_files(DAM)│
│   • NestJS API :3300  /api/v2                                      │
│     - 公开只读:  GET /brand/everhot/products        (脱敏, 无鉴权)  │
│     - 鉴权写:    POST /product-catalog/devices      (AuthGuard)     │
│     - DAM:       POST /file-artifact/upload-base64  GET /:id/base64 │
└───────────────▲───────────────────────────────▲──────────────────┘
                │(构建期拉取, 匿名/ops令牌)        │(编辑/上传, BFF服务令牌)
     ┌──────────┴──────────┐          ┌───────────┴─────────────┐
     │ 构建脚本 (everhot-cn)│          │ brand-console :4012 (BFF)│
     │ fetch-products…      │          │ 编辑/上新/上下架/发布     │
     │ fetch-product-images…│          │ (Next.js, httpOnly cookie)│
     └──────────┬──────────┘          └───────────┬─────────────┘
                │ 生成静态文件                      │ 点「发布」= spawn 构建脚本
                ▼                                   │
     ┌─────────────────────────────────────────────▼───────────────┐
     │ 官网静态站 everhot-cn :4011 (纯静态, /everhot)                 │
     │   public/js/products-data.js   ← 构建产物(勿手改)             │
     │   public/js/product-images.js  ← 构建产物(勿手改)             │
     │   public/**/*.html  public/css/everhot.css  public/js/*.js    │
     └───────────────────────────────────────────────────────────────┘
```

**闭环**：在 brand-console 改产品 → 入库 → 点「发布」 → 构建脚本从 Nexus 重生成静态文件 → 官网更新。
**降级**：Nexus 不可达时，构建脚本**离线回退**（保留上次静态文件），官网照常上线。

---

## 4. 目录与文件地图（`apps/everhot-cn/`）

| 路径 | 角色 |
|---|---|
| `public/index.html` | 首页（hero / 三受众 / 品类入口） |
| `public/products/residential/**` | 家用品类页 + 10 个子类型 SEO 落地页 |
| `public/products/commercial/**` | 商用品类页 + 8 个子类型 SEO 落地页 |
| `public/products/detail/index.html` | 产品详情页（`?model=slug`） |
| `public/css/everhot.css` | **样式事实源**；`:root` 内是 CSS 令牌（VI 真相源） |
| `public/js/products-data.js` | **产品数据（构建产物）**：`window.EVERHOT_PRODUCTS` + `EVERHOT_CATALOG` |
| `public/js/product-images.js` | **产品图映射（构建产物）**：卡片图 + 参数长图两张表 |
| `public/js/catalog.js` | 渲染引擎：网格/详情页按 `products-data.js` 渲染 |
| `public/js/product-art.js` | 无图时的 SVG 矢量插画回退 |
| `public/js/nav.js` | 顶部导航 / mega-nav / 受众弹窗 |
| `public/assets/img/products/<slug>.jpg` | 产品图静态资源（构建期从 DAM 拉回） |
| `data/product-image-manifest.json` | 产品图来源清单 + `owned` 授权标记 |
| `scripts/*.mjs / *.js` | 构建与数据管线（见 §7、§8） |
| `design-tokens.json` · `VI-SPEC.md` | 设计令牌 / VI 规范 |

---

## 5. VI / UI 标准（事实源：`everhot.css :root` + `VI-SPEC.md`）

### 5.1 颜色（关键令牌）
| 令牌 | 值 | 用途 |
|---|---|---|
| `--red` / `--accent` | `#BF1924` | 恒热红（主色，**面积 ≤ 30%**，须配次级中性色） |
| `--red-dk` `--red-hi` `--red-lo` | `#9E141D` `#C81C28` `#8E1018` | 红色渐变族 |
| `--red-tint` | `rgba(191,25,36,0.05)` | 极浅红底（统一 tint，**禁止散装粉色**） |
| `--ink` / `--dark` | `#2B2623` | 正文/标题墨色 |
| `--gray` `--gray-lt` | `#5A534E` `#8E867F` | 中性灰文字 |
| `--surface` `--surface-2` `--page` | `#F6F3EF` `#FBF9F6` `#FFFFFF` | 背景层 |
| `--border` `--border-lt` | `#E8E2DC` `#F1EDE8` | 描边 |
| 辅助色 `--aux-*` | teal/green/yellow… | **仅点缀**，配主色+次级色 |

**红线（off-spec 禁用）**：`#C8102E`（旧错误红）、任何散装粉色 hex、冷灰回潮。新增颜色必须走令牌。

### 5.2 圆角 / 间距 / 字号
- 圆角：`--r-sm 4` · `--r 6` · `--r-lg 10` · `--r-xl 16` · `--r-pill 999`。**禁止裸写 px 圆角**。
- 间距：`--space-1…10`（4→64px 阶梯）。
- 字号：`--fs-display/h1/h2/h3/lead/body/sm`（多为 `clamp()` 响应式）。

### 5.3 字体
- 中英文统一 **阿里巴巴普惠体 3.0**；权重：标题 Black≈900 / 副标 Medium≈500 / 内文 Regular≈400。
- 字体文件放 `public/assets/fonts/`；未就位回退系统字。

### 5.4 改 VI 的唯一正确姿势
1. 改 `public/css/everhot.css` 的 `:root` 令牌（或新增语义令牌）。
2. 同步 `design-tokens.json`（供 Figma）。
3. 全站引用令牌，**不硬编码**。改动记入 `VI-SPEC.md`。

---

## 6. 内容架构与 SEO/GEO

- **三受众**：家用 Homeowners / 商用 Commercial / 专业人士 Professionals（首页受众弹窗 + 顶部导航）。
- **产品信息架构**：`品类(cat) → 系统(sys) → 子类型(series)`。
  - 家用：`residential/{water-heating, heating-cooling}/<子类型>/`（10 页）
  - 商用：`commercial/{water-heating, heating-cooling}/<子类型>/`（8 页）
- **子类型 SEO 页**：每页含 hero + 选购理由卡 + `data-catalog="cat:sys:series"` 产品网格 + CTA + JSON-LD。由 `scripts/gen-subtype-pages.mjs` 数据驱动生成。
- **产品详情页**：`products/detail/?model=<slug>`，`catalog.js` 按 `products-data.js` 渲染，含参数长图区。
- 每页须有：`title/description`、Open Graph、JSON-LD、面包屑；产出经 `npm run geo`（GEO/SEO 构建）+ `npm run audit`（链接审计）。

---

## 7. 数据与后台打通（详见 `EVERHOT-NEXUS-INTEGRATION-DESIGN.md`）

### 7.1 产品数据链路
- 事实源：`public.products`（`tenant='rhautt_shared'`, `brand='everhot'`）。
- 完整原始产品对象存 `products.meta.everhot`（保证无损往返）。
- 公开只读：`GET /api/v2/brand/everhot/products`（脱敏，回读 `meta.everhot`）。
- 构建期：`fetch-products-from-nexus.mjs` → 重生成 `products-data.js`（保留头注释与 `EVERHOT_CATALOG` 工具块）。

### 7.2 产品图链路（DAM）
- 事实源：`public.uploaded_files`（DAM）；产品行 `meta.imageArtifactId/imageObjectKey/imageRole` 指向图。
- `imageRole`：`card`（卡片图）/ `spec`（详情页参数长图）。
- 上传：`POST /api/v2/file-artifact/upload-base64`；读取：`GET /api/v2/file-artifact/:id/base64`（Fastify 安全，纯 JSON）。
- 构建期：`fetch-product-images-from-dam.mjs` → 写 `public/assets/img/products/<slug>.<ext>` + 重生成 `product-images.js`。
- **授权底线**：`sync-product-images-to-dam.mjs` 默认只上传 `product-image-manifest.json` 中 `"owned": true` 的图；`--include-placeholders` 才含 dev 占位图（**当前占位图带第三方字样，仅本地用，上线前必换授权白底图**）。

### 7.3 后台 brand-console（`apps/brand-console`，端口 4012）
- Next.js 16 内部 admin；BFF 服务端持 `JWT_SECRET` 铸 `rhautt_shared` 服务令牌调 API，**密钥/令牌不下发浏览器**（httpOnly cookie）。
- 能力：产品列表 / 编辑 / 上新 / 上下架（安全合并 `meta.everhot`）/ 产品图上传 / **一键发布**（spawn 构建脚本）。
- dev 登录门：`.env.local` 的 `BRAND_CONSOLE_USER/PASSWORD`（默认 `admin` / `everhot2026`）。**生产改接本仓自有 auth/SSO + RBAC**，不依赖跨仓 CRM 仓库或共享服务。

---

## 8. 标准操作手册（SOP）

> 所有命令的工作目录标注在各步；`<repo>` = `/Users/tiechuishan/Documents/RheNova/enterprise_website`。

### 8.0 一次性准备
- Node 18+；本机 PostgreSQL 16 已运行，库 `rhautt_nexus`，角色 `rhautt`。
- 环境变量事实源：`<repo>/.env.nestjs`（含 `JWT_SECRET` / `POSTGRES_*`）。

### 8.1 本地起全栈
```bash
# 1) Nexus API（:3300）—— 从 <repo> 运行
JWT_SECRET=<见.env.nestjs> POSTGRES_URI=postgresql://rhautt:rhautt2026@localhost:5432/rhautt_nexus \
PORT=3300 POSTGRES_SYNCHRONIZE=false \
STORAGE_LOCAL_PATH=<repo>/storage \
npx ts-node --project services/api/tsconfig.json services/api/src/main.ts

# 2) 官网静态站（:4011）—— 从 <repo>/apps/everhot-cn
npm run dev

# 3) 品牌后台（:4012）—— 从 <repo>/apps/brand-console
npm run dev
```
> 说明：`POSTGRES_SYNCHRONIZE=false` 保护既有库结构；`STORAGE_LOCAL_PATH` 让 DAM 落盘在 repo 内。

### 8.2 首次灌数据（把 products-data.js 导入 Nexus）
```bash
# 从 <repo>，需 API 在跑
node apps/everhot-cn/scripts/sync-products-to-nexus.mjs           # 产品 → 库（幂等）
node apps/everhot-cn/scripts/sync-product-images-to-dam.mjs --include-placeholders   # 图 → DAM（dev 占位图）
```

### 8.3 改产品文案 / 上新 / 上下架 / 换图（推荐走后台）
1. 打开 `http://localhost:4012`，登录（`admin` / `everhot2026`）。
2. 表格内改**名称/标语/品类** → 逐行「保存」；「上架/下架」切状态；「图」按钮传产品图。
3. 「+ 上新」建新产品（输 slug + 名称）。
4. 点 **「发布到站点」** → 官网静态文件重生成。
5. 刷新 `http://localhost:4011/everhot/` 查看。

### 8.4 纯命令行发布（CI / 无后台时）
```bash
# 从 <repo>/apps/everhot-cn，需 API 在跑
npm run build
# = fetch:products → fetch:images → gen:subtypes → geo → audit
```
> 单步：`npm run fetch:products` / `npm run fetch:images` / `npm run gen:subtypes`。

### 8.5 加/改子类型 SEO 页
- 改 `scripts/gen-subtype-pages.mjs` 里的数据数组（cat/sys/series/文案/SEO）→ `npm run gen:subtypes`。
- 新子类型要能出产品：确保有产品的 `meta.everhot.series` 命中该网格的 `series`。

### 8.6 改 VI（颜色/圆角/字体）
- 见 §5.4。改 `everhot.css :root` + `design-tokens.json`，记入 `VI-SPEC.md`。

### 8.7 换正式授权产品图（上线前必做）
1. 把授权白底图放 `public/assets/img/products/<slug>.<ext>`。
2. 在 `data/product-image-manifest.json` 对应 slug 标 `"owned": true`。
3. `node scripts/sync-product-images-to-dam.mjs`（不带 `--include-placeholders`，只传 owned）。
4. `npm run fetch:images` 重生成映射。

### 8.8 部署上线（静态托管）
- 产物 = `apps/everhot-cn/public/`（构建后）。托管到自有域名 `/everhot`（或根路径，调 `serve.js --base`）。
- 构建期需能访问 Nexus API（或依赖离线回退用上次产物）。

---

## 9. 常见问题排查（FAQ / Troubleshooting）

| 现象 | 排查 |
|---|---|
| **官网产品没更新** | 是否点了「发布」/ 跑了 `fetch:products`？`products-data.js` 是构建产物，改库后必须重生成。 |
| **发布报错 / 数据没变** | API 是否在 `:3300` 跑？`curl http://localhost:3300/api/v2/brand/everhot/products` 应返回 JSON。 |
| **产品图不显示** | 该产品 `meta.imageArtifactId` 是否存在？跑过 `fetch:images`？否则回退 SVG 插画（正常）。 |
| **卡片图被裁成一条** | 竖长参数图应为 `imageRole='spec'`（进详情页参数区），不进卡片。 |
| **后台上传图 415** | 用 base64 端点（后台已用）；`file-artifact/upload`（multipart）在 Fastify 下失效，勿用。 |
| **后台 401 未登录** | httpOnly cookie 过期（8h）；重新登录。 |
| **DAM 找不到图 / 租户不匹配** | 上传与拉取须同租户；本环境统一 `rhautt_shared`。后台 BFF 已固定该租户。 |
| **API 起不来 DI 报错** | 若曾报 `EventConsumers→CrmService`：清 ts-node 缓存重启；现已修（无残留导入）。 |
| **产品数据 diff 很大但内容没变** | `jsonb` 不保留键序，重生成会重排序，属正常（站点按字段名读取）。 |
| **改了库结构** | 本环境 API 用 `public` schema；迁移事实源在 `database/postgres/migrations/`（`rhautt_nexus` schema）。二者差异见集成设计 §7 注记。 |

---

## 10. 规划框架与路线图

### 10.1 迁移阶段（详见 `EVERHOT-NEXUS-INTEGRATION-DESIGN.md` §7）
| 阶段 | 内容 | 状态 |
|---|---|---|
| P1 | products-data.js → Nexus（幂等导入） | ✅ 24/24 |
| P2 | 产品图 → DAM（objectKey/artifactId） | ✅ 14/14 无损（dev 占位图） |
| P3 | 公开只读端点 + 构建期重生成 | ✅ 无损往返 |
| P4 | brand-console 编辑/上新/上下架/发布闭环 | ✅ 已验证 |
| P5 | 统一 Nexus 为事实源，站点不直连 DB | ✅ |

### 10.2 生产上线清单（TODO）
- [ ] **换授权白底产品图**（去第三方字样），标 `owned:true` 重导（§8.7）。
- [ ] brand-console 接**本仓自有 auth/SSO + RBAC**（替换 dev 登录门；不引入跨仓共享服务）。
- [ ] 切生产 schema：`rhautt_nexus` + FORCE RLS；补 **Everhot 品牌租户 UUID**（现用 `rhautt_shared` 共享目录）。
- [ ] 字体文件 `阿里巴巴普惠体 3.0` 就位到 `public/assets/fonts/`。
- [ ] 构建接入 CI（发布触发 `npm run build` + 部署静态产物）。
- [ ] ICP 备案信息、`robots.txt`/`sitemap.xml` 校核。

### 10.3 迭代原则
- 先读本文 → 改动走令牌/脚本/后台，不手改构建产物 → 按 §11 验收 → 更新本文状态。

---

## 11. 变更验收规范（Checklist）

**任何数据/内容变更后：**
1. `curl -s http://localhost:3300/api/v2/brand/everhot/products` 返回预期条数。
2. `node --check apps/everhot-cn/public/js/products-data.js`（语法有效）。
3. 官网 `:4011` 目标页面渲染正确、图/文案更新。
4. `npm run audit`（链接审计）无断链。

**VI 变更后：** 全站抽查关键页；确认无 off-spec 颜色/裸圆角；`VI-SPEC.md` 已记录。

**后台功能变更后：** 走一遍闭环（改→发布→站点更新）；确认 `meta.everhot` 未被覆盖。

---

## 12. 环境与端口参考

| 服务 | 端口 | 启动目录 | 停止 |
|---|---|---|---|
| Nexus API (NestJS) | 3300 | `<repo>` | `pkill -f "services/api/src/main.ts"` |
| 官网静态站 | 4011 | `apps/everhot-cn` | `pkill -f "serve.js"` |
| 品牌后台 brand-console | 4012 | `apps/brand-console` | `pkill -f "next dev --port 4012"` |
| PostgreSQL | 5432 | 本机(brew) | — |

**关键路径**：产品数据事实源 = `public.products`；图事实源 = `public.uploaded_files`(DAM)；
构建产物（勿手改）= `public/js/products-data.js`、`public/js/product-images.js`、`public/assets/img/products/`。
