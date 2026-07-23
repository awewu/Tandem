# Rysnova BIM 受约束设备布置与跨楼层三维管线路由 PRD

Status: ready-for-agent

上位需求：3D 能力整合 PRD

产品归属：Rysnova BIM / Rhautt Nexus 设计工作台

视觉参考：`https://rhautt.com/lithnova-designer.html` 的实体设备、实体管道、透视相机、轨道视角、灯光和空间深度表达。该页面仅作为视觉与交互参考，不是生产代码来源或新入口。

## Problem Statement

设计师当前能够在统一 Viewer 中查看和选择三维构件，也已经具备设备拖放、楼层/标高持久化、两点管线绘制和端点移动的基础能力，但这些能力仍不足以完成真实住宅暖通布管：

1. 设备可被拖到远离建筑的位置，缺少基于建筑轮廓、房间和安装类型的有效放置边界，容易产生失真的方案和异常相机包围盒。
2. 当前画管交互本质上是在单一水平面内拖出起点和终点，只能形成直线；设计师不能逐点增加弯折、移动中间路径点或形成工程上可识别的弯头。
3. 当前管线虽然保存了三维坐标，但渲染为没有体积的细线，旋转视角后缺少管径、弯头、遮挡、光照和明确的空间深度，无法承担三维校核。
4. 当前缺少跨楼层路由工作流。设计师无法在二楼指定立管位置、穿越楼板并继续连接一楼设备，也无法在单层视图和全楼三维视图中追踪同一条连续管路。
5. 管道长度、BOM 数量和楼层归属没有建立在一条可持久化、可编辑的完整三维路径之上，编辑后容易与工程量摘要脱节。

用户需要的不是给二维线条增加视觉伪装，而是能够在建筑范围约束下摆放设备、绘制和编辑真实三维路径，并通过立管完成楼层间连续连接的工程设计能力。

## Solution

在现有统一 Viewer 中增加“受约束布置 + 三维折线路由 + 手动立管 + 实体管道渲染”能力：

1. 以当前楼层的建筑轮廓和项目配置计算设备允许放置区域。室内设备限制在建筑轮廓内；允许室外安装的设备可以进入建筑外扩缓冲区，但不能继续拖到远离建筑的位置。
2. 将画管从一次拖拽生成两点直线，升级为逐点创建的三维正交折线路由。设计师可以添加、移动、插入和删除任意路径点，并可将端点吸附到设备接口。
3. 路径数据保持直线段和明确转折点；视觉层根据管径和弯曲半径生成实体管段和圆滑弯头。视觉曲线不得替代工程路径或改变长度计算。
4. 提供“添加立管”工作流。设计师在当前楼层指定立管位置和目标楼层，系统在相同平面坐标处生成垂直段，并允许切换到目标楼层继续绘制同一条逻辑管路。
5. 单层视图显示本层管段及立管入口/出口标记；全楼三维视图显示完整水平段、弯头和垂直段。用户旋转到侧视角时必须清晰看到楼层高差。
6. 保存完整三维路径、楼层关联、管径、弯曲半径、端点连接和系统归属；长度、管件数量提示和 BOM 工程量从已保存路径派生并随编辑更新。

## Product Goals

1. 设备拖放始终保持在建筑内部或允许的有限外扩区域内。
2. 设计师可以绘制至少包含三个路径点的水平折线路由，并编辑任意中间点。
3. 设计师可以从二楼设备连接到一楼设备，形成一条连续且可保存、可重开的三维管路。
4. 管道在正式查看状态下具有真实可感知的体积、管径和弯头，而不是屏幕宽度固定的细线。
5. 三维路径编辑后，长度、选中信息、管道摘要和 BOM 数量保持一致。
6. 新能力继续使用统一 Viewer、现有构件 CRUD 和 v2 Rysnova BIM 后端边界，不创建新的独立页面或平行状态源。

## Success Measures

