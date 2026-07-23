# Rhautt Nexus · 全局问题总账（MASTER PROBLEM LEDGER）

> 状态：现行 · 2026-07-02 · 用途：跨板块**问题唯一销项台账**，逐项可勾选。
> 事实源（实读汇总）：`RHAUTT-NEXUS-MASTER-ARCHITECTURE-AND-DECOUPLING-BLUEPRINT.md` · `RENOVA-ENABLEMENT-LOCKED-SPEC.md` · `RENOVA-FUNCTION-COMPLETENESS-AUDIT.md` · `RHAUTT-NEXUS-FEATURE-AND-GAP-LEDGER.md` · `DATABASE-GAP-ANALYSIS.md` · `RHAUTT-NEXUS-ENTITY-MIGRATION-DRIFT-LEDGER.md` · `SECURITY-AUDIT-ACCOUNT-SYSTEM.md` · 线索交接/归属/生命周期设计。
> 图例：`[ ]` 待办 · `[~]` 部分完成 · `[x]` 已完成/已验证。优先级：P0 上线闸/红线 · P1 首版必备 · P2 扩散期 · P3 增强。
> 判进度铁律：**以真实代码/执行记录为准**，锁定规格与真实进度冲突时以执行记录为准（见 §5 文档漂移）。

---

## 0. 总根因（一个靶）

**半完成迁移**：Legacy `server/`（Express+Mongo）仍是 live；NestJS `services/api` 是目标但**未上位**；`src/`(Vite) 与 `apps/*` 并存；npm+pnpm+nx 三套构建叠加。
→ 派生：双后端代理错位、实体↔迁移漂移、双栈安全策略漂移、文档漂移。**修根 = 推动 NestJS 主干上位 + legacy 冻结（Strangler Fig）。**

---

## 1. 🔴 P0 · 上线硬阻断 / 安全红线

| ID | 问题 | 证据 | 状态 |
|---|---|---|---|
| P0-SEC-1 | **生产密钥已进 git 历史，未轮换**（`JWT_SECRET`/`PII_ENCRYPTION_KEY`/`PHONE_HASH_SECRET`/`POSTGRES_PASSWORD`/`rheem-production-secret-key-2024`）——等同已泄露 | SECURITY-AUDIT S2 | `[~]` 代码侧已 `rm --cached`+`.gitignore`；**轮换 + `git filter-repo` 清历史未做（运维）** |
| P0-SEC-2 | S1 NestJS 曾在所有环境硬编码 JWT 兜底密钥（任意人可伪造 `platform_admin` 令牌） | SECURITY-AUDIT S1 | `[x]` 已修：缺 `JWT_SECRET` 即启动失败，删兜底 |
| P0-SEC-3 | H1 短信登录后门 `smsCode==='000000'` 免密登入任意账号，不查锁定 | SECURITY-AUDIT H1 | `[ ]` 待办 |
| P0-SEC-4 | H2 NestJS **无全局 `APP_GUARD`、无 RBAC**，控制器漏挂 `@UseGuards` 即裸奔 | SECURITY-AUDIT H2 | `[x]` **已实现 deny-by-default**：根 `APP_GUARD` 挂 `AuthGuard`(认 `@Public()`)+`RolesGuard`；补 `@Public()` 白名单(health/login/brand·everhot/ingress/bim·public/share-view/compliance/quotation计算/rysnova-bim·boundary)；修复裸奔 `DeliveryController`/`MdmController`；RBAC `@Roles(platform_admin,hq_admin)` 挂 Tenant/Mdm。`tsc --noEmit` 通过。**运行时 e2e boot 受 P0-SMOKE 阻断未跑通** |
| P0-SMOKE | boot-smoke 模式**未真正启动过**：`@InjectDataSource()` 服务(Compliance/Auth/Crm...)在 `TARGET_API_BOOT_SMOKE` 下无 DataSource 桩 → DI 解析失败；官方 smoke 被缺失 `nx` 依赖 gate 掉，一直「vacuously pass」 | 本轮 H2 验证时发现 | `[ ]` 待办：boot-smoke 补 DataSource 桩(或 forRoot 用内存/sqlite)，让 target-api-boot-smoke 真跑 |
| P0-PIPL | M14 中国合规缺代码；问诊线上锁定面 `pain-diagnosis.html` **0 处 consent**，且从未采真实联系方式（兜底 `13800000000`） | 完备性审计 §2.1 | `[~]` **Layer1 服务端 consent 闸 + 占位拒绝已实现**（`diagnosis.routes.js`/`diagnosis.service.js`）；**Layer3 前端删兜底已实现**（`pain-diagnosis.html`）；Layer2a 同意留痕入 lead profile；**Layer2b 权威 consent 落库 NestJS compliance 待接（依赖 P1-ARCH-1 代理白名单）** |
| P0-DB-GATE | `finalLaunchDatabaseProof:false`；staging smoke = `missing-staging-run`（`POSTGRES_STAGING_URL` 未配，harness 拒绝 localhost）→ DB/workflow/加密/HA 上线证据全 false | DB 缺口分析 §3.3 | `[ ]` 待运维给非本地 staging 凭据 |

