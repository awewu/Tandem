# Rysnova BIM 3D 视口专业编辑与分叉管网 PRD

Status: ready-for-agent

产品归属：Rysnova BIM / Rhautt Nexus 设计师工作台

需求状态：本 PRD 所列产品需求已确认并锁定，可直接进入实施拆分。

上位需求：Rysnova BIM 受约束设备布置与跨楼层三维管线路由 PRD

## Problem Statement

设计师已经可以在统一 3D Viewer 中生成模型、选择构件、绘制多点管线、调整端点和添加跨层立管，但当前页面仍然带有明显的开发阶段痕迹，编辑效率与工程表达能力不足：

1. 楼层、视图范围、选择、画管、移动、拖端点、立管和删除等高频工具位于右侧长面板中，离主要操作画布较远，并与属性字段、摘要和状态信息混排。
2. 管线字段在没有选中管线时仍长期显示，用户无法快速判断当前是在创建新管线、编辑已有管线，还是只浏览模型。
3. 数据库上下文、草稿 ID、模型 ID、可信度、MVP 说明、内部 BOM 映射和多段状态文字占用大量垂直空间。这些信息主要服务开发调试，不服务设计师当前任务。
4. 保存草稿和重新载入是当前唯一的恢复手段。设计师无法安全撤销误删、误移、错误端点调整或属性修改，也无法重做刚刚撤销的操作。
5. 当前工程路径仍以单条折线的起点和终点关系为核心。虽然能够保存多个路径点和弯曲半径元数据，但渲染层仍以直管段和球形接头拼接，不能形成符合安装语义的圆弧弯头；连接合同只有首尾端点，不能表达主管、支管和三通节点。
6. 墙体、门和窗主要继承系统颜色或相近的中性色，选中态还会覆盖原有颜色。模型旋转、缩放或构件密集时，三类建筑构件缺少稳定识别度，设计师难以快速理解空间边界和开口位置。
7. 右侧摘要、设备清单、管道统计和内部构件详情与 BOM、摘要等下游页面职责重复，使 3D 编辑页面变成信息堆叠页，而不是聚焦建模操作的专业工作区。

用户需要一个职责清晰、可恢复、可识别并具备真实管网拓扑的 3D 编辑工作区：工具靠近画布，属性跟随选择，错误操作可以撤销，墙门窗一眼可辨，管线能够以真实弯头和分叉关系参与后续工程量与 BOM 计算。

## Solution

将统一 3D Viewer 收敛为“顶部工具栏 + 中央视口 + 选择驱动检查器 + 固定草稿操作区”的专业编辑布局，并补齐编辑历史、建筑构件类型着色和分叉管网能力：

1. 将楼层、单层/全部楼层、选择、画管、移动、拖端点、立管和删除移动到视口顶部工具栏。
2. 在工具栏加入撤销与重做。完整编辑动作形成一个原子历史步骤，拖拽过程不得按每次指针移动写入历史。
3. 右侧只显示与当前上下文有关的属性。未选中管线时不显示已有管线字段；选中管线后才显示管线系统、尺寸、标高、长度、弯曲半径和连接状态。
4. 删除数据库交接四宫格、设备清单、管道统计、内部构件详情、草稿 ID、MVP 说明和长期调试状态。错误、未保存、锁定和保存失败等操作状态改为就近提示或短暂通知。
5. 右侧底部固定保留“保存草稿”和“重新载入”，并以轻量状态表达是否存在未保存修改。
6. 将管线底层表达升级为由连接节点和管段组成的工程网络。用户可以从已有管段发起支管，系统自动切分主管并建立三通或其他明确的分叉节点。
7. 路径仍以可计算的工程中心线为权威数据。转角根据管径和弯曲半径生成相切圆弧弯头，不使用可能越界的任意平滑样条替代工程路径。
8. 为生成模型中的墙体、门和窗建立独立类型材质：墙体使用稳定的中性结构色，门使用暖色，窗使用带透明度的冷色玻璃表达。选中态通过轮廓或发光强调，不覆盖基础类型颜色。
9. 保持 IFC/GLB 原始材质和受保护几何不受类型着色规则影响；本需求只治理可编辑的生成模型构件。