1. 在验收户型中，设备无法被保存到建筑允许区域以外；越界拖动结束后的位置始终可解释且可重复。
2. 用户可在不输入坐标的情况下完成“二楼设备 -> 二楼水平管 -> 立管 -> 一楼水平管 -> 一楼设备”的完整操作。
3. 保存并刷新后，路径点数量、每点三维坐标、楼层连接、管径和总长度与保存前一致。
4. 全楼三维视图中，从侧面观察可以明确分辨至少一个跨层垂直管段；画布非空且无管道、设备或楼层标签重叠导致的不可用状态。
5. 现有 IFC/GLB 打开、构件选择、设备拖放、BOM 摘要和相机控制回归测试继续通过。

## User Stories

1. As a designer, I want indoor equipment to remain inside the building footprint, so that I do not accidentally create an impossible installation layout.
2. As a designer, I want outdoor-installable equipment to move only within a limited area around the building, so that outdoor units can be placed realistically without disappearing far from the project.
3. As a designer, I want an invalid placement preview before release, so that I understand when the pointer has crossed the allowed boundary.
4. As a designer, I want an out-of-range drop to resolve to the nearest valid position, so that a drag operation cannot corrupt the model.
5. As a designer, I want equipment placement constraints to remain effective after orbiting, zooming, panning or resizing the viewport, so that screen-to-world mapping stays reliable.
6. As a designer, I want to start a pipe from an equipment connector, so that the route has an explicit engineering relationship with the equipment.
7. As a designer, I want to click multiple points to create a route, so that I can guide the pipe around rooms and building elements.
8. As a designer, I want orthogonal snapping while routing, so that horizontal, vertical and right-angle layouts are easy to create.
9. As a designer, I want to finish or cancel an in-progress route explicitly, so that accidental clicks do not create incomplete pipes.
10. As a designer, I want to move any route point, not only the two endpoints, so that I can adjust every bend after drawing.
11. As a designer, I want to insert and remove intermediate route points, so that I can increase or reduce route complexity without redrawing the whole pipe.
12. As a designer, I want bends to appear as connected elbows, so that the route reads as one continuous physical pipe.
13. As a designer, I want the visible pipe diameter to follow the selected specification, so that different systems and sizes are distinguishable in 3D.
14. As a designer, I want pipe and duct systems to retain their own colors and cross-section rules, so that I can isolate and review systems.
15. As a designer, I want to choose a riser position on the current floor, so that I control where the pipe penetrates the slab.
16. As a designer, I want to choose the target floor for a riser, so that the same route can continue from the second floor to the first floor or between other adjacent floors.
17. As a designer, I want the riser to preserve the same plan position while changing elevation, so that the vertical segment is geometrically continuous.
18. As a designer, I want to continue drawing on the target floor without creating a separate unrelated route, so that the full path remains one logical system connection.
19. As a designer, I want each floor view to show local pipe segments and riser markers, so that I can understand where the route enters or leaves that floor.
20. As a designer, I want an all-floor 3D view to show the complete route, so that I can verify vertical relationships by orbiting the model.
21. As a designer, I want to select the solid pipe body and its edit handles reliably, so that visual thickness does not make editing harder.
22. As a designer, I want the route length to include horizontal, diagonal and vertical segments, so that engineering quantities are based on the complete 3D path.
23. As a BOM user, I want saved route edits to update pipe quantity and route statistics, so that the commercial output matches the design.
24. As a project user, I want saved routes to reopen with the same path, floor transitions and equipment connections, so that work survives refresh and later review.
25. As a technical support engineer, I want generated, manually edited and imported model content to remain distinguishable, so that editable business objects do not damage IFC/GLB source geometry.
26. As a reviewer, I want pipe visibility, floor isolation and fit-view controls, so that I can inspect dense routes without losing orientation.

## Functional Requirements

### 1. Placement Boundary

