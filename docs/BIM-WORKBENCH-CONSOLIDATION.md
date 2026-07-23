# rysnova-bim-workbench 归并方案

> 目标：把 `rysnova-bim-workbench` 的深度 BIM 能力合并进 `dealer-workbench`，避免同一业务能力散落在 3 个应用里，同时保留并强化现有交付流程。

---

## 一、现状

### 1.1 rysnova-bim-workbench 当前能力

| 路由 | 页面 | 作用 | 后端端点 |
|---|---|---|---|
| `/` | 深化台首页 | 输入 file-artifact ID 或加载本地 IFC | 无 |
| `/queue` | 待深化队列 | 列出已签单、待深化的项目 | `GET /api/v2/rysnova-bim/projects` |
| `/deepen/[projectId]` | 项目深化 | 资料就绪度、生成效果图/施工图/BOM、阶段推进 | `GET/POST /api/v2/rysnova-bim/projects/:id/...` |
| `/artifacts` | 产物库 | 按项目筛选深化产物 | `GET /api/v2/rysnova-bim/artifacts` |

### 1.2 现在的问题

- **未在 git 跟踪**：`git status` 显示 `?? apps/rysnova-bim-workbench/`，代码随时可能丢失。
- **与 dealer-workbench 重叠**：`dealer-workbench/bim` 已是 BIM 交付入口， deepening 却单独放在另一个应用。
- **与 designer-workbench 重叠**：`/viewer` 也做 IFC/BIM 查看。
- **额外一套导航/Auth**：虽然 `AuthProvider` 已 redirect 到 dealer-workbench 登录，但 NavBar 仍直接读 `localStorage`。

---

## 二、归并原则

1. **单一 BIM 入口**：所有「BIM 交付/深化」能力统一放在 `dealer-workbench/bim/*`。
2. **不删能力只搬家**：`/queue`、`/deepen`、`/artifacts`、`BimViewer` 都保留，仅改路由与导航。
3. **复用 dealer 布局与权限**：合并后走 dealer 的 sidebar、登录态、角色权限。
4. **保留 deep-link**：原 `/deepen/:id` 通过 302 或 Next.js rewrite 兼容到 `/bim/deepen/:id`。
5. **技术深化角色**：后续在 `dealer-workbench` 里支持 `engineer` 角色，而不是独立一个应用。

---

## 三、目标路由设计

```
dealer-workbench
├── /bim                              (现有：BIM 交付项目列表)
├── /bim/deepen-queue                 (原 /queue：待深化队列)
├── /bim/deepen/[projectId]           (原 /deepen/[projectId]：项目深化台)
├── /bim/artifacts                    (原 /artifacts：产物库)
└── /bim/viewer                       (可选：把 designer-workbench/viewer 的只读 IFC 查看器也复用过来)
```

### 导航调整

`DealerNav.tsx` 的 `/bim` 入口保留，点击后展开子菜单或进入 `/bim` 总览，包含：
- BIM 项目总览 `/bim`
- 待深化队列 `/bim/deepen-queue`
- 产物库 `/bim/artifacts`

---

## 四、迁移步骤

### 步骤 1：先保护代码（立即执行）

把 `rysnova-bim-workbench` 先加入 git，防止后续删除/迁移过程中丢失。

```bash
git add apps/rysnova-bim-workbench/
git commit -m "chore: track rysnova-bim-workbench before consolidation"
```

### 步骤 2：迁移公共组件

在 `dealer-workbench` 新建目录：

```
apps/dealer-workbench/src/
├── app/bim/deepen-queue/page.tsx        # 原 apps/rysnova-bim-workbench/src/app/queue/page.tsx
├── app/bim/deepen/[projectId]/page.tsx  # 原 apps/rysnova-bim-workbench/src/app/deepen/[projectId]/page.tsx
├── app/bim/artifacts/page.tsx           # 原 apps/rysnova-bim-workbench/src/app/artifacts/page.tsx
└── components/bim/
    ├── BimViewer.tsx                    # 原 rysnova-bim-workbench/src/components/BimViewer.tsx
    └── DeepenNav.tsx                    # 子导航
```

迁移时同步替换：
- `import { bim } from '../../lib/api'` → 新 API 封装（`dealer-workbench/src/lib/api.ts` 已有逻辑）。
- `AuthProvider` → 删除，由 dealer-workbench layout 统一守卫。
- 路径 `/queue`、`/deepen/:id`、`/artifacts` → 新路径。

### 步骤 3：后端端点保持不变

后端 `services/api/src/modules/rysnova-bim` 无需改动，前端只改调用路径前缀。

原 `rysnova-bim-workbench` 调用 `/api/v2/rysnova-bim/*`，`dealer-workbench` 同样走 `/api/v2/rysnova-bim/*`（其 `next.config.js` 已 rewrite `/api/*` 到后端）。

### 步骤 4：路由兼容

在 `dealer-workbench/next.config.js` 增加 rewrites（可选，取决于旧 URL 是否对外曝光过）：

```js
{ source: '/queue', destination: '/bim/deepen-queue' },
{ source: '/deepen/:projectId', destination: '/bim/deepen/:projectId' },
{ source: '/artifacts', destination: '/bim/artifacts' },
```

### 步骤 5：删除 rysnova-bim-workbench

迁移完成并验证后：

```bash
rm -rf apps/rysnova-bim-workbench
git add -A
git commit -m "refactor: merge rysnova-bim-workbench into dealer-workbench/bim"
```

---

## 五、与 designer-workbench 的边界

| 能力 | 归属 | 原因 |
|---|---|---|
| IFC 查看器（只读） | `designer-workbench/viewer` | 设计师用于方案阶段 |
| BIM 项目状态管理 | `dealer-workbench/bim` | 经销商负责交付进度 |
| 深化执行（生成施工图/BOM/效果图） | `dealer-workbench/bim/deepen` | 签单后的技术交付 |
| 产物库 | `dealer-workbench/bim/artifacts` | 交付物管理 |
| 方案设计 / 负荷计算 | `designer-workbench/*` | 售前方案 |

未来如果设计师也需要访问深化台，可以通过共享组件或 iframe 方式复用，而不是再开一套应用。

---

## 六、风险与回滚

| 风险 | 缓解 |
|---|---|
| 迁移过程中组件依赖链断裂 | 每次迁移一个页面，本地构建通过后再迁下一个 |
| 原 `AuthProvider` 跳转逻辑丢失 | dealer-workbench layout 已做登录守卫 |
| 用户旧书签失效 | 配置 rewrite/redirect 兼容 |
| git 历史丢失 | 步骤 1 先整体提交原应用 |

---

## 七、建议立即执行动作

1. ~~同意此方案后，先执行步骤 1（`git add` 并提交 rysnova-bim-workbench）。~~ ✅ 已完成
2. ~~逐个迁移页面，每页一个 commit。~~ ✅ 已完成
3. ~~完成后删除原应用并更新 `docs/SYSTEM-ANALYSIS.md` 的状态。~~ ✅ 已完成

> 执行结果：原 `rysnova-bim-workbench` 的 `/queue`、`/deepen/[projectId]`、`/artifacts` 及 artifact-loaded BIM 查看能力已并入 `dealer-workbench/bim/*`；`BimIfcViewer` 通过新增 `artifactId` prop 替代了原 `BimViewer`；旧路由 `/queue`、`/deepen/:id`、`/artifacts` 已通过 `dealer-workbench/next.config.js` 的 `redirects` 兼容。
