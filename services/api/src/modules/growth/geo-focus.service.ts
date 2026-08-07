import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { withRlsTransaction } from '../common/rls';
import type { JwtPayload } from '../auth/auth.service';
import { GeoTargetEntity, GeoCognitionAssetEntity } from './geo-focus.entity';

/**
 * GEO 进化服务（借鉴分众智投）：
 *  选点(selectTargets) · 千问千面(variantStrategy) · 认知资产漏斗(cognitionFunnel) · 按 lift 重分配(reallocate)。
 */
@Injectable()
export class GeoFocusService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}
  private scope(a: JwtPayload) { return { tenantId: a.tenantId, actorId: a.userId, role: a.role }; }

  async upsertTarget(actor: JwtPayload, dto: { id?: string; category?: string; query?: string; brandCode?: string; segment?: string; scenario?: string; engine?: string; priorityScore?: number; variantStrategy?: Record<string, unknown> }) {
    if (!dto.category || !dto.query) throw new BadRequestException('category and query required');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GeoTargetEntity);
      if (dto.id) {
        await repo.update({ id: dto.id, tenantId: actor.tenantId }, {
          query: dto.query!, category: dto.category!, brandCode: dto.brandCode ?? null, segment: dto.segment ?? null,
          scenario: dto.scenario ?? null, engine: dto.engine ?? null, priorityScore: Number(dto.priorityScore) || 0,
          variantStrategy: (dto.variantStrategy ?? {}) as any, updatedAt: new Date(),
        } as any);
        return { id: dto.id, updated: true };
      }
      const row = await repo.save(repo.create({
        tenantId: actor.tenantId, category: dto.category!, query: dto.query!, brandCode: dto.brandCode ?? null,
        segment: dto.segment ?? null, scenario: dto.scenario ?? null, engine: dto.engine ?? null,
        priorityScore: Number(dto.priorityScore) || 0, variantStrategy: (dto.variantStrategy ?? {}) as any, status: 'candidate',
      }));
      return { target: row };
    }, this.scope(actor));
  }

  // 选点：按潜客浓度×价值 优先级排序（分众"选楼"的 GEO 版）。
  async selectTargets(actor: JwtPayload, category: string, opts: { segment?: string; limit?: number } = {}) {
    return withRlsTransaction(this.ds, async (em) => {
      const qb = em.getRepository(GeoTargetEntity).createQueryBuilder('t')
        .where('t.tenant_id = :tn AND t.category = :c', { tn: actor.tenantId, c: category })
        .andWhere("t.status IN ('candidate','active')");
      if (opts.segment) qb.andWhere('t.segment = :s', { s: opts.segment });
      qb.orderBy('t.priority_score', 'DESC').limit(Math.min(Number(opts.limit) || 20, 100));
      return { category, targets: await qb.getMany() };
    }, this.scope(actor));
  }

  async listTargets(actor: JwtPayload, category?: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const where: Record<string, unknown> = { tenantId: actor.tenantId };
      if (category) where.category = category;
      return { targets: await em.getRepository(GeoTargetEntity).find({ where, order: { priorityScore: 'DESC' }, take: 200 }) };
    }, this.scope(actor));
  }

  // 认知资产漏斗累积（AI-AIPL）：increment 触达/引用/推荐/线索。
  async recordCognition(actor: JwtPayload, dto: { brandCode?: string; category?: string; engine?: string; period?: string; reach?: number; cited?: number; recommended?: number; lead?: number }) {
    if (!dto.brandCode || !dto.category) throw new BadRequestException('brandCode and category required');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GeoCognitionAssetEntity);
      const where = { tenantId: actor.tenantId, brandCode: dto.brandCode!, category: dto.category!, engine: dto.engine ?? null, period: dto.period ?? null };
      const existing = await repo.findOne({ where: where as any });
      if (existing) {
        await repo.update({ id: existing.id }, {
          reach: existing.reach + (Number(dto.reach) || 0), cited: existing.cited + (Number(dto.cited) || 0),
          recommended: existing.recommended + (Number(dto.recommended) || 0), lead: existing.lead + (Number(dto.lead) || 0),
          updatedAt: new Date(),
        });
        return { id: existing.id, updated: true };
      }
      const row = await repo.save(repo.create({
        ...where, reach: Number(dto.reach) || 0, cited: Number(dto.cited) || 0,
        recommended: Number(dto.recommended) || 0, lead: Number(dto.lead) || 0,
      } as any));
      return { asset: row };
    }, this.scope(actor));
  }

  // 认知资产漏斗读取 + 转化率（触达→引用→推荐→线索）。
  async cognitionFunnel(actor: JwtPayload, category?: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const params: any[] = [actor.tenantId];
      let sql = `SELECT COALESCE(SUM(reach),0) reach, COALESCE(SUM(cited),0) cited, COALESCE(SUM(recommended),0) recommended, COALESCE(SUM(lead),0) lead
                   FROM rhautt_nexus.geo_cognition_asset WHERE tenant_id = $1`;
      if (category) { sql += ' AND category = $2'; params.push(category); }
      const rows: Array<{ reach: string; cited: string; recommended: string; lead: string }> = await em.query(sql, params).catch(() => []);
      const r = rows[0] || { reach: '0', cited: '0', recommended: '0', lead: '0' };
      const reach = Number(r.reach), cited = Number(r.cited), recommended = Number(r.recommended), lead = Number(r.lead);
      return {
        category: category ?? 'all',
        funnel: { reach, cited, recommended, lead },
        rates: {
          citeRate: reach ? cited / reach : 0,
          recommendRate: cited ? recommended / cited : 0,
          leadRate: recommended ? lead / recommended : 0,
        },
      };
    }, this.scope(actor));
  }

  // 可优化：按 lift 把优先级火力重分配到高增益目标（分众"预算重分配到高转化城市"的 GEO 版）。
  async reallocate(actor: JwtPayload, adjustments: Array<{ id: string; deltaPriority: number }>) {
    if (!Array.isArray(adjustments) || !adjustments.length) throw new BadRequestException('adjustments required');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GeoTargetEntity);
      for (const a of adjustments) {
        const t = await repo.findOne({ where: { id: a.id, tenantId: actor.tenantId } });
        if (t) await repo.update({ id: t.id }, { priorityScore: Number(t.priorityScore) + Number(a.deltaPriority || 0), status: 'active', updatedAt: new Date() });
      }
      return { reallocated: adjustments.length };
    }, this.scope(actor));
  }
}
