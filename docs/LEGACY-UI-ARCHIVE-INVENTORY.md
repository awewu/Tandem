# 遗留前端界面盘点与归档清单

> 归档日期：2026-07-06
> 背景：技术栈统一为 Next.js + React + TypeScript + Tailwind（`apps/`）。原 Vite React 工程（`src/`）与静态 HTML 原型（`public/`）已完成历史使命，统一归档至 `archive/legacy-ui/`，避免与当前主干混淆。

## 1. 原 Vite React 工程（`src/`）

| 文件 | 说明 | 状态 |
|------|------|------|
| `src/App.jsx` | 原 Vite 应用根组件 | 已归档 |
| `src/main.jsx` | 原 Vite 入口 | 已归档 |
| `src/index.css` | 原全局样式 | 已归档 |
| `src/components/` | 空目录 | 已归档 |
| `src/hooks/` | 空目录 | 已归档 |
| `src/pages/` | 空目录 | 已归档 |
| `src/services/` | 空目录 | 已归档 |
| `src/stores/` | 空目录 | 已归档 |
| `src/utils/` | 空目录 | 已归档 |

## 2. 静态 HTML 原型（`public/`）

已按 `legacy-surface-manifest.json` 的四个桶重新归类，仅包含实际存在于 `archive/legacy-ui/public/` 的文件。

### 2.1 active（生产静态守卫允许的入口）

| 文件 | 说明 | 状态 |
|------|------|------|
| `business-console.html` | 业务控制台原型 | 已归档 |
| `consent.html` | PIPL 同意页 | 已归档 |
| `customer-view.html` | 客户视图原型 | 已归档 |
| `designer.html` | 设计师工作台原型 | 已归档 |
| `index-ready.html` | 旧就绪页 | 已归档 |
| `index.html` | 旧门户首页 | 已归档 |
| `pain-diagnosis.html` | 痛点诊断原型 | 已归档 |
| `privacy.html` | 隐私页 | 已归档 |
| `rysnova-bim-designer.html` | Rysnova BIM 设计器原型 | 已归档 |

### 2.2 migration-candidate（待迁移到目标 Next.js 应用）

| 文件 | 说明 | 目标应用 |
|------|------|------|
| `construction-management.html` | 施工管理原型 | customer-portal / dealer-workbench |
| `designer-legacy.html` | 设计师旧版原型 | designer-workbench |
| `quotation-pro.html` | 报价专业版原型 | designer-workbench / dealer-workbench |
| `smart-routing.html` | 智能路由原型 | dealer-workbench |
| `solution-view.html` | 方案展示原型 | consumer-diagnosis / designer-workbench |
| `technical-drawings.html` | 技术图纸原型 | rysnova-bim-workbench |
| `technical-manual.html` | 技术手册原型 | rysnova-bim-workbench |
| `technical-support.html` | 技术支持原型 | rysnova-bim-workbench |
| `workorders.html` | 工单原型 | customer-portal / dealer-workbench |

### 2.3 archive（仅历史参考，不再导航）

| 文件 | 说明 |
|------|------|
| `admin-dashboard.html` | 管理后台原型 |
| `admin/marketing.html` | 后台营销页原型 |
| `admin/products.html` | 后台产品页原型 |
| `analytics.html` | 数据分析原型 |
| `delivery-center.html` | 交付中心原型 |
| `design-review.html` | 设计评审原型 |
| `drawing-engine.html` | 绘图引擎原型 |
| `floorplan-bim.html` | BIM 户型原型 |
| `growth-hub.html` | 增长中心原型 |
| `index-portal-legacy.html` | 旧 portal 入口 |

### 2.4 static-inventory（已清空，未使用）

当前为空。

### 2.5 其他辅助资源

| 文件 | 说明 |
|------|------|
| `settings.html` | 设置页（未在 manifest 中分类，仍保留于归档目录） |
| `everhot` | 品牌占位 |
| `sample-news.xml` | 示例 XML |
| `MANIFEST.yml` | 旧 manifest |
| `manifest.json` | 旧 manifest |
| `legacy-surface-manifest.json` | 遗留 surface 清单（已按实际文件重新 reconciled） |
| `design-system.json` | 旧设计系统配置 |
| `service-worker.js` | 旧 service worker |
| `sw.js` | 旧 service worker |
| 各类 `.css` / `.js` 辅助文件 | 样式与脚本 |
| `css/` / `js/` / `images/` / `shared/` / `design-tokens/` | 静态资源目录 |

## 3. 归档位置

- Vite 工程：`archive/legacy-ui/src/`
- 静态 HTML 原型：`archive/legacy-ui/public/`

## 4. 说明

- 归档后，当前项目根目录不再包含 `src/` 与 `public/` 的遗留文件。
- 若后续需要恢复某个原型，请从 `archive/legacy-ui/` 复制回项目根目录，并评估是否需迁移到 `apps/` 的 Next.js 架构。
- 归档操作不影响 `server/modules/` 或 `services/api/` 的 API 迁移；API 迁移仍按 `auth → tenant → crm → quote` 顺序推进。
