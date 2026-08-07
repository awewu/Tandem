import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { withRlsTransaction } from '../common/rls';
import type { JwtPayload } from '../auth/auth.service';
import { ProductEntity } from './product-catalog.entity';
import { ProductLaunchEntity, ProductSellingPointEntity, PricingPolicyEntity } from './product-mgmt.entity';

const LIFECYCLE_STAGES = ['intro', 'growth', 'mature', 'eol'];
const MARGIN_FLOOR = Number(process.env.PRICING_MARGIN_FLOOR || 0.15); // 毛利闸阈值（基座3）

@Injectable()
export class ProductMgmtService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private scope(actor: JwtPayload) { return { tenantId: actor.tenantId, actorId: actor.userId, role: actor.role }; }

  // 4.4 生命周期阶段流转
  async setLifecycleStage(actor: JwtPayload, productId: string, stage: string) {
    if (!LIFECYCLE_STAGES.includes(stage)) throw new BadRequestException('invalid lifecycle_stage');
    return withRlsTransaction(this.ds, async (em) => {
      const res = await em.getRepository(ProductEntity).update({ id: productId }, { lifecycleStage: stage } as any);
      if (!res.affected) throw new NotFoundException('product not found');
      return { productId, lifecycleStage: stage };
    }, this.scope(actor));
  }

  // 4.5 NPI 上市
  async createLaunch(actor: JwtPayload, dto: { name?: string; productId?: string; sku?: string; plan?: Record<string, unknown>; checklist?: unknown[]; targetDate?: string }) {
    if (!dto.name) throw new BadRequestException('launch name is required');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ProductLaunchEntity);
      const row = await repo.save(repo.create({
        tenantId: actor.tenantId, name: dto.name!, productId: dto.productId ?? null, sku: dto.sku ?? null,
        plan: dto.plan ?? {}, checklist: dto.checklist ?? [], targetDate: dto.targetDate ?? null, status: 'planned',
      }));
      return { launch: row };
    }, this.scope(actor));
  }

  async listLaunches(actor: JwtPayload) {
    return withRlsTransaction(this.ds, async (em) => ({
      launches: await em.getRepository(ProductLaunchEntity).find({ where: { tenantId: actor.tenantId }, order: { updatedAt: 'DESC' } }),
    }), this.scope(actor));
  }

  async updateLaunchStatus(actor: JwtPayload, id: string, status: string) {
    if (!['planned', 'launching', 'launched', 'cancelled'].includes(status)) throw new BadRequestException('invalid status');
    return withRlsTransaction(this.ds, async (em) => {
      await em.getRepository(ProductLaunchEntity).update({ id, tenantId: actor.tenantId }, { status, updatedAt: new Date() });
      return { id, status };
    }, this.scope(actor));
  }

  // 4.10 卖点（基座4：建议带 evidenceRef 事实依据）
  async addSellingPoint(actor: JwtPayload, dto: { productId?: string; sku?: string; segment?: string; claim?: string; evidenceRef?: string; sortOrder?: number }) {
    if (!dto.claim) throw new BadRequestException('claim is required');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ProductSellingPointEntity);
      const row = await repo.save(repo.create({
        tenantId: actor.tenantId, productId: dto.productId ?? null, sku: dto.sku ?? null,
        segment: dto.segment ?? null, claim: dto.claim!, evidenceRef: dto.evidenceRef ?? null, sortOrder: dto.sortOrder ?? 0,
      }));
      return { sellingPoint: row, evidenceMissing: !dto.evidenceRef };
    }, this.scope(actor));
  }

  async listSellingPoints(actor: JwtPayload, productId?: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const where: Record<string, unknown> = { tenantId: actor.tenantId };
      if (productId) where.productId = productId;
      return { sellingPoints: await em.getRepository(ProductSellingPointEntity).find({ where, order: { sortOrder: 'ASC' } }) };
    }, this.scope(actor));
  }

  // 4.17 定价政策提报 → 毛利测算闸（基座3）
  private computeMargin(proposedPrice: number, costPrice: number) {
    const price = Number(proposedPrice) || 0;
    const cost = Number(costPrice) || 0;
    const marginAmt = price - cost;
    const marginRate = price > 0 ? marginAmt / price : 0;
    return { marginAmt, marginRate, floor: MARGIN_FLOOR, gatePassed: marginRate >= MARGIN_FLOOR };
  }

  async submitPricingPolicy(actor: JwtPayload, dto: { productId?: string; sku?: string; policyType?: string; proposedPrice?: number; costPrice?: number }) {
    if (!['list', 'promo', 'rebate'].includes(String(dto.policyType))) throw new BadRequestException('invalid policy_type');
    const marginCalc = this.computeMargin(Number(dto.proposedPrice) || 0, Number(dto.costPrice) || 0);
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(PricingPolicyEntity);
      const row = await repo.save(repo.create({
        tenantId: actor.tenantId, productId: dto.productId ?? null, sku: dto.sku ?? null,
        policyType: dto.policyType!, proposedPrice: Number(dto.proposedPrice) || 0, costPrice: Number(dto.costPrice) || 0,
        marginCalc: marginCalc as any, status: 'submitted', submittedBy: actor.userId, submittedAt: new Date(),
      }));
      return { policy: row, gatePassed: marginCalc.gatePassed, warning: marginCalc.gatePassed ? null : `毛利率 ${(marginCalc.marginRate * 100).toFixed(1)}% 低于阈值 ${(MARGIN_FLOOR * 100).toFixed(0)}%，审批将被阻断（基座3）` };
    }, this.scope(actor));
  }

  async decidePricingPolicy(actor: JwtPayload, id: string, decision: 'approved' | 'rejected', note?: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(PricingPolicyEntity);
      const row = await repo.findOne({ where: { id, tenantId: actor.tenantId } });
      if (!row) throw new NotFoundException('policy not found');
      if (decision === 'approved') {
        const gate = (row.marginCalc as any)?.gatePassed;
        if (!gate) throw new ForbiddenException('毛利闸未通过，不得批准发布（基座3）');
      }
      await repo.update({ id }, { status: decision, approver: actor.userId, decisionNote: note ?? null, decidedAt: new Date(), updatedAt: new Date() });
      return { id, status: decision };
    }, this.scope(actor));
  }

  async listPricingPolicies(actor: JwtPayload) {
    return withRlsTransaction(this.ds, async (em) => ({
      policies: await em.getRepository(PricingPolicyEntity).find({ where: { tenantId: actor.tenantId }, order: { updatedAt: 'DESC' } }),
    }), this.scope(actor));
  }

  // 定价毛利闸风险计数（喂 CMO riskAlerts）：提报中但毛利闸未过的政策数。
  async pricingRiskCount(actor: JwtPayload) {
    return withRlsTransaction(this.ds, async (em) => {
      const rows: Array<{ n: string }> = await em.query(
        `SELECT COUNT(*) n FROM rhautt_nexus.pricing_policy
          WHERE tenant_id = $1 AND status = 'submitted' AND COALESCE((margin_calc->>'gatePassed')::boolean, true) = false`,
        [actor.tenantId]).catch(() => []);
      return Number(rows[0]?.n || 0);
    }, this.scope(actor));
  }

  // 产品组合健康：按生命周期阶段分布 + 在途上市数（喂 CMO 舱 productPortfolio 屏）。
  async portfolioSummary(actor: JwtPayload) {
    return withRlsTransaction(this.ds, async (em) => {
      const rows: Array<{ lifecycle_stage: string; n: string }> = await em.query(
        `SELECT lifecycle_stage, COUNT(*) AS n FROM rhautt_nexus.products GROUP BY lifecycle_stage`,
      ).catch(() => []);
      const byStage: Record<string, number> = {};
      for (const r of rows) byStage[r.lifecycle_stage] = Number(r.n) || 0;
      const launches = await em.getRepository(ProductLaunchEntity).count({ where: { tenantId: actor.tenantId } }).catch(() => 0);
      return { byStage, activeLaunches: launches };
    }, this.scope(actor));
  }
}
