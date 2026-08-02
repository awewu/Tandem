/**
 * PMS · 报价定价洞察 (纯计算, 可单测, 无 IO)
 *
 * "事后洞察 (management by exception)": 经销商自由报价, 全量沉淀 → 后台长期汇总,
 * 跨报价对同一产品的成交/报价单价做同侪比较, 暴露异常低价 (恶意冲量/围标嫌疑) 与破限价。
 *
 * 两类异常:
 *   - below_floor: 单价低于产品目录最低限价 (minPrice) → 明确破线, critical。
 *   - low_outlier: 同侪 (同产品 ≥minPeers 份报价) 中位数显著偏低 → 统计离群。
 * 无 IO: 输入为精简报价数组 + 限价 Map, 便于纯函数单测。
 */

import type { QuoteSystem } from '@/lib/types/pms';

export interface QuoteInsightInput {
  id: string;
  dealerOrgId: string;
  systems: QuoteSystem[];
}

export interface ProductPriceStat {
  productKey: string; // catalogId 或 model:<型号>
  productLabel: string;
  count: number; // 该产品被报价的行数 (跨报价)
  min: number;
  max: number;
  median: number;
  mean: number;
  floor?: number; // 目录最低限价 (若已知)
}

export interface QuotePriceAnomaly {
  quoteId: string;
  dealerOrgId: string;
  productKey: string;
  productLabel: string;
  unitPrice: number;
  peerMedian: number;
  peerCount: number;
  floor?: number;
  type: 'below_floor' | 'low_outlier';
  severity: 'warning' | 'critical';
  detail: string;
}

export interface QuotePricingReport {
  generatedAt: string;
  quoteCount: number;
  productStats: ProductPriceStat[];
  anomalies: QuotePriceAnomaly[];
}

export interface AnalyzeOptions {
  /** 低于同侪中位数此比例判 low_outlier (默认 0.3 = 低 30%) */
  lowOutlierPct?: number;
  /** 触发 critical 的更深偏离比例 (默认 0.5 = 低 50%) */
  criticalPct?: number;
  /** 判 low_outlier 所需的最少同侪份数 (默认 3) */
  minPeers?: number;
}

const DEFAULTS: Required<AnalyzeOptions> = { lowOutlierPct: 0.3, criticalPct: 0.5, minPeers: 3 };

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** 中位数 (输入非空; 会先排序副本) */
export function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

/** 明细行 → 归集键 (软引用目录优先, 否则型号) + 展示标签 */
function itemKey(it: QuoteSystem['items'][number]): { key: string; label: string } | null {
  if (it.productCatalogId) return { key: it.productCatalogId, label: it.model || it.productCatalogId };
  if (it.costType === 'equipment' && it.model?.trim()) return { key: `model:${it.model.trim()}`, label: it.model.trim() };
  return null;
}

interface Sample {
  quoteId: string;
  dealerOrgId: string;
  unitPrice: number;
  label: string;
}

/**
 * 跨报价分析定价: 按产品归集单价 → 统计 + 检测异常。
 * @param quotes 精简报价 (应为已签发/成交口径, 由调用方筛选)
 * @param floors productKey → 最低限价 (来自 catalog.minPrice; catalogId 键)
 */
export function analyzeQuotePricing(
  quotes: QuoteInsightInput[],
  floors: Map<string, number> = new Map(),
  opts: AnalyzeOptions = {},
): QuotePricingReport {
  const o = { ...DEFAULTS, ...opts };
  const byProduct = new Map<string, Sample[]>();

  for (const q of quotes) {
    for (const sys of q.systems ?? []) {
      for (const it of sys.items ?? []) {
        const unit = Number(it.unitPrice);
        if (!(unit > 0)) continue;
        const k = itemKey(it);
        if (!k) continue;
        const arr = byProduct.get(k.key) ?? [];
        arr.push({ quoteId: q.id, dealerOrgId: q.dealerOrgId, unitPrice: unit, label: k.label });
        byProduct.set(k.key, arr);
      }
    }
  }

  const productStats: ProductPriceStat[] = [];
  const anomalies: QuotePriceAnomaly[] = [];

  for (const [key, samples] of Array.from(byProduct.entries())) {
    const prices = samples.map((s) => s.unitPrice);
    const med = median(prices);
    const label = samples[0]?.label ?? key;
    const floor = floors.get(key);
    productStats.push({
      productKey: key,
      productLabel: label,
      count: samples.length,
      min: round2(Math.min(...prices)),
      max: round2(Math.max(...prices)),
      median: round2(med),
      mean: round2(prices.reduce((a, b) => a + b, 0) / prices.length),
      floor: floor != null ? round2(floor) : undefined,
    });

    for (const s of samples) {
      // 1) 破限价 (确定性, 与同侪无关)
      if (floor != null && s.unitPrice < floor) {
        anomalies.push({
          quoteId: s.quoteId,
          dealerOrgId: s.dealerOrgId,
          productKey: key,
          productLabel: label,
          unitPrice: round2(s.unitPrice),
          peerMedian: round2(med),
          peerCount: samples.length,
          floor: round2(floor),
          type: 'below_floor',
          severity: 'critical',
          detail: `单价 ¥${round2(s.unitPrice)} 低于最低限价 ¥${round2(floor)}`,
        });
        continue; // 破限价已是最严重, 不重复报 low_outlier
      }
      // 2) 同侪离群 (需足够样本)
      if (samples.length >= o.minPeers && med > 0) {
        const ratio = s.unitPrice / med;
        if (ratio < 1 - o.lowOutlierPct) {
          anomalies.push({
            quoteId: s.quoteId,
            dealerOrgId: s.dealerOrgId,
            productKey: key,
            productLabel: label,
            unitPrice: round2(s.unitPrice),
            peerMedian: round2(med),
            peerCount: samples.length,
            floor: floor != null ? round2(floor) : undefined,
            type: 'low_outlier',
            severity: ratio < 1 - o.criticalPct ? 'critical' : 'warning',
            detail: `单价 ¥${round2(s.unitPrice)} 较同侪中位数 ¥${round2(med)} 低 ${Math.round((1 - ratio) * 100)}%`,
          });
        }
      }
    }
  }

  // 统计按份数降序; 异常按严重度→偏离度排序
  productStats.sort((a, b) => b.count - a.count);
  const sevRank = { critical: 0, warning: 1 } as const;
  anomalies.sort((a, b) => {
    if (sevRank[a.severity] !== sevRank[b.severity]) return sevRank[a.severity] - sevRank[b.severity];
    return a.unitPrice / (a.peerMedian || 1) - b.unitPrice / (b.peerMedian || 1);
  });

  return {
    generatedAt: new Date().toISOString(),
    quoteCount: quotes.length,
    productStats,
    anomalies,
  };
}
