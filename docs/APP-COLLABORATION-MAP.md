# 瑞诺瓦平台 · 界面协同机制清单（App Collaboration Map）

> 目的：一图看清「所有界面之间来回扭转的完整协同机制」——谁从哪进、如何免登流转、
> 数据在各端之间如何交接。端口为本地开发默认值，生产可用 `NEXT_PUBLIC_APP_<APP>_URL` 覆盖为子域。
>
> 维护约定：新增应用 / 改跳转 / 改交接端点时，请同步更新本文件与 `apps/dealer-workbench/src/app/hub/page.tsx` 的 `CLUSTERS`。

---

## 一、应用地图

| 端口 | 应用 (目录) | 类型 | 主要角色 | 登录守卫 |
|---|---|---|---|---|
| `:4000` | `dealer-workbench` | **统一登录 + Hub 总入口** + 舒适家 CRM/交付 | 全员登录 · 销售/门店/经销商 | 账号密码（签发 `nx_token`） |
| `:4001` | `consumer-diagnosis` | C 端 AI 问诊（公开） | 终端客户（免登） | 无（公开） |
| `:4002` | `customer-portal` | 客户门户 · 项目进度/验收 | customer | 短信验证码（写同一 `nx_token`） |
| `:4003` | `designer-workbench` | 技术 BIM 设计（精算/出图/BOM） | designer / engineer | SSO（读 `nx_token`，缺票跳 :4000） |
| `:4004` | `rysnova-bim-workbench` | 技术支持深化端 | engineer / designer | SSO（读 `nx_token`，缺票跳 :4000） |
| `:4005` | `public-portal` | 集团/品牌官网 | 公开 | 无 |
| `:4010` | `nexus-console` | 增长引擎 / 品牌中枢 / 部署运营 | marketing / 平台管理员 | 自有 `/api/session` + `nx_token` 兜底（见 §五） |
| `:4012` | `brand-console` | 品牌运营控制台 | 品牌/总部管理员 | ⚠️ 无守卫（见 §五） |
| `:4016` | `product-catalog` | 产品目录底座 | 多角色 | — |
| `:4011/4013/4014/4015` | `everhot-cn / lithnova-cn / rheem-cn / ruud-cn` | 品牌静态官网 | 公开 | 无 |
| `:3300` | `services/api` (NestJS) | 后端 API `/api/v2/*` | 全部 | JWT / Cookie |

---

## 二、进入与流转机制（交互层）

### 唯一入口 + 单点登录（SSO）
1. 员工端登录只在 **`:4000`**（`apps/dealer-workbench/src/app/page.tsx`）。
2. 登录成功后：`setToken()` 写同源 **`nx_token` cookie**（localhost 跨端口天然共享）+ `localStorage`。
3. 子应用 `AuthProvider` 读 cookie：
   - 有票 → 免登直进；
   - 无票 → 跳 `:4000/?returnUrl=<原页面>`，登录后**自动回跳**。
4. 已接入该守卫：`designer-workbench`、`rysnova-bim-workbench`（`AuthProvider.tsx` → `localhost:4000`）。

### 角色路由（Hub 过滤）
- `:4000/hub` 调 `/auth/me` 取 `role`，用 `moduleVisible()` 过滤模块卡片。
- `roles: ['*']` 对所有人可见；`platform_admin / hq_admin` 可见全部。
- 卡片可**深链到子功能**：`featureHref = appBase(端口/子域) + 子路径`。

### 四大组团（Hub `CLUSTERS`）
1. **组团一 · 品牌厂家功能组** — 品牌运营台、增长引擎、产品目录、品牌官网、品牌与市场中枢。
2. **组团二 · 客户赋能三件套** — ① AI 问诊获客 → ② 舒适家 CRM+交付 → ③ 技术 BIM 设计 → ④ 技术支持深化。
3. **组团三 · 平台运营** — Nexus 部署管理（租户/版本/环境/监控）。
4. **组团四 · 客户入口** — 客户门户（进度/交付/在线验收）。

---

## 三、业务主链路：界面间「来回扭转」的交接点

