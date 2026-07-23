# RysNova 企业数字化平台 · 系统梳理与问题分析

> 梳理范围：`apps/*`、`services/api`、`packages/*`  
> 颗粒度：应用 → 功能域 → 模块/路由 → 关键能力（四级）  
> 日期：2026-07-08

---

## 一、总体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         公域入口层                                  │
│  public-portal（集团官网）  rheem-cn / ruud-cn / everhot-cn /        │
│  lithnova-cn（品牌独立站）  consumer-diagnosis（AI 问诊）             │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         B 端工作台层                                │
│  dealer-workbench（经销商）  designer-workbench（设计师）            │
│  rysnova-bim-workbench（技术支持深化） customer-portal（业主查询）    │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         运营/品牌中枢层                              │
│  nexus-console（集团经营控制台）  brand-console（品牌运营）          │
│  product-catalog（产品目录）                                        │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         后端服务层                                  │
│  services/api（NestJS）：AI 问诊、CRM、设计、BIM、报价、产品目录、      │
│  合规、增长、多租户、事件总线                                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 二、完整功能目录（四级）

### 第一章 公域入口层

#### 1.1 集团官网 `public-portal`

| L1 | L2 | L3 | L4 |
|---|---|---|---|
| 1.1.1 品牌 | 1.1.1.1 首页 | 品牌故事、核心价值 | — |
| | 1.1.1.2 关于我们 | 公司介绍 | `/about` |
| | | 领导力 | `/about/leadership` |
| | | 发展历程 | `/about/our-story` |
| | | 价值观 | `/about/our-values` |
| | | 公司治理 | `/about/governance` |
| | 1.1.1.3 旗下品牌 | `/brands` | 品牌矩阵入口 |
| | 1.1.1.4 可持续发展 | `/sustainability` | — |
| 1.1.2 产品与方案 | 1.1.2.1 系统方案 | `/solutions` | 系统族展示 |
| | 1.1.2.2 产品系列 | `/products` | 产品列表 |
| | | 产品详情 | `/products/[id]` | SKU 详情 |
| | 1.1.2.3 舒适计算器 | `/calculator` | 负荷/报价估算 |
| 1.1.3 支持 | 1.1.3.1 查找经销商 | `/dealers` | — |
| | 1.1.3.2 联系我们 | `/contact` | — |
| | 1.1.3.3 保修 | `/warranty` | — |
| | 1.1.3.4 召回 | `/recall` | — |
| 1.1.4 资讯与合规 | 1.1.4.1 新闻中心 | `/news` | 新闻列表 |
| | | 新闻详情 | `/news/[slug]` | 单篇新闻 |
| | 1.1.4.2 招聘 | `/careers` | — |
| | 1.1.4.3 隐私政策 | `/privacy` | — |
| | 1.1.4.4 使用条款 | `/terms` | — |
| 1.1.5 专业人士入口 | 1.1.5.1 经销商/设计师入口 | `/professional` | 跳 B 端工作台 |

#### 1.2 C 端 AI 问诊 `consumer-diagnosis`

| L1 | L2 | L3 | L4 |
|---|---|---|---|
| 1.2.1 营销落地 | 1.2.1.1 品牌首页 | `index-ready.html` | 早期静态落地页 |
| | 1.2.1.2 痛点问诊 | `pain-diagnosis.html` | 旧版 4 步问诊 |
| 1.2.2 信息页 | 1.2.2.1 系统方案 | `/solutions` | Next.js 信息页 |
| | 1.2.2.2 产品系列 | `/products` | Next.js 信息页 |
| | 1.2.2.3 关于我们 | `/about` | Next.js 信息页 |
| | 1.2.2.4 联系我们 | `/contact` | Next.js 信息页 |
| 1.2.3 法律页 | 1.2.3.1 隐私政策 | `/privacy.html` | 静态页 |
| | 1.2.3.2 个人信息处理授权 | `/consent.html` | 静态页 |

#### 1.3 客户门户 `customer-portal`

| L1 | L2 | L3 | L4 |
|---|---|---|---|
| 1.3.1 项目查询 | 1.3.1.1 匿名查询首页 | `/` | 报价单号查询 |
| | 1.3.1.2 项目详情展示 | — | 状态/进度/BIM |
| 1.3.2 登录 | 1.3.2.1 短信登录 | `/login` | 手机 + 验证码 |
| 1.3.3 我的项目 | 1.3.3.1 项目列表 | `/dashboard` | 登录后查看 |