---

## 2. 🟠 P1 · 结构性 / 首版必备

| ID | 问题 | 状态 |
|---|---|---|
| P1-ARCH-1 | 双后端错位：Express 代理白名单早期只放行 4 域，NestJS 独有域（design/product-catalog/bim/brand）前端全落空 | `[~]` harness 验证补白名单 200；**生产 `productionMiddleware` 落位待确认** |
| P1-INTAKE | 交接层 intake 缺失（主闭环第一跳断）：ToC 表单仅 `saveLocal+TODO`；派单引擎不存在；跨 dealer 撞单无裁决（现仅租户内 phoneHash） | `[ ]` 未落地（设计已完备：LEAD-HANDOFF-DESIGN） |
| P1-M12 | design↔rysnova-bim 单一真相源 | `[x]` NestJS 侧 `design-sync` E2E 接线（与锁定规格 MISS 矛盾，见 §5）；`[ ]` 前端同步状态视图 |
| P1-M15 | 跨板块数据总线/MDM（`global_product_id` + 事件总线）；`mdm_outbox_events` 与 `outbox_events` 双 outbox 待裁定合并 | `[~]` 表已落位；总线未选型 |
| P1-DB-PLANE | 四数据平面**物理分库**未做（单 `rhautt_nexus` schema）；Mongo 未集成 NestJS 主干；Redis/Temporal worker 缺证据 | `[ ]` 蓝图 only |
| P1-ANALYTICS | analytics 仍走 Mongoose，PG UUID 当 ObjectId 转换失败 → `/analytics/overview` 500 | `[ ]` 待迁 PG |
| P1-CONTRACT | 电子合同/在线签约缺（报价就绪后无签约闭环）；SSO；统一审计中间件 | `[ ]` 缺 |
| P1-ENTITY-DRIFT | 实体↔迁移漂移（`quotations`/`file_artifacts`/`opportunities`/`audit_logs`/`workflow_instances`/`customers.tags`） | `[x]` 经 migration 008 + 实体映射收口，`tsc` 0 error；`[ ]` 真库 apply 待 staging |
| P1-RLS-ADOPT | 裸 repository 写路径未全量切 `withRlsTransaction`（FORCE RLS 下裸写 fail-fast） | `[~]` 13 服务已切；auth/tenant/mdm/product-catalog 有意例外 |

---

## 3. 🟡 P2 · 扩散期

