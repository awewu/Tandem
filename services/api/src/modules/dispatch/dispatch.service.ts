import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { DealerDirectoryEntity, RoutingDecisionEntity } from './dispatch.entity';
import { CustomerEntity, OpportunityEntity } from '../crm/crm.entity';
import { JwtPayload } from '../auth/auth.service';
import { withRlsTransaction } from '../common/rls';
import { TenantScope } from '../common/tenant-context';

interface ScoredCandidate {
  dealerId: string;
  dealerTenantId: string | null;
  storeId: string | null;
  name: string;
  city: string | null;
  province: string | null;
  score: number;
  breakdown: { city: number; province: number; category: number; contract: number; loadPenalty: number; categoryOverlap: number };
  routable: boolean;
}

const CONTRACT_WEIGHT: Record<string, number> = { S: 15, A: 10, B: 5 };

/**
 * 问诊→经销商智能派单（线索交接层 · LEAD-HANDOFF-DESIGN §6）。
 * 系统态在获客暂存池租户内消费 lead.captured：按 地域+品类+负载 打分选经销商，
 * 落 dispatch_routing_decisions 审计，并把命中经销商 stamp 回 pool 内的 customer/opportunity。
 * 经销商目录读 foundation 行（tenant_id NULL 跨租户可读），不触 FORCE-RLS 的 dealers 表。
 */
@Injectable()
export class DispatchService {
  private readonly logger = new Logger('Dispatch');

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** 事务内派单——供 event-consumers 在 lead.captured 的 RLS 事务里调用。 */
  async routeCapturedLeadInTx(em: EntityManager, args: { tenantId: string; customerId: string }): Promise<RoutingDecisionEntity | null> {
    const { tenantId, customerId } = args;
    const customer = await em.getRepository(CustomerEntity).findOne({ where: { id: customerId, tenantId } });
    if (!customer) return null;
    // B 路径（已归属客户的问诊）不重复派单
    if (customer.dealerId) return null;

    const opp = await em.getRepository(OpportunityEntity).findOne({
      where: { customerId, tenantId }, order: { createdAt: 'DESC' },
    });

    const profile = (customer.profile || {}) as Record<string, unknown>;
    const requested: string[] = Array.isArray(profile.systems) ? (profile.systems as string[]) : [];
    const province = typeof profile.province === 'string' ? profile.province : null;

    const dirRepo = em.getRepository(DealerDirectoryEntity);
    const candidates = await dirRepo.find({ where: { active: true } });
    const scored = candidates
      .map((c) => this.score(c, { city: customer.city, province, requested }))
      .sort((a, b) => b.score - a.score);

    const chosen = scored.find((s) => s.routable) || null;
    const decisionRepo = em.getRepository(RoutingDecisionEntity);
    const decision = decisionRepo.create({
      tenantId,
      intakeCustomerId: customerId,
      intakeOpportunityId: opp?.id ?? null,
      source: customer.source ?? null,
      city: customer.city ?? null,
      province,
      category: requested[0] ?? null,
      rule: 'geo+category+load',
      chosenDealerId: chosen?.dealerId ?? null,
      chosenStoreId: chosen?.storeId ?? null,
      chosenDealerTenantId: chosen?.dealerTenantId ?? null,
      score: chosen ? chosen.score : null,
      candidates: scored.slice(0, 5),
      reason: chosen
        ? `命中 ${chosen.name}（city=${chosen.breakdown.city} province=${chosen.breakdown.province} category=${chosen.breakdown.category} contract=${chosen.breakdown.contract} load=-${chosen.breakdown.loadPenalty}）`
        : (candidates.length === 0 ? '目录无可派经销商' : '无经销商可服务所需品类/地域'),
      status: chosen ? 'routed' : 'unrouted',
    });
    const saved = await decisionRepo.save(decision);

    if (chosen) {
      // stamp 归属（本切片：lead 仍留 pool，stamp dealer/store + 记录真实租户，供后续系统态迁移落库）
      await em.getRepository(CustomerEntity).update(
        { id: customerId, tenantId },
        { dealerId: chosen.dealerId, storeId: chosen.storeId },
      );
      if (opp) {
        await em.getRepository(OpportunityEntity).update(
          { id: opp.id, tenantId },
          { dealerId: chosen.dealerId, storeId: chosen.storeId },
        );
      }
      // 负载自增（foundation 行 tenant_id NULL，WITH CHECK 允许）
      await dirRepo.increment({ dealerId: chosen.dealerId }, 'activeLoad', 1);
    }

    this.logger.log(`lead.captured → dispatch status=${decision.status} dealer=${chosen?.dealerId ?? '-'} customer=${customerId} tenant=${tenantId}`);
    return saved;
  }

  private score(c: DealerDirectoryEntity, ctx: { city: string | null; province: string | null; requested: string[] }): ScoredCandidate {
    const cityMatch = c.city && ctx.city && c.city === ctx.city ? 40 : 0;
    const provinceMatch = c.province && ctx.province && c.province === ctx.province ? 15 : 0;
    const overlap = ctx.requested.filter((r) => (c.categories || []).includes(r)).length;
    const categoryScore = overlap > 0 ? 20 + overlap * 10 : 0;
    const contractScore = c.contractLevel ? (CONTRACT_WEIGHT[c.contractLevel] ?? 0) : 0;
    const loadPenalty = c.capacity > 0 ? Math.round((c.activeLoad / c.capacity) * 20) : 0;
    const score = cityMatch + provinceMatch + categoryScore + contractScore - loadPenalty;
    // 可派：须能服务至少一个所需品类；若问诊未选品类，则退化为地域可达即可派
    const routable = categoryScore > 0 || (ctx.requested.length === 0 && cityMatch > 0);
    return {
      dealerId: c.dealerId, dealerTenantId: c.dealerTenantId, storeId: c.storeId,
      name: c.name, city: c.city, province: c.province,
      score, routable,
      breakdown: { city: cityMatch, province: provinceMatch, category: categoryScore, contract: contractScore, loadPenalty, categoryOverlap: overlap },
    };
  }

  // ── 只读/维护 API（控制器） ─────────────────────────────────────────────
  listDecisions(user: JwtPayload, limit = 50) {
    return withRlsTransaction(this.ds, (em) =>
      em.getRepository(RoutingDecisionEntity).find({
        where: { tenantId: user.tenantId! }, order: { createdAt: 'DESC' }, take: Math.min(limit, 200),
      }), this.rls(user));
  }

  listDirectory(user: JwtPayload) {
    // foundation 行（tenant_id NULL）+ 本租户行；RLS policy 已放行 NULL 行
    return withRlsTransaction(this.ds, (em) =>
      em.getRepository(DealerDirectoryEntity).find({ order: { city: 'ASC' } }), this.rls(user));
  }

  private rls(user: JwtPayload): TenantScope {
    return { tenantId: user.tenantId!, actorId: user.userId, role: user.role };
  }
}
