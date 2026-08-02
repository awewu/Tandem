/**
 * PMS · 智能查重服务
 * 五维查重算法：客户名 + 地址 + 电话 + 项目名 + 产品重叠
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsOpportunities, pmsDuplicateChecks } from '../infra/drizzle-schema';
import { eq, and, gte, isNull } from 'drizzle-orm';
import { embed, cosineSim, isEmbeddingConfigured } from '../infra/embedding';
import { logger } from '../infra/logger';

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

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * 品牌别名词典 (英文/拼音/简称 → 规范中文): 破"中英混写/简称"字面漏判。
 * 键为**已归一化(小写去噪)**的变体, 值为规范名。种子几个高频商用连锁,
 * 生产应由客户主数据/别名表驱动 (此处仅内置常见集)。
 */
const NAME_ALIASES: Record<string, string> = {
  hilton: '希尔顿',
  huazhu: '华住',
  marriott: '万豪',
  ihg: '洲际',
  intercontinental: '洲际',
  accor: '雅高',
  hyatt: '凯悦',
  sheraton: '喜来登',
  wyndham: '温德姆',
  hampton: '希尔顿欢朋',
  ibis: '宜必思',
};

function applyAliases(s: string): string {
  let out = s;
  for (const k in NAME_ALIASES) {
    if (out.includes(k)) out = out.split(k).join(NAME_ALIASES[k]);
  }
  return out;
}

/**
 * 实体名归一化 (客户名/项目名): 破"简称 vs 全称 / 全角半角 / 噪声后缀"造成的字面漏判。
 *   - 全角 → 半角, 转小写, 去标点/空白
 *   - 剥离高频噪声词 (有限公司/集团/项目/工程/系统 …), 保留判别性主干
 */