#### 1.4 品牌独立站

| 应用 | L2 | L3 | L4 |
|---|---|---|---|
| `rheem-cn` | 1.4.1 静态首页 | `public/index.html` | 独立域名 rheem.com.cn，端口 4014 |
| `ruud-cn` | 1.4.2 静态首页 | `public/index.html` | 独立域名 ruud.com.cn，端口 4015 |
| `everhot-cn` | 1.4.3 品牌站 | 产品同步 | `sync:products` / `fetch:products` |
| | | 图片同步 | `sync:images` / `fetch:images` |
| | | GEO 页面生成 | `geo-build.js` |
| | | 子类型页面生成 | `gen-subtype-pages.mjs` |
| | | 图片优化 | `optimize-images.mjs` |
| `lithnova-cn` | 1.4.4 静态首页 | `public/index.html` | 基路径 `/lithnova`，端口 4013 |

---

### 第二章 B 端工作台层

#### 2.1 经销商工作台 `dealer-workbench`

| L1 | L2 | L3 | L4 |
|---|---|---|---|
| 2.1.1 统一入口 | 2.1.1.1 门户首页 | `/hub` | 工作台导航枢纽 |
| 2.1.2 销售 | 2.1.2.1 CRM 客户 | `/crm` | 线索/客户/跟进 |
| | 2.1.2.2 方案设计 | `/design` | 2D 设计嵌入 |
| | | 方案可视化 | `/design/visualize` | 3D/热力/管路/气流 |
| | | 专业 CAD 编辑器 | `/design/pro` | Floor plan 编辑 |
| 2.1.3 交付 | 2.1.3.1 BIM 交付 | `/bim` | BIM 项目管理 |
| | 2.1.3.2 项目进度 | `/projects` | 项目生命周期 |
| 2.1.4 运营 | 2.1.4.1 产品目录 | `/products` | 经销商选品 |
| | 2.1.4.2 经营分析 | `/analytics` | 看板/KPI |
| | 2.1.4.3 财务 | `/finance` | 收款/定金 |
| | 2.1.4.4 售后 | `/aftersales` | 工单/服务 |
| | 2.1.4.5 团队 | `/team` | 人员权限 |
| | 2.1.4.6 品牌 | `/brand` | 品牌物料 |
| | 2.1.4.7 移动报价 | `/mobile` | 快速报价 |
| 2.1.5 认证 | 2.1.5.1 登录 | `/login` | JWT 登录 |

#### 2.2 设计师工作台 `designer-workbench`

| L1 | L2 | L3 | L4 |
|---|---|---|---|
| 2.2.1 首页 | 2.2.1.1 工具导航 | `/` | DesignerHome 卡片 |
| 2.2.2 精算 | 2.2.2.1 负荷精算 | `/calc` | 一键精算 · 签章 |
| 2.2.3 同步 | 2.2.3.1 M12 同步 | `/sync` | design↔Rysnova 变更同步 |
| 2.2.4 设计 | 2.2.4.1 2D 平面设计 | `/floor-plan` | 拖拽布局 |
| | 2.2.4.2 布局 · CFD | `/layout-cfd` | 气流/热场仿真 |
| 2.2.5 BIM 查看 | 2.2.5.1 IFC 模型查看 | `/viewer` | ThatOpen 查看器 |
| 2.2.6 AI | 2.2.6.1 AI 方案 | `/ai-design` | 设计建议/校验 |
| 2.2.7 物料 | 2.2.7.1 BOM 清单 | `/bom` | 材料/报价 |
| 2.2.8 系统 | 2.2.8.1 系统模型 | `/system-model` | 架构可视化 |

#### 2.3 技术支持深化台 `rysnova-bim-workbench`

| L1 | L2 | L3 | L4 |
|---|---|---|---|
| 2.3.1 深化台 | 2.3.1.1 深化首页 | `/` | 加载 IFC / 产物 ID |
| | 2.3.1.2 项目深化 | `/deepen/[projectId]` | 资料就绪度、生成效果图/施工图/BOM |
| 2.3.2 队列 | 2.3.2.1 待深化队列 | `/queue` | 签单承接项目列表 |
| 2.3.3 产物 | 2.3.3.1 产物库 | `/artifacts` | 文件产物管理 |
| 2.3.4 认证 | 2.3.4.1 退出/登录 | NavBar | localStorage token |

