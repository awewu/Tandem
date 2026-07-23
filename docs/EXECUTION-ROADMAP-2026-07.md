# 生产完成执行路线图 · 2026-07

> 平台：瑞诺瓦AI舒适家 · Rhautt Nexus / 瑞合数智枢纽
> 目标：把 `locked-active-not-production-complete` 推进到「可上线」。
> 事实源：`PROJECT-CHARTER.md`；本文件为执行计划，不改定位。
> 说明：本仓库有 50+ CI guard 强耦合，任何后端受管模块改动必须与 `module-boundary.ts` + `contracts/` + guard 期望值**同批**更新，避免 `guard:all` 变红。

四条优先级 + 板块三，统一在此排期。每项都有：现状 → 差距 → 动作 → 验收门。

---

## P1 · Flow 1 端到端闭环（问诊 → CRM）

### 现状（已核实）
- 前端 `apps/consumer-diagnosis/src/app/page.tsx` **已实现**四步问诊，并调用：
  - `POST /api/v2/crm/leads`
  - `POST /api/v2/diagnosis/public/ai-analyze`
  - `POST /api/v2/quotation/load-calc`
- 后端事件链**已存在**：`diagnosis.completed` → `EventConsumersService` → lifecycle(lead) + notification；`opportunity.signed` → notification。

### 差距（关键 bug）
1. **公域留资打到了带鉴权的路由**：`CrmController` 是 `@UseGuards(AuthGuard)`（class 级），而 C 端问诊无 JWT → `POST /api/v2/crm/leads` 会 403。正确入口是匿名 `IngressController` 的 `POST /api/v2/ingress/lead`（已存在，`IngressService.captureLead` 以获客暂存租户绑定）。
2. **前端端点口径漂移**：`/api/v2/diagnosis/public/ai-analyze` 仍需与 NestJS 实际路由核对（当前 NestJS `diagnosis` 无 `public/ai-analyze`）。`/api/v2/quotation/load-calc` 已在 Quote M1–M4 收口中确认由 NestJS `/api/v2/quotation` 提供，并通过 3300/3000 smoke，不再属于该漂移项。

### 动作
1. 前端留资改调 `POST /api/v2/ingress/lead`（携带 `audience/source/campaign/consent`），移除对 `/crm/leads` 的匿名调用。
2. 在 NestJS `diagnosis` 增 `POST diagnosis/public/ai-analyze`（匿名，公共诊断租户），或经 `ingress` 代理，产出 `systemLabels/combination/reasoning`。
3. 负荷计算统一到 `/api/v2/quote/load-calc`（或迁 design 计算域），前端改口径。
4. 补 e2e：匿名问诊 → ingress 落线索 → diagnosis.completed 事件 → lifecycle(lead) 可见。

### 验收门
- `test:production-readiness` 通过；新增 `flow1-consumer-to-crm.e2e` 通过。
- `guard:frontend-api-contract` 无 unmatched（前端每个调用都映射到 NestJS 路由）。
- staging 手动跑通：C 端提交 → CRM/lifecycle 出现该线索。

---

## P2 · legacy → NestJS 迁移里程碑（先 auth，消灭双写）

### 现状
- 双主干并存：legacy `server/modules/*`(57) + NestJS `services/api/src/modules/*`(22)。
- NestJS `auth` 模块已具 controller/service/guard/entity；migration 007 已做 auth foundation + PIPL。
- 2026-07-15：`/api/v2/auth/*` 已由 `services/api/src/modules/auth` 单一实现，Express 仅代理到 NestJS；旧 `/api/auth/login`、`/api/login` 均返回 404。