export function normalizeName(s?: string | null): string {
  if (!s) return '';
  // 全角 → 半角
  let out = s.replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/\u3000/g, ' ');
  out = out.toLowerCase();
  // 噪声词 (公司实体后缀 + 项目通用词)
  out = out.replace(
    /有限责任公司|股份有限公司|有限公司|有限|责任|股份|集团|公司|企业|项目|工程|系统|设备|改造|采购|中心|管理|服务|科技|贸易|商贸/g,
    '',
  );
  // 去标点/空白 (不用 \p{P} 以兼容 tsconfig target): 空白 + CJK/通用标点 + 残留全角 + ASCII 标点
  out = out.replace(/[\s\u00B7\u2000-\u206F\u3000-\u303F\uFF00-\uFFEF]/g, '');
  out = out.replace(/[!-\/:-@[-`{-~]/g, '');
  // 别名规范化 (英文/拼音/简称 → 规范中文), 破中英混写
  out = applyAliases(out);
  return out;
}

/** 归一化后的名称字面相似度 (Jaccard on 归一化字符集) */
export function nameSimilarityLexical(a?: string | null, b?: string | null): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  return jaccardSimilarity(na, nb);
}

/**
 * 综合撞单评分 (纯函数, 可测) — 修复两类漏判:
 *   1. 信息不全惩罚: 仅在**双方都有**的维度上做加权平均 (权重按在场维度重归一),
 *      缺电话/地址不再结构性拉低总分。
 *   2. 电话强信号: 电话完全一致 = 极强撞单证据 →
 *      至少预警(0.65); 若同时名称相似(≥0.5) → 直判撞单(0.85)。
 */
export function scoreDuplicate(dims: {
  nameSim: number;
  projectSim: number;
  addrSim: number | null; // null = 任一方地址缺失
  phoneExact: boolean;
}): number {
  const parts: Array<{ w: number; v: number }> = [
    { w: 0.45, v: clamp01(dims.nameSim) },
    { w: 0.3, v: clamp01(dims.projectSim) },
  ];
  if (dims.addrSim != null) parts.push({ w: 0.25, v: clamp01(dims.addrSim) });
  const wsum = parts.reduce((s, p) => s + p.w, 0);
  let score = wsum > 0 ? parts.reduce((s, p) => s + p.w * p.v, 0) / wsum : 0;

  if (dims.phoneExact) {
    score = Math.max(score, 0.65);
    if (dims.nameSim >= 0.5) score = Math.max(score, 0.85);
  }
  return Math.round(clamp01(score) * 1000) / 1000;
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
 *   >= 0.60 → warning   (提示, 可提交)
 *   >= 0.45 → suspect   (疑似, 边缘 → 推销售管理部人工复核, 宁多提示不漏判)
 *   否则    → pass
 */
export function classifyDuplicate(score: number): 'pass' | 'suspect' | 'warning' | 'duplicate' {
  if (score >= 0.80) return 'duplicate';
  if (score >= 0.60) return 'warning';
  if (score >= 0.45) return 'suspect';
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
  status: 'pass' | 'suspect' | 'warning' | 'duplicate';
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
  
  // 1.5 语义层 (fail-soft): embedding 可用时对"客户名+项目名"做语义相似,
  //     破"写法不同/简称/中英混写"的字面漏判; 不可用则纯字面, 绝不阻塞报备。
  let embOn = false;
  let inputVec: number[] | null = null;
  try {
    embOn = await isEmbeddingConfigured();
    if (embOn) {
      inputVec = await embed(`${normalizeName(input.customerName)} ${normalizeName(input.projectName)}`);
    }
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[pms-dedupe] embedding unavailable, lexical-only');
    embOn = false;
  }

  // 2. 对每个商机计算多维相似度 (归一化字面 + 语义 + 强信号)
  const matches: Array<{
    opportunityId: string;
    dimensions: string[];
    similarity: number;
  }> = [];

  const SEMANTIC_CAP = 60; // 控嵌入调用量
  let semanticDone = 0;

  for (const opp of activeOpportunities) {
    // 归一化字面相似 (破简称/全角/噪声词)
    let nameSim = nameSimilarityLexical(input.customerName, opp.customerName);
    let projectSim = nameSimilarityLexical(input.projectName, opp.projectName);

    // 语义增强: 与字面取 max, 只升不降
    if (embOn && inputVec && semanticDone < SEMANTIC_CAP) {
      try {
        const cand = await embed(`${normalizeName(opp.customerName)} ${normalizeName(opp.projectName)}`);
        if (cand) {
          const sem = cosineSim(inputVec, cand);
          nameSim = Math.max(nameSim, sem);
          projectSim = Math.max(projectSim, sem);
        }
      } catch {
        /* fail-soft: 单条嵌入失败不影响其余 */
      }
      semanticDone++;
    }

    const addrProvided = !!(input.customerAddress && opp.customerAddress);
    const addrSim = addrProvided
      ? addressSimilarity(input.customerAddress, opp.customerAddress || undefined)
      : null;
    const phoneExact = phoneMatch(input.customerPhone, opp.customerPhone || undefined);

    const similarity = scoreDuplicate({ nameSim, projectSim, addrSim, phoneExact });

    // 命中维度 (用于透明展示"为什么判撞")
    const dimensions: string[] = [];
    if (nameSim >= 0.5) dimensions.push('customerName');
    if (addrSim != null && addrSim >= 0.6) dimensions.push('address');
    if (phoneExact) dimensions.push('phone');
    if (projectSim >= 0.5) dimensions.push('projectName');

    // 产品重叠（15%）— 需 ERP 产品明细/BOM 主数据支撑, 随 ERP 对接落地(二期)。

    if (similarity > 0 && (dimensions.length > 0 || phoneExact)) {
      matches.push({ opportunityId: opp.id, dimensions, similarity });
    }
  }
  
  // 3. 按相似度排序
  matches.sort((a, b) => b.similarity - a.similarity);
  
  // 4. 判定结果
  const status: 'pass' | 'suspect' | 'warning' | 'duplicate' =
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
      status, // pass 不入库; 存真实档 (suspect/warning/duplicate) 供人工复核区分

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