---

### 第三章 运营/品牌中枢层

#### 3.1 集团经营控制台 `nexus-console`

| L1 | L2 | L3 | L4 |
|---|---|---|---|
| 3.1.1 Rhautt Comfort（品牌与市场） | 3.1.1.1 板块总览 | `/comfort/overview` | 在管站点/KPI |
| | 3.1.1.2 网站管理 | `/comfort/sites` | 域名/交付方式/VI |
| | 3.1.1.3 市场物料库 DAM | `/comfort/dam` | 上传/分类/审批 |
| | 3.1.1.4 品牌产品库 | `/comfort/catalog` | 产品条目管理 |
| | 3.1.1.5 上新/发布 | `/comfort/publish` | ICP/发布 |
| 3.1.2 瑞诺瓦赋能平台 | 3.1.2.1 总览 | `/enablement/overview` | 租户/KPI |
| | 3.1.2.2 租户开通 | `/enablement/tenants` | 租户创建 |
| | 3.1.2.3 版本/发布 | `/enablement/releases` | 版本管理 |
| | 3.1.2.4 环境/部署 | `/enablement/envs` | 环境状态 |
| | 3.1.2.5 健康/监控 | `/enablement/health` | 探针/告警 |
| 3.1.3 增长中枢 | 3.1.3.1 总览 | `/growth/overview` | 增长指标 |
| | 3.1.3.2 GEO 可见度 | `/growth/geo` | 搜索引擎可见度分析 |
| | 3.1.3.3 文案 Copilot | `/growth/copywriter` | AI 文案 |
| | 3.1.3.4 舆情雷达 | `/growth/sentiment` | 舆情监控 |
| | 3.1.3.5 营销自动化 | `/growth/automation` | 自动化营销 |

#### 3.2 品牌控制台 `brand-console`

| L1 | L2 | L3 | L4 |
|---|---|---|---|
| 3.2.1 品牌内容 | 3.2.1.1 内容管理 | — | 文章/页面 |
| 3.2.2 发布 | 3.2.2.1 发布审批 | — | 工作流 |
| 3.2.3 认证 | 3.2.3.1 SSO/OIDC | — | 身份联邦 |

#### 3.3 产品目录 `product-catalog`

| L1 | L2 | L3 | L4 |
|---|---|---|---|
| 3.3.1 展示 | 3.3.1.1 目录首页 | `/` | 产品浏览 |

---

### 第四章 后端服务层 `services/api`

#### 4.1 认证与授权

| L1 | L2 | L3 | L4 |
|---|---|---|---|
| 4.1.1 身份 | 4.1.1.1 JWT Auth | `auth/auth.controller` | 登录/刷新/注销 |
| | 4.1.1.2 SSO/OIDC | `auth/auth.controller` | OIDC 联邦 |
| 4.1.2 短信 | 4.1.2.1 短信验证码 | `auth/*` | 发送/校验 |
| 4.1.3 权限 | 4.1.3.1 角色权限 | `auth/auth.service` | role/permissions |
| 4.1.4 品牌注册 | 4.1.4.1 品牌入驻 | `brand-registry/*` | 租户/经销商注册 |

#### 4.2 AI 问诊模块 `diagnosis`

