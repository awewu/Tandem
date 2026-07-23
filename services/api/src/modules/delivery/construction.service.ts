import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import {
  DeliveryProjectEntity, DeliveryMilestoneEntity, DeliveryPaymentEntity, DeliveryEvidenceEntity,
} from './construction.entity';
import { ContractEntity } from './delivery.entity';
import { LifecycleLinkEntity } from '../lifecycle/lifecycle.entity';
import { JwtPayload } from '../auth/auth.service';
import { EventBusService } from '../mdm/event-bus.service';
import { withRlsTransaction } from '../common/rls';
import { TenantScope } from '../common/tenant-context';
import { ownershipScope } from '../common/scope';

/** 施工里程碑模板（进场→隐蔽→主材→调试→收尾）。隐蔽/收尾强制留证 + 验收签认。 */
interface MilestoneDef {
  key: string; label: string; requiresEvidence: boolean; requiresAcceptance: boolean; unlocksPaymentKey: string | null;
}
export const MILESTONE_TEMPLATE: MilestoneDef[] = [
  { key: 'enter',         label: '进场准备', requiresEvidence: false, requiresAcceptance: false, unlocksPaymentKey: null },
  { key: 'concealed',     label: '隐蔽工程', requiresEvidence: true,  requiresAcceptance: true,  unlocksPaymentKey: null },
  { key: 'main-material', label: '主材安装', requiresEvidence: false, requiresAcceptance: false, unlocksPaymentKey: 'progress' },
  { key: 'commissioning', label: '系统调试', requiresEvidence: false, requiresAcceptance: false, unlocksPaymentKey: null },
  { key: 'finishing',     label: '收尾验收', requiresEvidence: true,  requiresAcceptance: true,  unlocksPaymentKey: 'final' },
];

/** 进度款默认三段拆分（定金/进度款/尾款）。定金立即可收；其余由节点解锁。 */
const DEFAULT_PAYMENT_PLAN: { kind: string; fraction: number; unlockedByMilestoneKey: string | null }[] = [
  { kind: 'deposit',  fraction: 0.30, unlockedByMilestoneKey: null },
  { kind: 'progress', fraction: 0.40, unlockedByMilestoneKey: 'main-material' },
  { kind: 'final',    fraction: 0.30, unlockedByMilestoneKey: 'finishing' },
];

/**
 * 施工交付过程管控（原生，替 Legacy technicalDelivery 壳）。
 * 里程碑逐节点推进 + 隐蔽工程强制留证闸 + 进度款节点解锁（防误触发收款）。
 * 全程 withRlsTransaction 绑定租户会话，PostgreSQL RLS 数据库层强隔离。
 */
@Injectable()
export class ConstructionService {
  private readonly logger = new Logger(ConstructionService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly eventBus: EventBusService,
  ) {}