### 里程碑（auth 先行，绞杀者模式）
| 阶段 | 内容 | 完成判据 |
|---|---|---|
| M1 契约冻结 | 用 legacy auth 行为写满 NestJS auth 合同测试（login/sms/register/refresh/scope 校验） | `test:contracts` 覆盖 auth 全部对外行为 |
| M2 影子运行 | NestJS auth 上 staging，与 legacy 并行；灰度对比响应 | 关键路径响应一致，无回归 |
| M3 切流 | 生产 `/api/v2/auth/*` 指向 NestJS；legacy auth 路由从 `productionRouteCatalog.js` 标记 deprecated | `guard:route-target-map` 显示 auth 目标=nestjs |
| M4 下线双写 | 删除 legacy auth 路由与内联实现；PostgreSQL auth 用户按独立、可审计的数据迁移策略处理 | `guard:catalog` 无 auth 双写；auth 范围合同、路由归属与运行时代理验证通过 |

### Auth 收口证据（2026-07-15）
- M1：auth 合同/服务/OTP/路由归属测试 `27/27` 通过；OpenAPI 合同 `8/8` 通过。
- M2/M3：NestJS `:3300/api/v2/auth/login` 与 Express `:3000/api/v2/auth/login` 均返回 200；`guard:route-target-map` 通过，auth owner 为 NestJS。
- M4：legacy auth 路由文件及内联登录实现已删除；`guard:catalog`、`guard:generated-client`、`guard:frontend-api-contract` 均通过。
- 数据边界：`database/users.json` 的弱口令/旧角色演示账号不直接迁入 PostgreSQL；当前 auth 库只保留按新角色模型和 bcrypt/PIPL 规则建立的账号。`scripts/migrate-pii-reencrypt.js` 只处理 MongoDB `CustomerV2`，不能作为 auth 用户迁移工具。
- 全局发布门仍未全绿：`guard:nestjs-boundary` 现被 `design.service.ts` 直连 legacy `CFDSimulationEngine` 阻断；该问题不属于 auth，但必须在整体验收前收口。

### Tenant 收口证据（2026-07-15）
- M1：OpenAPI 已覆盖 `/api/v2/tenants|dealers|stores` 的 6 个路径、12 个操作及方法级 `x-roles`；生成客户端共 202 个操作，合同测试 `9/9` 通过。
- M2/M3：NestJS `:3300` 与 Express 代理 `:3000` 的 tenant 读写链路均通过；真实路由 owner 已统一为 `services/api/src/modules/tenant`，`guard:route-target-map` 通过。
- 写入治理：tenant/dealer/store 写操作使用字段白名单；JWT tenant scope 不可被请求体覆盖；audit + outbox 与业务写同事务；跨租户 dealer-store 关联被拒绝。服务测试 `4/4` 通过。
- 真库证据：经 `:3300` 创建 dealer、经 `:3000` 更新成功，伪造 tenantId/id 未生效；同一业务 ID 产生 create/update audit 与 outbox 各 2 条，测试数据随后清理。
- 数据收口：`seed-nestjs-auth.js` 幂等创建 DEFAULT dealer/store，并绑定 dealer_admin 与门店员工 scope；前端 `:4000` rewrite 登录后可从 PostgreSQL 读取 1 个 dealer、1 个 store。
- M4：未发现独立 legacy tenant/dealer/store 业务路由实现；旧治理登记中的虚构单数 `/api/v2/tenant` 已替换为三个真实命名空间。

- 之后顺序：`auth → tenant → crm → quote`（宪章锁定），每域独立走 M1–M4，不大爆炸。

### 验收门
- 每域先通过本域合同、路由归属、运行时和数据迁移证据；整批发布前 `guard:all:nonvisual` + `test:production-readiness` 必须全绿，且 `productionRouteCatalog.js` 无该域双写条目。

---

## P3 · README / 文档口径校正（→ NestJS + PostgreSQL 终态）

### 现状
- `README.md` 后端写「Node.js + Express + MongoDB」（迁移期口径），与宪章第 5 章 NestJS + Fastify + PostgreSQL 终态不一致。
- README 多处文档链接指向失效绝对路径 `/Users/tiechuishan/Documents/rhautt-web/enterprise_website/...`（实际目录为 `RheNova`）。

### 动作（本批已开始）
1. 后端技术栈章节改为「终态：NestJS + Fastify + PostgreSQL + TypeORM；迁移期兼容主干：Express + MongoDB（逐域下线）」。
2. 失效绝对链接改为仓库内相对链接（`docs/...`）。
3. 保留 CI 锁定 token `瑞诺瓦AI舒适家`（`guard:nexus-naming` 要求）。

