import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { withRlsTransaction } from '../common/rls';
import type { JwtPayload } from '../auth/auth.service';
import { ChannelPartnerEntity, ChannelRebateEntity, ChannelPerformanceEntity } from './channel.entity';

const TIERS = ['prospect', 'bronze', 'silver', 'gold', 'platinum'];
const REBATE_MARGIN_FLOOR = Number(process.env.REBATE_MARGIN_FLOOR || 0.05); // 返利后毛利下限（基座3）

@Injectable()
export class ChannelService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}
  private scope(a: JwtPayload) { return { tenantId: a.tenantId, actorId: a.userId, role: a.role }; }

  // 6.1 招募 / 6.2 分层认证
  async recruitPartner(actor: JwtPayload, dto: { code?: string; name?: string; region?: string; categories?: string[]; contact?: Record<string, unknown> }) {
    if (!dto.code || !dto.name) throw new BadRequestException('code and name required');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ChannelPartnerEntity);
      const row = await repo.save(repo.create({
        tenantId: actor.tenantId, code: dto.code!, name: dto.name!, region: dto.region ?? null,
        categories: dto.categories ?? [], contact: dto.contact ?? {}, tier: 'prospect', status: 'recruiting',
      }));
      return { partner: row };
    }, this.scope(actor));
  }

  async updatePartner(actor: JwtPayload, id: string, patch: { tier?: string; status?: string; certified?: boolean; categories?: string[]; region?: string }) {
    if (patch.tier && !TIERS.includes(patch.tier)) throw new BadRequestException('invalid tier');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ChannelPartnerEntity);
      const p = await repo.findOne({ where: { id, tenantId: actor.tenantId } });
      if (!p) throw new NotFoundException('partner not found');
      await repo.update({ id }, {
        tier: patch.tier ?? p.tier, status: patch.status ?? p.status,
        certified: patch.certified ?? p.certified, categories: patch.categories ?? p.categories,
        region: patch.region ?? p.region, updatedAt: new Date(),
      } as any);
      return { id, updated: true };
    }, this.scope(actor));
  }

  async listPartners(actor: JwtPayload, q: { status?: string; tier?: string } = {}) {
    return withRlsTransaction(this.ds, async (em) => {
      const where: Record<string, unknown> = { tenantId: actor.tenantId };
      if (q.status) where.status = q.status;
      if (q.tier) where.tier = q.tier;
      return { partners: await em.getRepository(ChannelPartnerEntity).find({ where, order: { tier: 'DESC', updatedAt: 'DESC' } }) };
    }, this.scope(actor));
  }

  // 6.4 返利（毛利闸·基座3）：grossMargin = 返利前毛利率 - 返利占比
  private computeRebateMargin(amount: number, gmv: number, baseMarginRate: number) {
    const rebateRatio = gmv > 0 ? amount / gmv : 0;
    const netMarginRate = baseMarginRate - rebateRatio;
    return { rebateRatio, baseMarginRate, netMarginRate, floor: REBATE_MARGIN_FLOOR, gatePassed: netMarginRate >= REBATE_MARGIN_FLOOR };
  }

  async submitRebate(actor: JwtPayload, dto: { partnerId?: string; period?: string; basis?: string; amount?: number; gmv?: number; baseMarginRate?: number }) {
    if (!dto.period || !['sell_through', 'gmv', 'coop'].includes(String(dto.basis))) throw new BadRequestException('period and valid basis required');
    const marginCalc = this.computeRebateMargin(Number(dto.amount) || 0, Number(dto.gmv) || 0, Number(dto.baseMarginRate) || 0);
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ChannelRebateEntity);
      const row = await repo.save(repo.create({
        tenantId: actor.tenantId, partnerId: dto.partnerId ?? null, period: dto.period!, basis: dto.basis!,
        amount: Number(dto.amount) || 0, marginCalc: marginCalc as any, status: 'submitted',
      }));
      return { rebate: row, gatePassed: marginCalc.gatePassed, warning: marginCalc.gatePassed ? null : `返利后毛利 ${(marginCalc.netMarginRate * 100).toFixed(1)}% 低于阈值 ${(REBATE_MARGIN_FLOOR * 100).toFixed(0)}%，审批将被阻断（基座3）` };
    }, this.scope(actor));
  }

  async decideRebate(actor: JwtPayload, id: string, decision: 'approved' | 'rejected' | 'paid') {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ChannelRebateEntity);
      const row = await repo.findOne({ where: { id, tenantId: actor.tenantId } });
      if (!row) throw new NotFoundException('rebate not found');
      if (decision === 'approved' && !(row.marginCalc as any)?.gatePassed) throw new ForbiddenException('毛利闸未通过，不得批准返利（基座3）');
      await repo.update({ id }, { status: decision, approver: actor.userId, updatedAt: new Date() });
      return { id, status: decision };
    }, this.scope(actor));
  }

  async listRebates(actor: JwtPayload) {
    return withRlsTransaction(this.ds, async (em) => ({
      rebates: await em.getRepository(ChannelRebateEntity).find({ where: { tenantId: actor.tenantId }, order: { updatedAt: 'DESC' } }),
    }), this.scope(actor));
  }

  // 6.11 绩效
  async recordPerformance(actor: JwtPayload, dto: { partnerId?: string; period?: string; gmv?: number; deals?: number; sellThrough?: number; activeProfitable?: boolean }) {
    if (!dto.partnerId || !dto.period) throw new BadRequestException('partnerId and period required');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ChannelPerformanceEntity);
      const row = await repo.save(repo.create({
        tenantId: actor.tenantId, partnerId: dto.partnerId, period: dto.period!,
        gmv: Number(dto.gmv) || 0, deals: Number(dto.deals) || 0, sellThrough: Number(dto.sellThrough) || 0,
        activeProfitable: !!dto.activeProfitable,
      }));
      return { performance: row };
    }, this.scope(actor));
  }

  // 返利毛利闸风险计数（喂 CMO riskAlerts）：提报中但毛利闸未过的返利数。
  async rebateRiskCount(actor: JwtPayload) {
    return withRlsTransaction(this.ds, async (em) => {
      const rows: Array<{ n: string }> = await em.query(
        `SELECT COUNT(*) n FROM rhautt_nexus.channel_rebate
          WHERE tenant_id = $1 AND status = 'submitted' AND COALESCE((margin_calc->>'gatePassed')::boolean, true) = false`,
        [actor.tenantId]).catch(() => []);
      return Number(rows[0]?.n || 0);
    }, this.scope(actor));
  }

  async channelHealth(actor: JwtPayload) {
    return withRlsTransaction(this.ds, async (em) => {
      const partners = await em.getRepository(ChannelPartnerEntity).count({ where: { tenantId: actor.tenantId } });
      const active = await em.getRepository(ChannelPartnerEntity).count({ where: { tenantId: actor.tenantId, status: 'active' } });
      const perf: Array<{ gmv: string; profitable: string }> = await em.query(
        `SELECT COALESCE(SUM(gmv),0) AS gmv, COUNT(*) FILTER (WHERE active_profitable) AS profitable
           FROM rhautt_nexus.channel_performance WHERE tenant_id = $1`, [actor.tenantId]).catch(() => [{ gmv: '0', profitable: '0' }]);
      return { partners, active, networkGmv: Number(perf[0]?.gmv || 0), activeProfitable: Number(perf[0]?.profitable || 0) };
    }, this.scope(actor));
  }
}