1. The Viewer must derive a placement boundary from the current floor building outline. Room polygons may refine the boundary but must not be the only source when room data is incomplete.
2. Indoor-only equipment must be clamped to the valid building footprint, accounting for its configured placement anchor and dimensions rather than only its center point.
3. Outdoor-installable equipment may use an expanded boundary. The project-level `outsidePlacementMarginM` defaults to 2.0 meters and must be validated as a finite non-negative value.
4. Equipment without an explicit indoor/outdoor installation classification must use the stricter indoor rule.
5. During drag, the Viewer must expose whether the candidate position is valid. On release outside the hard boundary, the saved position must be the nearest valid position, not the raw pointer position.
6. Boundary calculations must use model coordinates and remain stable after camera orbit, zoom, pan and viewport resize.
7. Existing floor, elevation and install-height rules continue to determine the placement plane. Boundary enforcement constrains plan coordinates and must not silently reset vertical placement.
8. A missing or malformed building outline must not permit unbounded placement. The Viewer must use a deterministic fallback derived from the current generated building bounds and report the degraded constraint state.

### 2. Three-Dimensional Route Authoring

1. The default route-authoring mode must create an ordered polyline with two or more three-dimensional points.
2. The coordinate convention is locked to `X/Z` for plan axes and `Y` for absolute model elevation, matching the current Viewer.
3. A route point must retain numeric `x`, `y` and `z` values. Floor identity and local install height may accompany a point but must resolve deterministically to the absolute `y` elevation.
4. The user must be able to add successive route points, finish the route, cancel the draft and undo the most recent draft point.
5. Orthogonal routing must be the default. The interaction may preview the next `X`-first or `Z`-first leg and must not create zero-length duplicate segments.
6. The user must be able to select and drag every route point, including intermediate bends.
7. The user must be able to insert a point on a segment and remove an intermediate point while retaining at least two route points.
8. Route endpoints should snap to compatible equipment connectors when connector metadata exists. Until connector catalogs are complete, an explicit equipment anchor may serve as a documented fallback.
9. Editing a connected equipment position must either update the connected endpoint or visibly mark the connection stale; it must never leave an apparently valid but detached connection without state.
10. Locked routes and protected imported model geometry must not be editable.

### 3. Cross-Floor Riser Workflow

1. MVP cross-floor routing uses a user-selected riser point. Fully automatic riser discovery is not required.
2. The user must be able to invoke “add riser” from an active route, select a target floor and confirm the plan position.
3. A riser must create a vertical route segment at a constant `x/z` position between source and target elevations.
4. Source and target elevations must be derived from project floor levels plus the route install height for each floor. The saved absolute coordinates remain authoritative for rendering and length.
5. The same logical route identifier must span both floors. The implementation must not create two unrelated pipes joined only by matching coordinates.
6. After creating a riser, the Viewer must switch or offer to switch to the target floor and continue the active route from the riser endpoint.
7. A single-floor view must show the route portions associated with that floor and a clear riser-up or riser-down marker at the transition.
8. The all-floor view must render the complete route continuously, including the vertical segment and both floor-level horizontal segments.
9. Changing floor height or level data after routes exist must not silently distort accepted routes. Affected routes must be recalculated through an explicit operation or marked stale for review.
10. The server must reject risers whose floor references do not exist, whose source and target floor are identical, or whose coordinates/elevations are malformed.

### 4. Solid 3D Rendering

1. Draft routing may use lightweight lines and handles for responsiveness, but saved routes must render as solid geometry.
2. Circular pipes must render with a radius derived from `diameterMm`; rectangular ducts must render with their saved width and height.
3. Straight route segments must remain faithful to the authoritative polyline. Bends may use a configured bend radius for a visual elbow but must not overshoot the intended route or pass through unrelated space as an unconstrained spline.
4. Adjacent segments and elbows must appear continuous without visible gaps, detached caps or flicker.
5. Pipe materials must respond to scene lighting and preserve system colors. Selection must remain visually distinct without hiding the system identity.
6. The Viewer must retain orbit, pan, zoom, fit view, layer visibility and floor isolation while solid routes are present.
7. Edit handles must remain usable at normal working zoom levels and must not resize the layout or obscure nearby controls.
8. The Lithnova reference informs depth, tube volume, lighting and camera behavior only. The production Viewer retains its own Rysnova workbench layout, design tokens, dependency versions and accessibility rules.

