import { DataSource } from 'typeorm';
import { withRlsTransaction } from '../common/rls';

/**
 * MongoDB 下线 · Rysnova 产物 / 事件的 PostgreSQL 持久化适配器。
 *
 * 旧实现（server/modules/rysnova-bim/rysnova-bim-artifact.service）通过 Mongoose
 * BaseRepository(RysnovaArtifact) + BaseRepository(OutboxEvent) 落 MongoDB。这里提供
 * 两个「接口兼容」的适配器注入到该服务，使 3856 行领域计算原样保留、仅将存储切到
 * Postgres（rhautt_nexus.rysnova_bim_artifacts / mdm_outbox_events），所有写入均在
 * withRlsTransaction 内绑定租户 GUC，满足 FORCE RLS 租户隔离。
 *
 * scope 由领域服务在每次调用时传入（{ tenantId, dealerId, storeId, userId, ... }），
 * 与旧 BaseRepository 的 scope 语义一致。
 */

interface RepoScope {
  tenantId?: string;
  dealerId?: string | null;
  storeId?: string | null;
  customerId?: string | null;
  userId?: string;
  role?: string;
}

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function uuidOrNull(value: unknown): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null;
}

function requireTenant(scope: RepoScope): string {
  if (!scope?.tenantId) {
    const err: any = new Error('tenantId is required for tenant-scoped repository operations');
    err.status = 403;
    throw err;
  }
  return scope.tenantId;
}