  /** 合同生效 → 派生施工项目（同合同幂等）。装配里程碑模板 + 进度款计划。 */
  async createProjectForContract(user: JwtPayload, dto: { contractId: string; paymentPlan?: { kind: string; fraction: number }[] }) {
    const tenantId = this.scope(user);
    if (!dto || typeof dto !== 'object' || Array.isArray(dto)) throw new BadRequestException('请求体必须是对象');
    if (!dto.contractId || typeof dto.contractId !== 'string') throw new BadRequestException('contractId 必填且必须是字符串');
    if (dto.paymentPlan !== undefined && !Array.isArray(dto.paymentPlan)) throw new BadRequestException('paymentPlan 必须是数组');

    return withRlsTransaction(this.ds, async (em) => {
      const contract = await em.getRepository(ContractEntity)
        .findOneBy({ id: dto.contractId, tenantId, ...ownershipScope(user) });
      if (!contract) throw new NotFoundException('合同不存在');
      if (!['signed', 'active', 'fulfilled'].includes(contract.status)) {
        throw new BadRequestException(`合同处于 ${contract.status}，需签署/生效后方可开工`);
      }

      const projects = em.getRepository(DeliveryProjectEntity);
      const existing = await projects.findOneBy({ tenantId, contractId: contract.id });
      if (existing) return this.assembleView(em, tenantId, existing, false);

      const total = Number(contract.totalAmount) || 0;
      // P3: 从 lifecycle_links 查 project_id（按 contractId 定位）
      const link = await em.getRepository(LifecycleLinkEntity)
        .findOne({ where: { tenantId, contractId: contract.id } });
      const project = await projects.save(projects.create({
        tenantId, dealerId: contract.dealerId ?? user.dealerId ?? null, storeId: user.storeId ?? null,
        contractId: contract.id, customerId: contract.customerId, quotationId: contract.quotationId ?? null,
        projectId: link?.id ?? null,
        status: 'scheduled', currentMilestoneKey: MILESTONE_TEMPLATE[0].key, totalAmount: total, meta: {},
      }));

      const msRepo = em.getRepository(DeliveryMilestoneEntity);
      await msRepo.save(MILESTONE_TEMPLATE.map((m, i) => msRepo.create({
        tenantId, projectId: project.id, key: m.key, label: m.label, seq: i + 1, status: 'pending',
        requiresEvidence: m.requiresEvidence, requiresAcceptance: m.requiresAcceptance, unlocksPaymentKey: m.unlocksPaymentKey,
      })));

      const payRepo = em.getRepository(DeliveryPaymentEntity);
      await payRepo.save(DEFAULT_PAYMENT_PLAN.map((p) => payRepo.create({
        tenantId, projectId: project.id, kind: p.kind, amount: this.round(total * p.fraction),
        status: p.unlockedByMilestoneKey ? 'locked' : 'payable', unlockedByMilestoneKey: p.unlockedByMilestoneKey,
      })));

      await this.eventBus.publishInTx(em, {
        tenantId, eventType: 'delivery.project.created', aggregateType: 'delivery_project', aggregateId: project.id,
        payload: { projectId: project.id, contractId: contract.id, customerId: contract.customerId, totalAmount: total },
      });
      this.logger.log(`delivery.project.created project=${project.id} contract=${contract.id} tenant=${tenantId}`);
      return this.assembleView(em, tenantId, project, true);
    }, this.rls(user));
  }

  listProjects(user: JwtPayload, query: Record<string, string> = {}) {
    const tenantId = this.scope(user);
    return withRlsTransaction(this.ds, (em) => {
      const qb = em.getRepository(DeliveryProjectEntity).createQueryBuilder('p').where('p.tenantId = :t', { t: tenantId });
      if (user.storeId)      qb.andWhere('p.storeId = :s',  { s: user.storeId });
      else if (user.dealerId) qb.andWhere('p.dealerId = :d', { d: user.dealerId });
      if (query.status)      qb.andWhere('p.status = :st', { st: query.status });
      if (query.customerId)  qb.andWhere('p.customerId = :c', { c: query.customerId });
      return qb.orderBy('p.updatedAt', 'DESC').limit(100).getMany().then((items) => ({ items }));
    }, this.rls(user));
  }

  getProject(user: JwtPayload, id: string) {
    const tenantId = this.scope(user);
    return withRlsTransaction(this.ds, async (em) => {
      const project = await this.loadProject(em, user, id);
      return this.assembleView(em, tenantId, project, false);
    }, this.rls(user));
  }

  /** 开始节点：pending→in-progress。必须是当前应做节点（前序全部完成）。 */
  async startMilestone(user: JwtPayload, projectId: string, key: string) {
    const tenantId = this.scope(user);
    return withRlsTransaction(this.ds, async (em) => {
      const project = await this.loadProject(em, user, projectId);
      const msRepo = em.getRepository(DeliveryMilestoneEntity);
      const milestones = await msRepo.find({ where: { tenantId, projectId }, order: { seq: 'ASC' } });
      const target = milestones.find((m) => m.key === key);
      if (!target) throw new NotFoundException('里程碑不存在');
      if (target.status === 'completed') throw new BadRequestException('该节点已完成');
      const priorIncomplete = milestones.find((m) => m.seq < target.seq && m.status !== 'completed');
      if (priorIncomplete) throw new BadRequestException(`需先完成前序节点「${priorIncomplete.label}」`);

      await msRepo.update({ id: target.id, tenantId }, { status: 'in-progress', startedAt: new Date() });
      await em.getRepository(DeliveryProjectEntity).update(
        { id: projectId, tenantId }, { status: 'in-progress', currentMilestoneKey: target.key },
      );
      return this.assembleView(em, tenantId, project, false);
    }, this.rls(user));
  }

