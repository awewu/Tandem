# 3D 能力整合 Issue 拆分

来源 PRD：`docs/dev/3d能力整合.md`

本拆分遵循本仓库本地 issue tracker 约定，正式 issue 文件已发布到 `.scratch/3d-capability-integration/issues/`。每个 issue 都按可独立领取的 vertical slice 编写，要求贯穿前端、后端、数据库和验收测试，不按纯前端/纯后端横切。

## Issue 列表

| Issue | 标题 | 类型 | 依赖 | 是否可并发 |
| --- | --- | --- | --- | --- |
| 01 | Unified Viewer Shell, Persisted Draft and IFC | AFK | 无 | 立即开始 |
| 02 | Legacy Designer Redirect | AFK | 无 | 立即开始 |
| 03 | Generated HVAC Model Persistence and Selection | AFK | 01 | Wave 1 并发 |
| 04 | IFC/GLB Source Parity and Model Records | AFK | 01 | Wave 1 并发 |
| 05 | Load, Equipment and Compliance Persistence | AFK | 01 | Wave 1 并发 |
| 06 | Model CRUD Workflow | AFK | 01, 03, 04 | Wave 2/下游 |
| 07 | 2D, BOM and Quote Database-Backed Handoff | AFK | 01, 05 | 下游并发 |
| 08 | Unified Viewer Acceptance Regression QA | AFK | 全部实现类 issue | 最终验收 |
| 09 | 3D Component Catalog and Left Panel Switching | AFK | 01 | Wave 1 并发 |
| 10 | Expanded Component Instance Contract and Persistence | AFK | 03 | Wave 2 并发 |
| 11 | Drag-to-Place 3D Components | AFK | 09, 10 | Wave 3 |
| 12 | Selected Component Editing and Drag Update | AFK | 11 | Wave 4 |
| 13 | Legacy Designer 2D-to-3D Conversion | AFK | 10 | Wave 4，可与 12 并发 |
| 14 | Manual Components BOM and Quote Rollup | AFK | 05, 10, 12 | Wave 5 |

## 可并发执行批次

### Wave 0：立即开始

1. `01-unified-viewer-shell-persisted-draft-and-ifc`
2. `02-legacy-designer-redirect`

说明：01 是后续大多数页面/状态能力的地基；02 是兼容跳转，独立性高。

### Wave 1：Issue 01 完成后并发

1. `03-generated-hvac-model-persistence-and-selection`
2. `04-ifc-glb-source-parity-and-model-records`
3. `05-load-equipment-compliance-persistence`
4. `09-3d-component-catalog-left-panel`

说明：这四个可以由不同人/agent 同时做。03 做生成模型和选择状态，04 做 IFC/GLB 模型源记录，05 做负荷/设备/合规摘要落库，09 做左侧构件库。

### Wave 2：Issue 03 完成后并发推进

1. `10-expanded-component-instance-contract`
2. `06-model-crud-workflow`，需同时等 01/03/04

说明：10 是手工构件 CRUD 的数据合同。06 是模型级 CRUD，不等同于构件级 CRUD。

### Wave 3：Issue 09 和 10 完成后

1. `11-drag-to-place-3d-components`

说明：这个 issue 负责从左侧构件库拖到 3D 视图，并保存到数据库。

### Wave 4：构件放置/合同完成后并发

1. `12-selected-component-editing-and-drag-update`
2. `13-legacy-designer-2d-to-3d-conversion`

说明：12 做选中后尺寸编辑、拖拽移动、删除和刷新恢复；13 以 `4001/designer.html` 的 2D 图纸/构件能力为标准来源，迁移为同一套 3D 构件实例。`4003/floor-plan` 暂时不作为来源或收敛目标。13 只依赖 10，可以和 12 并发。

### Wave 5：下游联动

1. `14-manual-components-bom-quote-rollup`
2. `07-2d-bom-quote-database-backed-handoff`

说明：14 让手工新增/编辑的设备和管线进入设备清单、BOM、报价摘要。07 保证 2D/BOM/报价入口拿的是数据库上下文。

### Final：最终验收

1. `08-unified-viewer-acceptance-regression-qa`

说明：最终验收必须补充构件库、拖拽放置、属性编辑、删除、刷新恢复、2D 转 3D、BOM/报价联动等路径。

## 推荐并发分配

1. Agent A：Issue 01
2. Agent B：Issue 02
3. Agent C：Issue 03
4. Agent D：Issue 04
5. Agent E：Issue 05
6. Agent F：Issue 09
7. Agent G：Issue 10
8. Agent H：Issue 11
9. Agent I：Issue 12
10. Agent J：Issue 13
11. Agent K：Issue 14
12. Agent L：Issue 06
13. Agent M：Issue 07
14. Agent N：Issue 08

## 执行注意

1. 每个 issue 单独分支，避免多个 agent 同时改同一个大容器文件。
2. Issue 01 应优先提供页面状态和扩展点，后续 issue 通过扩展点接入。
3. Issue 09 和 10 是构件级 CRUD 的核心前置，优先级高。
4. Issue 11/12 不能只做前端 Three.js 临时对象，必须通过后端保存并能刷新恢复。
5. Issue 13 必须复用 Issue 10 的构件实例合同，不允许创建第二套 2D 转 3D 数据结构；不得依赖 `4003/floor-plan`。
