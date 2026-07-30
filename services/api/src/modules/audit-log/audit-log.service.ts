import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { withRlsTransaction } from '../common/rls';
import type { JwtPayload } from '../auth/auth.service';

export type AuditLogStatus = 'success' | 'failed';

export type AuditLogRecordInput = {
  tenantId?: string | null;
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  requestId?: string | null;
  traceId?: string | null;
  ip?: string | null;
};

export type AuditLogQuery = {
  module?: string;
  action?: string;
  status?: AuditLogStatus;
  search?: string;
  limit?: string | number;
};

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 300;

@Injectable()
export class AuditLogService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async record(input: AuditLogRecordInput) {
    if (!input.tenantId || !input.action || !input.resourceType) return;
    try {
      await withRlsTransaction(this.ds, async (em) => {
        await em.query(
          `INSERT INTO rhautt_nexus.audit_logs
             (tenant_id, actor_user_id, action, resource_type, resource_id, before_state, after_state, request_id, trace_id, ip_hash)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10)`,
          [
            input.tenantId,
            input.actorUserId || null,
            input.action,
            input.resourceType,
            input.resourceId || null,
            JSON.stringify(input.beforeState || {}),
            JSON.stringify(input.afterState || {}),
            input.requestId || null,
            input.traceId || null,
            this.hashIp(input.ip),
          ],
        );
      }, { tenantId: input.tenantId, actorId: input.actorUserId || undefined });
    } catch {
      // Audit logging must never block the business operation path.
    }
  }

  async list(actor: JwtPayload, query: AuditLogQuery) {
    const limit = Math.min(Math.max(Number(query.limit || DEFAULT_LIMIT) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    return withRlsTransaction(this.ds, async (em) => {
      const where = ['l.tenant_id = $1'];
      const params: unknown[] = [actor.tenantId];

      if (query.module) {
        params.push(query.module);
        where.push(`l.resource_type = $${params.length}`);
      }
      if (query.action) {
        params.push(`%${query.action}%`);
        where.push(`l.action ILIKE $${params.length}`);
      }
      if (query.status) {
        params.push(query.status);
        where.push(`CASE WHEN l.after_state->>'status' = 'failed' THEN 'failed' ELSE 'success' END = $${params.length}`);
      }
      if (query.search) {
        params.push(`%${query.search.trim()}%`);
        where.push(`(
          l.action ILIKE $${params.length}
          OR l.resource_type ILIKE $${params.length}
          OR COALESCE(l.resource_id, '') ILIKE $${params.length}
          OR COALESCE(u.display_name, '') ILIKE $${params.length}
        )`);
      }

      const whereSql = where.join(' AND ');
      const countRows: Array<{ total: string }> = await em.query(
        `SELECT COUNT(*)::text AS total
           FROM rhautt_nexus.audit_logs l
           LEFT JOIN rhautt_nexus.users u ON u.id = l.actor_user_id AND u.tenant_id = l.tenant_id
          WHERE ${whereSql}`,
        params,
      );
      params.push(limit);
      const rows = await em.query(
        `SELECT l.id,
                l.tenant_id AS "tenantId",
                l.actor_user_id AS "actorUserId",
                COALESCE(u.display_name, '系统') AS "actorName",
                l.action,
                l.resource_type AS "resourceType",
                l.resource_id AS "resourceId",
                l.before_state AS "beforeState",
                l.after_state AS "afterState",
                CASE WHEN l.after_state->>'status' = 'failed' THEN 'failed' ELSE 'success' END AS status,
                l.request_id AS "requestId",
                l.trace_id AS "traceId",
                l.created_at AS "createdAt"
           FROM rhautt_nexus.audit_logs l
           LEFT JOIN rhautt_nexus.users u ON u.id = l.actor_user_id AND u.tenant_id = l.tenant_id
          WHERE ${whereSql}
          ORDER BY l.created_at DESC
          LIMIT $${params.length}`,
        params,
      );
      return { logs: rows, total: Number(countRows[0]?.total || 0), limit };
    }, { tenantId: actor.tenantId, actorId: actor.userId, role: actor.role });
  }

  private hashIp(ip?: string | null) {
    const value = String(ip || '').trim();
    if (!value) return null;
    return createHash('sha256').update(value).digest('hex').slice(0, 32);
  }
}