## User Stories

1. As a designer, I want editing tools directly above the 3D viewport, so that I can switch tools without leaving the modeling context.
2. As a designer, I want floor selection and floor isolation beside the viewport tools, so that I can understand which floor an edit affects.
3. As a designer, I want destructive deletion separated from ordinary tools, so that I do not trigger it accidentally.
4. As a designer, I want unavailable tools visibly disabled, so that I know which actions are valid in the current state.
5. As a designer, I want to undo a completed edit, so that an accidental move, deletion or property change does not force me to reload the whole draft.
6. As a designer, I want to redo an undone edit, so that I can recover when I undo too far.
7. As a keyboard user, I want standard undo and redo shortcuts, so that repetitive editing remains efficient.
8. As a designer, I want cancelling an in-progress route to remain distinct from undoing a completed route, so that draft gestures and accepted edits have predictable behavior.
9. As a designer, I want a full drag gesture to create one history entry, so that undo returns the component to its original position in one step.
10. As a designer, I want a deleted editable component to be recoverable through undo, so that destructive actions remain reversible within the session.
11. As a designer, I want saving a draft to preserve my current session history, so that saving does not prevent me from correcting the latest operation.
12. As a designer, I want a warning before reload discards unsaved work and history, so that I do not lose edits unexpectedly.
13. As a designer, I want pipe properties to appear only after selecting a pipe or duct route, so that the inspector always describes a real editing target.
14. As a designer, I want the selected route inspector to show system, size, elevation, length, bend radius and connection state, so that I can make engineering changes without reading internal metadata.
15. As a designer, I want non-route selections to hide pipe fields, so that equipment, walls, doors and windows are not confused with routes.
16. As a designer, I want an empty or minimal inspector when nothing is selected, so that the viewport retains visual priority.
17. As a designer, I want raw IDs, database handoff details and MVP explanations removed, so that the production workbench does not look like a debugging console.
18. As a designer, I want save failures, lock state and validation errors to remain visible near the affected action, so that removing debug text does not hide actionable problems.
19. As a designer, I want “保存草稿” and “重新载入” to remain persistently available, so that draft persistence is always easy to find.
20. As a designer, I want to identify walls by a stable neutral structural color, so that I can read the building boundary quickly.
21. As a designer, I want doors to use a visually distinct warm color, so that entrances and openings stand out from walls.
22. As a designer, I want windows to use a visually distinct translucent cool color, so that glazing is recognizable from doors and solid walls.
23. As a designer, I want selected walls, doors and windows to retain their type color, so that selection does not destroy category recognition.
24. As a reviewer, I want type colors to remain legible under normal lighting and different camera angles, so that recognition is not dependent on one view.
25. As a designer, I want imported IFC/GLB materials to remain unchanged, so that source-model fidelity is not damaged by generated-model styling.
26. As a designer, I want route corners to display as continuous radius elbows, so that the model resembles installable pipework instead of connected sticks.
27. As a designer, I want bend radius to follow the selected route specification, so that visual geometry and engineering metadata agree.
28. As a designer, I want to start a branch from an existing pipe segment, so that one source can serve multiple terminal devices.
29. As a designer, I want the host pipe to split automatically at the selected branch point, so that the network remains topologically connected.
30. As a designer, I want a tee or wye junction to be created explicitly, so that fittings can be identified and counted in BOM.
31. As a designer, I want to move a junction and have connected segments update together, so that branch edits do not detach the network.
32. As a designer, I want deleting a branch to preserve the valid remainder of the main route, so that local cleanup does not destroy unrelated pipework.
33. As a designer, I want undoing branch creation to restore the exact pre-branch main route, so that the topology edit is one reversible operation.
34. As a BOM user, I want elbows, tees and pipe lengths derived from the accepted network, so that commercial quantities match the model.
35. As an engineering reviewer, I want disconnected or stale junctions visibly identified, so that an apparently continuous model cannot hide a broken network.
36. As a project user, I want save and reload to preserve route nodes, segments, fittings, colors and connections, so that the design can continue in a later session.

