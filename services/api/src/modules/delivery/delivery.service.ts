import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  DeliveryProjectEntity,
  DeliveryMilestoneEntity,
  DeliveryPaymentEntity,
  DeliveryEvidenceEntity,
  ServiceTicketEntity,
  WarrantyEntity,
  LifecycleLinkEntity,
} from './delivery.entity';
import { withRlsTransaction } from '../common/rls';
import { TenantScope } from '../common/tenant-context';
import { JwtPayload } from '../auth/auth.service';

const DEFAULT_MILESTONES = [
  { key: 'enter', label: '进场', seq: 1, requiresEvidence: false, requiresAcceptance: false, unlocksPaymentKey: 'deposit' },
  { key: 'concealed', label: '隐蔽工程', seq: 2, requiresEvidence: true, requiresAcceptance: true, unlocksPaymentKey: null },
  { key: 'main-material', label: '主材安装', seq: 3, requiresEvidence: false, requiresAcceptance: false, unlocksPaymentKey: 'progress' },
  { key: 'commissioning', label: '调试', seq: 4, requiresEvidence: false, requiresAcceptance: true, unlocksPaymentKey: null },
  { key: 'finishing', label: '收尾', seq: 5, requiresEvidence: true, requiresAcceptance: true, unlocksPaymentKey: 'final' },
];

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger('Delivery');

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async listProjects(user: JwtPayload, query?: { status?: string }) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(DeliveryProjectEntity);
      const qb = repo.createQueryBuilder('p').where('p.tenant_id = :tid', { tid: user.tenantId });
      if (query?.status && query.status !== 'all') qb.andWhere('p.status = :status', { status: query.status });
      qb.orderBy('p.updatedAt', 'DESC').limit(100);
      return qb.getMany();
    }, this.scopeOf(user));
  }

  async getProject(user: JwtPayload, projectId: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const proj = await em.getRepository(DeliveryProjectEntity).findOne({ where: { id: projectId } });
      if (!proj) throw new NotFoundException('delivery project not found');
      return proj;
    }, this.scopeOf(user));
  }

  async createProject(user: JwtPayload, body: { contractId: string; customerId: string; quotationId?: string; totalAmount?: number }) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(DeliveryProjectEntity);
      const project = repo.create({
        tenantId: user.tenantId,
        dealerId: user.dealerId ?? null,
        storeId: user.storeId ?? null,
        contractId: body.contractId,
        customerId: body.customerId,
        quotationId: body.quotationId ?? null,
        status: 'scheduled',
        totalAmount: body.totalAmount ?? 0,
      });
      const saved = await repo.save(project);

      const msRepo = em.getRepository(DeliveryMilestoneEntity);
      const payRepo = em.getRepository(DeliveryPaymentEntity);

      for (const ms of DEFAULT_MILESTONES) {
        await msRepo.save(msRepo.create({
          tenantId: user.tenantId,
          projectId: saved.id,
          key: ms.key,
          label: ms.label,
          seq: ms.seq,
          status: 'pending',
          requiresEvidence: ms.requiresEvidence,
          requiresAcceptance: ms.requiresAcceptance,
          unlocksPaymentKey: ms.unlocksPaymentKey,
        }));
      }

      for (const kind of ['deposit', 'progress', 'final'] as const) {
        await payRepo.save(payRepo.create({
          tenantId: user.tenantId,
          projectId: saved.id,
          kind,
          amount: 0,
          status: 'locked',
        }));
      }

      return saved;
    }, this.scopeOf(user));
  }

  async getMilestones(user: JwtPayload, projectId: string) {
    return withRlsTransaction(this.ds, async (em) => {
      return em.getRepository(DeliveryMilestoneEntity).find({
        where: { projectId },
        order: { seq: 'ASC' },
      });
    }, this.scopeOf(user));
  }

  async advanceMilestone(user: JwtPayload, projectId: string, milestoneKey: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const msRepo = em.getRepository(DeliveryMilestoneEntity);
      const ms = await msRepo.findOne({ where: { projectId, key: milestoneKey } });
      if (!ms) throw new NotFoundException('milestone not found');

      if (ms.requiresEvidence) {
        const evidence = await em.getRepository(DeliveryEvidenceEntity).find({ where: { projectId, milestoneKey } });
        if (evidence.length === 0) throw new Error('milestone requires evidence before advancing');
      }

      ms.status = 'completed';
      ms.completedAt = new Date();
      await msRepo.save(ms);

      if (ms.unlocksPaymentKey) {
        const payRepo = em.getRepository(DeliveryPaymentEntity);
        const payment = await payRepo.findOne({ where: { projectId, kind: ms.unlocksPaymentKey as any } });
        if (payment && payment.status === 'locked') {
          payment.status = 'payable';
          await payRepo.save(payment);
        }
      }

      const next = await msRepo.findOne({ where: { projectId, seq: ms.seq + 1 } });
      if (next) {
        next.status = 'in-progress';
        next.startedAt = new Date();
        await msRepo.save(next);
      }

      const allMilestones = await msRepo.find({ where: { projectId }, order: { seq: 'ASC' } });
      const allCompleted = allMilestones.every((m) => m.status === 'completed');
      if (allCompleted) {
        const projRepo = em.getRepository(DeliveryProjectEntity);
        const proj = await projRepo.findOne({ where: { id: projectId } });
        if (proj) {
          proj.status = 'delivered';
          proj.currentMilestoneKey = null;
          await projRepo.save(proj);
        }
      } else {
        const projRepo = em.getRepository(DeliveryProjectEntity);
        const proj = await projRepo.findOne({ where: { id: projectId } });
        if (proj) {
          proj.status = 'in-progress';
          proj.currentMilestoneKey = next?.key ?? milestoneKey;
          await projRepo.save(proj);
        }
      }

      return ms;
    }, this.scopeOf(user));
  }

  async getPayments(user: JwtPayload, projectId: string) {
    return withRlsTransaction(this.ds, async (em) => {
      return em.getRepository(DeliveryPaymentEntity).find({ where: { projectId } });
    }, this.scopeOf(user));
  }

  async recordPayment(user: JwtPayload, projectId: string, paymentId: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(DeliveryPaymentEntity);
      const payment = await repo.findOne({ where: { id: paymentId, projectId } });
      if (!payment) throw new NotFoundException('payment not found');
      if (payment.status !== 'payable') throw new Error('payment is not payable yet');
      payment.status = 'paid';
      payment.paidAt = new Date();
      return repo.save(payment);
    }, this.scopeOf(user));
  }

  async uploadEvidence(user: JwtPayload, projectId: string, body: { milestoneKey: string; fileKey?: string; fileUrl?: string; meta?: Record<string, unknown> }) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(DeliveryEvidenceEntity);
      const evidence = repo.create({
        tenantId: user.tenantId,
        projectId,
        milestoneKey: body.milestoneKey,
        fileKey: body.fileKey ?? null,
        fileUrl: body.fileUrl ?? null,
        meta: body.meta ?? {},
        uploadedBy: user.userId,
      });
      return repo.save(evidence);
    }, this.scopeOf(user));
  }

  async listEvidence(user: JwtPayload, projectId: string) {
    return withRlsTransaction(this.ds, async (em) => {
      return em.getRepository(DeliveryEvidenceEntity).find({ where: { projectId } });
    }, this.scopeOf(user));
  }

  async listTickets(user: JwtPayload, query?: { status?: string; category?: string }) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ServiceTicketEntity);
      const qb = repo.createQueryBuilder('t').where('t.tenant_id = :tid', { tid: user.tenantId });
      if (query?.status) qb.andWhere('t.status = :status', { status: query.status });
      if (query?.category) qb.andWhere('t.category = :cat', { cat: query.category });
      qb.orderBy('t.updatedAt', 'DESC').limit(100);
      return qb.getMany();
    }, this.scopeOf(user));
  }

  async createTicket(user: JwtPayload, body: { title: string; category?: string; priority?: string; customerId?: string; customerName?: string; phone?: string; description?: string; bimProjectId?: string }) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ServiceTicketEntity);
      const ticketNo = `TK-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const ticket = repo.create({
        tenantId: user.tenantId,
        dealerId: user.dealerId ?? null,
        storeId: user.storeId ?? null,
        ticketNo,
        customerId: body.customerId ?? null,
        customerName: body.customerName ?? null,
        phone: body.phone ?? null,
        bimProjectId: body.bimProjectId ?? null,
        title: body.title,
        category: body.category ?? 'repair',
        priority: body.priority ?? 'normal',
        description: body.description ?? '',
        status: 'open',
      });
      return repo.save(ticket);
    }, this.scopeOf(user));
  }

  async updateTicket(user: JwtPayload, ticketId: string, patch: Partial<ServiceTicketEntity>) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ServiceTicketEntity);
      const existing = await repo.findOne({ where: { id: ticketId } });
      if (!existing) throw new NotFoundException('ticket not found');
      Object.assign(existing, patch);
      if (patch.status === 'resolved' || patch.status === 'closed') {
        existing.resolvedAt = new Date();
      }
      return repo.save(existing);
    }, this.scopeOf(user));
  }

  async listWarranties(user: JwtPayload, query?: { status?: string }) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(WarrantyEntity);
      const qb = repo.createQueryBuilder('w').where('w.tenant_id = :tid', { tid: user.tenantId });
      if (query?.status) qb.andWhere('w.status = :status', { status: query.status });
      qb.orderBy('w.updatedAt', 'DESC').limit(100);
      return qb.getMany();
    }, this.scopeOf(user));
  }

  async createWarranty(user: JwtPayload, body: { warrantyNo: string; customerId?: string; customerName?: string; productName?: string; systemFamily?: string; startDate: string; endDate: string; bimProjectId?: string; terms?: Record<string, unknown> }) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(WarrantyEntity);
      const warranty = repo.create({
        tenantId: user.tenantId,
        dealerId: user.dealerId ?? null,
        storeId: user.storeId ?? null,
        warrantyNo: body.warrantyNo,
        customerId: body.customerId ?? null,
        customerName: body.customerName ?? null,
        bimProjectId: body.bimProjectId ?? null,
        productName: body.productName ?? null,
        systemFamily: body.systemFamily ?? null,
        startDate: body.startDate,
        endDate: body.endDate,
        status: 'active',
        terms: body.terms ?? {},
      });
      return repo.save(warranty);
    }, this.scopeOf(user));
  }

  async getLifecycleLink(user: JwtPayload, customerId: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const link = await em.getRepository(LifecycleLinkEntity).findOne({
        where: { customerId },
        order: { updatedAt: 'DESC' },
      });
      return link;
    }, this.scopeOf(user));
  }

  async upsertLifecycleLink(user: JwtPayload, body: { customerId: string; opportunityId?: string; quotationId?: string; contractId?: string; designProjectId?: string; stage?: string }) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(LifecycleLinkEntity);
      const existing = await repo.findOne({ where: { customerId: body.customerId }, order: { updatedAt: 'DESC' } });
      if (existing) {
        Object.assign(existing, body);
        return repo.save(existing);
      }
      const link = repo.create({
        tenantId: user.tenantId,
        customerId: body.customerId,
        opportunityId: body.opportunityId ?? null,
        quotationId: body.quotationId ?? null,
        contractId: body.contractId ?? null,
        designProjectId: body.designProjectId ?? null,
        stage: body.stage ?? 'lead',
      });
      return repo.save(link);
    }, this.scopeOf(user));
  }

  private scopeOf(user: JwtPayload): TenantScope {
    return { tenantId: user.tenantId, actorId: user.userId };
  }
}