### 5. Persistence, Validation and Derived Quantities

1. Routes remain business components in the current Viewer draft and component CRUD model; they must not exist only as temporary Three.js objects.
2. The persisted route geometry must contain the ordered three-dimensional point list and cross-floor transition metadata required to reconstruct the same route after reload.
3. Route metadata must include system ownership, route type, size, material, insulation where applicable, bend radius, floor participation, endpoint connection references, visibility, lock state and BOM mapping.
4. The server must validate point count, finite coordinates, supported elevation range, existing floor references, positive size values and allowed component ownership before saving.
5. Total route length must be derived from the saved three-dimensional segments and include vertical distance. Client estimates may be shown during editing, but persisted summaries must be recalculated from accepted geometry.
6. BOM quantity and pipe summaries must update after create, edit, riser insertion, point insertion/removal and deletion.
7. Save and reopen must preserve the route exactly within the repository’s existing coordinate precision.
8. Tenant, project, draft version and authorization checks remain mandatory for every route mutation.

## Implementation Decisions

1. The production surface remains the existing unified Rysnova BIM Viewer. No new public HTML editor, iframe or duplicate application is introduced.
2. The frontend extends the current generated-model interaction state machine and shared Viewer capabilities. Imported IFC/GLB geometry remains protected unless it has an explicit editable business-component projection.
3. New backend behavior belongs to the existing NestJS Rysnova BIM module and `/api/v2/rysnova-bim/*` contract direction. No new business route is added to the legacy production server.
4. Existing Viewer draft component CRUD is the initial persistence seam. The current JSONB model may carry the route shape for MVP; normalization into dedicated route tables is deferred until cross-draft querying, collaboration or fabrication workflows require it.
5. `X/Z` are horizontal plan axes and `Y` is absolute elevation. This convention applies to rendering, persistence, drag raycasting, route length and tests.
6. Engineering geometry is an ordered polyline. A smoothing curve is a rendering aid only and cannot be the source of truth because an unconstrained spline can overshoot walls, floor openings and intended bend positions.
7. Orthogonal polyline routing and user-selected risers are the MVP defaults. They provide deterministic behavior before automatic route finding and collision avoidance are introduced.
8. Placement constraints use a footprint plus typed installation policy. The default outdoor margin is 2.0 meters and can later become tenant/project configuration without changing route geometry.
9. A cross-floor path is one logical route with floor-aware points/transitions, not one component per floor. Floor views derive visibility from that route.
10. Route length, floor participation and BOM quantity are derived values and are recalculated from accepted geometry rather than trusted from arbitrary client input.
11. Solid circular pipes use the repository’s existing Three.js stack; rectangular ducts use an equivalent swept/extruded geometry. The legacy Lithnova CDN dependency and its older Three.js version must not enter the production bundle.
12. Camera control is disabled only during an active placement or route edit gesture and must be restored on pointer release, cancellation, drag end, blur and error paths.

## Acceptance Criteria

1. A manually placed indoor device cannot be saved beyond the building footprint; an outdoor-capable device cannot be saved beyond the configured external margin.
2. Boundary behavior remains correct after orbit, zoom, pan and resize, and the device does not jump when dragging begins.
3. A user can create a route with at least four points and two bends, then save and reopen it with identical geometry.
4. A user can drag an intermediate bend point, insert a new point and delete a non-endpoint point; the solid pipe and total length update after each accepted edit.
5. Saved circular pipes render with visible diameter and continuous elbows; saved ducts render with visible rectangular cross-section.
6. A user can connect a second-floor equipment endpoint to a first-floor equipment endpoint by selecting a riser location and continuing on the target floor.
7. The cross-floor route is stored as one logical route, contains a vertical segment with constant plan position and appears continuous in all-floor 3D view.
8. First-floor and second-floor isolated views show the correct local segments plus complementary riser markers.
9. Rotating to an elevation or side perspective visibly reveals the vertical separation between the two floors and the connecting riser.
10. Total length includes every horizontal and vertical segment and remains consistent between selected-component details, pipe summary and BOM quantity.
11. Saving, refreshing and reopening preserve device constraints, path points, floor transitions, size, system color, endpoint references and derived quantities.
12. Existing IFC/GLB loading, equipment placement, component selection, property editing, deletion, layer visibility and camera controls continue to work.

