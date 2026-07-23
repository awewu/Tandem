import { Injectable } from '@nestjs/common';

/**
 * 增长中枢 · E4 归因与经济性引擎（G4）· 纯函数，可单测。
 *
 * 真实价值：把「曝光虚荣指标」换成真实 CAC/转化漏斗 + 多触点归因权重。
 *  - campaignEconomics：由预算 + 聚合指标算 CTR/留资率/成交率/CAC/CPL（真实除法，非自报）。
 *  - multiTouchCredit：给定一条 lead 的触点旅程，按 first/last/linear/time-decay 分配成交信用，
 *    支撑跨战役 ROI 归因（旅程数据到位即生效）。
 */

export type AttributionModel = 'first-touch' | 'last-touch' | 'linear' | 'time-decay';

export interface CampaignAggregate {
  impressions: number;
  clicks: number;
  leads: number;
  signed: number;
}

export interface CampaignEconomics extends CampaignAggregate {
  spend: number;
  ctr: number;          // 点击率 clicks/impressions
  leadRate: number;     // 留资率 leads/clicks
  closeRate: number;    // 成交率 signed/leads
  cpl: number;          // 单条留资成本 spend/leads
  cac: number;          // 获客成本 spend/signed
}

export interface Touchpoint {
  campaignId: string;
  ts: number;           // epoch ms
}

@Injectable()
export class AttributionService {
  private safeDiv(a: number, b: number): number {
    return b > 0 ? a / b : 0;
  }
  private round(n: number, dp = 4): number {
    const f = 10 ** dp;
    return Math.round(n * f) / f;
  }

  /** 单战役经济性：真实转化漏斗 + CAC/CPL。 */
  campaignEconomics(budget: number, agg: CampaignAggregate): CampaignEconomics {
    const spend = Number(budget) || 0;
    return {
      ...agg,
      spend,
      ctr: this.round(this.safeDiv(agg.clicks, agg.impressions)),
      leadRate: this.round(this.safeDiv(agg.leads, agg.clicks)),
      closeRate: this.round(this.safeDiv(agg.signed, agg.leads)),
      cpl: this.round(this.safeDiv(spend, agg.leads), 2),
      cac: this.round(this.safeDiv(spend, agg.signed), 2),
    };
  }

  /**
   * 多触点归因：把 1 个成交（信用 = 1）按模型分配到旅程中的各触点战役。
   * 返回 { campaignId: 信用占比 }，各占比之和 = 1（旅程非空时）。
   */
  multiTouchCredit(journey: Touchpoint[], model: AttributionModel = 'linear'): Record<string, number> {
    const path = [...(journey || [])].sort((a, b) => a.ts - b.ts);
    const credit: Record<string, number> = {};
    if (path.length === 0) return credit;

    const add = (id: string, w: number) => { credit[id] = this.round((credit[id] || 0) + w); };

    if (model === 'first-touch') {
      add(path[0].campaignId, 1);
    } else if (model === 'last-touch') {
      add(path[path.length - 1].campaignId, 1);
    } else if (model === 'time-decay') {
      // 越接近成交权重越高：半衰期 7 天。
      const last = path[path.length - 1].ts;
      const halfLife = 7 * 24 * 3600 * 1000;
      const raw = path.map((t) => 2 ** (-(last - t.ts) / halfLife));
      const sum = raw.reduce((s, x) => s + x, 0) || 1;
      path.forEach((t, i) => add(t.campaignId, raw[i] / sum));
    } else {
      // linear：均分。
      const w = 1 / path.length;
      path.forEach((t) => add(t.campaignId, w));
    }
    return credit;
  }
}
