import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ServiceTicketEntity, WarrantyEntity } from './aftersales.entity';
import { LifecycleLinkEntity } from '../lifecycle/lifecycle.entity';
import { JwtPayload } from '../auth/auth.service';
import { withRlsTransaction } from '../common/rls';
import { TenantScope } from '../common/tenant-context';
import { ownershipScope } from '../common/scope';

const TICKET_STATUSES = ['open', 'assigned', 'in-progress', 'resolved', 'closed'];
// 兼容前端中文状态 → 规范英文状态。
const STATUS_ALIAS: Record<string, string> = {
  待处理: 'open', 已派工: 'assigned', 处理中: 'in-progress', 已解决: 'resolved', 已完成: 'closed', 已关闭: 'closed',
};

@Injectable()
export class AftersalesService {
  private readonly logger = new Logger(AftersalesService.name);
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private scope(user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException('缺少租户上下文');
    return user.tenantId;
  }
  private rls(user: JwtPayload): TenantScope {
    return { tenantId: this.scope(user), actorId: user.userId, role: user.role };
  }
  private normalizeStatus(s?: string): string {
    if (!s) return 'open';
    const v = STATUS_ALIAS[s] || s;
    if (!TICKET_STATUSES.includes(v)) throw new BadRequestException(`非法工单状态：${s}`);
    return v;
  }
  private nextNo(prefix: string, tenantId: string) {
    return `${prefix}-${String(tenantId).slice(-6).toUpperCase()}-${Date.now()}`;
  }

  // ── 工单 ──────────────────────────────────────────────────────────────────
  listTickets(user: JwtPayload, query: Record<string, string> = {}) {
    return withRlsTransaction(this.ds, (em) => {
      const qb = em.getRepository(ServiceTicketEntity).createQueryBuilder('t')
        .where('t.tenantId = :t', { t: this.scope(user) });
      if (user.storeId) qb.andWhere('t.storeId = :s', { s: user.storeId });
      else if (user.dealerId) qb.andWhere('t.dealerId = :d', { d: user.dealerId });
      if (query.status) qb.andWhere('t.status = :st', { st: this.normalizeStatus(query.status) });
      if (query.customerId) qb.andWhere('t.customerId = :c', { c: query.customerId });
      return qb.orderBy('t.createdAt', 'DESC')
        .limit(Math.min(Number(query.limit || 50), 200))
        .getManyAndCount()
        .then(([items, total]) => ({ items, total }));
    }, this.rls(user));
  }

