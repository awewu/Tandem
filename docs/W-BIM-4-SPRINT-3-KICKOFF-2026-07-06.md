# W-BIM-4 · 冲刺 3 立项报告：基础设计能力（论证 → 立项 → 启动）

> 本报告承接冲刺 1（合规/产品目录/基准集/迁移方案）与冲刺 2（真相源/存证/签收）的验证结论，正式为冲刺 3（W-BIM-4 基础设计能力）立项，明确范围、验收、风险与首批交付。

## 1. 前置论证已完成的结论

| 维度 | 论证结论 | 证据 |
|---|---|---|
| 开源 BIM 底座 | ✅ ThatOpen 可加载 IFC、剖切、显隐、构件选中；许可证可商用 | `experiments/thatopen-spike/README.md` 验收 4 项全过 |
| 精算合规 | ✅ verified 链路 + 计算书 + 国标软闸 | `DesignService.runCalc` + `calc-report.ts` |
| 产品目录驱动 | ✅ kernel 无硬编码设备；价格来自产品真相源 | `WaterSystemEngine` + `default-device-catalog.js` |
| 数据真相源 | ✅ design.changed → outbox → stale + quote 重算 | `DesignChangedHandler` + `DesignSyncService` |
| 工程修正回流 | ✅ BCF-3.0-lite 载荷契约 | `bcf.ts` + `bcf.spec.ts` |
| 对象存储存证 | ✅ 外部往返证据 + 上传/下载自动 SHA-256 | `ObjectStorageEvidenceService` + 端点 |
| 客户签收 | ✅ 电子签 PDF 存对象存储 + DeliveryRecord 闭环 | `ContractService.handleWebhook` + `GET /contract/:id/acceptance` |

## 2. 冲刺 3 目标

W-BIM-4：把 ThatOpen spike 从隔离实验转正为 `designer-workbench` 的正式模块，并补齐三项基础设计能力：

1. **3.1 查看器替换**：ThatOpen 接 approved 产物（图纸、IFC、BOM）
2. **3.2 轻量户型层**：画墙、画房间、CAD 底图临摹
3. **3.3 HVAC 参数化几何层 v1**：布管吸附、直径壁厚、变径辅材、吊杆

## 3. 范围与首批交付（MVP）

### 3.1 查看器替换（优先）
- 在 `apps/designer-workbench` 新建 `app/viewer` 路由 ✅
- 封装 `ThatOpenViewer` React 组件，复用 spike 的 `main.js` 逻辑 ✅
- 支持：IFC 本地加载、剖切、构件显隐、双击选中 ✅
- 输入来源：`GET /api/file-artifact/:id/base64`（artifactId 从 `?artifactId=xxx` 传入）✅
- 输出：后续通过 `onLoaded` 回调把模型信息透传给 HVAC 参数化层

### 3.1 已交付文件
- `apps/designer-workbench/components/ThatOpenViewer.tsx`
- `apps/designer-workbench/src/app/viewer/page.tsx`
- `apps/designer-workbench/src/app/viewer/ViewerParams.tsx`
- `apps/designer-workbench/package.json`（依赖更新）
- `apps/designer-workbench/README.md`（smoke test 步骤）

### 3.2 轻量户型层（其次）
- 在 `designer-workbench` 新增 `app/floor-plan` 路由 ✅
- 2D 画布： walls / rooms 的 CRUD ✅
- 支持上传 CAD 底图作为临摹层 ✅
- 数据回写 `POST /design/floor-plans` 与回读 `GET /design/projects/:id/floor-plan` ✅

### 3.2 已交付文件
- `apps/designer-workbench/components/FloorPlanCanvas.tsx`
- `apps/designer-workbench/src/app/floor-plan/page.tsx`
- `package.json` 加入 `konva` + `react-konva`

### 3.3 HVAC 参数化几何层（核心自研投入）
- 在 approved 产物/户型图上叠加 HVAC 管线 ✅（基础组件，已嵌入 `/floor-plan`）
- 吸附到墙/楼板 ✅（pipe 模式自动 snap 到最近墙线段）
- 管径、壁厚、保温、材质、吊杆间距参数化 ✅
- 3D 可视化占位 ✅（新增 `Model3DPreview`：墙/房间/管线/设备简单 3D 渲染）
- 自动计算管长与辅材 ⬜

