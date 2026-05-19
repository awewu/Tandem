# Tandem · 技术宪章 v2.0

> **性质**: 产品开发不可逾越的红线。所有代码、架构、部署决策必须服从。
> **修订**: 每 3 个月复审，创始人+架构师双签字。
> **定位**: 企业级操作系统，超越飞书/微信的工程标准。

---

## §T1 · 分层架构红线（Onion Architecture）

```text
┌─────────────────────────────────────────────────────────┐
│  API / Controller 层  ← DTO 校验、Auth、序列化、错误码映射  │
│  ─────────────────────────────────────────────────────  │
│  Service 层           ← 业务用例、事务边界、跨域编排       │
│  ─────────────────────────────────────────────────────  │
│  Domain 层            ← Entity、Value Object、Domain Event │
│  ─────────────────────────────────────────────────────  │
│  Repository 层        ← 数据访问抽象（接口，非实现）         │
│  ─────────────────────────────────────────────────────  │
│  Infra 层             ← Drizzle、Redis、MinIO、ES、Queue   │
└─────────────────────────────────────────────────────────┘
```

**禁止行为：**

- API 路由直接 import Drizzle `db` (必须经 Repository 接口)
- API 路由直接 import `lib/boot.ts` 或 `globalThis` 上的任何状态
- Domain 层依赖 HTTP/Next.js/Express 框架
- Service 层调用 `res.json()` 或 `NextResponse`

**正确调用链：**

```text
HTTP Request → Controller → Service → Domain → Repository Interface → Infra
```

---

## §T2 · 状态管理重构红线

**当前反模式（已造成 3 次崩溃）：**

```typescript
// ❌ 死刑代码 — 永远禁止
const _g = globalThis as any;
_g.__tandem_store__ = createDrizzleStore(); // HMR 残留 → 500
```

**正确模式（三选一）：**

#### A. RSC + React Cache（V1 推荐）

```typescript
import { unstable_cache } from 'next/cache';

export const getStore = unstable_cache(
  async () => drizzleStoreFactory(),
  ['tandem-store'],
  { revalidate: false }
);
```

#### B. 模块级单例 + 环境检测

```typescript
// lib/infra/drizzle-client.ts
const _g = globalThis as { __pg__?: ReturnType<typeof postgres> };
const client = _g.__pg__ ?? postgres(process.env.DATABASE_URL!, { max: 10, prepare: false });
if (process.env.NODE_ENV !== 'production') _g.__pg__ = client;
export const db = drizzle(client, { schema });
```

#### C. 请求级 DI（V2 推荐）

```typescript
// 每个请求创建新 context，依赖注入 store
const ctx = createRequestContext();
const result = await DecisionService.list(ctx, params);
```

---

## §T3 · 存储层接口分离（Repository 契约）

**当前反模式：**

```typescript
// ❌ 通用 CRUD 掩盖业务差异
interface Repository<T> { list(filter?: Partial<T>): Promise<T[]>; }
// DecisionCard 有 convergence 状态机，Memory 有签批流程，共用同一接口 = 灾难
```

#### 正确模式：按业务语义拆分接口

```typescript
// lib/domain/repositories/decision-card-repo.ts
interface DecisionCardRepository {
  findById(id: string): Promise<DecisionCard | null>;
  findActiveByUser(userId: string): Promise<DecisionCard[]>;
  create(draft: DecisionCardDraft): Promise<DecisionCard>;
  commit(id: string, actionItems: ActionItem[]): Promise<DecisionCard>;
  escalate(id: string, reason: string): Promise<DecisionCard>;
  // 没有 generic update() — 状态机驱动，禁止随意 PATCH
}
```

**原则：**

- Repository 接口命名反映业务动作，不是 CRUD 动词
- 禁止 `Partial<T>` 更新，必须显式定义 UpdateCommand
- 状态迁移（如 COMMIT → VETOED）必须在 Domain Service 内完成，不在 API 层

---

## §T4 · 前后端边界契约

**共享类型文件（唯一真源）：**

```text
types/
  api/          ← 前后端共享
    requests/   ← Zod schema + TypeScript 类型（输入校验）
    responses/  ← 返回类型（API 契约）
  domain/       ← 后端独占（Domain Entity）
  frontend/     ← 前端独占（UI Component Props）
```

**输入校验（零容忍）：**

