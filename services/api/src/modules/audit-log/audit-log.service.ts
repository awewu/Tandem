import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { DataSource, type EntityManager } from 'typeorm';
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
  page?: string | number;
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
    const page = Math.max(Number(query.page || 1) || 1, 1);
    const offset = (page - 1) * limit;
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
          OR l.before_state::text ILIKE $${params.length}
          OR l.after_state::text ILIKE $${params.length}
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
      params.push(offset);
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
          LIMIT $${params.length - 1}
         OFFSET $${params.length}`,
        params,
      );
      await this.enrichResourceLabels(em, actor.tenantId, rows);
      return { logs: rows, total: Number(countRows[0]?.total || 0), page, limit };
    }, { tenantId: actor.tenantId, actorId: actor.userId, role: actor.role });
  }

  private async enrichResourceLabels(em: EntityManager, tenantId: string, rows: Array<Record<string, unknown>>) {
    const ids = [...new Set(rows.map((row) => String(row.resourceId || '').trim()).filter(Boolean))];
    if (!ids.length) return;
    const labels = new Map<string, string>();
    await Promise.all([
      this.mergeResourceLabels(em, labels, 'site_news_articles', tenantId, ids, "NULLIF(title, '')"),
      this.mergeResourceLabels(em, labels, 'tenant_brand_sites', tenantId, ids, "COALESCE(NULLIF(name_cn, ''), NULLIF(name_en, ''), NULLIF(code, ''))"),
      this.mergeResourceLabels(em, labels, 'brand_site_basic_settings', tenantId, ids, "NULLIF(site_code, '')"),
      this.mergeResourceLabels(em, labels, 'site_product_assignments', tenantId, ids, "COALESCE(NULLIF(site_title, ''), NULLIF(public_slug, ''))"),
      this.mergeResourceLabels(em, labels, 'products', tenantId, ids, "NULLIF(CONCAT_WS(' · ', NULLIF(name, ''), NULLIF(sku, '')), '')"),
      this.mergeResourceLabels(em, labels, 'products', 'rhautt_shared', ids, "NULLIF(CONCAT_WS(' · ', NULLIF(name, ''), NULLIF(sku, '')), '')"),
      this.mergeResourceLabels(em, labels, 'product_content', tenantId, ids, "NULLIF(name, '')"),
      this.mergeResourceLabels(em, labels, 'uploaded_files', tenantId, ids, "NULLIF(original_name, '')"),
      this.mergeResourceLabels(em, labels, 'growth_marketing_material', tenantId, ids, "NULLIF(CONCAT_WS(' · ', NULLIF(title, ''), NULLIF(material_type, ''), NULLIF(brand_slug, ''), NULLIF(file_format, '')), '')"),
      this.mergeResourceLabels(em, labels, 'users', tenantId, ids, "NULLIF(display_name, '')"),
      this.mergeResourceLabels(em, labels, 'rbac_roles', tenantId, ids, "COALESCE(NULLIF(name, ''), NULLIF(code, ''))"),
    ]);
    for (const row of rows) {
      const id = String(row.resourceId || '').trim();
      if (id && labels.has(id)) row.resourceLabel = labels.get(id) || null;
    }
  }

  private async mergeResourceLabels(
    em: EntityManager,
    labels: Map<string, string>,
    table: string,
    tenantId: string,
    ids: string[],
    labelSql: string,
  ) {
    if (!(await this.tableExists(em, table))) return;
    try {
      const rows: Array<{ id: string; label: string | null }> = await em.query(
        `SELECT id::text AS id, ${labelSql} AS label
           FROM rhautt_nexus.${table}
          WHERE tenant_id = $1 AND id::text = ANY($2::text[])`,
        [tenantId, ids],
      );
      for (const row of rows) {
        const label = String(row.label || '').trim();
        if (label && !labels.has(row.id)) labels.set(row.id, label);
      }
    } catch {
      // Label enrichment is best-effort; the audit list must remain readable even when an optional table differs by environment.
    }
  }

  private async tableExists(em: EntityManager, table: string) {
    const rows: Array<{ exists: boolean }> = await em.query(
      `SELECT to_regclass($1) IS NOT NULL AS exists`,
      [`rhautt_nexus.${table}`],
    );
    return Boolean(rows[0]?.exists);
  }

  private hashIp(ip?: string | null) {
    const value = String(ip || '').trim();
    if (!value) return null;
    return createHash('sha256').update(value).digest('hex').slice(0, 32);
  }
}
