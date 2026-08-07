import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { withRlsTransaction } from '../common/rls';
import { writeAudit } from '../common/audit';
import type { JwtPayload } from '../auth/auth.service';
import { GtmCampaignEntity, GtmOkrEntity } from './gtmplan.entity';

@Injectable()
export class GtmplanService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}
  private scope(a: JwtPayload) { return { tenantId: a.tenantId, actorId: a.userId, role: a.role }; }

  // 模块7 战役/预算
  async createCampaign(actor: JwtPayload, dto: { name?: string; buType?: string; buRef?: string; period?: string; budget?: number }) {
    if (!dto.name) throw new BadRequestException('name required');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GtmCampaignEntity);
      const row = await repo.save(repo.create({
        tenantId: actor.tenantId, name: dto.name!, buType: dto.buType ?? null, buRef: dto.buRef ?? null,
        period: dto.period ?? null, budget: Number(dto.budget) || 0, status: 'planned',
      }));
      await writeAudit(em, { tenantId: actor.tenantId, actorUserId: actor.userId, action: 'gtm.campaign.create', resourceType: 'gtm_campaign', resourceId: row.id, afterState: { name: dto.name, period: dto.period, budget: Number(dto.budget) || 0 } });
      return { campaign: row };
    }, this.scope(actor));
  }

  async updateCampaign(actor: JwtPayload, id: string, patch: { spend?: number; attributedRevenue?: number; status?: string }) {
    return withRlsTransaction(this.ds, async (em) => {
      const upd: any = { updatedAt: new Date() };
      if (patch.spend != null) upd.spend = Number(patch.spend);
      if (patch.attributedRevenue != null) upd.attributedRevenue = Number(patch.attributedRevenue);
      if (patch.status) upd.status = patch.status;
      await em.getRepository(GtmCampaignEntity).update({ id, tenantId: actor.tenantId }, upd);
      await writeAudit(em, { tenantId: actor.tenantId, actorUserId: actor.userId, action: 'gtm.campaign.update', resourceType: 'gtm_campaign', resourceId: id, afterState: { spend: patch.spend, attributedRevenue: patch.attributedRevenue, status: patch.status } });
      return { id, updated: true };
    }, this.scope(actor));
  }

  async listCampaigns(actor: JwtPayload) {
    return withRlsTransaction(this.ds, async (em) => ({
      campaigns: await em.getRepository(GtmCampaignEntity).find({ where: { tenantId: actor.tenantId }, order: { updatedAt: 'DESC' } }),
    }), this.scope(actor));
  }

  // MROI 汇总（喂 CMO mroi 屏）：ROI = 归因收入 / 花费
  async mroiSummary(actor: JwtPayload) {
    return withRlsTransaction(this.ds, async (em) => {
      const rows: Array<{ budget: string; spend: string; revenue: string; n: string }> = await em.query(
        `SELECT COALESCE(SUM(budget),0) budget, COALESCE(SUM(spend),0) spend, COALESCE(SUM(attributed_revenue),0) revenue, COUNT(*) n
           FROM rhautt_nexus.gtm_campaign WHERE tenant_id = $1`, [actor.tenantId]).catch(() => []);
      const r = rows[0] || { budget: '0', spend: '0', revenue: '0', n: '0' };
      const spend = Number(r.spend) || 0; const revenue = Number(r.revenue) || 0;
      return { campaigns: Number(r.n) || 0, budget: Number(r.budget) || 0, spend, attributedRevenue: revenue, mroi: spend > 0 ? revenue / spend : null };
    }, this.scope(actor));
  }

  // 模块10 OKR
  async upsertOkr(actor: JwtPayload, dto: { id?: string; level?: string; owner?: string; buRef?: string; objective?: string; keyResults?: any[]; progress?: number; period?: string }) {
    if (!dto.objective || !['group', 'business_unit', 'function'].includes(String(dto.level))) throw new BadRequestException('objective and valid level required');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GtmOkrEntity);
      if (dto.id) {
        await repo.update({ id: dto.id, tenantId: actor.tenantId }, {
          objective: dto.objective!, keyResults: (dto.keyResults ?? []) as any, progress: Number(dto.progress) || 0,
          owner: dto.owner ?? null, buRef: dto.buRef ?? null, period: dto.period ?? null, updatedAt: new Date(),
        } as any);
        await writeAudit(em, { tenantId: actor.tenantId, actorUserId: actor.userId, action: 'gtm.okr.update', resourceType: 'gtm_okr', resourceId: dto.id, afterState: { level: dto.level, objective: dto.objective, progress: Number(dto.progress) || 0 } });
        return { id: dto.id, updated: true };
      }
      const row = await repo.save(repo.create({
        tenantId: actor.tenantId, level: dto.level!, owner: dto.owner ?? null, buRef: dto.buRef ?? null,
        objective: dto.objective!, keyResults: (dto.keyResults ?? []) as any, progress: Number(dto.progress) || 0, period: dto.period ?? null,
      }));
      await writeAudit(em, { tenantId: actor.tenantId, actorUserId: actor.userId, action: 'gtm.okr.create', resourceType: 'gtm_okr', resourceId: row.id, afterState: { level: dto.level, objective: dto.objective, progress: Number(dto.progress) || 0 } });
      return { okr: row };
    }, this.scope(actor));
  }

  async listOkrs(actor: JwtPayload, level?: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const where: Record<string, unknown> = { tenantId: actor.tenantId };
      if (level) where.level = level;
      return { okrs: await em.getRepository(GtmOkrEntity).find({ where, order: { level: 'ASC', updatedAt: 'DESC' } }) };
    }, this.scope(actor));
  }

  // OKR 汇总（喂 CMO teamOkr 屏）：按层级平均进度
  async okrSummary(actor: JwtPayload) {
    return withRlsTransaction(this.ds, async (em) => {
      const rows: Array<{ level: string; avg: string; n: string }> = await em.query(
        `SELECT level, AVG(progress) avg, COUNT(*) n FROM rhautt_nexus.gtm_okr WHERE tenant_id = $1 GROUP BY level`, [actor.tenantId]).catch(() => []);
      return { byLevel: rows.map((r) => ({ level: r.level, avgProgress: Number(r.avg) || 0, count: Number(r.n) || 0 })) };
    }, this.scope(actor));
  }
}