```
[C端问诊 :4001] ──lead──▶ [CRM :4000] ──签单──▶ [BIM设计 :4003]
      │                       │                       │
   quote/定金             sign/inherit           drawing/BOM
      ▼                       ▼                       ▼
  初诊报告            [技术深化 :4004] ◀──承接── BIM项目(继承报价快照)
                            │
                     出图/BOM/推进→verified→交付包
                            ▼
                   [交付里程碑] ──handover──▶ [客户门户 :4002] 在线验收
```

### 逐段交接的后端端点（已核实 `services/api/src/modules`）

| 交接 | 从 → 到 | 后端端点 |
|---|---|---|
| 获客 | 问诊 → 线索 | `POST /api/v2/ingress/lead`、`POST /diagnosis/public/ai-analyze` |
| 痛点 | 问诊痛点库 | `GET /diagnosis/painpoints`、`POST /diagnosis/painpoints/detect` |
| 报价 | 生成三档 | `POST /diagnosis/quote`、`POST /quote/generate`、`POST /quote/load-calc` |
| 定金 | 问诊锁客 | `POST /diagnosis/deposit/intent` → `POST /diagnosis/deposit/:id/confirm` |
| 成交 | CRM 签单 | `POST /crm/opportunities/:id/sign`、`PUT /crm/opportunities/:id/stage` |
| **承接** | **报价 → BIM 项目** | `POST /rysnova-bim/inherit/:quotationId`（签单后快照） |
| 深化 | 出图/BOM/推进 | `PUT /rysnova-bim/:id/drawing`、`PUT /:id/bom`、`PUT /:id/advance` |
| 交付 | 合同 → 交付项目 | `POST /delivery/projects/from-contract` + `…/milestones/:key/start|complete` |
| 移交 | 交付 → 客户 | `POST /lifecycle/handover` → `POST /handover/:id/acceptance`、`GET /handover/:id/handoff-package` |

### BIM 项目状态机（`rysnova-bim/bim.entity.ts`）
```
inherited → drawing → bom_confirmed → construction → acceptance → iot_delivered
```

---

## 四、跨端硬跳转（Deep Link 清单）

| 位置 | 从 → 到 | 说明 |
|---|---|---|
| `consumer-diagnosis/public/index-ready.html:891` | 首页 → `:4000/` | 员工登录入口 |
| `dealer-workbench/src/components/CrmDrawer.tsx:262` | CRM → `:4000/floor-plan?projectId=…` | **唯一显式带项目上下文**的跳转 |
| `dealer-workbench/src/app/page.tsx:160/163` | 登录页 → `:4005` / `:4010` | 集团门户 / 经营控制台 |
| `dealer-workbench/src/app/products/page.tsx:15` | CRM → `:4016/` | 产品目录 |
| `designer-workbench` / `rysnova-bim-workbench` `AuthProvider:12` | 子应用 → `:4000` | 缺票回跳统一登录 |
| Hub 卡片（动态） | `:4000/hub` → 各端口子路径 | `moduleHref` / `featureHref` |

---

## 五、登录一致性现状与风险（待决策）

| 应用 | 现状 | 风险 / 建议 |
|---|---|---|
| `designer :4003` / `bim :4004` | ✅ 读 `nx_token`，缺票回跳 :4000 | 一致，符合 SSO 预期 |
| `consumer-diagnosis :4001` | 公开无守卫 | 符合预期（C 端获客） |
| `customer-portal :4002` | 短信验证码登录，写**同一** `nx_token` | Cookie 兼容；但 dashboard 无显式前端守卫，靠 API 401 兜底。可加 `AuthProvider` 统一体验 |
| `nexus-console :4010` | 自有 `/api/session` 登录 + 读共享 cookie 兜底 | ⚠️ 兜底要求 token `payload.env==='dev'`，而 Hub 由 `:3300` 签发的 JWT 未必带该字段 → **从 Hub 点进可能仍要求再登一次**。建议对齐 token 校验或统一签发 |
| `brand-console :4012` | 仅 `HubReturnButton`，**无守卫** | ⚠️ 等于开放访问。建议接入统一 SSO 守卫 |

### 端口 vs 生产子域
- Hub 用 `NEXT_PUBLIC_APP_<APP>_URL` 覆盖端口为子域；生产环境需为每个 app 配置。
- 跨子域时 `nx_token` cookie 需设 `Domain=.<主域>` 才能继续共享，否则 SSO 失效——迁生产前必查。

---

_最后更新：由架构梳理生成。改动应用/跳转/交接端点时请同步维护本文件。_