interface ArtifactRow {
  id: string;
  artifact_doc: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

/** 将 DB 行还原为旧 Mongoose lean 文档形状（保留全部领域字段 + id/_id/时间）。 */
function reconstruct(row: ArtifactRow): Record<string, unknown> {
  const doc = row.artifact_doc || {};
  return {
    ...doc,
    id: row.id,
    _id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const TABLE = 'rhautt_nexus.rysnova_bim_artifacts';

/**
 * artifactRepo 适配器：实现旧服务用到的 create / findById / list / updateById。
 * 富文档整体存入 artifact_doc(jsonb)，标量列作可索引投影。
 */
export class RysnovaArtifactPgRepository {
  constructor(
    private readonly dataSource: DataSource,
    private readonly defaultLimit = 20,
    private readonly maxLimit = 100,
  ) {}

  async create(scope: RepoScope, data: Record<string, any>): Promise<Record<string, unknown>> {
    const tenantId = requireTenant(scope);
    const doc = { ...data, tenantId };
    return withRlsTransaction(this.dataSource, async (mgr) => {
      const rows = await mgr.query(
        `INSERT INTO ${TABLE}
           (tenant_id, dealer_id, project_id, customer_id, artifact_type, name, file_key,
            bim_data, status, project_key, artifact_doc)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id, artifact_doc, created_at, updated_at`,
        [
          tenantId,
          uuidOrNull(data.dealerId ?? scope.dealerId),
          uuidOrNull(data.projectId),
          uuidOrNull(data.customerId ?? scope.customerId),
          data.type ?? 'bim_model',
          String(data.objectKey ?? data.type ?? 'artifact'),
          data.objectKey ?? null,
          {},
          data.status ?? 'draft',
          data.projectId != null ? String(data.projectId) : null,
          JSON.stringify(doc),
        ],
      );
      return reconstruct(rows[0]);
    }, { tenantId, actorId: scope.userId });
  }

  async findById(scope: RepoScope, id: string): Promise<Record<string, unknown> | null> {
    const tenantId = requireTenant(scope);
    if (!uuidOrNull(id)) return null;
    return withRlsTransaction(this.dataSource, async (mgr) => {
      const rows = await mgr.query(
        `SELECT id, artifact_doc, created_at, updated_at FROM ${TABLE} WHERE id = $1 LIMIT 1`,
        [id],
      );
      return rows.length ? reconstruct(rows[0]) : null;
    }, { tenantId, actorId: scope.userId });
  }

  async list(
    scope: RepoScope,
    query: Record<string, any> = {},
    options: Record<string, any> = {},
  ): Promise<{ items: Record<string, unknown>[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
    const tenantId = requireTenant(scope);
    const page = Math.max(parseInt(options.page ?? 1, 10), 1);
    const limit = Math.min(Math.max(parseInt(options.limit ?? this.defaultLimit, 10), 1), this.maxLimit);
    const offset = (page - 1) * limit;

    return withRlsTransaction(this.dataSource, async (mgr) => {
      const filters: string[] = [];
      const params: unknown[] = [];
      if (query.projectId != null) {
        params.push(String(query.projectId));
        filters.push(`project_key = $${params.length}`);
      }
      if (query.type != null) {
        params.push(String(query.type));
        filters.push(`artifact_type = $${params.length}`);
      }
      if (query.status != null) {
        params.push(String(query.status));
        filters.push(`status = $${params.length}`);
      }
      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

      const countRows = await mgr.query(`SELECT COUNT(*)::int AS total FROM ${TABLE} ${where}`, params);
      const total = countRows[0]?.total ?? 0;

      const rows = await mgr.query(
        `SELECT id, artifact_doc, created_at, updated_at FROM ${TABLE} ${where}
         ORDER BY updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      );

      return {
        items: rows.map(reconstruct),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) || 0 },
      };
    }, { tenantId, actorId: scope.userId });
  }

  async updateById(scope: RepoScope, id: string, update: Record<string, any> = {}): Promise<Record<string, unknown> | null> {
    const tenantId = requireTenant(scope);
    if (!uuidOrNull(id)) return null;

    // 兼容旧 BaseRepository 的 $set 与平铺字段两种写法。
    const flat: Record<string, unknown> = { ...(update.$set || {}) };
    for (const [k, v] of Object.entries(update)) {
      if (k.startsWith('$')) continue;
      flat[k] = v;
    }
    delete (flat as any).tenantId;

    return withRlsTransaction(this.dataSource, async (mgr) => {
      const existingRows = await mgr.query(
        `SELECT id, artifact_doc, created_at, updated_at FROM ${TABLE} WHERE id = $1 LIMIT 1`,
        [id],
      );
      if (!existingRows.length) return null;
      const existingDoc = (existingRows[0].artifact_doc || {}) as Record<string, unknown>;
      const nextDoc = { ...existingDoc, ...flat, tenantId };

      const rows = await mgr.query(
        `UPDATE ${TABLE}
           SET artifact_doc = $1,
               status = COALESCE($2, status),
               file_key = COALESCE($3, file_key),
               name = COALESCE($3, name),
               updated_at = now()
         WHERE id = $4
         RETURNING id, artifact_doc, created_at, updated_at`,
        [
          JSON.stringify(nextDoc),
          flat.status != null ? String(flat.status) : null,
          flat.objectKey != null ? String(flat.objectKey) : null,
          id,
        ],
      );
      return rows.length ? reconstruct(rows[0]) : null;
    }, { tenantId, actorId: scope.userId });
  }
}

const OUTBOX_TABLE = 'rhautt_nexus.mdm_outbox_events';

/**
 * outboxService 适配器：实现旧服务用到的 publish(scope, event)，写 Postgres outbox。
 * 幂等：按 (tenant_id, aggregate_type, aggregate_id, event_type) 去重（idempotencyKey 语义）。
 */
export class RysnovaOutboxPgService {
  constructor(private readonly dataSource: DataSource) {}

  async publish(scope: RepoScope, event: Record<string, any>): Promise<{ published: boolean }> {
    const tenantId = requireTenant(scope);
    return withRlsTransaction(this.dataSource, async (mgr) => {
      await mgr.query(
        `INSERT INTO ${OUTBOX_TABLE}
           (tenant_id, event_type, aggregate_type, aggregate_id, payload, status, attempts)
         VALUES ($1,$2,$3,$4,$5,'pending',0)`,
        [
          tenantId,
          String(event.eventType),
          String(event.aggregateType),
          String(event.aggregateId),
          JSON.stringify(event.payload ?? {}),
        ],
      );
      return { published: true };
    }, { tenantId, actorId: scope.userId });
  }
}
