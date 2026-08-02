/**
 * PMS · 报价定价洞察服务 (拉真库 issued 报价 + 目录限价 → 纯分析)
 *
 * 管理侧只读洞察 (事后): 汇总全量已签发报价, 跨报价对同产品单价做同侪比较,
 * 暴露破限价 / 异常低价。经销商自由报价不阻断, 异常在此显影供管理复盘。
 */

import { db } from '../infra/drizzle-client';
import { pmsQuotes } from '../infra/drizzle-schema';
import { and, eq, inArray } from 'drizzle-orm';
import { listProducts } from './product-catalog-service';
import { analyzeQuotePricing, type QuoteInsightInput, type QuotePricingReport } from './quote-insights';
import type { QuoteSystem } from '@/lib/types/pms';

/** 参与分析的报价状态: 已签发 + 已被替代(历史成交口径) + 已接受 */
const ANALYZED_STATUSES = ['issued', 'accepted', 'superseded'];

export async function assembleQuotePricingReport(
  tenantId: string,
  filters: { dealerOrgId?: string } = {},
): Promise<QuotePricingReport> {
  const conds = [eq(pmsQuotes.tenantId, tenantId), inArray(pmsQuotes.status, ANALYZED_STATUSES)];
  if (filters.dealerOrgId) conds.push(eq(pmsQuotes.dealerOrgId, filters.dealerOrgId));

  const rows = await db.select().from(pmsQuotes).where(and(...conds));
  const quotes: QuoteInsightInput[] = rows.map((r) => ({
    id: r.id,
    dealerOrgId: r.dealerOrgId,
    systems: (r.systems as QuoteSystem[] | null) ?? [],
  }));

  // 目录最低限价 (catalogId → minPrice)
  const products = await listProducts({ tenantId, limit: 5000 });
  const floors = new Map<string, number>();
  for (const p of products) {
    if (p.minPrice != null) floors.set(p.id, p.minPrice);
  }

  return analyzeQuotePricing(quotes, floors);
}
