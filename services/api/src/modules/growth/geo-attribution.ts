/**
 * GEO 归因分渠道（北极星「GEO→高意向线索数」的诚实计数底座）· 纯函数，可单测。
 *
 * 为什么要它（宪章 §6 / §8 缺口）：
 *   旧驾驶舱把北极星近似成 lead/reach 的聚合比率，触达<线索时不可解释 → 返回 null。
 *   根因：线索与 GEO 触达是两条独立计数的漏斗事件，**没有把每条线索归因到其获客渠道**。
 *   本模块把每条线索的获客来源（lead.created / lead.captured 事件已携带的 payload.source）
 *   归一为渠道枚举，使「GEO→高意向线索数」成为**真实的按渠道计数子集**，而非编造的比率。
 *
 * 诚实纪律：无来源信号的线索归入 'other'，绝不默认算作 GEO；GEO 归因集显式且可审计。
 *
 * 边界：单触点（末次/线索来源）归因。多触点旅程归因见 AttributionService.multiTouchCredit，
 *   待旅程触点存储到位后接入，不在本模块范围。
 */

export type LeadChannel =
  | 'geo'          // AI 引擎/生成式检索推荐而来（GEO 直接成效）
  | 'ai-diagnosis' // 品牌站 AI 问诊留资（GEO 品牌站表面的转化口，宪章定位的 C 端获客入口）
  | 'referral'     // 转介绍
  | 'paid'         // 付费投放/信息流/SEM
  | 'organic'      // 自然搜索/SEO
  | 'manual'       // 人工录入/导入
  | 'other';       // 无法归因（诚实兜底，不算 GEO）

export const LEAD_CHANNELS: LeadChannel[] = [
  'geo', 'ai-diagnosis', 'referral', 'paid', 'organic', 'manual', 'other',
];

export const LEAD_CHANNEL_LABELS: Record<LeadChannel, string> = {
  geo: 'GEO 引擎推荐',
  'ai-diagnosis': 'AI 问诊留资',
  referral: '转介绍',
  paid: '付费投放',
  organic: '自然搜索',
  manual: '人工录入',
  other: '未归因',
};

/**
 * GEO 归因集：计入北极星「GEO→高意向线索数」的渠道。
 * 依据宪章 §1/§6：品牌站(GEO 表面) + AI 问诊(其留资口) 构成 GEO→线索的转化路径，
 * 故 'geo'（引擎直接推荐）与 'ai-diagnosis'（品牌站问诊）均属 GEO 成效；其余渠道不计入。
 * 该集合显式导出，驾驶舱同时给出全渠道拆分，口径透明可审计。
 */
export const GEO_ATTRIBUTED_CHANNELS: LeadChannel[] = ['geo', 'ai-diagnosis'];

export interface LeadAttributionSignal {
  source?: string | null;
  campaign?: string | null;
  medium?: string | null;
}

const GEO_RE = /(geo|chatgpt|gpt|perplexity|copilot|gemini|claude|kimi|doubao|豆包|文心|wenxin|通义|tongyi|deepseek|ai[-_ ]?engine|ai[-_ ]?search|ai[-_ ]?referral|生成式|大模型)/i;
const DIAGNOSIS_RE = /(diagnosis|问诊|rysnova-diagnosis)/i;
const REFERRAL_RE = /(referral|转介绍|推荐)/i;
const PAID_RE = /(^ad$|[-_ ]ad$|\bads?\b|sem|paid|竞价|投放|信息流|feed[-_ ]?ad)/i;
const ORGANIC_RE = /(organic|seo|自然|搜索)/i;
const MANUAL_RE = /(manual|import|crm|录入|导入)/i;

/**
 * 归一化线索获客渠道。优先级：GEO 引擎 > AI 问诊 > 转介绍 > 付费 > 自然 > 人工 > 未归因。
 * 有 campaign 但源未命中付费关键字时视为 'paid'（战役带来的线索默认付费获客）。
 */
export function normalizeLeadChannel(signal: LeadAttributionSignal | null | undefined): LeadChannel {
  const s = `${signal?.source ?? ''} ${signal?.medium ?? ''}`.trim();
  if (GEO_RE.test(s)) return 'geo';
  if (DIAGNOSIS_RE.test(s)) return 'ai-diagnosis';
  if (REFERRAL_RE.test(s)) return 'referral';
  if (PAID_RE.test(s)) return 'paid';
  if (ORGANIC_RE.test(s)) return 'organic';
  if (MANUAL_RE.test(s)) return 'manual';
  if (signal?.campaign) return 'paid';
  return 'other';
}

export function isGeoAttributed(channel: LeadChannel): boolean {
  return GEO_ATTRIBUTED_CHANNELS.includes(channel);
}
