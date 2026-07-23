import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { DealerEntity, StoreEntity, TenantEntity } from './tenant.entity';
import { JwtPayload } from '../auth/auth.service';
import { withRlsTransaction } from '../common/rls';
import { AuditLogEntity } from '../governance/governance.entity';
import { EventBusService } from '../mdm/event-bus.service';

function pickDefined(source: Record<string, unknown>, keys: readonly string[]) {
  return Object.fromEntries(keys
    .filter(key => Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined)
    .map(key => [key, source[key]]));
}

const TENANT_MUTABLE_FIELDS = ['code', 'name', 'type', 'status', 'settings'] as const;
const DEALER_MUTABLE_FIELDS = ['code', 'name', 'province', 'city', 'contact', 'contractLevel', 'status'] as const;
const STORE_MUTABLE_FIELDS = ['dealerId', 'code', 'name', 'city', 'address', 'managerUserId', 'status'] as const;

@Injectable()
export class TenantService {
  constructor(
    @InjectDataSource()             private readonly ds: DataSource,
    @InjectRepository(TenantEntity) private tenants: Repository<TenantEntity>,
    @InjectRepository(DealerEntity) private dealers: Repository<DealerEntity>,
    @InjectRepository(StoreEntity)  private stores: Repository<StoreEntity>,
    private readonly eventBus: EventBusService,
  ) {}

  // tenants 表无 RLS（HQ 跨租户管理）；dealers/stores 受 FORCE RLS，须在租户绑定事务内读写。

  // ── Tenant ──────────────────────────────────────────────────────────────────
  listTenants(user: JwtPayload, query: Record<string, string>) {
    this.requireHq(user);
    const qb = this.tenants.createQueryBuilder('t');
    if (query.status) qb.andWhere('t.status = :status', { status: query.status });
    return qb.orderBy('t.name').getMany();
  }

  async getTenant(user: JwtPayload, id: string) {
    this.requireHq(user);
    const tenant = await this.tenants.findOneBy({ id });
    if (!tenant) throw new NotFoundException('租户不存在');
    return tenant;
  }

