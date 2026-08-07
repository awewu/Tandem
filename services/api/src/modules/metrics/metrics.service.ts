import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { withRlsTransaction } from '../common/rls';
import type { JwtPayload } from '../auth/auth.service';
import { MetricDailyRollupEntity, MetricChannelAttributionEntity } from './metrics.entity';
import { attributeConversion, type AttributionModel, type Touch } from './attribution';

const MODELS: AttributionModel[] = ['linear', 'position', 'time_decay'];

@Injectable()
export class MetricsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}
  private scope(a: JwtPayload) { return { tenantId: a.tenantId, actorId: a.userId, role: a.role }; }

  // 读模型刷新:从 growth_funnel_event 重算 (日×渠道) 漏斗滚动 → metric_daily_rollup。
  // 在租户绑定事务内跑,RLS 只见本租户事件,写入 WITH CHECK 也绑本租户。
  async refreshDailyRollup(actor: JwtPayload) {
    return withRlsTransaction(this.ds, async (em) => {
      await em.query(
        `INSERT INTO rhautt_nexus.metric_daily_rollup
           (tenant_id, day, channel, reach, lead, visit, proposal, revenue, referral, updated_at)
         SELECT tenant_id, created_at::date AS day, COALESCE(channel,'unknown') AS channel,
                COUNT(*) FILTER (WHERE stage='reach')    AS reach,
                COUNT(*) FILTER (WHERE stage='lead')     AS lead,
                COUNT(*) FILTER (WHERE stage='visit')    AS visit,
                COUNT(*) FILTER (WHERE stage='proposal') AS proposal,
                COUNT(*) FILTER (WHERE stage='revenue')  AS revenue,
                COUNT(*) FILTER (WHERE stage='referral') AS referral,
                now()
           FROM rhautt_nexus.growth_funnel_event
          GROUP BY tenant_id, created_at::date, COALESCE(channel,'unknown')
         ON CONFLICT (tenant_id, day, channel) DO UPDATE
           SET reach=EXCLUDED.reach, lead=EXCLUDED.lead, visit=EXCLUDED.visit,
               proposal=EXCLUDED.proposal, revenue=EXCLUDED.revenue, referral=EXCLUDED.referral,
               updated_at=now()`,
      );
      const [{ n }] = await em.query(`SELECT COUNT(*)::int n FROM rhautt_nexus.metric_daily_rollup`);
      return { refreshed: true, rows: n };
    }, this.scope(actor));
  }

  // 多触点归因刷新:对期内「已签约(revenue)」的 subject 旅程,按模型分配渠道信用。
  async refreshAttribution(actor: JwtPayload, period: string, model: AttributionModel = 'position') {
    if (!period) throw new BadRequestException('period (YYYY-MM) required');
    if (!MODELS.includes(model)) throw new BadRequestException('invalid model');
    return withRlsTransaction(this.ds, async (em) => {
      const converters: Array<{ subject_id: string }> = await em.query(
        `SELECT DISTINCT subject_id FROM rhautt_nexus.growth_funnel_event
          WHERE period = $1 AND stage = 'revenue' AND subject_id IS NOT NULL`, [period]);
      const subjectIds = converters.map((c) => c.subject_id);
      const credit: Record<string, number> = {};
      const touchCount: Record<string, number> = {};
      if (subjectIds.length) {
        const rows: Array<{ subject_id: string; channel: string | null; at: string }> = await em.query(
          `SELECT subject_id, channel, (extract(epoch from created_at)*1000) AS at
             FROM rhautt_nexus.growth_funnel_event
            WHERE subject_id = ANY($1) ORDER BY created_at ASC`, [subjectIds]);
        const bySubject = new Map<string, Touch[]>();
        for (const r of rows) {
          const arr = bySubject.get(r.subject_id) || [];
          arr.push({ channel: r.channel || 'unknown', at: Number(r.at) });
          bySubject.set(r.subject_id, arr);
        }
        for (const touches of bySubject.values()) {
          const conv = attributeConversion(touches, model);
          for (const [ch, w] of Object.entries(conv)) credit[ch] = (credit[ch] || 0) + w;
          for (const t of touches) touchCount[t.channel] = (touchCount[t.channel] || 0) + 1;
        }
      }
      // 先清本期本模型旧结果,再写入(幂等)。
      await em.query(`DELETE FROM rhautt_nexus.metric_channel_attribution WHERE tenant_id = rhautt_nexus.current_tenant_id() AND period = $1 AND model = $2`, [period, model]);
      const repo = em.getRepository(MetricChannelAttributionEntity);
      const channels = Object.keys(credit);
      for (const ch of channels) {
        await repo.save(repo.create({ tenantId: actor.tenantId, period, model, channel: ch, creditedConversions: Number(credit[ch].toFixed(4)), touches: touchCount[ch] || 0 }));
      }
      return { period, model, conversions: subjectIds.length, channels: channels.length };
    }, this.scope(actor));
  }

  async getDailyRollup(actor: JwtPayload, q: { from?: string; to?: string } = {}) {
    return withRlsTransaction(this.ds, async (em) => {
      const rows: any[] = await em.query(
        `SELECT day, channel, reach, lead, visit, proposal, revenue, referral
           FROM rhautt_nexus.metric_daily_rollup
          WHERE ($1::date IS NULL OR day >= $1) AND ($2::date IS NULL OR day <= $2)
          ORDER BY day DESC, channel ASC LIMIT 2000`,
        [q.from || null, q.to || null]);
      return { rollup: rows };
    }, this.scope(actor));
  }

  async getChannelAttribution(actor: JwtPayload, period: string, model: AttributionModel = 'position') {
    return withRlsTransaction(this.ds, async (em) => {
      const rows: Array<{ channel: string; credited_conversions: string; touches: number }> = await em.query(
        `SELECT channel, credited_conversions, touches FROM rhautt_nexus.metric_channel_attribution
          WHERE period = $1 AND model = $2 ORDER BY credited_conversions DESC`, [period, model]);
      const total = rows.reduce((s, r) => s + (Number(r.credited_conversions) || 0), 0) || 1;
      return {
        period, model,
        channels: rows.map((r) => ({ channel: r.channel, creditedConversions: Number(r.credited_conversions) || 0, share: (Number(r.credited_conversions) || 0) / total, touches: r.touches })),
      };
    }, this.scope(actor));
  }
}