  /** 完成节点：in-progress→completed。隐蔽/验收节点强制留证闸；完成后解锁对应款项。 */
  async completeMilestone(user: JwtPayload, projectId: string, key: string) {
    const tenantId = this.scope(user);
    return withRlsTransaction(this.ds, async (em) => {
      const project = await this.loadProject(em, user, projectId);
      const msRepo = em.getRepository(DeliveryMilestoneEntity);
      const milestones = await msRepo.find({ where: { tenantId, projectId }, order: { seq: 'ASC' } });
      const target = milestones.find((m) => m.key === key);
      if (!target) throw new NotFoundException('里程碑不存在');
      if (target.status === 'completed') return this.assembleView(em, tenantId, project, false); // 幂等

      // 留证闸：隐蔽工程必须有影像；验收节点必须有电子签
      if (target.requiresEvidence || target.requiresAcceptance) {
        const evi = await em.getRepository(DeliveryEvidenceEntity).find({ where: { tenantId, milestoneId: target.id } });
        if (target.requiresEvidence && !evi.some((e) => e.type === 'photo')) {
          throw new BadRequestException(`「${target.label}」需影像留证方可完成（隐蔽工程强制）`);
        }
        if (target.requiresAcceptance && !evi.some((e) => e.type === 'esign')) {
          throw new BadRequestException(`「${target.label}」需验收电子签方可完成`);
        }
      }

      await msRepo.update({ id: target.id, tenantId }, { status: 'completed', completedAt: new Date() });

      // 解锁进度款：locked→payable（防误触发——节点没完成收不了）
      if (target.unlocksPaymentKey) {
        const payRepo = em.getRepository(DeliveryPaymentEntity);
        const pay = await payRepo.findOneBy({ tenantId, projectId, kind: target.unlocksPaymentKey });
        if (pay && pay.status === 'locked') {
          await payRepo.update({ id: pay.id, tenantId }, { status: 'payable' });
          await this.eventBus.publishInTx(em, {
            tenantId, eventType: 'delivery.payment.unlocked', aggregateType: 'delivery_project', aggregateId: projectId,
            payload: { projectId, kind: pay.kind, amount: Number(pay.amount), byMilestone: target.key },
          });
        }
      }

      // 项目状态推进：全部完成 → delivered；否则 currentMilestone 指向下一未完成
      const remaining = milestones.filter((m) => m.id !== target.id && m.status !== 'completed').sort((a, b) => a.seq - b.seq);
      const projRepo = em.getRepository(DeliveryProjectEntity);
      if (!remaining.length) {
        await projRepo.update({ id: projectId, tenantId }, { status: 'delivered', currentMilestoneKey: null });
      } else {
        const nextKey = remaining[0].key;
        const projStatus = target.key === 'finishing' ? 'acceptance-pending' : 'in-progress';
        await projRepo.update({ id: projectId, tenantId }, { status: projStatus, currentMilestoneKey: nextKey });
      }

      await this.eventBus.publishInTx(em, {
        tenantId, eventType: 'delivery.milestone.completed', aggregateType: 'delivery_project', aggregateId: projectId,
        payload: { projectId, milestoneKey: target.key, customerId: project.customerId },
      });
      this.logger.log(`delivery.milestone.completed project=${projectId} key=${target.key} tenant=${tenantId}`);
      return this.assembleView(em, tenantId, project, false);
    }, this.rls(user));
  }