| ID | 问题 | 状态 |
|---|---|---|
| P2-SPLIT | 件套未拆：`dealer-workbench` 大杂烩（BIM/设计塞在内）；`rysnova-bim-workbench` 空壳、`customer-portal` 骨架 | `[ ]` |
| P2-SEC | 无令牌吊销（改密不失效旧 JWT、无 `jti`/tokenVersion）；bcrypt 轮数=10；双栈安全策略漂移 | `[ ]` |
| P2-FEAT | 客户360、跟进 SLA、毛利护栏/折扣审批、施工留证、保修回流 lifecycle、brand-console、SKU 批量导入、DAM 授权、通知多渠道 | `[ ]` 逐项 |
| P2-NAMING | `rysnova` vs 官方 `Rysnova` 命名未统一（问诊页临时用 `rheem` 规避） | `[ ]` 待命名治理裁定 |
| P2-LEGACY | 105 个 legacy `public/*.html` 待收编（非产品面） | `[ ]` |
| P2-CCF | React 候选面转正：`dealer-workbench` 等需过 production-readiness + frontend-api-contract + browser-visual 三闸 | `[ ]` |

---

## 4. 🟢 P3 · 增强

- `[ ]` DigitalTwin 真三维 · `[ ]` 运行数据反哺精算 · `[ ]` CFD 协同
- `[ ]` MDM 单写 + CDC/ELT → OLAP 数仓 + 对账 · `[ ]` 统一事件总线选型 + schema registry
- `[ ]` PII 列级 + 静态加密（KMS）· `[ ]` HA/DR/PITR + 恢复演练留证

---

## 5. 因果链推演（修问题的顺序逻辑）

- **链 A（迁移半成品）**：双后端/双前端/双构建 → 代理错位 + 实体漂移 + 安全漂移 + 文档漂移。修根 = NestJS 上位 + legacy 冻结。
- **链 B（缺 staging 凭据）**：一个 `POSTGRES_STAGING_URL` 未配 → 所有上线证据硬门 false。**一个凭据解锁一大片。**
- **链 C（交接层缺失）**：主闭环第一跳断 → 问诊/官网线索到不了经销商 → CRM/报价成型也空转。
- **链 D（安全双轨反了）**：Legacy 严、Target（主干目标）松 → 直接上位等于把弱策略扶正 → **上位前必须先补 S1/H1/H2**。
- **链 E（文档漂移）**：锁定规格（06-28）标 `M12/M14/M15 MISS`，更晚审计显示 M12 已 E2E、问诊前端已 524 行、实体漂移已 008 收口 → **以执行记录为准**。

---

## 6. 运行时已观察现象（非 bug，记录备查）

- `growth_campaign_metric` 去重测试报 `42501 RLS violation`：唯一索引 `growth_metric_source_event_uq (tenant_id, source_event_id) WHERE source_event_id IS NOT NULL` 与 `source_event_id uuid` 列**已就位**；报错真因是测试脚本**裸 INSERT 未 `SET LOCAL app.tenant_id`**（FORCE RLS 拒绝），dedupe 分支未跑到。修法：测试在 RLS 事务内 `SET LOCAL app.tenant_id` 后再插。印证 P1-RLS-ADOPT。

---

## 7. 建议攻坚顺序（P0 先）

1. `[ ]` **安全兜底**：轮换全部已泄露密钥 + `git filter-repo` 清历史（P0-SEC-1，等同泄露，最高优）
2. `[ ]` **Target 上位前置**：H1 移除短信后门 + H2 全局 `APP_GUARD`+RBAC（P0-SEC-3/4）
3. `[ ]` **发布闸**：PIPL 线上面 consent + 服务端落库（P0-PIPL）
4. `[ ]` **解锁上线证据**：配非本地 `POSTGRES_STAGING_URL` 跑 staging smoke（P0-DB-GATE）
5. `[ ]` **主闭环**：intake 交接层 P0 公开口 + 同意闸 + 未归属池 →（P1）派单（P1-INTAKE）
6. `[ ]` **收尾**：确认代理白名单生产落位 + 008 真库 apply（P1-ARCH-1 / P1-ENTITY-DRIFT）

---

## 8. 变更记录

- 2026-07-02：初版落盘（汇总既有账本 + 因果链推演 + 攻坚顺序）。
