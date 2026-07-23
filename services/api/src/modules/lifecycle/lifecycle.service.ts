import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { LifecycleLinkEntity } from './lifecycle.entity';
import { isLifecycleState, LifecycleState, lifecycleStateOrder } from './lifecycle-states';
import { EventBusService } from '../mdm/event-bus.service';
import { withRlsTransaction } from '../common/rls';
import { TenantScope } from '../common/tenant-context';
import { ownershipScope } from '../common/scope';
import { normalizeAddress } from '../common/address';
import {
  activateInstalledAssets,
  buildCustomerProjectView,
  buildIotHandoffPackageFromLink,
  buildIotHomeId,
  getProjectStateMap,
  lifecycleOutboxPayload,
  normalizeCapabilityRegistry,
  normalizeDevices,
  normalizeInstalledAssets,
  normalizeProjectStatePatch,
  normalizeServicePlan,
} from './lifecycle-projection';

// 遗留 Express 服务仅作为「纯投影/归一化函数库」复用（PROJECT_STATES、buildCustomerProjectView、
// normalize*/summarize* 等无副作用方法）。#2 收敛后，一切持久化改走 Postgres，不再调用其 Mongo 路径。
// eslint-disable-next-line @typescript-eslint/no-var-requires

export interface LifecycleAdvance {
  tenantId: string;
  customerId: string;
  stage: LifecycleState;
  opportunityId?: string | null;
  quotationId?: string | null;
  contractId?: string | null;
  designProjectId?: string | null;
  dealerId?: string | null;
  storeId?: string | null;
  // 项目主线业务唯一键组成（手机号+项目地址）。见 docs/PROJECT-SPINE-DATA-MODEL-DESIGN.md。
  phoneHash?: string | null;
  projectAddress?: string | null;
}

interface LifecycleScope {
  tenantId: string;
  dealerId: string | null;
  storeId: string | null;
  userId: string | null;
  role: string | null;
  customerId: string | null;
}

function toScope(user: Record<string, unknown>): LifecycleScope {
  return {
    tenantId: String(user['tenantId'] ?? ''),
    dealerId: (user['dealerId'] as string) ?? null,
    storeId: (user['storeId'] as string) ?? null,
    userId: (user['sub'] as string) ?? (user['userId'] as string) ?? null,
    role: (user['role'] as string) ?? null,
    customerId: (user['customerId'] as string) ?? null,
  };
}

interface StatePatch {
  projectState: string;
  customerVisibleState: string;
  progressPercent: number;
  currentMilestone: string;
  lifecycleStage: string;
  handoverStatus: string;
}

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function requireUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new BadRequestException(`${field} must be a UUID`);
  }
  return value;
}

