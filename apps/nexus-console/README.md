# Rhautt Nexus 管理中枢（nexus-console）

对内工程底座 / **控制平面**。管理两大板块的**内容 / 物料 / 发布 / 部署元数据**，
**不托管、不吞并**任何独立品牌站点的 UI/VI（铁律见 `platform-modules.json`）。

## 板块

- **板块一 · Rhautt Comfort（品牌与市场）** `/comfort`
  网站管理 · 市场物料库 DAM · 品牌产品库 · 上新/发布
- **板块二 · 瑞诺瓦/Rysnova 赋能平台（部署管理）** `/enablement`
  租户开通 · 版本/发布 · 环境/部署状态 · 健康/监控

## 运行

```bash
npm install
npm run dev      # http://localhost:5010
```

### 后端数据接入（token 流）

控制台通过**服务端**访问 NestJS（默认 `:3300`，前缀 `/api/v2`），JWT 存 **httpOnly cookie**（不落 localStorage，遵循安全审计）：

```bash
NEXUS_API_URL=http://localhost:3300   # NestJS 服务地址
NEXUS_API_PREFIX=/api/v2              # 全局前缀
```

- 右上角「登录」→ `POST /api/session/login`（代理 NestJS `auth/login`，成功后写 httpOnly cookie）
- 登录后，板块总览的真实 KPI 自动点亮：
  - **板块二 · 租户** ← `GET /api/v2/tenants`
  - **板块一 · 产品条目** ← `GET /api/v2/brand`
  - **健康** ← `GET /api/v2/health`（`LiveHealth` 实时探测）
- 后端未启动 / 未登录时**优雅降级**为占位值，不报错。

## 结构

- `src/lib/boards.ts` —— 两板块结构唯一数据源（对齐 `platform-modules.json`）
- `src/components/Sidebar.tsx` —— 双板块导航（client，active 高亮）
- `src/components/Panel.tsx` —— 由数据驱动渲染 cards/table/note
- `src/app/[board]/[[...section]]/page.tsx` —— 板块/分区路由

## 边界

- 仅消费 `business-console`/NestJS 的聚合数据，不直接持有领域库。
- 不引入跨站共享 UI 组件库；本应用样式仅服务于中枢自身。
- 每件套保留独立 namespace + 独立部署路径，中枢只编排发布/回滚/监控。
