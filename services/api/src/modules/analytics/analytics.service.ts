import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { JwtPayload } from '../auth/auth.service';
import { withRlsTransaction } from '../common/rls';

// 与 app.module/data-source 对齐：原生 SQL 必须显式限定 schema，
// 否则非限定表名走连接默认 search_path(public)，会读到无 RLS 的 legacy 空表。
const S = process.env.POSTGRES_SCHEMA || 'rhautt_nexus';

/**
 * 经营分析（PG 直查）。原委托遗留 Express/Mongoose 服务（MongoDB/内存），
 * 已迁至 PostgreSQL 单一真相源：在租户 RLS 事务内聚合 dealers/stores/users/
 * customers/opportunities。租户隔离由 RLS 保证；HQ 角色看租户全量，其余按
 * dealer/store 收窄可见域。
 */
@Injectable()
export class AnalyticsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async getOverview(user: JwtPayload, query: Record<string, string> = {}) {
    const isHq = user.role === 'platform_admin' || user.role === 'hq_admin';
    // 过滤器优先取显式 query，其次非 HQ 角色回落自身 dealer/store 可见域
    const dealerId = query.dealerId || (!isHq ? user.dealerId : null) || null;
    const storeId = query.storeId || (!isHq ? user.storeId : null) || null;

    return withRlsTransaction(
      this.ds,
      (em) => this.computeOverview(em, user, dealerId, storeId, isHq),
      { tenantId: user.tenantId, actorId: user.userId ?? undefined, role: user.role },
    );
  }

  private async computeOverview(
    em: EntityManager,
    user: JwtPayload,
    dealerId: string | null,
    storeId: string | null,
    isHq: boolean,
  ) {
    // $1=dealerId $2=storeId（NULL 即不约束）；tenant 由 RLS 自动隔离。
    const scoped = (col: { dealer?: string; store?: string }) => {
      const parts: string[] = [];
      if (col.dealer) parts.push(`($1::text IS NULL OR ${col.dealer}::text = $1)`);
      if (col.store) parts.push(`($2::text IS NULL OR ${col.store}::text = $2)`);
      return parts.length ? `WHERE ${parts.join(' AND ')}` : '';
    };
    const p = [dealerId, storeId];

    // 单事务单连接：顺序执行（并发查询会争用同一 pg 连接）。
    // dealers 无 dealer_id 列，dealer 过滤命中其自身 id
    const dealerRow = await em.query(`SELECT count(*)::int AS c FROM ${S}.dealers ${dealerId ? 'WHERE id::text = $1' : ''}`, dealerId ? [dealerId] : []);
    const storeRow = await em.query(`SELECT count(*)::int AS c FROM ${S}.stores ${scoped({ dealer: 'dealer_id', store: 'id' })}`, p);
    const staffRow = await em.query(
      `SELECT count(*)::int AS c FROM ${S}.users
       WHERE role <> 'customer'
         AND ($1::text IS NULL OR dealer_id::text = $1)
         AND ($2::text IS NULL OR store_id::text = $2)`,
      p,
    );
    const customerRow = await em.query(`SELECT count(*)::int AS c FROM ${S}.customers ${scoped({ dealer: 'dealer_id', store: 'store_id' })}`, p);
    const stageRows = await em.query(
      `SELECT stage, count(*)::int AS count, COALESCE(SUM(estimated_budget), 0)::float AS amount
       FROM ${S}.opportunities ${scoped({ dealer: 'dealer_id', store: 'store_id' })}
       GROUP BY stage`,
      p,
    );
    const dealerPerf = await em.query(
      `SELECT dealer_id AS "dealerId", count(*)::int AS "opportunityCount",
              COALESCE(SUM(estimated_budget), 0)::float AS "estimatedPipeline",
              COALESCE(SUM((stage = 'won')::int), 0)::int AS "wonCount",
              COALESCE(SUM((stage = 'quoted')::int), 0)::int AS "quotedCount"
       FROM ${S}.opportunities ${scoped({ dealer: 'dealer_id', store: 'store_id' })}
       GROUP BY dealer_id
       ORDER BY "estimatedPipeline" DESC
       LIMIT 20`,
      p,
    );

    const stages: Record<string, { count: number; amount: number }> = {};
    let pipeline = 0;
    for (const row of stageRows as Array<{ stage: string; count: number; amount: number }>) {
      stages[row.stage] = { count: row.count, amount: row.amount };
      pipeline += row.amount || 0;
    }

    return {
      scope: {
        tenantId: user.tenantId,
        dealerId,
        storeId,
        role: user.role || null,
        visibility: isHq ? 'tenant-wide' : 'dealer-scoped',
      },
      totals: {
        dealers: dealerRow[0]?.c ?? 0,
        stores: storeRow[0]?.c ?? 0,
        staff: staffRow[0]?.c ?? 0,
        customers: customerRow[0]?.c ?? 0,
        pipeline,
        wonAmount: stages['won']?.amount ?? 0,
        quotedAmount: stages['quoted']?.amount ?? 0,
      },
      stages,
      dealerPerformance: dealerPerf,
      generatedAt: new Date().toISOString(),
      storageMode: 'postgres',
    };
  }
}