## Functional Requirements

### 1. Viewport Toolbar

1. The primary editing toolbar must appear above the 3D viewport and remain visible while the right inspector scrolls.
2. The toolbar order is locked to: `撤销 / 重做 | 楼层 / 单层·全部楼层 | 选择 / 画管 / 移动 / 拖端点 / 立管 | 删除`.
3. Undo and redo use familiar directional-arrow icons with accessible labels and tooltips. Icon buttons must have stable dimensions and must not shift the layout when enabled or disabled.
4. Delete must be visually separated from the ordinary editing tools, use destructive semantics, and remain disabled until a deletable editable object is selected.
5. Riser must remain disabled unless an editable route is selected and the project has a valid target floor.
6. Floor selection must clearly indicate the active floor. Single-floor and all-floor modes remain mutually exclusive.
7. Tool selection, disabled state, keyboard focus and busy state must remain visually distinguishable without relying only on color.
8. At narrower supported desktop widths, the toolbar may use controlled horizontal overflow or grouped wrapping, but it must not overlap the project title, viewport or right inspector.

### 2. Undo, Redo and Dirty State

1. The editable session must maintain separate undo and redo stacks with a documented bounded history size of at least 50 completed actions.
2. The following completed actions must be reversible: component create, delete and move; route create and delete; path-point insert, move and delete; endpoint move; riser creation; branch and junction creation; editable property changes; and applicable lock/visibility changes.
3. A continuous pointer gesture creates one history entry from the state before pointer-down to the accepted state after pointer-up.
4. A property input session creates one history entry when the value is committed through blur, Enter or an explicit save action. Intermediate keystrokes must not flood history.
5. Undoing branch creation must reverse the complete transaction, including the new branch, junction and split host segments.
6. Redo must replay the same accepted result without generating new identifiers or changing geometry unexpectedly.
7. Starting a new accepted action after undo clears the redo stack.
8. Cancelling an unfinished route, riser or drag is not an undo operation and must not consume a completed history entry.
9. Saving a draft does not clear session history. Successful save updates the clean checkpoint used by the unsaved-state indicator.
10. Reloading, switching project, switching draft or regenerating the authoritative model clears history only after unsaved changes are handled through the existing confirmation policy.
11. Standard shortcuts are required: `Ctrl/Cmd+Z` for undo, `Ctrl/Cmd+Shift+Z` for redo, and `Ctrl+Y` as a Windows redo alternative.
12. Shortcuts must not trigger while the user is composing text with an IME or when native text-field undo should retain ownership.

### 3. Selection-Driven Inspector and Information Cleanup

1. Existing-route properties must not render when no route is selected.
2. Selecting a pipe or duct route opens a route-specific inspector containing only user-facing editable fields and actionable connection state.
3. Pipe-route fields include name, system, diameter, material where supported, insulation where supported, start/end elevation, calculated length, bend radius and endpoint/junction connection status.
4. Duct-route fields substitute width and height for pipe diameter and retain compatible bend-radius behavior.
5. Selecting equipment, wall, door or window must not show route fields or raw component metadata. Any retained type-specific property editor must contain only properties required by an established editing workflow.
6. The persistent “当前选中构件” raw-detail block is removed. Internal IDs, model version, BOM category and SKU hints are not displayed in the normal inspector.
7. Database context metrics, equipment summary cards, pipe summary cards, raw draft ID, MVP instructions and long-lived technical status paragraphs are removed from the modeling inspector.
8. Data removed from this screen remains available to its owning workflow, such as BOM, design summary or diagnostic evidence; this requirement removes presentation, not authoritative data.
9. Validation errors appear next to the relevant control or in a concise notification. Save error, lock state, stale connection and unsaved state remain visible.
10. “保存草稿” and “重新载入” remain fixed at the bottom of the inspector. The controls must remain reachable without scrolling through removed diagnostic content.
11. Reload remains disabled when no persisted draft exists. Save and reload expose loading and failure states without duplicating database IDs.

