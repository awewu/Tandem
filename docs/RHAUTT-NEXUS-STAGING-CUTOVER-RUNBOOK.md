# Rhautt Nexus · Staging 启动联调验收剧本

> 用途：staging Postgres 到位后，按本剧本逐步执行 → 完成 W0 主干上位 + W2 经营脊柱 + 板块二诊断回流的**真库验收**，并落盘可审计证据。
>
> 前置唯一硬阻塞：**`POSTGRES_STAGING_URL`**（运维提供 staging Postgres 实例与连接串）。其余命令均已在仓内就绪。
>
> 命名约定：所有 Nest 端点带全局前缀 `/api/v2`（见 `services/api/src/main.ts`）。

---

## 0 · 前置环境

```bash
# 运维提供（示例形态，勿提交到仓库）
export POSTGRES_STAGING_URL='postgres://app_rw:***@<host>:5432/rhautt_nexus'

# API 运行所需（与上等价拆分；apply-migrations 用 migrator 角色，运行期用 app_rw）
export POSTGRES_HOST=<host> POSTGRES_PORT=5432 \
       POSTGRES_USER=app_rw POSTGRES_PASSWORD='***' POSTGRES_DB=rhautt_nexus
export JWT_SECRET='***' PHONE_HASH_SECRET='***'
export POSTGRES_SYNCHRONIZE=false   # schema 只由 curated migrations 拥有，禁止 TypeORM 改表
```

**角色最小权限**：`migrator`（DDL，跑迁移）与 `app_rw`（DML，运行期，受 RLS 约束、**非** superuser/BYPASSRLS）分离——否则 FORCE RLS 形同虚设。

---

## W0-1 · 连接校验

```bash
psql "$POSTGRES_STAGING_URL" -c "select current_user, current_database(), version();"
```

**出口闸**：连接成功；`current_user` 为受限角色（非 superuser）。

---

## W0-2 · 迁移 apply + RLS 证据

```bash
# 1) 预演与状态（无写入）
npm run db:migrate:dry-run
npm run db:migrate:status     # 应列出 001–008 为 pending

# 2) 应用（按文件名顺序，sha256 记入 public.schema_migrations）
npm run db:migrate
npm run db:migrate:status     # 全部 applied；008_entity_drift_reconciliation 在列

# 3) 真库 RLS + 事务 + outbox 证据（canonical 验收）
POSTGRES_STAGING_URL="$POSTGRES_STAGING_URL" npm run release:postgres-staging:smoke

# 4) 证据守卫复核（读 evidence/，不连库）
npm run guard:postgres-staging-smoke
```

**出口闸**（`evidence/database/postgres-staging-smoke-report.json`）：
- `status: passed-staging-current-run`、`finalLaunchDatabaseProof: true`
- checks 全 `passed`，含：跨租户写被拒（`cross-tenant write was not rejected` 未触发）、`FORCE RLS` 生效、outbox 事件（`rysnova-bim.customer_package.ready` / `customer_signoff.confirmed`）、workflow、`rawSensitiveEvidenceOmitted`
- 同步更新 `evidence/release-evidence.json#requiredEvidence.postgresStagingSmoke`

> 该脚本以 `BEGIN; SET LOCAL ROLE …; SET LOCAL app.tenant_id …; … ROLLBACK;` 在事务内取证，不污染数据。

---

## W0-3 · API 接真库启动

```bash
npm run release:target-api:boot-smoke      # 真依赖装齐后的启动冒烟
# 实启（前台）
node services/api/dist/main.js   # 或 ts 运行入口；监听 ${API_PORT:-3300}
curl -fsS localhost:3300/api/v2/health
```

**出口闸**：`/api/v2/health` 200；各模块 DI 启动无错（boot-smoke failures = 0）。

---

## W2 · 经营脊柱真库验收（HTTP 闭环）

> 设 `BASE=localhost:3300/api/v2`。先登录取 `TOKEN`。

