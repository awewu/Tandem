import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { withRlsTransaction } from '../common/rls';
import { writeAudit } from '../common/audit';
import type { JwtPayload } from '../auth/auth.service';
import { ActivationActivityEntity, ActivationParticipationEntity } from './activation.entity';

const TYPES = ['coupon', 'groupon', 'flashsale', 'fission', 'referral'];

@Injectable()
export class ActivationService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}
  private scope(a: JwtPayload) { return { tenantId: a.tenantId, actorId: a.userId, role: a.role }; }

  async create(actor: JwtPayload, dto: { type?: string; name?: string; brandCode?: string; category?: string; rules?: Record<string, unknown>; budget?: number; periodStart?: string; periodEnd?: string }) {
    if (!dto.name || !TYPES.includes(String(dto.type))) throw new BadRequestException('name and valid type required');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ActivationActivityEntity);
      const row = await repo.save(repo.create({
        tenantId: actor.tenantId, type: dto.type!, name: dto.name!, brandCode: dto.brandCode ?? null,
        category: dto.category ?? null, rules: dto.rules ?? {}, budget: Number(dto.budget) || 0,
        periodStart: dto.periodStart ?? null, periodEnd: dto.periodEnd ?? null, status: 'draft',
      }));
      await writeAudit(em, { tenantId: actor.tenantId, actorUserId: actor.userId, action: 'activation.create', resourceType: 'activation_activity', resourceId: row.id, afterState: { type: dto.type, name: dto.name, budget: Number(dto.budget) || 0 } });
      return { activity: row };
    }, this.scope(actor));
  }

  async setStatus(actor: JwtPayload, id: string, status: string) {
    if (!['draft', 'running', 'paused', 'ended'].includes(status)) throw new BadRequestException('invalid status');
    return withRlsTransaction(this.ds, async (em) => {
      const r = await em.getRepository(ActivationActivityEntity).update({ id, tenantId: actor.tenantId }, { status, updatedAt: new Date() });
      if (!r.affected) throw new NotFoundException('activity not found');
      await writeAudit(em, { tenantId: actor.tenantId, actorUserId: actor.userId, action: `activation.status.${status}`, resourceType: 'activation_activity', resourceId: id, afterState: { status } });
      return { id, status };
    }, this.scope(actor));
  }

  async list(actor: JwtPayload, q: { type?: string; status?: string } = {}) {
    return withRlsTransaction(this.ds, async (em) => {
      const where: Record<string, unknown> = { tenantId: actor.tenantId };
      if (q.type) where.type = q.type;
      if (q.status) where.status = q.status;
      return { activities: await em.getRepository(ActivationActivityEntity).find({ where, order: { updatedAt: 'DESC' } }) };
    }, this.scope(actor));
  }

  // 参与记录（裂变/转介绍护线索飞轮）：referred_lead 计入线索来源。
  async participate(actor: JwtPayload, dto: { activityId?: string; participantRef?: string; action?: string; referredLead?: boolean }) {
    if (!dto.activityId || !['join', 'share', 'redeem', 'refer'].includes(String(dto.action))) throw new BadRequestException('activityId and valid action required');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ActivationParticipationEntity);
      await repo.save(repo.create({
        tenantId: actor.tenantId, activityId: dto.activityId!, participantRef: dto.participantRef ?? null,
        action: dto.action!, referredLead: !!dto.referredLead,
      }));
      // 汇总回写活动 metrics（去数据库聚合，保持真实）。
      const agg: Array<{ action: string; n: string; leads: string }> = await em.query(
        `SELECT action, COUNT(*) n, COUNT(*) FILTER (WHERE referred_lead) leads
           FROM rhautt_nexus.activation_participation WHERE tenant_id = $1 AND activity_id = $2 GROUP BY action`,
        [actor.tenantId, dto.activityId]).catch(() => []);
      const metrics: Record<string, unknown> = {};
      let totalLeads = 0;
      for (const a of agg) { metrics[a.action] = Number(a.n) || 0; totalLeads += Number(a.leads) || 0; }
      metrics.referredLeads = totalLeads;
      await em.getRepository(ActivationActivityEntity).update({ id: dto.activityId, tenantId: actor.tenantId }, { metrics: metrics as any, updatedAt: new Date() });
      return { recorded: true, metrics };
    }, this.scope(actor));
  }
}