### 4. Engineering Elbows and Branch Network

1. The authoritative route representation must distinguish network topology from route rendering geometry.
2. A network consists of stable nodes and connected route segments. Supported node roles include equipment connector, free endpoint, junction and cross-floor transition.
3. Junction type must be explicit. MVP must support tee junctions; the contract must allow later wye, cross and manifold types without reinterpreting ordinary bend points as junctions.
4. Each route segment retains an ordered three-dimensional centerline, system ownership, route type, size, material, insulation, floor participation, visibility, lock state and BOM mapping.
5. Starting a branch from an existing segment must project the selected point onto the accepted centerline, reject invalid near-endpoint or zero-length splits, split the host segment deterministically and create one shared junction node.
6. Connected segment endpoints must reference the same junction identity. Coincident coordinates without a shared node do not count as a valid connection.
7. Moving a junction updates all incident editable segments in one atomic operation. Locked segments prevent or constrain the move with an actionable message.
8. Deleting a branch removes only the selected branch edge and any now-unused branch endpoint. The main path remains connected unless the user explicitly deletes it.
9. A bend is not a network junction. Bend points carry geometric turn information but do not imply flow division.
10. For a valid corner, the renderer must trim adjacent straight portions and generate a tangent circular elbow using the accepted bend radius.
11. Bend radius must be positive and compatible with adjacent segment lengths. When the requested radius cannot fit, the system must clamp to a deterministic valid radius or reject the edit with a clear field error; it must not silently overshoot the centerline corridor.
12. Arbitrary Catmull-Rom, Bezier or other free splines must not replace the engineering centerline as the source of truth.
13. Circular pipes render swept circular elbows. Rectangular ducts render an equivalent radius transition that preserves the accepted width and height.
14. Tee geometry must appear physically connected without gaps, overlapping caps or detached branch cylinders.
15. Accepted length is derived from straight centerline portions plus arc centerline lengths. Elbow, tee and other fitting quantities are derived from topology and geometry rather than manually entered summary values.
16. Network persistence must retain stable node and segment identities across save and reload so that selection, undo/redo replay, BOM references and future hydraulic analysis remain deterministic.
17. Existing unbranched logical routes remain readable through a compatibility path and may be treated as a two-endpoint, one-or-more-segment network without destructive migration.

### 5. Wall, Door and Window Type Colors

1. Generated editable walls, doors and windows must use component-type colors rather than inheriting a common envelope color.
2. Default semantic materials are locked as follows:
   - Wall: `#94A3B8`, neutral structural gray, predominantly opaque.
   - Door: `#B7791F`, warm amber-brown, opaque enough to remain distinct from walls.
   - Window glazing: `#38BDF8`, cool light blue with controlled transparency; frame uses a neutral light material distinct from glazing.
3. These colors are 3D semantic visualization tokens, not Rheem brand colors. Rheem Red `#E4002B` remains reserved for brand identity and primary UI actions and must not become the default wall, door or window material.
4. Material roughness, metalness, opacity and lighting response must keep each component visible against the current light viewport background.
5. Selection must preserve the base type material and add an outline, halo or emissive accent. Replacing the entire selected object with yellow is not acceptable because it removes category recognition.
6. Hover, selected, locked and invalid-placement states must remain distinguishable from the default material and from each other.
7. Type recognition must not depend on color alone. Door frames/panels, window frames/glazing and wall solid form remain geometrically distinguishable.
8. Color assignment must be stable across model regeneration, save/reload, floor isolation and visibility toggles.
9. Imported IFC/GLB objects retain source materials unless a later explicit material-override feature is approved. No automatic recoloring is applied to protected imported geometry.
10. Pipe and equipment system colors retain their existing system semantics and must not be replaced by the new wall/door/window palette.