  async createTicket(user: JwtPayload, dto: {
    title?: string; description?: string; category?: string; priority?: string;
    customerId?: string; customerName?: string; phone?: string; bimProjectId?: string;
    slaDueAt?: string; meta?: Record<string, unknown>;
  }) {
    if (!dto.title) throw new BadRequestException('title required');
    const tenantId = this.scope(user);
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ServiceTicketEntity);
      // P3: 从 lifecycle_links 查 project_id（按 bimProjectId 定位）
      const link = dto.bimProjectId
        ? await em.getRepository(LifecycleLinkEntity).findOne({ where: { tenantId, bimProjectId: dto.bimProjectId } })
        : null;
      const ticket = await repo.save(repo.create({
        tenantId,
        dealerId: user.dealerId ?? null,
        storeId: user.storeId ?? null,
        ticketNo: this.nextNo('T', tenantId),
        customerId: dto.customerId ?? null,
        customerName: dto.customerName ?? null,
        phone: dto.phone ?? null,
        bimProjectId: dto.bimProjectId ?? null,
        projectId: link?.id ?? null,
        category: dto.category ?? 'repair',
        priority: dto.priority ?? 'normal',
        title: dto.title,
        description: dto.description ?? '',
        status: 'open',
        slaDueAt: dto.slaDueAt ? new Date(dto.slaDueAt) : null,
        meta: dto.meta ?? {},
      }));
      this.logger.log(`[ticket.create] tenant=${tenantId} no=${ticket.ticketNo}`);
      return ticket;
    }, this.rls(user));
  }

  async assignTicket(user: JwtPayload, id: string, assignedTo: string) {
    if (!assignedTo) throw new BadRequestException('assignedTo required');
    return this.mutateTicket(user, id, (t) => {
      t.assignedTo = assignedTo;
      if (t.status === 'open') t.status = 'assigned';
    });
  }

  async updateStatus(user: JwtPayload, id: string, status: string) {
    const normalized = this.normalizeStatus(status);
    return this.mutateTicket(user, id, (t) => {
      t.status = normalized;
      if (normalized === 'resolved' || normalized === 'closed') t.resolvedAt = t.resolvedAt ?? new Date();
    });
  }

  async closeTicket(user: JwtPayload, id: string, resolution: string) {
    return this.mutateTicket(user, id, (t) => {
      t.status = 'closed';
      t.resolution = resolution ?? t.resolution ?? '';
      t.resolvedAt = t.resolvedAt ?? new Date();
    });
  }

  private async mutateTicket(user: JwtPayload, id: string, apply: (t: ServiceTicketEntity) => void) {
    const tenantId = this.scope(user);
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ServiceTicketEntity);
      // 归属过滤防同租户跨经销商越权
      const ticket = await repo.findOneBy({ id, tenantId, ...ownershipScope(user, { hasStore: true }) });
      if (!ticket) throw new NotFoundException('工单不存在');
      apply(ticket);
      return repo.save(ticket);
    }, this.rls(user));
  }

  // ── 保修台账 ──────────────────────────────────────────────────────────────
  listWarranties(user: JwtPayload, query: Record<string, string> = {}) {
    const today = new Date().toISOString().slice(0, 10);
    return withRlsTransaction(this.ds, async (em) => {
      const qb = em.getRepository(WarrantyEntity).createQueryBuilder('w')
        .where('w.tenantId = :t', { t: this.scope(user) });
      if (user.storeId) qb.andWhere('w.storeId = :s', { s: user.storeId });
      else if (user.dealerId) qb.andWhere('w.dealerId = :d', { d: user.dealerId });
      if (query.customerId) qb.andWhere('w.customerId = :c', { c: query.customerId });
      const rows = await qb.orderBy('w.endDate', 'DESC').limit(Math.min(Number(query.limit || 100), 500)).getMany();
      // 到期状态派生：end_date < today 且未作废 → expired
      const items = rows.map((w) => ({
        ...w,
        status: w.status === 'void' ? 'void' : (w.endDate < today ? 'expired' : 'active'),
      }));
      return { items, total: items.length };
    }, this.rls(user));
  }

  async createWarranty(user: JwtPayload, dto: {
    startDate?: string; endDate?: string; productName?: string; systemFamily?: string;
    customerId?: string; customerName?: string; bimProjectId?: string; terms?: Record<string, unknown>;
  }) {
    if (!dto.startDate || !dto.endDate) throw new BadRequestException('startDate and endDate required');
    const tenantId = this.scope(user);
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(WarrantyEntity);
      // P3: 从 lifecycle_links 查 project_id（按 bimProjectId 定位）
      const link = dto.bimProjectId
        ? await em.getRepository(LifecycleLinkEntity).findOne({ where: { tenantId, bimProjectId: dto.bimProjectId } })
        : null;
      return repo.save(repo.create({
        tenantId,
        dealerId: user.dealerId ?? null,
        storeId: user.storeId ?? null,
        warrantyNo: this.nextNo('W', tenantId),
        customerId: dto.customerId ?? null,
        customerName: dto.customerName ?? null,
        bimProjectId: dto.bimProjectId ?? null,
        projectId: link?.id ?? null,
        productName: dto.productName ?? null,
        systemFamily: dto.systemFamily ?? null,
        startDate: dto.startDate,
        endDate: dto.endDate,
        status: 'active',
        terms: dto.terms ?? {},
      }));
    }, this.rls(user));
  }
}
