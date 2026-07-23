import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { withRlsTransaction } from '../common/rls';
import {
  SubscriptionEntity, SellableModuleId, SubscriptionPlan,
  SELLABLE_MODULES,
} from './subscription.entity';

export interface GrantInput {
  moduleId: SellableModuleId;
  plan?: SubscriptionPlan;
  seats?: number | null;
  endsAt?: Date | null;
}

@Injectable()
export class EntitlementService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @InjectRepository(SubscriptionEntity) private readonly subs: Repository<SubscriptionEntity>,
  ) {}

  private assertSellable(moduleId: string): asserts moduleId is SellableModuleId {
    if (!SELLABLE_MODULES.includes(moduleId as SellableModuleId)) {
      throw new BadRequestException(`未知可售模块: ${moduleId}`);
    }
  }

  /** 列出某租户全部订阅（RLS 绑定该租户）。 */
  async listForTenant(tenantId: string): Promise<SubscriptionEntity[]> {
    return withRlsTransaction(this.ds, (em) =>
      em.getRepository(SubscriptionEntity).find({ where: { tenantId } }),
    { tenantId });
  }

  /** 当前有效（active/trialing 且未过期）的模块 id 集合。 */
  async activeModuleIds(tenantId: string): Promise<Set<SellableModuleId>> {
    const rows = await this.listForTenant(tenantId);
    return new Set(rows.filter((r) => r.isActive).map((r) => r.moduleId));
  }

  /** 授权判定：租户是否对全部所需模块持有有效订阅。 */
  async hasActiveModules(tenantId: string, required: SellableModuleId[]): Promise<boolean> {
    if (required.length === 0) return true;
    const active = await this.activeModuleIds(tenantId);
    return required.every((m) => active.has(m));
  }

  /** 平台开通/更新订阅（platform_admin）。以目标租户 scope 写入，满足 FORCE RLS WITH CHECK。 */
  async grant(tenantId: string, actorId: string | null, input: GrantInput): Promise<SubscriptionEntity> {
    this.assertSellable(input.moduleId);
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(SubscriptionEntity);
      const existing = await repo.findOne({ where: { tenantId, moduleId: input.moduleId } });
      const patch: Partial<SubscriptionEntity> = {
        tenantId,
        moduleId: input.moduleId,
        plan: input.plan ?? 'standard',
        status: 'active',
        seats: input.seats ?? null,
        endsAt: input.endsAt ?? null,
      };
      const entity = existing ? repo.merge(existing, patch) : repo.create(patch);
      return repo.save(entity);
    }, { tenantId, actorId: actorId ?? undefined });
  }

  /** 平台停用订阅（platform_admin）。 */
  async revoke(tenantId: string, actorId: string | null, moduleId: SellableModuleId): Promise<{ revoked: boolean }> {
    this.assertSellable(moduleId);
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(SubscriptionEntity);
      const res = await repo.update({ tenantId, moduleId }, { status: 'canceled' });
      return { revoked: (res.affected ?? 0) > 0 };
    }, { tenantId, actorId: actorId ?? undefined });
  }
}