## Implementation Decisions

1. The production surface remains the existing unified Rysnova BIM Viewer in the designer workbench. No new page, iframe or duplicate editor is introduced.
2. The visual layout has four responsibilities: viewport header and toolbar, central 3D canvas, selection-driven right inspector, and fixed draft persistence actions.
3. Undo/redo is a client-session command history over accepted editable domain changes. History records stable before/after domain state or deterministic inverse commands, not Three.js object instances and not pointer-event streams.
4. Persistence stores the current accepted draft state, not the session history. Multi-user collaborative undo and server-side history browsing are outside this increment.
5. Branch creation, junction movement and branch deletion are atomic domain transactions so that undo, redo, persistence and derived quantities cannot observe half-completed topology.
6. The existing v2 Rysnova BIM module remains the backend owner. New network contract behavior stays under the established `/api/v2/rysnova-bim/*` boundary and does not add business routes to the legacy production server.
7. The current ordered route points remain the geometric compatibility representation. Network nodes and segment relationships add topology; they do not discard the established `X/Z` plan axes and absolute `Y` elevation convention.
8. Engineering elbows are derived from centerline turn points and bend radius. The visible curve and its derived arc length must be reproducible from persisted data.
9. Component type determines the base material for generated walls, doors and windows; HVAC system determines the base material for routes and equipment. Selection is a separate visual layer.
10. Removed summary and debug information is not deleted from persisted drafts or downstream contracts. It is removed only from the primary modeling surface.
11. Existing imported-model protection, tenant ownership, draft versioning, component lock rules and endpoint stale-state behavior remain mandatory.
12. No new frontend dependency is required for command history, semantic materials, circular elbows or network graph validation unless the existing stack proves insufficient during implementation and the dependency is separately approved.

## Acceptance Criteria

1. The viewport toolbar shows undo, redo, active floor, single/all floors, select, draw pipe, move, drag endpoint, riser and delete in the approved order without overlapping the viewport at supported desktop widths.
2. Delete is separated, disabled without a deletable selection and enabled for an editable selected component.
3. Creating and then undoing a route removes it; redoing restores the same route identity, geometry and properties.
4. Moving a component through a continuous drag and pressing undo once returns it to the exact pre-drag position.
5. Deleting a component and pressing undo restores it with the same identity and connections.
6. Undoing after changing route diameter, elevation or bend radius restores the previous accepted value; redo restores the new value.
7. Saving a draft leaves undo available, while reloading an accepted draft clears session history after the unsaved-change policy is satisfied.
8. No pipe property block is visible when nothing or a non-route component is selected.
9. Selecting a pipe shows its user-facing route fields; selecting a duct shows width/height fields; raw IDs and internal BOM/SKU metadata remain absent.
10. Database context cards, equipment summary, pipe summary, MVP instructions, persistent current-component details and raw draft ID are absent from the modeling inspector.
11. Save draft and reload remain visible at the bottom, with a concise dirty/saved state and actionable failure feedback.
12. Generated walls render in neutral gray, doors in warm amber-brown and window glazing in translucent light blue under the normal scene lighting.
13. Selecting each wall, door or window preserves its type color while adding a visible selection treatment.
14. Imported IFC/GLB material appearance remains unchanged in a protected regression fixture.
15. A four-point route with two bends renders continuous tangent elbows whose radii match accepted values and do not extend beyond adjacent segment limits.
16. A user can select a main-pipe segment, create a branch and obtain one shared tee junction with three connected incident segments.
17. Moving the tee updates all connected editable segments without gaps; undo restores the previous junction and segment geometry in one step.
18. Deleting the branch preserves a continuous main route; undo restores the branch, shared junction and original split geometry.
19. Save and reload preserve network node IDs, segment IDs, centerlines, junction type, bend radius, endpoint references and component colors.
20. Derived total length includes straight and arc centerline lengths, and derived BOM fitting quantities include the accepted elbows and tee.
21. Existing multi-point routing, route-point editing, cross-floor risers, floor isolation, equipment movement, camera controls and IFC/GLB viewing continue to pass regression checks.