## Testing Decisions

1. Test external geometry behavior through the existing placement helper seam: given a footprint, component dimensions, installation policy and candidate point, return a deterministic valid/invalid result and nearest allowed placement.
2. Extend existing Viewer placement tests to cover indoor clamping, outdoor-margin clamping, non-ground elevation preservation, malformed outlines and camera-independent model-coordinate behavior.
3. Add route-domain tests for orthogonal point creation, duplicate-point removal, point insertion/removal, three-dimensional length, riser generation, floor participation and endpoint connection state.
4. Extend existing Viewer draft service tests to prove valid multi-point and cross-floor routes persist, reopen unchanged and reject malformed coordinates, floor references, sizes and tenant ownership.
5. Extend existing summary tests to prove route edits and vertical segments update total length, route count, linked component IDs and BOM quantity.
6. Extend the current generated Viewer acceptance seam rather than introducing a separate test application. Browser tests must exercise actual pointer interactions for multi-point drawing, bend editing, equipment boundary clamping and cross-floor continuation.
7. Add an end-to-end scenario: place equipment on floors 2 and 1, draw a second-floor horizontal segment, add a riser, continue on floor 1, connect the endpoint, save, refresh and reopen.
8. Browser visual acceptance must capture desktop and narrow viewport states, verify the WebGL canvas has non-background pixels, and verify the side/elevation view exposes a visible vertical pipe segment.
9. Regression coverage must keep IFC/GLB protected behavior, locked-component behavior, camera recovery, selection, pipe/equipment visibility and existing draft CRUD intact.
10. Feature completion requires the focused Viewer node tests, Rysnova BIM backend unit tests, designer-workbench typecheck/build, Viewer acceptance smoke and relevant production readiness/visual guards to pass. Any unrelated repository-wide failure must be reported separately rather than hidden.

## Out of Scope

1. Fully automatic A* route planning, automatic riser discovery or automatic selection of the globally optimal route.
2. Production-grade clash detection, code-clearance checking, sleeve sizing or structural approval of floor penetrations.
3. Hydraulic balancing, pressure-drop calculation, airflow simulation or automatic equipment sizing changes caused by the route.
4. Fabrication-level fittings, hangers, supports, valves, insulation takeoff and spool drawing generation.
5. Editing original IFC/GLB source geometry directly.
6. Multi-user real-time collaborative route editing and conflict resolution.
7. AR/VR presentation or photorealistic rendering.
8. Copying the Lithnova page layout, legacy HTML implementation, CDN scripts or runtime dependencies into the production Viewer.
9. Changing the fixed product positioning or creating a Lithnova-branded production entry for this Rysnova BIM capability.

## Further Notes

1. This PRD deepens the existing 3D capability integration work. It does not replace the unified Viewer, component CRUD, floor/elevation persistence or BOM handoff decisions already made.
2. Current implementation evidence shows the appropriate extension points already exist: route components use polyline geometry with three-dimensional points, floor/elevation fields are persisted, and the Viewer already supports route creation/update callbacks. The key gaps are multi-point authoring, intermediate-point editing, bounded placement, cross-floor workflow and solid geometry.
3. The first delivery should favor deterministic engineering behavior over automatic routing. Manual bend points and a user-selected riser provide a controllable foundation for later collision-aware routing.
4. The visual reference is accepted when the result has readable depth, volume and vertical separation. Pixel-level reproduction of the Lithnova page is neither required nor desired.
5. Before implementation issues are closed, acceptance must be demonstrated on a real two-floor fixture rather than only synthetic unit coordinates.