```typescript
// types/api/requests/create-document.ts
import { z } from 'zod';

export const CreateDocumentSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(50000).default(''),
  type: z.enum(['doc', 'sheet', 'slide']),
  ownerId: z.string().cuid(),
});

export type CreateDocumentRequest = z.infer<typeof CreateDocumentSchema>;
```

**API 路由职责仅限：**

1. `requireAuth(req)` — 认证
2. `CreateDocumentSchema.parse(body)` — 输入校验
3. `await DocumentService.create(ctx, command)` — 委托 Service
4. `return NextResponse.json({ data: result }, { status: 201 })` — 序列化

**禁止：** API 路由里写业务逻辑、直接操作数据库、调用 seed。

---

## §T5 · 错误处理标准化

**统一错误类型：**

```typescript
// lib/domain/errors.ts
export class DomainError extends Error {
  constructor(
    public code: string,      // 'DECISION_ALREADY_COMMITTED'
    public message: string,
    public statusCode: number = 500,
    public metadata?: Record<string, unknown>
  ) {}
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', `${resource} ${id} not found`, 404);
  }
}

export class AuthError extends DomainError {
  constructor() {
    super('UNAUTHORIZED', 'Authentication required', 401);
  }
}
```

**全局错误中间件（API 层兜底）：**

```typescript
// app/api/_middleware/error-handler.ts
export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (req, ...args) => {
    try {
      return await handler(req, ...args);
    } catch (err) {
      if (err instanceof DomainError) {
        return NextResponse.json(
          { error: { code: err.code, message: err.message } },
          { status: err.statusCode }
        );
      }
      // 未预期错误 — 内部记录，外部不泄漏细节
      log.error('Unhandled API error', err);
      return NextResponse.json(
        { error: { code: 'INTERNAL', message: 'Internal server error' } },
        { status: 500 }
      );
    }
  };
}
```

**客户端统一处理：**

```typescript
// lib/api-client.ts
class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, opts);
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data.error?.code, data.error?.message, res.status);
  }
  return data;
}
```

---

## §T6 · 数据持久化策略

#### 主存储：PostgreSQL + Drizzle ORM

- 所有业务数据（User、DecisionCard、Memory、OKR、Document、Calendar...）
- 必须运行 `npm run db:migrate` 在生产环境
- dev 环境用 `npm run db:push`，但必须保留 `drizzle/migrations/` 文件

#### 缓存层：Redis（必选）

```text
- Session / Token 黑名单
- Notification Badge 计数（TTL 30s）
- Rate Limit 窗口
- Yjs document update awareness（多节点广播）
```

#### 对象存储：MinIO / S3

```text
- DriveFile 实际文件内容（bucket: tandem-drive）
- Document 附件（bucket: tandem-attachments）
- 预签名 URL 15 分钟 TTL
```

#### 搜索：Elasticsearch / OpenSearch（V2）

```text
- 全文索引 Document、Memory、DecisionCard
- 增量同步 via Drizzle hooks + queue
```

#### 消息队列：Redis Streams / RabbitMQ（V2）

```text
- 会议邀请发送通知（异步）
- Memory 签批 SLA 扫描
- 复盘/降级/升阶定时任务
```

---

## §T7 · 实时协作架构

#### 文档协同编辑：Yjs + WebSocket

```text
Client A ──Yjs update──→ WebSocket Server ──broadcast──→ Client B
                              │
                              └─persist diff→ PostgreSQL (CRDT aware)
```

- 每 5 秒 snapshot，diff 持久化到 `Document.content` JSON
- 冲突解决：Yjs CRDT 自动合并

#### 通知推送：SSE（Server-Sent Events）

```text
Client ──EventSource──→ /api/notifications/stream
                            │
                            └─subscribe Redis pub/sub──→ 新通知触发 push
```

- 替代轮询，延迟 < 1s
- 断线自动重连 + Event ID 去重

#### 日历同步：iCal/WebDAV + webhook

```text
- 导出: /api/calendar/ical?token=xxx
- 同步: webhook 接收外部日历变更
- 提醒: cron job + SSE push
```

---

## §T8 · 测试标准

**分层测试金字塔：**

```text
        ┌───┐
        │E2E│  5% — Playwright, 覆盖核心用户旅程
       ┌───┐
       │API│ 15% — 独立测试每个 API 路由（supertest + test DB）
      ┌───┐
      │Svc│ 30% — Service 层单元测试（mock repo）
     ┌───┐
     │Dom│ 50% — Domain 纯函数测试（零依赖，最快）
    └─────┘
```