### 3.3 已交付文件
- `apps/designer-workbench/components/HvacParametricLayer.tsx`
- `apps/designer-workbench/components/Model3DPreview.tsx`

> 暂不求解，先保证几何表达与 BOM 参数一致。

### 3.4 分系统建模 + 族=真产品
- 新风/采暖/空调/水电/强电 系统分类 ✅
- 设备可绑定 `productAssetRef`（直连产品真相源/报价）✅
- 设备与户型图位置绑定 ✅（在 `FloorPlanCanvas` 中直接放置设备）
- 设备参数传入精算引擎 ✅（`/floor-plan` 把 devices 传给 `useCalcOnChange`）

### 3.4 已交付文件
- `apps/designer-workbench/components/SystemModel.tsx`
- `apps/designer-workbench/src/app/system-model/page.tsx`
- `apps/designer-workbench/components/FloorPlanCanvas.tsx`（device 模式）

### 3.5 出图与 BOM
- 工程图图签（SVG）✅
- 按系统/管材/吊杆聚合 BOM ✅
- 综合 `/bom` 页面（户型+管线+系统+工程图+BOM）✅
- PDF 导出 / 产品目录价格对接 ⬜

### 3.5 已交付文件
- `apps/designer-workbench/components/BomSheet.tsx`
- `apps/designer-workbench/components/DrawingSheet.tsx`
- `apps/designer-workbench/src/app/bom/page.tsx`

### 3.6 边画边算
- 前端 `useCalcOnChange` hook：防抖 + 调用 `/api/design/calc` ✅
- `/floor-plan` 改动即触发重算 ✅
- 后端 `design.changed` 已驱动 quote 重算 ✅
- 重审/信任状态机 UI ⬜

### 3.6 已交付文件
- `apps/designer-workbench/hooks/useCalcOnChange.ts`

## 4. 验收标准（冲刺 3 出口）

- [ ] `designer-workbench` 能独立启动并打开 ThatOpen viewer
- [ ] 加载 `small.ifc` 耗时 < 3 秒（本地网络）
- [ ] 剖切、显隐、构件选中三种操作可用
- [ ] 户型层可画墙、保存、回读
- [ ] HVAC 层可布一根管并展示管径/吊杆参数
- [ ] 新增 viewer/floor-plan 路由通过 smoke test
- [ ] BOM 页面可展示设备+管材+吊杆
- [ ] 改动户型后 2 秒内触发重算

## 5. 依赖与风险

| 依赖 | 状态 | 风险 |
|---|---|---|
| ThatOpen spike | ✅ 已验证 | WASM 打包体积大；Next.js 需自定义 webpack 配置 |
| 产物 approved API | 🔵 待 2.3 完成后稳定 | 若 legacy 产物未迁移，viewer 先接入 NestJS 新产物 |
| 户型 2D 引擎 | ⬜ | 可用 fabric / konva / 自研 canvas；需选型 |
| HVAC 几何内核 | ⬜ | 核心自研投入，需预留算法迭代时间 |
| 设计产物版权 | 低 | 客户上传 CAD 临摹不涉及版权转移 |

## 6. 建议实施顺序

1. **第 1-2 天**：把 `thatopen-spike` 封装进 `designer-workbench`（viewer 路由）
2. **第 3-4 天**：户型层 2D 画布选型 + 画墙/保存
3. **第 5-7 天**：HVAC 参数化几何层 v1（单管 + 吊杆）
4. **第 8 天**：smoke test + 验收

## 7. 立项决策点

- 是否批准把 ThatOpen 作为正式 viewer 底座？（论证已通过）
- 是否批准在 `designer-workbench` 中新增 `viewer` 与 `floor-plan` 路由？
- 是否批准投入 HVAC 参数化几何层自研？
- 户型 2D 引擎选型：fabric.js / konva.js / 自研？

## 8. 下一步动作

若本立项报告获批，立即执行：
1. 在 `apps/designer-workbench` 新建 `ThatOpenViewer` 组件与 `app/viewer` 路由
2. 把 `small.ifc` 作为测试资源拷入 public 目录
3. 配置 Next.js 以支持 `web-ifc` WASM 文件加载
