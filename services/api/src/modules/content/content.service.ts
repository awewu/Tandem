import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { withRlsTransaction } from '../common/rls';
import { writeAudit } from '../common/audit';
import type { JwtPayload } from '../auth/auth.service';
import { ContentAssetEntity } from './content.entity';

@Injectable()
export class ContentService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}
  private scope(a: JwtPayload) { return { tenantId: a.tenantId, actorId: a.userId, role: a.role }; }

  async create(actor: JwtPayload, dto: { title?: string; kind?: string; brandCode?: string; category?: string; body?: string; channel?: string; factRefs?: any[] }) {
    if (!dto.title) throw new BadRequestException('title required');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ContentAssetEntity);
      const row = await repo.save(repo.create({
        tenantId: actor.tenantId, title: dto.title!, kind: dto.kind ?? 'article', brandCode: dto.brandCode ?? null,
        category: dto.category ?? null, body: dto.body ?? null, channel: dto.channel ?? null,
        factRefs: (dto.factRefs ?? []) as any, status: 'draft', author: actor.userId,
      }));
      return { content: row };
    }, this.scope(actor));
  }

  async update(actor: JwtPayload, id: string, patch: { title?: string; body?: string; channel?: string; factRefs?: any[] }) {
    return withRlsTransaction(this.ds, async (em) => {
      const upd: any = { updatedAt: new Date() };
      for (const k of ['title', 'body', 'channel'] as const) if (patch[k] != null) upd[k] = patch[k];
      if (patch.factRefs) upd.factRefs = patch.factRefs;
      await em.getRepository(ContentAssetEntity).update({ id, tenantId: actor.tenantId }, upd);
      return { id, updated: true };
    }, this.scope(actor));
  }

  async submitReview(actor: JwtPayload, id: string) {
    return this.transition(actor, id, 'in_review');
  }

  async decide(actor: JwtPayload, id: string, decision: 'approved' | 'rejected', reviewer?: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ContentAssetEntity);
      const c = await repo.findOne({ where: { id, tenantId: actor.tenantId } });
      if (!c) throw new NotFoundException('content not found');
      await repo.update({ id }, { status: decision, reviewer: reviewer ?? actor.userId, updatedAt: new Date() });
      await writeAudit(em, {
        tenantId: actor.tenantId, actorUserId: actor.userId, action: `content.${decision}`,
        resourceType: 'content_asset', resourceId: id, beforeState: { status: c.status }, afterState: { status: decision, title: c.title },
      });
      return { id, status: decision };
    }, this.scope(actor));
  }

  // 基座4：发布前必须有事实源引用 + 已核准。
  async publish(actor: JwtPayload, id: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ContentAssetEntity);
      const c = await repo.findOne({ where: { id, tenantId: actor.tenantId } });
      if (!c) throw new NotFoundException('content not found');
      if (c.status !== 'approved') throw new ForbiddenException('内容须先审核通过才能发布');
      if (!(c.factRefs || []).length) throw new ForbiddenException('无事实源引用不得对外发布（基座4）');
      await repo.update({ id }, { status: 'published', updatedAt: new Date() });
      await writeAudit(em, {
        tenantId: actor.tenantId, actorUserId: actor.userId, action: 'content.publish',
        resourceType: 'content_asset', resourceId: id, afterState: { status: 'published', channel: c.channel, factRefs: (c.factRefs || []).length },
      });
      return { id, status: 'published' };
    }, this.scope(actor));
  }

  private async transition(actor: JwtPayload, id: string, status: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const r = await em.getRepository(ContentAssetEntity).update({ id, tenantId: actor.tenantId }, { status, updatedAt: new Date() });
      if (!r.affected) throw new NotFoundException('content not found');
      return { id, status };
    }, this.scope(actor));
  }

  async list(actor: JwtPayload, q: { status?: string; channel?: string } = {}) {
    return withRlsTransaction(this.ds, async (em) => {
      const where: Record<string, unknown> = { tenantId: actor.tenantId };
      if (q.status) where.status = q.status;
      if (q.channel) where.channel = q.channel;
      return { contents: await em.getRepository(ContentAssetEntity).find({ where, order: { updatedAt: 'DESC' }, take: 100 }) };
    }, this.scope(actor));
  }

  // 审核积压计数（喂 CMO riskAlerts）。
  async reviewBacklog(actor: JwtPayload) {
    return withRlsTransaction(this.ds, async (em) => ({
      inReview: await em.getRepository(ContentAssetEntity).count({ where: { tenantId: actor.tenantId, status: 'in_review' } }),
    }), this.scope(actor));
  }
}
