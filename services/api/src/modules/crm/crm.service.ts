import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { CustomerEntity, InteractionEntity, OpportunityEntity } from './crm.entity';
import { JwtPayload } from '../auth/auth.service';
import { encryptPII, hashPII } from '../compliance/compliance.pii';
import { AuditLogEntity } from '../governance/governance.entity';
import { EventBusService } from '../mdm/event-bus.service';
import { withRlsTransaction } from '../common/rls';
import { TenantScope } from '../common/tenant-context';
import { ownershipScope } from '../common/scope';

@Injectable()
export class CrmService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly eventBus: EventBusService,
  ) {}

  // ── Leads / Customers ───────────────────────────────────────────────────────
  async createLead(user: JwtPayload, dto: { phone: string; name: string; source?: string; city?: string; address?: string; profile?: Record<string, unknown> }) {
    if (!dto.phone || !dto.name) throw new BadRequestException('phone and name required');
    const tenantId = this.scope(user);
    const normalizedPhone = this.normalizePhone(dto.phone);
    if (!normalizedPhone) throw new BadRequestException('valid phone required');
    const phoneHash = hashPII(normalizedPhone);

    return withRlsTransaction(this.ds, async (em) => {
      const customers = em.getRepository(CustomerEntity);
      const opportunities = em.getRepository(OpportunityEntity);

      const existing = await customers.findOneBy({ tenantId, phoneHash });
      if (existing) return { customer: this.publicCustomer(existing), duplicate: true };

      const customer = await customers.save(customers.create({
        tenantId,
        dealerId: user.dealerId,
        storeId: user.storeId,
        ownerUserId: user.userId,
        phoneHash,
        phoneEncrypted: encryptPII(normalizedPhone),
        name: dto.name,
        source: dto.source || 'sales',
        city: dto.city,
        address: dto.address ?? null,
        profile: dto.profile || {},
        productDataNamespace: 'rhautt_shared',
      }));

      const opportunity = await opportunities.save(opportunities.create({
        tenantId, dealerId: user.dealerId, storeId: user.storeId,
        customerId: customer.id, ownerUserId: user.userId,
        projectId: null,
        stage: 'lead', productDataNamespace: 'rhautt_shared',
      }));

      await this.recordAudit(em, tenantId, user.userId, 'customer.create', 'customer', customer.id, null, {
        ...this.customerAuditState(customer), opportunityId: opportunity.id,
      });

      // 同事务发射 outbox 事件（业务写 + 事件原子落库）
      await this.eventBus.publishInTx(em, {
        tenantId, eventType: 'lead.created', aggregateType: 'customer', aggregateId: customer.id,
        payload: { customerId: customer.id, opportunityId: opportunity.id, source: customer.source },
      });

      return { customer: this.publicCustomer(customer), duplicate: false };
    }, this.rls(user));
  }

  listCustomers(user: JwtPayload, query: Record<string, string>) {
    return withRlsTransaction(this.ds, (em) => {
      const qb = em.getRepository(CustomerEntity).createQueryBuilder('c').where('c.tenantId = :t', { t: this.scope(user) });
      if (user.storeId)     qb.andWhere('c.storeId = :s',       { s: user.storeId });
      else if (user.dealerId) qb.andWhere('c.dealerId = :d',    { d: user.dealerId });
      if (query.status)     qb.andWhere('c.status = :status',   { status: query.status });
      if (query.ownerId)    qb.andWhere('c.ownerUserId = :o',   { o: query.ownerId });
      return qb.orderBy('c.updatedAt', 'DESC')
        .limit(Math.min(Number(query.limit || 20), 100))
        .offset((Number(query.page || 1) - 1) * Number(query.limit || 20))
        .getManyAndCount()
        .then(([items, total]) => ({ items: items.map(item => this.publicCustomer(item)), total }));
    }, this.rls(user));
  }

  async getCustomer360(user: JwtPayload, id: string) {
    const tenantId = this.scope(user);
    return withRlsTransaction(this.ds, async (em) => {
      // dealer/store 归属过滤：RLS 只兜 tenant，防同租户跨经销商 by-id 越权
      const customer = await em.getRepository(CustomerEntity)
        .findOneBy({ id, tenantId, ...ownershipScope(user, { hasStore: true }) });
      if (!customer) throw new NotFoundException('客户不存在');
      const [opportunities, interactions] = await Promise.all([
        em.getRepository(OpportunityEntity).find({ where: { customerId: id, tenantId }, order: { updatedAt: 'DESC' } }),
        em.getRepository(InteractionEntity).find({ where: { customerId: id, tenantId }, order: { createdAt: 'DESC' }, take: 50 }),
      ]);
      return { customer: this.publicCustomer(customer), opportunities, interactions };
    }, this.rls(user));
  }

  // ── Pipeline (board) ──────────────────────────────────────────────────────────
  // 一次返回全部商机 + 关联客户摘要，供 Kanban 漏斗看板使用
  async listPipeline(user: JwtPayload) {
    const tenantId = this.scope(user);
    const where: Record<string, unknown> = { tenantId };
    if (user.storeId) where.storeId = user.storeId;
    else if (user.dealerId) where.dealerId = user.dealerId;

    return withRlsTransaction(this.ds, async (em) => {
    const opps = await em.getRepository(OpportunityEntity).find({ where, order: { updatedAt: 'DESC' }, take: 500 });
    if (!opps.length) return { items: [] };

    const customerIds = [...new Set(opps.map(o => o.customerId))];
    const customers = await em.getRepository(CustomerEntity).find({ where: { id: In(customerIds), tenantId } });
    const cMap = new Map(customers.map(c => [c.id, c]));

    const items = opps.map(o => {
      const c = cMap.get(o.customerId);
      return {
        id: o.id,
        customerId: o.customerId,
        stage: o.stage,
        estimatedValue: Number(o.estimatedValue) || 0,
        probability: Number(o.probability) || 0,
        nextActionAt: o.nextActionAt,
        lostReason: o.lostReason,
        updatedAt: o.updatedAt,
        createdAt: o.createdAt,
        customer: c ? {
          name: c.name, city: c.city, source: c.source, tags: c.tags,
          profile: c.profile, lastInteractionAt: c.lastInteractionAt,
        } : null,
      };
    });
    return { items };
    }, this.rls(user));
  }

  // ── 签单：标记商机 + 自动触发 BIM 承接 ──────────────────────────────
  async sign(user: JwtPayload, opportunityId: string, quotationId: string) {
    if (!quotationId) throw new BadRequestException('quotationId required');
    const tenantId = this.scope(user);
    const scoped = ownershipScope(user, { hasStore: true });
    await withRlsTransaction(this.ds, async (em) => {
      const opportunities = em.getRepository(OpportunityEntity);
      // 先按归属校验：非本经销商/门店的商机直接 404，避免跨经销商写入与下游副作用
      const opp = await opportunities.findOne({ where: { id: opportunityId, tenantId, ...scoped } });
      if (!opp) throw new NotFoundException('商机不存在');
      await opportunities.update(
        { id: opportunityId, tenantId, ...scoped },
        { stage: 'signed' as any, quotationId } as any,
      );
      const signed = { ...opp, stage: 'signed', quotationId };
      await this.recordAudit(
        em, tenantId, user.userId, 'opportunity.sign', 'opportunity', opportunityId,
        this.opportunityAuditState(opp), this.opportunityAuditState(signed),
      );
      // 同事务发射：签单事件（驱动 BIM 承接、通知等下游消费）
      await this.eventBus.publishInTx(em, {
        tenantId, eventType: 'opportunity.signed', aggregateType: 'opportunity', aggregateId: opportunityId,
        payload: { opportunityId, quotationId, customerId: opp?.customerId, ownerUserId: opp?.ownerUserId },
      });
    }, this.rls(user));
    // P2-4 · 同步实时化：签单事务已提交，立即催投该租户 pending 事件（站内通知等），
    // 把可见反应从"等 sweep（≤5s）"压到毫秒级，消除"点了没反应"。尽力而为——不阻断签单结果。
    await this.eventBus.kickDispatch(tenantId);
    return { signed: true, opportunityId };
  }

  // ── Opportunities ───────────────────────────────────────────────────────────
  async updateOpportunityStage(user: JwtPayload, id: string, stage: string) {
    if (!stage) throw new BadRequestException('stage required');
    const tenantId = this.scope(user);
    const scoped = ownershipScope(user, { hasStore: true });
    return withRlsTransaction(this.ds, async (em) => {
      const opportunities = em.getRepository(OpportunityEntity);
      const existing = await opportunities.findOne({ where: { id, tenantId, ...scoped } });
      if (!existing) throw new NotFoundException('商机不存在');
      await opportunities.update({ id, tenantId, ...scoped }, { stage: stage as any });
      const saved = await opportunities.findOne({ where: { id, tenantId, ...scoped } });
      if (!saved) throw new NotFoundException('商机不存在');
      await this.recordMutation(
        em, user, 'opportunity.stage.update', 'opportunity.stage.updated', 'opportunity', id,
        this.opportunityAuditState(existing), this.opportunityAuditState(saved),
      );
      return saved;
    }, this.rls(user));
  }

  // 更新商机字段（金额/概率/下一步时间/丢单原因/阶段）
  async updateOpportunity(user: JwtPayload, id: string, dto: { stage?: string; estimatedValue?: number; probability?: number; nextActionAt?: string | null; lostReason?: string | null }) {
    const patch: Record<string, unknown> = {};
    if (dto.stage !== undefined)          patch.stage = dto.stage;
    if (dto.estimatedValue !== undefined) patch.estimatedValue = dto.estimatedValue;
    if (dto.probability !== undefined)    patch.probability = dto.probability;
    if (dto.nextActionAt !== undefined)   patch.nextActionAt = dto.nextActionAt ? new Date(dto.nextActionAt) : null;
    if (dto.lostReason !== undefined)     patch.lostReason = dto.lostReason;
    if (!Object.keys(patch).length) throw new BadRequestException('no fields to update');
    const tenantId = this.scope(user);
    const scoped = ownershipScope(user, { hasStore: true });
    return withRlsTransaction(this.ds, async (em) => {
      const opportunities = em.getRepository(OpportunityEntity);
      const existing = await opportunities.findOne({ where: { id, tenantId, ...scoped } });
      if (!existing) throw new NotFoundException('商机不存在');
      await opportunities.update({ id, tenantId, ...scoped }, patch as any);
      const saved = await opportunities.findOne({ where: { id, tenantId, ...scoped } });
      if (!saved) throw new NotFoundException('商机不存在');
      await this.recordMutation(
        em, user, 'opportunity.update', 'opportunity.updated', 'opportunity', id,
        this.opportunityAuditState(existing), this.opportunityAuditState(saved),
      );
      return saved;
    }, this.rls(user));
  }

  // ── Interactions ─────────────────────────────────────────────────────────────
  addInteraction(user: JwtPayload, dto: { customerId: string; type?: string; content?: string; opportunityId?: string }) {
    if (!dto.customerId) throw new BadRequestException('customerId required');
    const tenantId = this.scope(user);
    return withRlsTransaction(this.ds, async (em) => {
      // interactions 无 dealer/store 列，经父客户归属校验：不得给非本属客户挂交互
      const customer = await em.getRepository(CustomerEntity)
        .findOneBy({ id: dto.customerId, tenantId, ...ownershipScope(user, { hasStore: true }) });
      if (!customer) throw new NotFoundException('客户不存在');
      if (dto.opportunityId) {
        const opportunity = await em.getRepository(OpportunityEntity).findOne({ where: {
          id: dto.opportunityId,
          customerId: dto.customerId,
          tenantId,
          ...ownershipScope(user, { hasStore: true }),
        } });
        if (!opportunity) throw new NotFoundException('商机不存在');
      }
      const interactions = em.getRepository(InteractionEntity);
      const saved = await interactions.save(interactions.create({
        tenantId, customerId: dto.customerId,
        opportunityId: dto.opportunityId, actorUserId: user.userId,
        type: dto.type || 'note', content: dto.content,
      }));
      await this.recordMutation(
        em, user, 'interaction.create', 'interaction.created', 'interaction', saved.id,
        null, this.interactionAuditState(saved),
      );
      return saved;
    }, this.rls(user));
  }

  /**
   * 事务内建 lead（供 event-consumers 消费 `lead.captured` 等公域获客事件时调用）。
   * 与 createLead 同语义（去重 + 生命周期串联 + 发射 lead.created），但以显式 tenantId
   * 运行、不依赖 JwtPayload —— 消费方以 system actor 自开 RLS 事务传入 manager。
   */
  async createLeadInTx(em: import('typeorm').EntityManager, dto: {
    tenantId: string; phone: string; name: string;
    source?: string; city?: string | null; address?: string | null;
    dealerId?: string | null; storeId?: string | null; ownerUserId?: string | null;
    profile?: Record<string, unknown>;
    tags?: string[];
  }): Promise<{ customer: CustomerEntity; opportunity?: OpportunityEntity; duplicate: boolean }> {
    if (!dto.tenantId || !dto.phone || !dto.name) {
      throw new BadRequestException('tenantId, phone and name required');
    }
    const customers = em.getRepository(CustomerEntity);
    const opportunities = em.getRepository(OpportunityEntity);
    const normalizedPhone = this.normalizePhone(dto.phone);
    if (!normalizedPhone) throw new BadRequestException('valid phone required');
    const phoneHash = hashPII(normalizedPhone);

    const existing = await customers.findOneBy({ tenantId: dto.tenantId, phoneHash });
    if (existing) {
      const opportunity = await opportunities.findOne({
        where: { tenantId: dto.tenantId, customerId: existing.id },
        order: { createdAt: 'DESC' },
      });
      return { customer: existing, opportunity: opportunity || undefined, duplicate: true };
    }

    const customer = await customers.save(customers.create({
      tenantId: dto.tenantId,
      dealerId: dto.dealerId ?? null,
      storeId: dto.storeId ?? null,
      ownerUserId: dto.ownerUserId ?? null,
      phoneHash,
      phoneEncrypted: encryptPII(normalizedPhone),
      name: dto.name,
      source: dto.source || 'web',
      city: dto.city ?? null,
      address: dto.address ?? null,
      profile: dto.profile || {},
      tags: dto.tags || [],
      productDataNamespace: 'rhautt_shared',
    }));

    const opportunity = await opportunities.save(opportunities.create({
      tenantId: dto.tenantId, dealerId: dto.dealerId ?? null, storeId: dto.storeId ?? null,
      customerId: customer.id, ownerUserId: dto.ownerUserId ?? null,
      projectId: null,
      stage: 'lead', productDataNamespace: 'rhautt_shared',
    }));

    await this.recordAudit(
      em, dto.tenantId, dto.ownerUserId ?? null, 'customer.create', 'customer', customer.id, null,
      { ...this.customerAuditState(customer), opportunityId: opportunity.id },
    );

    await this.eventBus.publishInTx(em, {
      tenantId: dto.tenantId, eventType: 'lead.created', aggregateType: 'customer', aggregateId: customer.id,
      payload: { customerId: customer.id, opportunityId: opportunity.id, source: customer.source },
    });

    return { customer, opportunity, duplicate: false };
  }

  // ── helpers ──────────────────────────────────────────────────────────────────
  private scope(user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException('缺少租户上下文');
    return user.tenantId;
  }

  private rls(user: JwtPayload): TenantScope {
    return { tenantId: this.scope(user), actorId: user.userId, role: user.role };
  }

  private normalizePhone(phone: string) {
    return String(phone || '').replace(/\D/g, '');
  }

  private publicCustomer(customer: CustomerEntity) {
    const { phoneEncrypted: _encrypted, phoneHash: _hash, ...publicFields } = customer;
    return publicFields;
  }

  private customerAuditState(customer: Record<string, any>) {
    return this.pick(customer, ['id', 'tenantId', 'dealerId', 'storeId', 'ownerUserId', 'name', 'city', 'source', 'status']);
  }

  private opportunityAuditState(opportunity: Record<string, any>) {
    return this.pick(opportunity, [
      'id', 'tenantId', 'dealerId', 'storeId', 'customerId', 'ownerUserId', 'stage',
      'estimatedValue', 'probability', 'nextActionAt', 'lostReason', 'quotationId', 'projectId',
    ]);
  }

  private interactionAuditState(interaction: Record<string, any>) {
    return this.pick(interaction, ['id', 'tenantId', 'customerId', 'opportunityId', 'actorUserId', 'type']);
  }

  private pick(source: Record<string, any>, fields: string[]) {
    return fields.reduce<Record<string, unknown>>((result, field) => {
      if (source[field] !== undefined) result[field] = source[field];
      return result;
    }, {});
  }

  private async recordAudit(
    em: EntityManager,
    tenantId: string,
    actorUserId: string | null | undefined,
    action: string,
    resourceType: string,
    resourceId: string,
    beforeState: Record<string, unknown> | null,
    afterState: Record<string, unknown> | null,
  ) {
    const audits = em.getRepository(AuditLogEntity);
    await audits.save(audits.create({
      tenantId,
      actorUserId: actorUserId || null,
      action,
      resourceType,
      resourceId,
      beforeState,
      afterState,
      requestId: null,
      traceId: null,
      ipHash: null,
    }));
  }

  private async recordMutation(
    em: EntityManager,
    user: JwtPayload,
    action: string,
    eventType: string,
    resourceType: string,
    resourceId: string,
    beforeState: Record<string, unknown> | null,
    afterState: Record<string, unknown>,
  ) {
    const tenantId = this.scope(user);
    await this.recordAudit(em, tenantId, user.userId, action, resourceType, resourceId, beforeState, afterState);
    await this.eventBus.publishInTx(em, {
      tenantId,
      eventType,
      aggregateType: resourceType,
      aggregateId: resourceId,
      payload: afterState,
    });
  }
}