@Injectable()
export class LifecycleService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly eventBus: EventBusService,
  ) {}

  private rls(scope: LifecycleScope): TenantScope {
    return { tenantId: scope.tenantId, actorId: scope.userId ?? undefined, role: scope.role ?? undefined };
  }

  /** entity → 纯函数所需的 camelCase link 形态（quoteId←quotationId，designId←designProjectId）。 */
  private toLink(e: LifecycleLinkEntity): Record<string, unknown> {
    return {
      tenantId: e.tenantId, customerId: e.customerId, contractId: e.contractId,
      opportunityId: e.opportunityId, dealerId: e.dealerId, storeId: e.storeId,
      projectAddress: e.projectAddress,
      projectState: e.projectState, customerVisibleState: e.customerVisibleState,
      progressPercent: e.progressPercent, currentMilestone: e.currentMilestone,
      lifecycleStage: e.lifecycleStage, handoverStatus: e.handoverStatus,
      designId: e.designProjectId, quoteId: e.quotationId,
      designPackageId: e.designPackageId, rysnovaBimPackageId: e.rysnovaBimPackageId,
      systems: e.systems, iot: e.iot, devices: e.devices,
      installedAssets: e.installedAssets, servicePlan: e.servicePlan,
      acceptedAt: e.acceptedAt, updatedAt: e.updatedAt, storageMode: 'postgres',
    };
  }

  private applyStatePatch(link: LifecycleLinkEntity, patch: StatePatch): void {
    link.projectState = patch.projectState;
    link.customerVisibleState = patch.customerVisibleState;
    link.progressPercent = patch.progressPercent;
    link.currentMilestone = patch.currentMilestone;
    link.lifecycleStage = patch.lifecycleStage;
    link.handoverStatus = patch.handoverStatus;
  }

  private markTransition(link: LifecycleLinkEntity, state: string): void {
    const transitions = { ...(link.transitions || {}) } as Record<string, unknown>;
    if (!transitions[state]) transitions[state] = new Date().toISOString();
    link.transitions = transitions;
  }

  private outboxPayload(eventType: string, link: LifecycleLinkEntity, scope: LifecycleScope): Record<string, unknown> {
    return lifecycleOutboxPayload(eventType, this.toLink(link), scope);
  }

  // ── 承接 upsert（承接/生命周期富字段）──────────────────────────────────────
  async createOrUpdateHandover(user: Record<string, unknown>, body: unknown): Promise<LifecycleLinkEntity> {
    const scope = toScope(user);
    const data = (body || {}) as Record<string, any>;
    if (!data.customerId || !data.contractId) {
      throw new BadRequestException('customerId and contractId are required');
    }
    requireUuid(data.customerId, 'customerId');
    requireUuid(data.contractId, 'contractId');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(LifecycleLinkEntity);
      // 先按合同定位既有承接行；否则复用该客户的 funnel 串联行（CRM 建 lead 时已建）。
      let link = await repo.findOne({ where: { tenantId: scope.tenantId, contractId: data.contractId, ...ownershipScope(scope, { hasStore: true }) } });
      if (!link) link = await repo.findOne({ where: { tenantId: scope.tenantId, customerId: data.customerId, ...ownershipScope(scope, { hasStore: true }) } });
      const isNew = !link;
      if (!link) link = repo.create({ tenantId: scope.tenantId, customerId: data.customerId, transitions: {} });

      const devices = normalizeDevices(data.devices || []);
      const installedAssets = normalizeInstalledAssets(data, devices);
      const statePatch: StatePatch = normalizeProjectStatePatch({
        state: data.projectState || data.state || (installedAssets.length ? 'lifecycle-handoff-ready' : 'accepted'),
        updatedBy: scope.userId,
      });
      const servicePlan = normalizeServicePlan(
        scope, data.contractId, data.servicePlan,
        statePatch.projectState === 'lifecycle-active' ? 'active' : 'prepared',
      );
      const systems = data.systems || [...new Set([
        ...devices.map((d: any) => d.system).filter(Boolean),
        ...installedAssets.map((a: any) => a.category).filter((c: string) => c && c !== 'unknown'),
      ])];

      link.customerId = data.customerId;
      link.dealerId = scope.dealerId ?? link.dealerId ?? null;
      link.storeId = scope.storeId ?? link.storeId ?? null;
      link.opportunityId = data.opportunityId ?? link.opportunityId ?? null;
      link.contractId = data.contractId;
      link.designProjectId = data.designId ?? link.designProjectId ?? null;
      link.quotationId = data.quoteId ?? link.quotationId ?? null;
      link.designPackageId = data.designPackageId ?? link.designPackageId ?? null;
      link.rysnovaBimPackageId = data.rysnovaBimPackageId ?? link.rysnovaBimPackageId ?? null;
      link.projectAddress = data.projectAddress ?? link.projectAddress ?? null;
      this.applyStatePatch(link, statePatch);
      link.stage = statePatch.projectState; // stage 与 projectState 同步（同一规范词表）
      link.systems = systems;
      link.iot = {
        platform: data.iot?.platform || 'rhautt-iot',
        homeId: data.iot?.homeId || buildIotHomeId(scope, data.contractId),
        accountId: data.iot?.accountId,
        bindingStatus: data.iot?.bindingStatus || 'prepared',
        handoffBoundary: 'lifecycle_handoff_only',
        capabilityRegistry: normalizeCapabilityRegistry(data.iot || {}, installedAssets),
      };
      link.devices = devices;
      link.installedAssets = installedAssets;
      link.servicePlan = servicePlan;
      link.updatedBy = scope.userId ?? null;
      if (isNew) link.createdBy = scope.userId ?? null;
      this.markTransition(link, statePatch.projectState);

      const saved = await repo.save(link);
      await this.eventBus.publishInTx(em, {
        tenantId: scope.tenantId, eventType: 'lifecycle.handover.upsert',
        aggregateType: 'lifecycle_link', aggregateId: data.contractId,
        payload: this.outboxPayload('lifecycle.handover.upsert', saved, scope),
      });
      return saved;
    }, this.rls(scope));
  }

  // ── 验收标记（激活资产 + 置 handoff-ready）──────────────────────────────────
  async markAccepted(user: Record<string, unknown>, contractId: string, body: unknown): Promise<LifecycleLinkEntity> {
    const scope = toScope(user);
    requireUuid(contractId, 'contractId');
    const data = (body || {}) as Record<string, any>;
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(LifecycleLinkEntity);
      const link = await repo.findOne({ where: { tenantId: scope.tenantId, contractId, ...ownershipScope(scope, { hasStore: true }) } });
      if (!link) throw new NotFoundException('lifecycle handover not found');

      const acceptedAt = data.acceptedAt ? new Date(data.acceptedAt) : new Date();
      const { devices, installedAssets } = activateInstalledAssets(this.toLink(link), acceptedAt);
      const patch: StatePatch = normalizeProjectStatePatch({
        state: 'lifecycle-handoff-ready', handoverStatus: 'ready', updatedBy: scope.userId,
      });
      this.applyStatePatch(link, patch);
      link.stage = patch.projectState;
      link.acceptedAt = acceptedAt;
      link.devices = devices;
      link.installedAssets = installedAssets;
      link.iot = {
        ...((link.iot as Record<string, unknown>) || {}),
        bindingStatus: (link.iot as any)?.bindingStatus || 'prepared',
        handoffBoundary: 'lifecycle_handoff_only',
        capabilityRegistry: normalizeCapabilityRegistry(link.iot || {}, installedAssets),
      };
      link.servicePlan = { ...((link.servicePlan as Record<string, unknown>) || {}), status: 'prepared' };
      link.updatedBy = scope.userId ?? null;
      this.markTransition(link, patch.projectState);

      const saved = await repo.save(link);
      await this.eventBus.publishInTx(em, {
        tenantId: scope.tenantId, eventType: 'lifecycle.acceptance.marked',
        aggregateType: 'lifecycle_link', aggregateId: contractId,
        payload: this.outboxPayload('lifecycle.acceptance.marked', saved, scope),
      });
      return saved;
    }, this.rls(scope));
  }

  async buildIotHandoffPackage(user: Record<string, unknown>, contractId: string) {
    const scope = toScope(user);
    requireUuid(contractId, 'contractId');
    return withRlsTransaction(this.ds, async (em) => {
      const link = await em.getRepository(LifecycleLinkEntity).findOne({ where: { tenantId: scope.tenantId, contractId, ...ownershipScope(scope, { hasStore: true }) } });
      if (!link) throw new NotFoundException('lifecycle handoff package not found');
      if (scope.role === 'customer' && scope.customerId && String(link.customerId) !== String(scope.customerId)) {
        throw new NotFoundException('lifecycle handoff package not found');
      }
      return buildIotHandoffPackageFromLink(scope, this.toLink(link));
    }, this.rls(scope));
  }

  async listCustomerProjectViews(user: Record<string, unknown>, query: unknown) {
    const scope = toScope(user);
    const q = (query || {}) as Record<string, string>;
    const customerId = scope.role === 'customer' && scope.customerId ? scope.customerId : q.customerId;
    if (customerId) requireUuid(customerId, 'customerId');
    return withRlsTransaction(this.ds, async (em) => {
      const qb = em.getRepository(LifecycleLinkEntity).createQueryBuilder('l')
        .where('l.tenantId = :t', { t: scope.tenantId });
      if (customerId) qb.andWhere('l.customerId = :c', { c: customerId });
      if (q.lifecycleStage) qb.andWhere('l.lifecycleStage = :ls', { ls: q.lifecycleStage });
      if (q.handoverStatus) qb.andWhere('l.handoverStatus = :hs', { hs: q.handoverStatus });
      // 员工侧 dealer/store 归属过滤（customer 角色已按 customerId 收敛；RLS 仅兜 tenant）
      if (scope.role !== 'customer') {
        if (scope.storeId) qb.andWhere('l.storeId = :s', { s: scope.storeId });
        else if (scope.dealerId) qb.andWhere('l.dealerId = :d', { d: scope.dealerId });
      }
      const rows = await qb.orderBy('l.updatedAt', 'DESC').limit(200).getMany();
      const items = rows.map((r) => buildCustomerProjectView(scope, this.toLink(r)));
      return {
        items,
        pagination: { page: 1, limit: items.length, total: items.length, pages: 1 },
        storageMode: 'postgres',
      };
    }, this.rls(scope));
  }

  getProjectStateMap() {
    return getProjectStateMap();
  }

  async getCustomerProjectView(user: Record<string, unknown>, contractId: string) {
    const scope = toScope(user);
    requireUuid(contractId, 'contractId');
    return withRlsTransaction(this.ds, async (em) => {
      const link = await em.getRepository(LifecycleLinkEntity).findOne({
        where: { tenantId: scope.tenantId, contractId, ...ownershipScope(scope, { hasStore: true }) },
      });
      if (!link || (scope.role === 'customer' && scope.customerId && String(link.customerId) !== String(scope.customerId))) {
        throw new NotFoundException('customer project not found');
      }
      return buildCustomerProjectView(scope, this.toLink(link));
    }, this.rls(scope));
  }

  async getHandover(user: Record<string, unknown>, contractId: string): Promise<LifecycleLinkEntity> {
    const scope = toScope(user);
    requireUuid(contractId, 'contractId');
    return withRlsTransaction(this.ds, async (em) => {
      const link = await em.getRepository(LifecycleLinkEntity).findOne({
        where: { tenantId: scope.tenantId, contractId, ...ownershipScope(scope, { hasStore: true }) },
      });
      if (!link) throw new NotFoundException('lifecycle handover not found');
      return link;
    }, this.rls(scope));
  }

  async updateProjectState(user: Record<string, unknown>, contractId: string, body: unknown): Promise<LifecycleLinkEntity> {
    const scope = toScope(user);
    requireUuid(contractId, 'contractId');
    const data = (body || {}) as Record<string, any>;
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(LifecycleLinkEntity);
      const link = await repo.findOne({ where: { tenantId: scope.tenantId, contractId, ...ownershipScope(scope, { hasStore: true }) } });
      if (!link) throw new NotFoundException('lifecycle project not found');
      const patch: StatePatch = normalizeProjectStatePatch({ ...data, updatedBy: scope.userId });
      this.applyStatePatch(link, patch);
      link.stage = patch.projectState;
      link.updatedBy = scope.userId ?? null;
      this.markTransition(link, patch.projectState);
      const saved = await repo.save(link);
      await this.eventBus.publishInTx(em, {
        tenantId: scope.tenantId, eventType: 'lifecycle.project_state.update',
        aggregateType: 'lifecycle_link', aggregateId: contractId,
        payload: this.outboxPayload('lifecycle.project_state.update', saved, scope),
      });
      return saved;
    }, this.rls(scope));
  }

  /**
   * 事务内推进生命周期串联（lifecycle_links）：在业务写的同一 RLS 事务里 upsert，
   * 由 CRM 签单/线索等写路径在其事务内调用，保证原子串联。#2 收敛后同表同时承载
   * 富投影：本方法把规范 stage 映射为 14 态派生字段（客户视图/rollup 立即可见），
   * 且 projectState 单调前进——重放/早期事件不回退更靠后的承接态。
   */
  async advanceInTx(em: EntityManager, p: LifecycleAdvance): Promise<LifecycleLinkEntity> {
    if (!isLifecycleState(p.stage)) {
      throw new BadRequestException(`unknown lifecycle stage: ${p.stage}`);
    }
    const repo = em.getRepository(LifecycleLinkEntity);
    let link = await repo.findOne({ where: { tenantId: p.tenantId, customerId: p.customerId } });
    if (!link) {
      link = repo.create({ tenantId: p.tenantId, customerId: p.customerId, stage: p.stage, transitions: {} });
    }
    // 关联引用始终回填（幂等安全）
    if (p.opportunityId != null) link.opportunityId = p.opportunityId;
    if (p.quotationId != null) link.quotationId = p.quotationId;
    if (p.contractId != null) link.contractId = p.contractId;
    if (p.designProjectId != null) link.designProjectId = p.designProjectId;
    if (p.dealerId != null) link.dealerId = p.dealerId;
    if (p.storeId != null) link.storeId = p.storeId;
    // 项目主线唯一键：phone_hash 与客户键一致（幂等只填空）；地址落库并派生 address_normalized。
    if (p.phoneHash != null && !link.phoneHash) link.phoneHash = p.phoneHash;
    if (p.projectAddress != null && p.projectAddress !== '') {
      link.projectAddress = p.projectAddress;
      const norm = normalizeAddress(p.projectAddress);
      if (norm) link.addressNormalized = norm;
    }
    // 记录该态首次进入时间（无论是否前进）
    this.markTransition(link, p.stage);
    // projectState/stage 单调前进：只有 >= 当前态才推进派生投影，避免回退承接态
    const curOrder = lifecycleStateOrder(link.projectState || 'lead-created');
    if (lifecycleStateOrder(p.stage) >= curOrder) {
      link.stage = p.stage;
      const patch: StatePatch = normalizeProjectStatePatch({ state: p.stage });
      this.applyStatePatch(link, patch);
    }
    return repo.save(link);
  }
}
