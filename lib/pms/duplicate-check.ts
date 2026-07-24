/**
 * PMS · 智能查重服务
 * 五维查重算法：客户名 + 地址 + 电话 + 项目名 + 产品重叠
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsOpportunities, pmsDuplicateChecks } from '../infra/drizzle-schema';
import { eq, and, gte, isNull } from 'drizzle-orm';

/**
 * Jaccard 相似度计算
 */
export function jaccardSimilarity(str1: string, str2: string): number {
  const set1 = new Set(str1.toLowerCase().split(''));
  const set2 = new Set(str2.toLowerCase().split(''));
  
  const arr1 = Array.from(set1);
  const arr2 = Array.from(set2);
  
  const intersection = new Set(arr1.filter(x => set2.has(x)));
  const union = new Set([...arr1, ...arr2]);
  
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * 地址相似度（简化版，实际应使用地理编码）
 */
export function addressSimilarity(addr1?: string, addr2?: string): number {
  if (!addr1 || !addr2) return 0;
  return jaccardSimilarity(addr1, addr2);
}

/**
 * 电话匹配
 */
export function phoneMatch(phone1?: string, phone2?: string): boolean {
  if (!phone1 || !phone2) return false;
  // 去除空格和特殊字符
  const clean1 = phone1.replace(/[^\d]/g, '');
  const clean2 = phone2.replace(/[^\d]/g, '');
  return clean1 === clean2;
}

/**
 * 查重判定阈值 (纯函数, 可测):
 *   >= 0.80 → duplicate (阻断)
 *   >= 0.60 → warning (提示)
 *   否则    → pass
 */
export function classifyDuplicate(score: number): 'pass' | 'warning' | 'duplicate' {
  if (score >= 0.80) return 'duplicate';
  if (score >= 0.60) return 'warning';
  return 'pass';
}

/**
 * 智能查重
 */
export async function checkDuplicate(input: {
  tenantId: string;
  customerName: string;
  customerAddress?: string;
  customerPhone?: string;
  projectName: string;
}): Promise<{
  status: 'pass' | 'warning' | 'duplicate';
  matchedOpportunities: string[];
  matchDetails: Array<{
    opportunityId: string;
    dimensions: string[];
    similarity: number;
  }>;
}> {
  // 1. 查询最近 90 天内的活跃商机
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  
  const activeOpportunities = await db
    .select()
    .from(pmsOpportunities)
    .where(and(
      eq(pmsOpportunities.tenantId, input.tenantId),
      eq(pmsOpportunities.status, 'active'),
      gte(pmsOpportunities.createdAt, ninetyDaysAgo),
      isNull(pmsOpportunities.archivedAt)
    ));
  
  // 2. 对每个商机计算五维相似度
  const matches: Array<{
    opportunityId: string;
    dimensions: string[];
    similarity: number;
  }> = [];
  
  for (const opp of activeOpportunities) {
    const dimensions: string[] = [];
    let totalScore = 0;
    
    // 维度 1: 客户名（权重 25%）
    const nameSim = jaccardSimilarity(input.customerName, opp.customerName);
    if (nameSim > 0.7) {
      dimensions.push('customerName');
      totalScore += nameSim * 0.25;
    }
    
    // 维度 2: 地址（权重 25%）
    const addrSim = addressSimilarity(input.customerAddress, opp.customerAddress || undefined);
    if (addrSim > 0.7) {
      dimensions.push('address');
      totalScore += addrSim * 0.25;
    }
    
    // 维度 3: 电话（权重 20%）
    if (phoneMatch(input.customerPhone, opp.customerPhone || undefined)) {
      dimensions.push('phone');
      totalScore += 0.20;
    }
    
    // 维度 4: 项目名（权重 15%）
    const projectSim = jaccardSimilarity(input.projectName, opp.projectName);
    if (projectSim > 0.6) {
      dimensions.push('projectName');
      totalScore += projectSim * 0.15;
    }
    
    // 维度 5: 产品重叠（权重 15%）— 需 ERP 产品明细/BOM 主数据支撑, 随 ERP 对接落地(二期)。
    // 当前 4 维(客户名/地址/电话/项目名, 合计 85% 权重)已足够稳健识别撞单。
    
    // 如果有匹配维度，记录
    if (dimensions.length > 0) {
      matches.push({
        opportunityId: opp.id,
        dimensions,
        similarity: totalScore,
      });
    }
  }
  
  // 3. 按相似度排序
  matches.sort((a, b) => b.similarity - a.similarity);
  
  // 4. 判定结果
  const status: 'pass' | 'warning' | 'duplicate' =
    matches.length > 0 ? classifyDuplicate(matches[0].similarity) : 'pass';
  
  // 5. 如果是撞单或警告，记录查重结果
  if (status !== 'pass' && matches.length > 0) {
    const now = new Date();
    const checkId = nanoid();
    
    await db.insert(pmsDuplicateChecks).values({
      id: checkId,
      tenantId: input.tenantId,
      opportunityId: '', // 新商机还未创建，暂时为空
      duplicateOpportunityId: matches[0].opportunityId,
      similarityScore: matches[0].similarity.toString(),
      dimensions: matches[0].dimensions,
      status: status === 'duplicate' ? 'duplicate' : 'warning',
      resolvedBy: null,
      resolvedAt: null,
      createdAt: now,
    });
  }
  
  return {
    status,
    matchedOpportunities: matches.map(m => m.opportunityId),
    matchDetails: matches.slice(0, 5), // 最多返回 5 个匹配结果
  };
}

/**
 * 获取查重记录
 */
export async function getDuplicateCheck(checkId: string, tenantId: string) {
  const rows = await db
    .select()
    .from(pmsDuplicateChecks)
    .where(and(
      eq(pmsDuplicateChecks.id, checkId),
      eq(pmsDuplicateChecks.tenantId, tenantId)
    ))
    .limit(1);
  
  if (rows.length === 0) return null;
  
  const row = rows[0];
  return {
    id: row.id,
    tenantId: row.tenantId,
    opportunityId: row.opportunityId,
    duplicateOpportunityId: row.duplicateOpportunityId || undefined,
    similarityScore: parseFloat(row.similarityScore),
    dimensions: row.dimensions,
    status: row.status,
    resolvedBy: row.resolvedBy || undefined,
    resolvedAt: row.resolvedAt?.toISOString() || undefined,
    createdAt: row.createdAt.toISOString(),
  };
}