  async createTenant(user: JwtPayload, dto: Partial<TenantEntity>) {
    this.requireHq(user);
    if (!dto.code || !dto.name) throw new BadRequestException('code and name required');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(TenantEntity);
      const saved = await repo.save(repo.create(pickDefined(dto as Record<string, unknown>, TENANT_MUTABLE_FIELDS)));
      await this.recordMutation(em, user, 'tenant.create', 'tenant.created', 'tenant', saved.id, null, saved);
      return saved;
    }, this.rls(user));
  }

  async updateTenant(user: JwtPayload, id: string, dto: Record<string, unknown>) {
    this.requireHq(user);
    const patch = pickDefined(dto, TENANT_MUTABLE_FIELDS);
    if (!Object.keys(patch).length) throw new BadRequestException('no mutable fields supplied');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(TenantEntity);
      const before = await repo.findOneBy({ id });
      if (!before) throw new NotFoundException('租户不存在');
      await repo.update(id, patch);
      const saved = await repo.findOneBy({ id });
      if (!saved) throw new NotFoundException('租户不存在');
      await this.recordMutation(em, user, 'tenant.update', 'tenant.updated', 'tenant', id, before, saved);
      return saved;
    }, this.rls(user));
  }

  // ── Dealer ──────────────────────────────────────────────────────────────────
  listDealers(user: JwtPayload, query: Record<string, string>) {
    const tenantId = this.resolveScope(user);
    return withRlsTransaction(this.ds, (em) => {
      const qb = em.getRepository(DealerEntity).createQueryBuilder('d').where('d.tenantId = :tenantId', { tenantId });
      if (user.dealerId) qb.andWhere('d.id = :dealerId', { dealerId: user.dealerId });
      if (query.status) qb.andWhere('d.status = :status', { status: query.status });
      if (query.city)   qb.andWhere('d.city = :city',   { city: query.city });
      return qb.orderBy('d.name').getMany();
    }, { tenantId });
  }

  async getDealer(user: JwtPayload, id: string) {
    const tenantId = this.resolveScope(user);
    if (user.dealerId && user.dealerId !== id) throw new ForbiddenException('不可跨经销商访问');
    return withRlsTransaction(this.ds, async (em) => {
      const dealer = await em.getRepository(DealerEntity).findOneBy({ id, tenantId });
      if (!dealer) throw new NotFoundException('经销商不存在');
      return dealer;
    }, this.rls(user));
  }

  createDealer(user: JwtPayload, dto: Partial<DealerEntity>) {
    this.requireRegionalAdmin(user);
    if (!dto.code || !dto.name) throw new BadRequestException('code and name required');
    const tenantId = this.resolveScope(user);
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(DealerEntity);
      const saved = await repo.save(repo.create({
        ...pickDefined(dto as Record<string, unknown>, DEALER_MUTABLE_FIELDS),
        tenantId
      }));
      await this.recordMutation(em, user, 'dealer.create', 'tenant.dealer.created', 'dealer', saved.id, null, saved);
      return saved;
    }, this.rls(user));
  }

  async updateDealer(user: JwtPayload, id: string, dto: Record<string, unknown>) {
    this.requireDealerAdmin(user);
    if (user.dealerId && user.dealerId !== id) throw new ForbiddenException('不可跨经销商修改');
    const tenantId = this.resolveScope(user);
    const patch = pickDefined(dto, DEALER_MUTABLE_FIELDS);
    if (!Object.keys(patch).length) throw new BadRequestException('no mutable fields supplied');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(DealerEntity);
      const before = await repo.findOneBy({ id, tenantId });
      if (!before) throw new NotFoundException('经销商不存在');
      await repo.update(id, patch);
      const saved = await repo.findOneBy({ id, tenantId });
      if (!saved) throw new NotFoundException('经销商不存在');
      await this.recordMutation(em, user, 'dealer.update', 'tenant.dealer.updated', 'dealer', id, before, saved);
      return saved;
    }, this.rls(user));
  }

  // ── Store ───────────────────────────────────────────────────────────────────
  listStores(user: JwtPayload, query: Record<string, string>) {
    const tenantId = this.resolveScope(user);
    return withRlsTransaction(this.ds, (em) => {
      const qb = em.getRepository(StoreEntity).createQueryBuilder('s').where('s.tenantId = :t', { t: tenantId });
      if (user.storeId) qb.andWhere('s.id = :storeId', { storeId: user.storeId });
      else if (user.dealerId) qb.andWhere('s.dealerId = :d', { d: user.dealerId });
      if (query.status)  qb.andWhere('s.status = :status', { status: query.status });
      return qb.orderBy('s.name').getMany();
    }, { tenantId });
  }

  async getStore(user: JwtPayload, id: string) {
    const tenantId = this.resolveScope(user);
    if (user.storeId && user.storeId !== id) throw new ForbiddenException('不可跨门店访问');
    return withRlsTransaction(this.ds, async (em) => {
      const store = await em.getRepository(StoreEntity).findOneBy({
        id,
        tenantId,
        ...(user.dealerId ? { dealerId: user.dealerId } : {})
      });
      if (!store) throw new NotFoundException('门店不存在');
      return store;
    }, this.rls(user));
  }

  createStore(user: JwtPayload, dto: Partial<StoreEntity>) {
    this.requireDealerAdmin(user);
    if (!dto.code || !dto.name || !dto.dealerId) throw new BadRequestException('code, name, dealerId required');
    const tenantId = this.resolveScope(user);
    return withRlsTransaction(this.ds, async (em) => {
      const dealer = await em.getRepository(DealerEntity).findOneBy({ id: dto.dealerId, tenantId });
      if (!dealer) throw new NotFoundException('经销商不存在');
      if (user.dealerId && user.dealerId !== dealer.id) throw new ForbiddenException('不可跨经销商创建门店');
      const repo = em.getRepository(StoreEntity);
      const saved = await repo.save(repo.create({
        ...pickDefined(dto as Record<string, unknown>, STORE_MUTABLE_FIELDS),
        tenantId
      }));
      await this.recordMutation(em, user, 'store.create', 'tenant.store.created', 'store', saved.id, null, saved);
      return saved;
    }, this.rls(user));
  }

  async updateStore(user: JwtPayload, id: string, dto: Record<string, unknown>) {
    this.requireDealerAdmin(user);
    const tenantId = this.resolveScope(user);
    const patch = pickDefined(dto, STORE_MUTABLE_FIELDS);
    if (!Object.keys(patch).length) throw new BadRequestException('no mutable fields supplied');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(StoreEntity);
      const before = await repo.findOneBy({ id, tenantId });
      if (!before) throw new NotFoundException('门店不存在');
      if (user.dealerId && before.dealerId !== user.dealerId) throw new ForbiddenException('不可跨经销商修改门店');
      if (patch.dealerId) {
        const dealer = await em.getRepository(DealerEntity).findOneBy({ id: String(patch.dealerId), tenantId });
        if (!dealer) throw new NotFoundException('经销商不存在');
        if (user.dealerId && user.dealerId !== dealer.id) throw new ForbiddenException('不可跨经销商移动门店');
      }
      await repo.update(id, patch);
      const saved = await repo.findOneBy({ id, tenantId });
      if (!saved) throw new NotFoundException('门店不存在');
      await this.recordMutation(em, user, 'store.update', 'tenant.store.updated', 'store', id, before, saved);
      return saved;
    }, this.rls(user));
  }

  // ── helpers ─────────────────────────────────────────────────────────────────
  private resolveScope(user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException('缺少租户上下文');
    return user.tenantId;
  }

  private requireHq(user: JwtPayload) {
    if (!['platform_admin', 'hq_admin'].includes(user.role)) throw new ForbiddenException('仅总部管理员可操作');
  }

  private requireDealerAdmin(user: JwtPayload) {
    if (!['platform_admin', 'hq_admin', 'regional_manager', 'dealer_admin'].includes(user.role))
      throw new ForbiddenException('权限不足');
  }

  private requireRegionalAdmin(user: JwtPayload) {
    if (!['platform_admin', 'hq_admin', 'regional_manager'].includes(user.role))
      throw new ForbiddenException('权限不足');
  }

  private rls(user: JwtPayload) {
    return { tenantId: this.resolveScope(user), actorId: user.userId };
  }

  private auditState(resourceType: string, entity: Record<string, any> | null) {
    if (!entity) return null;
    const fields = resourceType === 'tenant'
      ? ['id', 'code', 'name', 'type', 'status']
      : resourceType === 'dealer'
        ? ['id', 'tenantId', 'code', 'name', 'province', 'city', 'contractLevel', 'status']
        : ['id', 'tenantId', 'dealerId', 'code', 'name', 'city', 'status'];
    return pickDefined(entity, fields);
  }

  private async recordMutation(
    em: EntityManager,
    user: JwtPayload,
    action: string,
    eventType: string,
    resourceType: 'tenant' | 'dealer' | 'store',
    resourceId: string,
    before: Record<string, any> | null,
    after: Record<string, any>,
  ) {
    const tenantId = this.resolveScope(user);
    const beforeState = this.auditState(resourceType, before);
    const afterState = this.auditState(resourceType, after);
    const auditRepo = em.getRepository(AuditLogEntity);
    await auditRepo.save(auditRepo.create({
      tenantId,
      actorUserId: user.userId || null,
      action,
      resourceType,
      resourceId,
      beforeState,
      afterState,
      requestId: null,
      traceId: null,
      ipHash: null,
    }));
    await this.eventBus.publishInTx(em, {
      tenantId,
      eventType,
      aggregateType: resourceType,
      aggregateId: resourceId,
      payload: afterState || { id: resourceId },
    });
  }
}
