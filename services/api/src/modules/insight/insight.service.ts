import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { withRlsTransaction } from '../common/rls';
import { writeAudit } from '../common/audit';
import type { JwtPayload } from '../auth/auth.service';
import { InsightCompetitorEntity, InsightSignalEntity } from './insight.entity';

const DIMENSIONS = ['product', 'price', 'channel', 'marketing', 'ai_sov'];

@Injectable()
export class InsightService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}
  private scope(a: JwtPayload) { return { tenantId: a.tenantId, actorId: a.userId, role: a.role }; }

  async recordCompetitor(actor: JwtPayload, dto: { category?: string; competitor?: string; dimension?: string; metric?: string; value?: number; valueText?: string; source?: string }) {
    if (!dto.category || !dto.competitor || !dto.metric) throw new BadRequestException('category, competitor, metric required');
    if (!DIMENSIONS.includes(String(dto.dimension))) throw new BadRequestException('invalid dimension');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(InsightCompetitorEntity);
      const row = await repo.save(repo.create({
        tenantId: actor.tenantId, category: dto.category!, competitor: dto.competitor!, dimension: dto.dimension!,
        metric: dto.metric!, value: dto.value ?? null, valueText: dto.valueText ?? null, source: dto.source ?? null,
      }));
      await writeAudit(em, { tenantId: actor.tenantId, actorUserId: actor.userId, action: 'insight.competitor.record', resourceType: 'insight_competitor', resourceId: row.id, afterState: { category: dto.category, competitor: dto.competitor, dimension: dto.dimension, metric: dto.metric } });
      return { record: row };
    }, this.scope(actor));
  }

  // 按品类列竞品情报（基座2：品类为轴）
  async listByCategory(actor: JwtPayload, category: string, dimension?: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const where: Record<string, unknown> = { tenantId: actor.tenantId, category };
      if (dimension) where.dimension = dimension;
      const rows = await em.getRepository(InsightCompetitorEntity).find({ where, order: { capturedAt: 'DESC' }, take: 200 });
      return { category, records: rows };
    }, this.scope(actor));
  }

  // AI 声量份额（按品类汇总各竞品 ai_sov 最新值）
  async sovByCategory(actor: JwtPayload, category: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const rows: Array<{ competitor: string; value: number }> = await em.query(
        `SELECT DISTINCT ON (competitor) competitor, value
           FROM rhautt_nexus.insight_competitor
          WHERE tenant_id = $1 AND category = $2 AND dimension = 'ai_sov'
          ORDER BY competitor, captured_at DESC`,
        [actor.tenantId, category],
      ).catch(() => []);
      const total = rows.reduce((s, r) => s + (Number(r.value) || 0), 0) || 1;
      return { category, shareOfVoice: rows.map((r) => ({ competitor: r.competitor, value: Number(r.value) || 0, share: (Number(r.value) || 0) / total })) };
    }, this.scope(actor));
  }

  async recordSignal(actor: JwtPayload, dto: { category?: string; signalType?: string; title?: string; summary?: string; source?: string; severity?: string }) {
    if (!dto.title || !['macro', 'industry', 'trend', 'ai_cognition'].includes(String(dto.signalType))) throw new BadRequestException('title and valid signalType required');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(InsightSignalEntity);
      const row = await repo.save(repo.create({
        tenantId: actor.tenantId, category: dto.category ?? null, signalType: dto.signalType!, title: dto.title!,
        summary: dto.summary ?? null, source: dto.source ?? null, severity: dto.severity ?? 'info',
      }));
      await writeAudit(em, { tenantId: actor.tenantId, actorUserId: actor.userId, action: 'insight.signal.record', resourceType: 'insight_signal', resourceId: row.id, afterState: { signalType: dto.signalType, title: dto.title, severity: dto.severity ?? 'info' } });
      return { signal: row };
    }, this.scope(actor));
  }

  async listSignals(actor: JwtPayload, q: { category?: string; signalType?: string } = {}) {
    return withRlsTransaction(this.ds, async (em) => {
      const where: Record<string, unknown> = { tenantId: actor.tenantId };
      if (q.category) where.category = q.category;
      if (q.signalType) where.signalType = q.signalType;
      return { signals: await em.getRepository(InsightSignalEntity).find({ where, order: { capturedAt: 'DESC' }, take: 100 }) };
    }, this.scope(actor));
  }
}
