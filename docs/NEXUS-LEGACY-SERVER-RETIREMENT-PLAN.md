# 遗留 Express `server/` 退场迁移清单（营销中台最大减重）

> 目标：安全退役 `server/`（48,421 行 / 1.66 MB · 当前生产入口 `server-production.js`），把生产入口切到 NestJS(3300)，删除最大技术债。**分波推进，每波门禁全绿 + 可回滚。** 不裸删（裸删=生产死 + 6 门禁崩）。
> 现状关键事实：`/api/v2` **默认已由 productionMiddleware 前置代理转发到 NestJS(3300)**；in-process `v2.router` 仅在 `LEGACY_V2_INPROCESS=true` 回退时服务。共 7 路由组 / ~24 路由。

## 路由组分类（归属 × v2 对等 × 动作）
| 组 | 路由 | 归属 | v2 对等 | 退场动作 |
|---|---|---|---|---|
| core-and-v2 | `/api/v2`(代理) · core-api · standards | 营销/CORE | ✅ NestJS 已服务 v2 | 波1：关回退、删 in-process v2.router |
| quote-calculation | oneclick · quotation · quotation-v2 · calc · three-tier · package | **客户赋能(已独立)** | 属独立产品 | 波2：移出营销中台生产入口(随客户赋能产品走) |
| lifecycle-iot-front-office | front-office-runtime · admin-routes · ops-runtime | **客户赋能 + ops** | 部分 | 波2：front-office 随客户赋能；ops 迁 CORE 运维 |
| legacy-foundation | marketing · exports · reports · business-domain · new-features | 营销 | 🟡 部分(growth/analytics) | 波3：补 NestJS 对等后退场 |
| ai-channel | channel(`/api/channel`) | 营销·模块6 渠道 | ❌ 模块6 未建 | 波3：建 NestJS channel 模块后退场 |
| pages-and-governance | page-aliases · promotions | 营销·内容/促销 | 🟡 | 波3：promotions→定价/促销；page-aliases→前端路由 |
| admin-runtime-guards | admin-guard(`/api/admin`) | 平台底座 | 🟡 auth/RBAC | 波4：并入 NestJS auth guard |

## 分波退场
### 波1 · 关回退 + 删 in-process v2　✅ 已完成(2026-08-06)
> 删 `server/modules/v2.router.js`；清 index.js require+条件挂载 + productionRouteCatalog 'v2' 条目/factory + route-target-map 映射 + guard:database 的过时 audit 断言(audit 归 NestJS)。语法/门禁验证：guard:ledger PASS 35/FAIL 0。回退：git revert。
- 确认生产 `/api/v2` 全量走 NestJS(3300) 代理；`LEGACY_V2_INPROCESS` 默认 false。
- 删 `server/modules/v2.router.js` + core-and-v2 组内 in-process v2 挂载。
- 门禁：route-catalog / route-target-map 更新(v2 目标=NestJS)。
- 验证：`/api/v2/*` 冒烟 + guard:ledger 绿。可回滚(env 开回退)。

### 波2a · 卸载 quote-calculation 组　✅ 已完成(2026-08-06)
- 从 productionRouteCatalog 移除 quote-calculation 组(oneclick/quotation/quotation-v2/calc/three-tier/package) + REQUIRED_DOMAINS 去 'quote-calculation' + route-target-map 契约去该组。
- 前端零调用(apps/ grep 0)；index.js(仅 legacy 调试入口)保留，波4 整体清。
- 验证：guard:ledger PASS 35/FAIL 0。回退：git revert。

### 波2b · front-office-runtime　⏸️ 暂缓(飞轮风险)
- ⚠️ front-office-runtime.routes 还服务 C 端问诊/获客端点(quick-session/visuals/field-state/ai-validation/feedback) —— 属**获客飞轮**(已保留)，非纯客户赋能。
- 前置条件：先证 NestJS `diagnosis`/`ingress` 已全量覆盖这些 C 端端点，再卸载；否则会断北极星线索源。**未验证前不动。**

### 波3 · 营销遗留路由补 NestJS 对等后退场
- marketing → `growth`；exports/reports → `analytics`；channel → **新建 NestJS `channel` 模块(模块6)**；standards → `product-catalog`/`system-packs`/kernels；promotions → 定价/促销(模块5)；business-domain → 拆解归位或废弃。
- 每条：NestJS 实现 + 契约测试通过 → 前端切 /api/v2 → 删遗留路由 + routeOwnership。
- 门禁：routes / standards / catalog 同步。

### 波4 · 生产入口切 NestJS + 删 server/
- `server-production.js` 退化为薄代理或退役；生产入口=NestJS(3300)/或 NestJS 托管静态。
- admin-guard/admin-routes/ops-runtime/page-aliases 并入 NestJS(auth/ops/静态)。
- 删 `server/` 目录 + 退役 6 门禁(catalog/routes/legacy-surface/legacy-surface-ownership/route-target-map/standards)或改为 NestJS 版。
- 验证：生产 serve 冒烟 + 全量 guard:ledger + 北极星飞轮 e2e。

## 依赖门禁（每波同步，避免崩红）
`guard:catalog`(route-catalog-boundary) · `guard:routes` · `guard:legacy-surface` · `guard:legacy-surface-ownership` · `guard:route-target-map` · `guard:standards` · `server/modules/routeOwnership.js`。

## 风险与回滚
- 风险：波2/波3 误删仍被前端/外部调用的路由 → 先查调用方(前端 lib/api.ts + 外部)。
- 回滚：每波独立提交；波1 可 env 开回退；波2–4 git revert。
- 红线：波次间 guard:ledger 必须保持 0 红；生产 serve 冒烟通过才进下一波。

## 减重预估
- 波1–2 移除客户赋能/回退遗留：数千行即时减重。
- 波3–4 完成：**server/ 48k 行整体退役**，双栈收敛为单一 NestJS，营销中台核心 ≈58k 行(前端+活跃后端+内核)。

_本清单为退场蓝图；每波执行前按"依赖门禁"更新，执行后跑 guard:ledger 收口。_