| L1 | L2 | L3 | L4 |
|---|---|---|---|
| 4.2.1 公开问诊 | 4.2.1.1 问诊完成 | `POST public/complete` | 留资 + 建会话 |
| | 4.2.1.2 快速 AI 分析 | `POST public/ai-analyze` | 痛点 → 系统 |
| | 4.2.1.3 痛点目录 | `GET painpoints` | 6 维 48 项 |
| | 4.2.1.4 痛点探测 | `POST painpoints/detect` | 自动勾选/隐性痛点 |
| | 4.2.1.5 对话式问诊 | `POST consult` | 渐进追问 |
| | 4.2.1.6 初步报价 | `POST quote` | 目录价三档 |
| | 4.2.1.7 原理图 | `POST principle-diagram` | 系统协同示意图 |
| | 4.2.1.8 案例推荐 | `POST cases` | 真实案例策展 |
| | 4.2.1.9 公开推荐 | `POST public/recommend` | 定位推荐 |
| | 4.2.1.10 定金意向 | `POST deposit/intent` | 路由到经销商收款 |
| 4.2.2 报告管理 | 4.2.2.1 报告读取 | `GET public/reports/:id` | 凭 shareToken |
| | 4.2.2.2 报告列表 | `GET reports` | 登录用户 |
| | 4.2.2.3 撤销报告 | `POST reports/:id/revoke` | — |
| 4.2.3 收款配置 | 4.2.3.1 经销商收款配置 | `deposit/config` | 线下/收款码/链接 |
| | 4.2.3.2 确认收款 | `deposit/:id/confirm` | 状态机 |
| | 4.2.3.3 退款 | `deposit/:id/refund` | 状态机 |

#### 4.3 CRM 模块

| L1 | L2 | L3 | L4 |
|---|---|---|---|
| 4.3.1 线索 | 4.3.1.1 线索创建 | `ingress/lead` | 公域留资 |
| | 4.3.1.2 线索管理 | `crm/*` | 跟进/分配 |
| 4.3.2 客户 | 4.3.2.1 客户档案 | `crm/*` | — |
| 4.3.3 项目 | 4.3.3.1 项目生命周期 | `lifecycle/*` | customer-projects |

#### 4.4 设计与报价

| L1 | L2 | L3 | L4 |
|---|---|---|---|
| 4.4.1 负荷计算 | 4.4.1.1 负荷精算 | `quote/load-calc` | — |
| 4.4.2 报价 | 4.4.2.1 报价单 | `quote/*` | — |
| 4.4.3 设计边界 | 4.4.3.1 设计规则 | `design/design-boundary` | — |
| 4.4.4 派工 | 4.4.4.1 派单 | `dispatch/*` | — |

#### 4.5 BIM 与深化

| L1 | L2 | L3 | L4 |
|---|---|---|---|
| 4.5.1 BIM 项目 | 4.5.1.1 项目管理 | `rysnova-bim/bim` | 状态机 |
| | 4.5.1.2 BCF 协同 | `rysnova-bim/bcf` | 问题追踪 |
| | 4.5.1.3 设计同步 | `rysnova-bim/design-sync` | design↔BIM |
| | 4.5.1.4 云能力 | `rysnova-bim/cloud-capability` | 模型服务 |
| 4.5.2 深化 | 4.5.2.1 深化包 | `rysnova-bim/v2-bim` | deepeningPackage |
| | 4.5.2.2 产物生成 | `rysnova-bim/*` | visual/deliverable |
| 4.5.3 文件产物 | 4.5.3.1 文件上传/读取 | `file-artifact/*` | 对象存储抽象 |

#### 4.6 产品目录

| L1 | L2 | L3 | L4 |
|---|---|---|---|
| 4.6.1 产品管理 | 4.6.1.1 产品 CRUD | `product-catalog/*` | — |
| 4.6.2 公开产品 | 4.6.2.1 公开目录 | `product-catalog.public/*` | 无鉴权浏览 |

#### 4.7 合规与 PIPL

| L1 | L2 | L3 | L4 |
|---|---|---|---|
| 4.7.1 同意管理 | 4.7.1.1 记录同意 | `compliance/*` | consent 落库 |
| 4.7.2 PII 保护 | 4.7.2.1 PII 哈希 | `compliance.pii` | — |

#### 4.8 增长与治理

| L1 | L2 | L3 | L4 |
|---|---|---|---|
| 4.8.1 增长 | 4.8.1.1 GEO 分析 | `growth/*` | 搜索可见度 |
| | 4.8.1.2 文案生成 | `growth/*` | AI copilot |
| 4.8.2 主数据 | 4.8.2.1 事件总线 | `mdm/event-bus` | 领域事件 |
| | 4.8.2.2 治理 | `governance/*` | — |
| | 4.8.2.3 租户 | `tenant/*` | 多租户 |
| 4.8.3 售后 | 4.8.3.1 售后工单 | `aftersales/*` | — |
| 4.8.4  entitlement | 4.8.4.1 权限/许可证 | `entitlement/*` | — |
| 4.8.5 健康 | 4.8.5.1 服务健康 | `health` | 探针 |
| 4.8.6 通知 | 4.8.6.1 消息通知 | `notification/*` | — |
| 4.8.7 工作流 | 4.8.7.1 工作流引擎 | `workflow/*` | — |