## Testing Decisions

1. Use the existing Viewer acceptance smoke seam as the highest-level test of toolbar presence and order, tool enabled states, selection-driven inspector behavior, semantic type materials, undo/redo workflows, branch creation, save/reload and protected IFC/GLB behavior.
2. Viewer tests assert user-observable model state and rendered semantic summaries. They must not couple to incidental React component structure or raw Three.js scene-tree ordering.
3. Add focused command-history tests for create, delete, move, property edit, path-point edit, riser creation and branch topology transactions. Each test verifies domain state before action, after action, after undo and after redo.
4. Add focused geometry tests for fillet feasibility, tangent points, arc length, radius clamping/rejection, zero-length segments, near-collinear corners and rectangular-duct turns.
5. Add focused graph tests for segment splitting, shared junction identity, incident-edge updates, branch deletion, orphan-node cleanup, stable identifiers and compatibility conversion from an unbranched logical route.
6. Extend NestJS viewer-draft contract tests to validate network ownership, finite coordinates, supported junction types, connected references, version conflicts, save/reload fidelity and server-derived length/fitting quantities.
7. Add visual acceptance at representative desktop viewports to verify toolbar fit, inspector hierarchy, non-overlap, wall/door/window differentiation and visible elbow/tee geometry.
8. Visual acceptance must include canvas pixel checks or equivalent rendered-output evidence so a nonblank DOM shell cannot pass while WebGL geometry is missing.
9. Run the designer-workbench typecheck and production build because the change crosses shared Viewer state, API contracts and rendering behavior.
10. Run existing Rysnova BIM viewer acceptance and relevant backend module tests as regression gates. Broader production readiness is required only when the implementation is promoted to the active production candidate surface.

## Out of Scope

1. Automatic full-building pipe routing, obstacle avoidance, clash resolution or optimization of branch topology.
2. Hydraulic balancing, flow allocation, pressure-drop solving or automatic pipe sizing, although the network model must not block those later capabilities.
3. Fabrication-level fittings, manufacturer-specific elbow catalogs, spool drawings or Revit family generation.
4. Free-form spline pipe authoring that is not constrained by engineering bend and fitting semantics.
5. Collaborative multi-user undo, persisted history timelines, named revisions or branch/merge version control.
6. Recoloring imported IFC/GLB source materials.
7. A general-purpose theme editor for user-configurable component colors.
8. Redesign of the BOM, design-summary, quotation or compliance pages that own information removed from the modeling inspector.
9. Full mobile 3D authoring. Mobile may retain a read-only or reduced interaction surface; desktop professional editing remains the acceptance target.

## Further Notes

1. “撤销”与“取消当前操作”是不同状态转换：取消只清理尚未接受的临时手势，撤销只作用于已经完成并进入编辑历史的动作。
2. 墙体、门和窗颜色用于工程识别，不属于品牌装饰。它们应保持克制，并通过结构形态、透明度和选中轮廓共同建立识别，而不是依赖高饱和度色块。
3. `bendRadius` 已存在于当前逻辑路由合同中，但必须从被动元数据升级为真实几何与工程量输入。
4. 分叉的关键验收不是“看起来相交”，而是三条管段共享同一稳定 junction identity，并能被保存、移动、撤销、重做和计入 BOM。
5. 页面信息清理不应造成可观察性倒退。开发诊断继续通过测试证据、结构化日志和开发工具提供，不回到普通用户的常驻界面。
