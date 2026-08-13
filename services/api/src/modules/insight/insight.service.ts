import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { withRlsTransaction } from '../common/rls';
import { writeAudit } from '../common/audit';
import type { JwtPayload } from '../auth/auth.service';
import { InsightCompetitorEntity, InsightSignalEntity } from './insight.entity';
import {
  computeHhi, computeMomentum, scoreThreats, computeLeaderGap,
  type CompetitorHits,
} from './competitive-analytics';

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

  /**
   * 系统态入账：GEO 探测命中竞品 → 自动落 ai_sov 时序数据点（每命中一次记 1）。
   * 由 event-consumers 消费 `geo.competitor.cited` 调用，取代手工台账。
   * 幂等：事件总线 at-least-once，重投递会虚增量级 → 以 (tenant,category,competitor,source)
   * 唯一索引（迁移 090，仅约束 source='geo-probe:*' 的系统态行）+ ON CONFLICT DO NOTHING 去重。
   * source 必须带 probeId 才能唯一标识一次探测；缺失时退化为 'geo-probe'，此时同品类同竞品只记一次。
   */
  async ingestAiSovHit(tenantId: string, dto: { category?: string | null; competitors: string[]; source?: string; isSelf?: boolean }) {
    const category = String(dto.category || '').trim() || 'uncategorized';
    const competitors = [...new Set((dto.competitors || []).map((c) => String(c || '').trim()).filter(Boolean))];
    if (!competitors.length) return { recorded: 0, deduped: 0 };
    const source = dto.source ?? 'geo-probe';
    const isSelf = !!dto.isSelf;
    return withRlsTransaction(this.ds, async (em) => {
      let recorded = 0;
      for (const competitor of competitors) {
        const res = await em.query(
          `INSERT INTO rhautt_nexus.insight_competitor
             (tenant_id, category, competitor, dimension, metric, value, value_text, source, is_self)
           VALUES ($1, $2, $3, 'ai_sov', 'ai_cited', 1, NULL, $4, $5)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [tenantId, category, competitor, source, isSelf],
        );
        if (Array.isArray(res) && res.length) recorded += 1;
      }
      return { recorded, deduped: competitors.length - recorded };
    }, { tenantId, actorId: 'system:event-bus', role: 'system' });
  }

  /**
   * 系统态入账：GEO 探测中**我方**被引 → 与竞品对称落 ai_sov（is_self=true）。
   * 由 event-consumers 消费 `geo.brand.cited` 调用。
   * 为什么必须有：只入账竞品时份额是「竞品之间的份额」，我方缺席自己的竞争格局，
   * 「与头部差距」无从计算（迁移 091 补 is_self）。幂等同竞品路径。
   */
  async ingestSelfCited(tenantId: string, dto: { category?: string | null; brandSlug?: string | null; source?: string }) {
    const brand = String(dto.brandSlug || '').trim();
    if (!brand) return { recorded: 0, deduped: 0 };
    return this.ingestAiSovHit(tenantId, {
      category: dto.category,
      competitors: [brand],
      source: dto.source,
      isSelf: true,
    });
  }

  /** 取某窗口内 ai_sov 命中聚合（含我方标记）。窗口以「天」为单位向前推。 */
  private async sovWindow(em: any, tenantId: string, category: string, fromDaysAgo: number, toDaysAgo: number): Promise<CompetitorHits[]> {
    const rows: Array<{ competitor: string; is_self: boolean; hits: string }> = await em.query(
      `SELECT competitor, bool_or(is_self) AS is_self, SUM(value) AS hits
         FROM rhautt_nexus.insight_competitor
        WHERE tenant_id = $1 AND category = $2 AND dimension = 'ai_sov' AND metric = 'ai_cited'
          AND captured_at > now() - ($3 || ' days')::interval
          AND captured_at <= now() - ($4 || ' days')::interval
        GROUP BY competitor
        ORDER BY hits DESC`,
      [tenantId, category, String(fromDaysAgo), String(toDaysAgo)],
    ).catch(() => []);
    return rows.map((r) => ({ competitor: r.competitor, isSelf: !!r.is_self, hits: Number(r.hits) || 0 }));
  }

  /**
   * 竞争格局：集中度(HHI) + 动量(本窗口 vs 上一等长窗口) + 头部差距 + 威胁评分。
   * 数据源只用 GEO 探测自动入账的 ai_sov 时序（手工台账无时间序列，做不出趋势）。
   * ⚠️ 诚实边界：无自动数据时如实返回 basis='none' 与空结构，不回落到手工值假装有趋势。
   */
  async landscapeByCategory(actor: JwtPayload, category: string, opts: { windowDays?: number } = {}) {
    const cat = String(category || '').trim();
    if (!cat) throw new BadRequestException('category required');
    const windowDays = Math.min(Math.max(Number(opts.windowDays) || 30, 1), 180);
    return withRlsTransaction(this.ds, async (em) => {
      const current = await this.sovWindow(em, actor.tenantId, cat, windowDays, 0);
      const previous = await this.sovWindow(em, actor.tenantId, cat, windowDays * 2, windowDays);

      if (!current.length && !previous.length) {
        return {
          category: cat, windowDays, basis: 'none' as const,
          note: '该品类尚无 GEO 探测自动入账的 AI 声量数据；格局分析需要时序数据，手工台账不足以出趋势。',
          universeIncludesSelf: false,
          concentration: null, shareOfVoice: [], momentum: [], threats: [], leaderGap: null,
        };
      }

      const total = current.reduce((s, r) => s + r.hits, 0) || 1;
      const momentum = computeMomentum(current, previous);
      return {
        category: cat,
        windowDays,
        basis: 'geo-probe' as const,
        /** 我方是否在样本内：false 时份额只是「竞品之间的份额」，不可当全量份额读 */
        universeIncludesSelf: current.some((r) => r.isSelf),
        concentration: computeHhi(current),
        shareOfVoice: current.map((r) => ({
          competitor: r.competitor, isSelf: !!r.isSelf, value: r.hits, share: r.hits / total,
        })),
        momentum,
        threats: scoreThreats(current, momentum),
        leaderGap: computeLeaderGap(current),
      };
    }, this.scope(actor));
  }

  /**
   * AI 声量份额。优先用 GEO 探测自动入账的时序计数（窗口内 SUM，真实、可比、有量），
   * 无自动数据时回落到手工录入的最新值（兼容旧口径）。
   */
  async sovByCategory(actor: JwtPayload, category: string, opts: { windowDays?: number } = {}) {
    const windowDays = Math.min(Math.max(Number(opts.windowDays) || 90, 1), 365);
    return withRlsTransaction(this.ds, async (em) => {
      // 自动口径：窗口内被引次数聚合
      const auto: Array<{ competitor: string; hits: string }> = await em.query(
        `SELECT competitor, SUM(value) AS hits
           FROM rhautt_nexus.insight_competitor
          WHERE tenant_id = $1 AND category = $2 AND dimension = 'ai_sov' AND metric = 'ai_cited'
            AND captured_at > now() - ($3 || ' days')::interval
          GROUP BY competitor
          ORDER BY hits DESC`,
        [actor.tenantId, category, String(windowDays)],
      ).catch(() => []);

      if (auto.length) {
        const rows = auto.map((r) => ({ competitor: r.competitor, value: Number(r.hits) || 0 }));
        const total = rows.reduce((s, r) => s + r.value, 0) || 1;
        return {
          category,
          basis: 'geo-probe' as const,
          windowDays,
          shareOfVoice: rows.map((r) => ({ competitor: r.competitor, value: r.value, share: r.value / total })),
        };
      }

      // 手工口径：取每竞品最新值（旧行为，兼容）
      const rows: Array<{ competitor: string; value: number }> = await em.query(
        `SELECT DISTINCT ON (competitor) competitor, value
           FROM rhautt_nexus.insight_competitor
          WHERE tenant_id = $1 AND category = $2 AND dimension = 'ai_sov'
          ORDER BY competitor, captured_at DESC`,
        [actor.tenantId, category],
      ).catch(() => []);
      const total = rows.reduce((s, r) => s + (Number(r.value) || 0), 0) || 1;
      return {
        category,
        basis: 'manual' as const,
        windowDays: null,
        shareOfVoice: rows.map((r) => ({ competitor: r.competitor, value: Number(r.value) || 0, share: (Number(r.value) || 0) / total })),
      };
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
