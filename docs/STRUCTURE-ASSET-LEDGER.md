# 结构资产台账（前端/工程层）

> 配套 `audit/asset-ledger.md`（后端 193 资产）与 `docs/PUBLIC-SURFACE-FUNCTION-PRD-INVENTORY.md`（public 105 页）。
> 本文覆盖三者未含部分：apps/、packages/、老 frontend/、老 src/、根级杂项。
> 处置标签同后端台账：KEEP / MIGRATE / SPLIT / ARCHIVE / ISOLATE / REVIEW / DELETE。

## 盘点口径

三份台账合起来即全仓资产全集：

| 台账 | 覆盖范围 | 资产数 |
| --- | --- | --- |
| `audit/asset-ledger.md` | server/ 引擎·路由·模型 | 193 |
| `docs/PUBLIC-SURFACE-FUNCTION-PRD-INVENTORY.md` | public/ 静态页 | 105 |
| 本文 | apps/·packages/·frontend/·src/·根级 | 见下 |

## A. apps/（Nx 应用群，10 个）

| 应用 | 角色 | src 文件 | 处置 | 依据 |
| --- | --- | --- | --- | --- |
| `apps/public-portal` | 集团官网（rhautt.com，对标 aosmith.com） | 8 | KEEP | 终态集团官网骨架，继续建设 |
| `apps/consumer-diagnosis` | 瑞诺瓦 C 端 AI 问诊 | 3 | KEEP | C 端舒适家入口，已上线形态 |
| `apps/dealer-workbench` | 经销商赋能工作台 | 43 | KEEP | 主力业务工作台，内容最完整 |
| `apps/customer-portal` | 客户门户 | 4 | REVIEW | 与 consumer-diagnosis 职责疑似重叠，需裁定 |
| `apps/business-console` | 业务管理后台 | 5 | KEEP | 数智枢纽管理面，继续建设 |
| `apps/designer-workbench` | 设计师工作台 | 3 | REVIEW | 骨架仅 3 文件，确认是否并入 dealer-workbench |
| `apps/rysnova-bim-workbench` | Rysnova BIM 交付 | 0 | REVIEW | 仅占位，确认独立软件边界后填充 |
| `apps/everhot-cn` | 恒热品牌站（复刻 rheem.com） | 0(静态在 public) | KEEP | 品牌站，VI 需对齐 Rheem 标准 |
| `apps/rheem-cn` | Rheem 中国品牌站 | 0 | REVIEW | 临时占位，终态由我们重写接入 |
| `apps/ruud-cn` | Ruud 中国品牌站 | 0 | REVIEW | 临时占位，终态由我们重写接入 |

> 品牌→应用映射的事实源为 `brand-registry.json`，新增品牌先登记再建 `apps/<slug>`。

## B. packages/（共享底座，6 个）

| 包 | 角色 | 处置 | 依据 |
| --- | --- | --- | --- |
| `packages/contracts` | L1 契约（OpenAPI/类型） | KEEP | 四层边界 L1，全站事实源 |
| `packages/domain` | L1 领域模型 | KEEP | 后端 model 迁移目标 |
| `packages/tokens` | L3 品牌主题（5 套 css 已建） | KEEP | 品牌主题切换底座 |
| `packages/visual-system` | L2 设计系统 | KEEP | 世界级设计系统骨架 |
| `packages/ui` | L2 组件库 | KEEP | 改一处全站生效的组件层 |
| `packages/generated-client` | 由契约生成的客户端 | KEEP | 产物包，随 contracts 再生 |

## C. 老 frontend/（v2 单体页，6 个）

| 文件 | 处置 | 依据 |
| --- | --- | --- |
| `frontend/AdminDashboard-v2.js` | ISOLATE | 旧单体页，能力已被 apps/ 取代，移入 legacy/ |
| `frontend/DesignerWorkspace-v2.js` | ISOLATE | 同上 |
| `frontend/LoginPage-v2.js` | ISOLATE | 同上 |
| `frontend/PainDiagnosisPage-v2.js` | ISOLATE | 同上 |
| `frontend/ProjectListPage-v2.js` | ISOLATE | 同上 |
| `frontend/QuickLockPage-v2.js` | ISOLATE | 同上 |

## D. 老 src/（Vite SPA 残留）

| 路径 | 处置 | 依据 |
| --- | --- | --- |
| `src/App.jsx` `src/main.jsx` `src/index.css` | ISOLATE | 旧 Vite 入口，被 Nx apps 取代 |
| `src/pages/*` | ISOLATE | 能力迁移目标见 apps/，页面骨架归档 |
| `src/components` `src/hooks` `src/services` `src/stores` `src/utils` | REVIEW | 可复用逻辑逐个判定迁入 packages/ 或弃用 |

## E. 根级杂项

| 文件 | 处置 | 依据 |
| --- | --- | --- |
| `server-production.js` | KEEP | 生产 runtime 入口，迁入 apps/api |
| `hammer.js` `main.js` | REVIEW | 启动器/壳脚本，确认 Nx 化后是否保留 |
| `multi-port-launcher.js` | REVIEW | 多端口启动器，Nx serve 可能取代 |
| `websocket-server.js` | KEEP | 改图联动 WS(3001)，迁入 platform/infra |
| `electron-main.js` `preload.js` `preload-simple.js` `package-electron.json` | ARCHIVE | Electron 桌面壳，新架构为 Web |
| `vite.config.js` | ISOLATE | 旧 Vite 配置，随老 src/ 归档 |
| `nx.json` `tsconfig.base.json` `tsconfig.json` `package.json` `tailwind.config.js` `jest.config.js` | KEEP | 新工程链配置 |
| `brand-registry.json` | KEEP | 品牌注册事实源 |
| 根级 *.md（CLAUDE/DESIGN/PRD-CURRENT/PRODUCT-SCOPE/README/各 GUIDE） | REVIEW | 与 PROJECT-CHARTER 合并去重，留单一事实源 |

## 下一步

1. 三份台账（后端 193 + public 105 + 本文）即全仓资产全集，REVIEW 项人工校订。
2. 校订完成后，回头重写 `PROJECT-CHARTER` 与 PRD：宪章是盘点结论的产物。
3. ISOLATE 项统一移入 `legacy/`，ARCHIVE 项归档不迁移，迁移完成后清理 LEGACY-COMPAT。