```bash
# 登录（手机号经 SECURITY DEFINER 预认证查找；见 auth.service）
TOKEN=$(curl -fsS -X POST $BASE/auth/login -H 'content-type: application/json' \
  -d '{"phone":"<seed-phone>","password":"<seed-pass>"}' | jq -r .accessToken)
AUTH=(-H "authorization: Bearer $TOKEN" -H 'content-type: application/json')

# W2-1 建线索（→ customer + opportunity + lifecycle(lead) + outbox lead.created，同事务）
curl -fsS -X POST $BASE/crm/leads "${AUTH[@]}" \
  -d '{"phone":"13900000001","name":"验收客户","source":"staging-smoke"}'

# 取 opportunityId
OPP=$(curl -fsS "$BASE/crm/pipeline" "${AUTH[@]}" | jq -r '.[0].id // .items[0].id')

# W2-2 持久化报价（→ quotation + outbox quotation.created）
QID=$(curl -fsS -X POST $BASE/quotation "${AUTH[@]}" \
  -d "{\"customerId\":\"<customerId>\",\"opportunityId\":\"$OPP\",\"items\":[{\"sku\":\"DEMO\",\"unitPrice\":1000}]}" | jq -r .id)

# 锁价（→ 护栏 + outbox quotation.locked）
curl -fsS -X POST $BASE/quotation/$QID/lock "${AUTH[@]}"

# W2-3/W2-4 签单（→ opportunity.signed + lifecycle(signed) + BIM 承接 + outbox opportunity.signed）
curl -fsS -X POST $BASE/crm/opportunities/$OPP/sign "${AUTH[@]}" -d "{\"quotationId\":\"$QID\"}"
```

**库侧出口闸**（psql，按租户上下文核对）：

```sql
-- outbox 四类事件均落库（同业务事务）
select event_type, count(*) from rhautt_nexus.mdm_outbox_events
 where event_type in ('lead.created','quotation.created','quotation.locked','opportunity.signed')
 group by 1;

-- lifecycle 串联推进至 signed，含 transitions 时间线
select stage, quotation_id, transitions from rhautt_nexus.lifecycle_links
 where opportunity_id = '<OPP>';
```

**验收**：一条单据走完「线索→报价→锁价→签单→BIM→lifecycle」，4 类 outbox 事件齐备，`lifecycle_links.stage = signed`。

---

## 板块二 · 诊断回流验收（S2-2）

```bash
# 完成诊断（→ diagnosis_session + outbox diagnosis.completed，同事务）
curl -fsS -X POST $BASE/diagnosis/complete "${AUTH[@]}" \
  -d '{"answers":{...},"sourceSurface":"pain-diagnosis.html"}'
```

```sql
select event_type, payload->>'customerId' customer, payload->>'reportId' report
  from rhautt_nexus.mdm_outbox_events where event_type='diagnosis.completed'
  order by created_at desc limit 1;
```

**验收**：`diagnosis.completed` 事件落库，payload 携带 `customerId/opportunityId/reportId/shareTokenHash` → CRM/lifecycle 可据此回流生成线索。

---

## 收尾 · 守卫与证据

```bash
npm run guard:postgres-rls-behavior
npm run guard:postgres-transaction-outbox
npm run guard:target-api-boot-smoke
npm run guard:route-target-map
# 一次性全量（非可视）：
npm run guard:all:nonvisual
```

**出口闸**：上述守卫全绿；`evidence/database/*` 与 `evidence/release-evidence.json` 反映 `passed-staging-current-run`。

---

## 投递器（outbox dispatcher）

`EventBusService.dispatchPending()` 负责把 `pending` 事件投递给订阅者（至少一次 + 重试 + 死信）。staging 验收阶段经 `POST /api/v2/mdm/event-bus/dispatch` 手动触发一轮确认消费；生产由调度器/worker 周期调用。死信经 `GET /api/v2/mdm/event-bus/dead-letters` 查看。

**消费方订阅已接线**（`event-consumers` 模块）：`diagnosis.completed` → 自动让已绑定客户进入 lifecycle（`lead` 起点，幂等可重放）。验收：

```bash
# 完成诊断后触发投递
curl -fsS -X POST $BASE/mdm/event-bus/dispatch "${AUTH[@]}"
```

```sql
-- 事件被消费（pending → delivered）
select status, count(*) from rhautt_nexus.mdm_outbox_events
 where event_type='diagnosis.completed' group by 1;
-- 诊断客户已自动进入 lifecycle
select stage from rhautt_nexus.lifecycle_links where customer_id='<customerId>';
```

> 后续工单：`opportunity.signed`/`quotation.locked` 的下游消费方（通知、合同生成等）按需扩展 `EventConsumersService`。

---

## 阻塞与回滚

- **阻塞**：`POSTGRES_STAGING_URL` 未配 → W0-2 起全部阻塞；report 维持 `missing-staging-run`、`finalLaunchDatabaseProof: false`（守卫允许，仅 warning）。
- **回滚**：迁移 `001` 不可变（已 applied 即免编辑）；如需回退，新增逆向迁移而非改历史。绞杀网关切流可即时回退到 legacy `/api`（route-target-map 保留 legacy 兼容路由直至证据齐备）。