### 验收门
- `guard:nexus-naming` 绿；README 所有文档链接可点达。

---

## P4 · 可观测性（OTel + SLO/burn 告警）+ 目标规模压测

### 现状
- 已有 `server/modules/observability`、`audit/capacity-*.js`、`perf:capacity`；但 `CLAUDE.md` 明确 OpenTelemetry、SLO burn 告警、目标规模压测**未完成**。

### 动作
1. **OTel 接入**：NestJS 侧加 `@opentelemetry/sdk-node` + auto-instrumentation（HTTP/Fastify/pg/redis），traceId 贯穿 outbox 事件；导出到 OTLP collector（env 配置，默认 no-op 不影响本地）。
2. **SLO 定义**（`docs/SLO.md` + `governance`）：
   - 可用性：核心 `/api/v2/*` 月度 99.9%。
   - 时延：p95 读 < 300ms、写 < 800ms。
   - 正确性：outbox 投递成功率 > 99.99%，DLQ 积压告警。
3. **burn-rate 告警**：多窗口（1h/6h）双烧率规则；接 notification/企业微信。
4. **目标规模压测**：按宪章「500+ 经销商并发、2000+ 设计销售、10万+ 档案」用 `autocannon`（已在 devDeps）跑场景脚本，产出容量证据供 `guard:capacity-evidence`。

### 验收门
- `guard:capacity-evidence` 有新鲜证据；trace 在 staging 可见端到端；SLO 文档 + 告警规则入库；压测报告达标或给出扩容结论。

---

## P5 · 板块三 增长中枢（详见 BOARD-3-NEXUS-GROWTH-BLUEPRINT.md）
- 分期 G0–G5；G0（契约+骨架，与 guard 同批）先行，G1 GEO Analyzer 最快出可上线证据。

---

## 执行顺序建议（一条主线，避免互相阻塞）
1. **P3 文档**（低风险，立即）→ 2. **P1 Flow1 修 bug**（补第一条可上线闭环）→ 3. **P2 auth M1–M2**（契约+影子，不切流）→ 4. **P4 OTel 骨架 + SLO 文档**（切流前必须有观测）→ 5. **P2 auth M3–M4 切流下线** → 6. **P5 G0/G1** 并行推进 → 7. 依次 tenant/crm/quote 迁移 + P4 压测收尾。

## 2026-07-15 迁移状态
- `auth`：M1–M4 完成，Express v2 路由已退休。
- `tenant`：M1–M4 完成，tenant/dealer/store 由 NestJS + PostgreSQL 提供。
- `crm`：M1–M4 路由切流完成。8 个 OpenAPI 端点、RLS 归属、PII 加密、审计/outbox、3300 直连与 3000 代理 smoke 均已验证；`server/modules/crm/crm.routes.js` 已删除，owner 已切到 `services/api/src/modules/crm`。
- CRM 物理清理剩余项：`server/modules/crm/crm.service.js` 仍被未迁移的 `server/modules/diagnosis/diagnosis.service.js` 直接依赖，只能作为 `legacy-compat` 暂存；禁止重新挂载 `/api/v2/crm`，待 diagnosis 域迁移后删除。
- `quote`：M1–M4 路由切流完成。8 个 OpenAPI 端点、customer/opportunity/project 归属链、锁价快照、审计/outbox、3300 直连与 3000 代理 smoke 均已验证；`server/modules/quotation/quotation.routes.js` 已删除，owner 已切到 `services/api/src/modules/quote`。
- Quote 物理清理剩余项：`server/modules/quotation/quotation.service.js` 仍被 `/api/quotation-v2` 兼容路由消费，保留为 `legacy-compat`，但禁止重新挂载 `/api/v2/quotation`。
- 下一迁移域：`diagnosis`，继续执行 `contract → red tests → implementation → runtime proof → cutover → retirement evidence`；完成后同时删除 CRM 的 diagnosis-only legacy service 依赖。
