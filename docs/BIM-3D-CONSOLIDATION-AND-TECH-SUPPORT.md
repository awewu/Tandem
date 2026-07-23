# BIM / 3D 代码体系深度检查 · 相互学习推演整合 · 独立技术支持端(:4004)

> 目的:回答"是不是搞了两套 3D 代码体系"(是,至少三套),把各实现相互学习整合成**一套共享 BIM 引擎**,并据此开出独立的**技术支持深化端** `rysnova-bim-workbench`(端口 4004)。

---

## 一、深度检查:现存 3D 体系清单(全部 live)

| 组件 | App | 技术栈 | three | web-ifc | 能力 | 路由 |
|---|---|---|---|---|---|---|
| `components/ThatOpenViewer.tsx` | designer-workbench | **@thatopen/components** | 0.175 | 0.0.68(**CDN**) | IFC 加载(文件+artifactId API)、**剖切面**、**双击选构件**、**隐藏/恢复**、Fragments LOD、正交/透视相机、网格 | `/viewer` |
| `components/Model3DPreview.tsx` | designer-workbench | 裸 three + OrbitControls | 0.175 | — | 通用 3D 预览(非 IFC) | `/floor-plan` |
| `src/components/BimIfcViewer.tsx` | dealer-workbench | **裸 three + 手写 IfcAPI** | 0.155 | 0.0.77(**本地 /wasm/**) | IFC 流式解析、包围盒适配相机、Z-up→Y-up、几何体 dispose、离线、许可声明 | `/bim/[id]` |
| `src/components/AirflowSim.tsx` + `SolutionViewer.tsx` | dealer-workbench | **@react-three/fiber** + drei | 0.155 | — | 气流仿真、方案可视化 | `/design/visualize` |
| `rysnova-bim-designer.html`(1991 行)、`smart-routing.html`、`floorplan-bim.html` | archive | 裸 three(CDN 脚本) | — | — | 旧版 BIM 设计器/寻路(真 3D) | 归档 |

### 结论:三套渲染范式 + 版本分叉
1. **两个独立 IFC 查看器干同一件事**:`ThatOpenViewer`(高层引擎)vs `BimIfcViewer`(裸 three 手写解析)。
2. **版本分叉**:`three@0.175 + web-ifc@0.0.68`(designer)vs `three@0.155 + web-ifc@0.0.77`(dealer)→ 组件无法共享、bundle 重复。
3. **三种范式**:thatopen 引擎 / 裸 three / react-three-fiber,外加 legacy CDN three。

---

## 二、相互学习:各实现的可取之处

**从 `ThatOpenViewer` 学(保留为引擎基座):**
- @thatopen 专业 BIM 能力:剖切面(施工图必需的剖面)、构件双击选中、隐藏/恢复、Fragments LOD(大模型性能)。
- 从 `file-artifact` API 按 `artifactId` 自动加载(接后端产物流)。

**从 `BimIfcViewer` 学(补 ThatOpen 短板):**
- **本地离线 WASM(`/wasm/`)** —— ThatOpen 现在从 `unpkg.com` CDN 取 WASM,离线/内网端不可用;技术支持端必须本地化。
- **许可合规声明**:web-ifc(MPL-2.0)+ three(MIT),明确替代 AGPL 的 xeokit。
- 包围盒适配相机(`fitCamera`)、IFC Z-up→three Y-up、几何体 `dispose()` 内存治理。

**从 `AirflowSim` 学:** react-three-fiber 适合"效果/仿真"类可视化(气流、恒温),与"工程 BIM 精确构件"是不同用途,收敛但不强并。

---

## 三、推演整合:统一到一套共享 BIM 引擎

### 目标:`packages/bim-viewer`(单一真相源)
- **引擎**:`@thatopen/components` + `@thatopen/components-front`(保留全部专业能力)。
- **WASM**:改为**本地 `/wasm/`**(取 BimIfcViewer 做法),锁定单一 `web-ifc` 版本。
- **版本锁**:全仓统一 `three` 与 `web-ifc` 到同一版本(以 designer 的 0.175 / 0.0.68 为基准评估,或统一升到 0.0.77)。
- **导出**:`<BimViewer artifactId? file? mode="review"|"deepen" />`,designer / dealer / 技术支持端共用。

### 收敛动作(除根,不新增第四套)
1. `BimIfcViewer`(dealer 裸 three)**退役** → dealer `/bim/[id]` 改用共享 `BimViewer`。
2. `ThatOpenViewer` 逻辑迁入 `packages/bim-viewer`,designer `/viewer` 改引用共享包。
3. `Model3DPreview`(轻量非 IFC 预览)保留或并入共享包的 `preview` 模式。
4. `AirflowSim`/`SolutionViewer`(仿真)暂留,后续评估收敛为共享包的 `sim` 模式。
5. legacy HTML 3D **仅作视觉参考,不迁代码**。

---

## 四、两条业务工作流 × 独立技术支持端(:4004)

主线钥匙:**`opportunityId`** 贯穿 诊断 → 设计 → 报价 → 合同 → BIM(已在后端实体层就位)。

### 工作流 1 — 设计师/销售 + 客户:边改边报价(designer-workbench)
- 从问诊 `opportunityId` 注入基础信息 → `/floor-plan`(二维图)+ `design-diagram`(原理图)边改。
- 编辑发 `design.changed` → 后端 `DesignChangedHandler` 自动重算报价(已签/锁定报价跳过)+ 把 BIM 派生产物置 `stale`。

### 工作流 2 — 技术支持深化:签约资料 → 3D 效果图 + 施工图(**新端 :4004**)
- 角色 `engineer`(信任阶梯:可把 `estimate` 提升为 `verified`,见 `bim-role.policy.ts`)。
- 输入:已签合同的 二维图 / 原理图 / 报价单(经 `opportunityId` 拉取)。
- 深化:共享 `BimViewer`(剖切/构件)产出 **BIM 3D**;生成 **施工图**(剖面/图纸)与 **效果图**;产物回挂合同 + `verified`。
- 交接:后端 `design-sync` / `design-changed.handler` 已提供"设计变更 → 深化产物 stale"的单一真相源同步。

---

## 五、独立端口 A 落地:`apps/rysnova-bim-workbench`(:4004)

- 端口 4004(空闲;4000-4003/4005/4010-4016 已占)。
- 技术栈同 designer-workbench(Next.js 16 + webpack),`engineer` 角色内嵌登录门。
- `/api/*` 代理到 NestJS :3300;引用共享 `bim-viewer`(过渡期先内联 ThatOpen + 本地 WASM)。
- 路由规划:`/`(工作台首页/待深化队列)、`/deepen/[opportunityId]`(深化工作台:BIM3D + 施工图 + 效果图)、`/artifacts`(产物库)。

### 分期
- **P0**:开端口 4004 + engineer 登录 + 共享 BIM 查看器(本地 WASM),证明独立端可登录可看 3D。
- **P1**:接 `opportunityId` 拉取签约资料(二维/原理/报价),深化队列。
- **P2**:施工图(剖面/图纸导出)+ 效果图产出,产物回挂 + `verified` 提升。
- **P3**:`packages/bim-viewer` 正式抽包,designer/dealer 回迁,退役 `BimIfcViewer`,统一版本。