  /** 挂验收留证（影像/电子签/文档）到指定节点。 */
  async addEvidence(user: JwtPayload, projectId: string, dto: { milestoneKey: string; type: string; objectKey?: string; note?: string; signerId?: string }) {
    const tenantId = this.scope(user);
    if (!dto.milestoneKey || !dto.type) throw new BadRequestException('milestoneKey and type required');
    if (!['photo', 'esign', 'doc'].includes(dto.type)) throw new BadRequestException('type 非法（photo|esign|doc）');
    return withRlsTransaction(this.ds, async (em) => {
      await this.loadProject(em, user, projectId);
      const milestone = await em.getRepository(DeliveryMilestoneEntity).findOneBy({ tenantId, projectId, key: dto.milestoneKey });
      if (!milestone) throw new NotFoundException('里程碑不存在');
      const eviRepo = em.getRepository(DeliveryEvidenceEntity);
      return eviRepo.save(eviRepo.create({
        tenantId, projectId, milestoneId: milestone.id, type: dto.type,
        objectKey: dto.objectKey ?? null, note: dto.note ?? null,
        signerId: dto.type === 'esign' ? (dto.signerId ?? user.userId ?? null) : (dto.signerId ?? null),
        verifiedAt: dto.type === 'esign' ? new Date() : null,
      }));
    }, this.rls(user));
  }

  /** 收款：仅 payable 可标记已收（locked=节点未完成，拒绝；防误触发）。 */
  async markPaymentPaid(user: JwtPayload, projectId: string, kind: string) {
    const tenantId = this.scope(user);
    return withRlsTransaction(this.ds, async (em) => {
      await this.loadProject(em, user, projectId);
      const payRepo = em.getRepository(DeliveryPaymentEntity);
      const pay = await payRepo.findOneBy({ tenantId, projectId, kind });
      if (!pay) throw new NotFoundException('款项不存在');
      if (pay.status === 'paid') return pay; // 幂等
      if (pay.status !== 'payable') throw new BadRequestException(`款项未解锁（对应施工节点未完成），当前 ${pay.status}`);
      await payRepo.update({ id: pay.id, tenantId }, { status: 'paid', paidAt: new Date() });
      await this.eventBus.publishInTx(em, {
        tenantId, eventType: 'delivery.payment.paid', aggregateType: 'delivery_project', aggregateId: projectId,
        payload: { projectId, kind, amount: Number(pay.amount) },
      });
      return payRepo.findOneByOrFail({ id: pay.id, tenantId });
    }, this.rls(user));
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  private async loadProject(em: EntityManager, user: JwtPayload, id: string): Promise<DeliveryProjectEntity> {
    const project = await em.getRepository(DeliveryProjectEntity)
      .findOneBy({ id, tenantId: this.scope(user), ...ownershipScope(user, { hasStore: true }) });
    if (!project) throw new NotFoundException('施工项目不存在');
    return project;
  }

  private async assembleView(em: EntityManager, tenantId: string, project: DeliveryProjectEntity, created: boolean) {
    // 重新读取项目：start/complete 已在同事务内 update 了 status/currentMilestoneKey，
    // 传入的 project 是更新前实体，直接返回会让响应里的状态/当前节点滞后一拍。
    const [fresh, milestones, payments] = await Promise.all([
      em.getRepository(DeliveryProjectEntity).findOneBy({ id: project.id, tenantId }),
      em.getRepository(DeliveryMilestoneEntity).find({ where: { tenantId, projectId: project.id }, order: { seq: 'ASC' } }),
      em.getRepository(DeliveryPaymentEntity).find({ where: { tenantId, projectId: project.id } }),
    ]);
    return { project: fresh ?? project, milestones, payments, created };
  }

  private round(n: number) { return Math.round(n * 100) / 100; }

  private scope(user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException('缺少租户上下文');
    return user.tenantId;
  }

  private rls(user: JwtPayload): TenantScope {
    return { tenantId: this.scope(user), actorId: user.userId, role: user.role };
  }
}