**测试数据库：**

- 必须独立 test DB，不能用 dev DB
- 每个 test 文件独立 transaction，test 结束 rollback
- `beforeAll` 运行 `drizzle-kit migrate`

**E2E 标准（非当前 9/24）：**

```text
- 所有 API 200/201/204/400/401/403/404/500 码必须验证
- 并发安全: 两个用户同时编辑同一文档不丢数据
- 断网恢复: 离线编辑 → 在线后自动同步
```

---

## §T9 · 部署与运维

**容器化（V1 GA 必选）：**

```dockerfile
# 多阶段构建
FROM node:22-alpine AS builder
COPY . .
RUN npm ci && npm run build

FROM node:22-alpine AS runner
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/drizzle ./drizzle
RUN npx drizzle-kit migrate
CMD ["node", "server.js"]
```

**环境变量管理：**

```text
.env.development  ← 本地开发（gitignored）
.env.staging      ← 测试环境
.env.production   ← 生产环境（加密管理，1Password/Vault）
.env.example      ← 模板（文档说明每个变量用途）
```

**健康检查：**

```text
GET /api/health  → { ok: true, db: 'connected', redis: 'connected', version: '1.0.0' }
```

**监控：**

- APM: OpenTelemetry + Jaeger（链路追踪）
- 日志: structured JSON + ELK / Loki
- 告警: Prometheus + AlertManager
- 错误聚合: Sentry

---

## §T10 · 安全红线

**认证：**

- JWT access token (15min TTL) + refresh token (7d, rotate on use)
- MFA 强制对 admin/steward
- 密码: Argon2id, 禁止明文存储

**授权：**

- RBAC: employee / manager / steward / admin / champion
- ABAC: 文档/云盘权限基于资源 ACL，不是纯角色
- 数据归属: tenantId 隔离（V2 多租户）

**审计：**

- 所有 mutation（create/update/delete）必须记录 audit log
- audit log 不可修改（WORM storage）
- 保留期: 生产 7 年

**传输：**

- 强制 HTTPS，HSTS max-age=31536000
- API rate limit: 100/min per IP, 1000/min per user

---

## §T11 · 禁止技术债清单

以下代码一经发现，**必须立即重构，不得累积**：

| 反模式 | 正确做法 | 严重程度 |
| --- | --- | --- |
| `globalThis.__xxx__` | 模块级单例 / DI / RSC cache | 🔴 P0 |
| `as any` / `as never` | 显式 DTO + Zod 校验 | 🔴 P0 |
| API 路由直接操作 DB | 分层: API → Service → Repo | 🔴 P0 |
| Seed 数据在 boot() 内 | 独立 seed script，生产禁用 | 🟡 P1 |
| 通用 `Repository<T>` | 按业务语义定义接口 | 🟡 P1 |
| try-catch 吞掉异常 | DomainError + 全局错误中间件 | 🟡 P1 |
| 前端直接 import 后端类型 | `types/api/` 共享契约 | 🟡 P1 |
| 无输入校验 | Zod schema 所有 API 入口 | 🟡 P1 |
| 无事务边界 | Service 层显式 transaction | 🟡 P1 |
| console.log | structured logger (pino/winston) | 🟢 P2 |

---

## §T12 · 超越飞书/微信的工程标准

| 维度 | 飞书/微信 | Tandem 标准 |
| --- | --- | --- |
| 数据模型 | 扁平消息驱动 | 决议卡状态机 + 四层知识架构 |
| AI 集成 | 外挂 GPT API | TAF 领域专用路由器 + Skills 注册表 |
| 协作模型 | 消息实时同步 | CRDT 文档 + SSE 推送 + 异步优先 |
| 部署 | 封闭 SaaS | 私有化优先 + Docker Compose + K8s |
| 数据归属 | 平台所有 | 企业所有 + 员工尊严铁律 |
| 扩展性 | 插件市场 | MCP 协议 + 自研 Agent 注册 |
| 合规 | 基础安全 | 审计日志 7 年 + WORM + 多租户隔离 |
| 工程标准 | 快速迭代 | 宪章约束 + 分层架构 + 100% API 契约测试 |

---

> **签字区**
>
> 本宪章自 2026-05-17 生效，所有代码提交必须通过 CI 检查（tsc, lint, test, e2e）。
>
> 创始人签字: _________________ 日期: _________________
> 架构师签字: _________________ 日期: _________________