---

### 第五章 基础设施层

#### 5.1 共享包 `packages/*`

| L1 | L2 | L3 | L4 |
|---|---|---|---|
| 5.1.1 认证 | 5.1.1.1 共享 Auth | `shared-auth` | token 管理、HubReturnButton |
| 5.1.2 UI | 5.1.2.1 共享组件 | `ui` | 可复用 React 组件 |
| 5.1.3 设计令牌 | 5.1.3.1 设计 Token | `tokens` | 颜色/字体/spacing |
| 5.1.4 视觉系统 | 5.1.4.1 视觉规范 | `visual-system` | 主题/变量 |
| 5.1.5 领域 | 5.1.5.1 HVAC 领域模型 | `domain/hvac-kernels` | 核心领域逻辑 |
| 5.1.6 合约 | 5.1.6.1 共享契约 | `contracts` | 类型/接口 |
| 5.1.7 生成客户端 | 5.1.7.1 API 客户端 | `generated-client` | OpenAPI 生成 |
| 5.1.8 引擎 | 5.1.8.1 计算引擎 | `engines` | 负荷/选型算法 |

#### 5.2 工程化

| L1 | L2 | L3 | L4 |
|---|---|---|---|
| 5.2.1 包管理 | 5.2.1.1 pnpm workspace | `pnpm-workspace.yaml` | apps/* / packages/* / services/* |
| | 5.2.1.2 Nx 缓存 | `nx.json` | 构建缓存 |
| 5.2.2 代码质量 | 5.2.2.1 ESLint | `.eslintrc.js` | 跨应用规则 |
| | 5.2.2.2 Prettier | `.prettierrc` | 格式化 |
| | 5.2.2.3 Husky | `.husky` | 提交钩子 |
| 5.2.3 部署 | 5.2.3.1 Dockerfile | Dockerfile/Dockerfile.backend/Dockerfile.frontend | — |
| 5.2.4 环境 | 5.2.4.1 环境变量 | `.env.example` | 各应用示例 |

---

## 三、关键应用间关系

```text
public-portal ──→ 跳 dealer-workbench / designer-workbench / investor
      │
      └── consumer-diagnosis ──→ 问诊 API ──→ 创建 lead ──→ dealer-workbench / CRM

dealer-workbench /hub
      ├── /crm
      ├── /design ──→ /design/pro, /design/visualize
      ├── /bim
      ├── /mobile
      └── ...

designer-workbench /
      ├── /calc, /floor-plan, /layout-cfd, /viewer, /ai-design, /bom, /system-model
      └── /sync（与 Rysnova-BIM 同步）

rysnova-bim-workbench /
      ├── /queue ──→ /deepen/[projectId]
      └── /artifacts

nexus-console
      ├── /comfort（品牌与市场）
      ├── /enablement（瑞诺瓦赋能）
      └── /growth（增长中枢）
```

---

## 四、问题与风险分析

### 4.1 架构层问题

| # | 问题 | 影响 | 证据 |
|---|---|---|---|
| 1 | ~~rysnova-bim-workbench 仍是独立应用，未合并到 dealer-workbench~~ ✅ 已归并 | — | 已迁移到 `dealer-workbench/bim/*`，原应用删除 |
| 2 | **consumer-diagnosis 处于「静态旧版 + Next.js 新版」混合态** | 品牌落地页与信息页视觉/导航割裂 | `/` 静态 `index-ready.html`，`/about` `/contact` 走 Next.js 布局 |
| 3 | **品牌独立站形态不统一** | 有的走 Next.js/构建脚本（everhot-cn），有的只是静态 HTML（rheem-cn/ruud-cn/lithnova-cn） | 见各 brand app 的 package.json |
| 4 | **BIM 能力仍分散在 2 个应用** | 交付深化在 dealer，方案查看在 designer | `dealer-workbench/bim/*`、`designer-workbench/viewer` |
| 4.1 | ~~BIM 能力散落在 3 个应用~~ ✅ 已归并 | rysnova-bim-workbench 并入 dealer-workbench | — |

### 4.2 代码与工程问题

| # | 问题 | 影响 | 证据 |
|---|---|---|---|
| 5 | ~~rysnova-bim-workbench 未在 git 跟踪中~~ ✅ 已归并 | — | 原应用已迁移并删除 |
| 6 | ~~rysnova-bim-workbench NavBar 直接读写 localStorage token~~ ✅ 已归并 | — | 统一走 dealer-workbench 布局与 shared-auth |
| 7 | **多个应用存在独立的 AuthProvider/登录逻辑** | 登录态同步复杂，单点登出难做 | 各 B 端应用有自己的登录页和 token 管理 |
| 8 | **本地 commit 未 push** | 交付风险，代码未入远程仓库 | GitLab `192.1.1.208:8088` 连不上 |

### 4.3 功能与产品问题

| # | 问题 | 影响 | 证据 |
|---|---|---|---|
| 9 | **nexus-console 大量面板为建设中占位** | 集团运营能力未闭环 | `boards.ts` 多处 `note: '🚧 该模块正在建设中...'` |
| 10 | **designer-workbench 首页未展示 `/layout-cfd`** | 该功能入口隐藏，用户难发现 | `page.tsx` TOOLS 数组只有 7 项 |
| 11 | **AI 问诊前端仅展示 6 个高频痛点，未调用完整 48 项痛点库** | 问诊深度不足 | `consumer-diagnosis/pain-diagnosis.html` 或新版 page.tsx 仅展示部分痛点 |
| 12 | **consumer-diagnosis 报价三档倍率在前端硬编码** | 报价不灵活，难与目录价联动 | 新版 page.tsx 1.0/1.3/1.7 倍率 |
| 13 | **brand-console 与 nexus-console/comfort 功能边界模糊** | 品牌内容运营入口分散 | 两者都涉及品牌/内容/发布 |
| 14 | **product-catalog 与 public-portal/products、everhot-cn 产品库可能重复** | 产品数据源不统一 | 多个应用展示产品 |

### 4.4 合规与数据问题

| # | 问题 | 影响 | 证据 |
|---|---|---|---|
| 15 | **PIPL 同意闸已做，但 old static `pain-diagnosis.html` 的同意流程需与新版合规字段对齐** | 静态页可能未传 policyVersion 等字段，触发 403 | `diagnosis.service.ts:73` 强制要求 policyVersion |
| 16 | **AI 问诊有 LLM Key 时走模型，否则规则兜底** | 体验可能从「AI」退化成「问卷」 | `diagnosis-ai.service.ts` |

---

## 五、建议路线图

### 第一阶段：归并与清理（高优先级）

1. **决定 rysnova-bim-workbench 命运**：要么正式保留并加入 workspace/git，要么把 `/queue`、`/deepen`、`/artifacts` 迁移到 `designer-workbench` 或 `dealer-workbench`，然后删除。
2. **统一 consumer-diagnosis**：要么全走早期静态版（把 about/contact/products/solutions 也迁成静态），要么全走 Next.js 并复刻旧版视觉。
3. **品牌独立站统一**：everhot-cn 用构建脚本，rheem/ruud/lithnova-cn 目前只是占位页，需明确是否要继续投入。
4. **推送到 GitLab**：解决网络/仓库问题，把本地 commit 推上去。

### 第二阶段：能力补齐（中优先级）

5. **nexus-console 占位面板**：逐个替换为真实数据 + 操作。
6. **AI 问诊前端**：接入完整 48 项痛点库，调用后端 `quote` 接口做诚实报价。
7. **设计师工作台首页**：补齐 `/layout-cfd` 入口。
8. **产品数据源统一**：确定主数据源，避免 public-portal、product-catalog、everhot-cn 各自维护。

### 第三阶段：体验与合规（持续）

9. **统一认证体验**：把所有 B 端应用的 token 管理收敛到 `@rhautt/shared-auth`，移除 localStorage 直接读写。
10. **跨应用导航**：持续维护环境变量，确保 HubReturnButton、品牌站入口、经销商/设计师跳转正确。
11. **静态页合规字段对齐**：确认 `pain-diagnosis.html` 提交的 consent/policyVersion 与后端契约一致。
