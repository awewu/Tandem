/**
 * PMS · AI 原生能力服务 (Phase 3)
 *
 * 三大能力 (均 grounded + fail-soft — LLM 不可用时降级到规则基线, 绝不阻塞):
 *   1. spec-in 风险预测: 综合规格矩阵/决策链/管道, 产出项目级被替换风险评估 + 行动建议.
 *   2. 决策链智能诊断: MEDDICC 缺口分析 + next best action.
 *   3. 招投标文档解析: 从粘贴的招标文本抽取关键要求/死线/资质/评分办法/风险点.
 *
 * 纪律:
 *   - 所有 LLM 调用 best-effort, 解析失败或抛错一律 fail-soft 返回规则基线 (source='rule').
 *   - 纯只读分析, 不写任何业务真值 (不落库).
 *   - 强制严格 JSON 输出 + extractJsonObject 容错解析 (剥离 ```json 包裹).
 */

import type {
  Project,
  ProjectStakeholder,
  SpecPosition,
  DecisionChainHealth,
  SpecCoverage,
} from '@/lib/types/pms';
import { specRiskLevel } from './spec-position-service';
import { CRITICAL_ROLES } from './project-stakeholder-service';
import { logger } from '@/lib/infra/logger';

// ---------------------------------------------------------------------------
// 纯函数 (可测)
// ---------------------------------------------------------------------------

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type InsightSource = 'ai' | 'rule';

/**
 * 从 LLM 原始输出中容错抽取第一个 JSON 对象.
 * 支持: 纯 JSON / ```json 包裹 / 前后有解释文字. 失败返回 null.
 */
export function extractJsonObject<T = Record<string, unknown>>(raw: string): T | null {
  if (!raw || typeof raw !== 'string') return null;
  // 优先剥离 ```json ... ``` 代码块
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/** 数值裁剪到 0-100 整数 */
export function clampScore(n: unknown, fallback = 50): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
  return Math.max(0, Math.min(100, Math.round(v)));
}

export interface SpecPositionRisk {
  positionId: string;
  equipmentFamily: string;
  riskLevel: 'low' | 'medium' | 'high' | 'lost';
  estimatedValue: number;
}

export interface SpecInRiskAssessment {
  source: InsightSource;
  /** 项目级综合被替换风险分 (0-100, 越高越危险) */
  riskScore: number;
  riskLevel: RiskLevel;
  /** 每个指定位的规则基线风险 */
  positions: SpecPositionRisk[];
  /** 关键风险点 (人类可读) */
  keyRisks: string[];
  /** 建议行动 */
  recommendedActions: string[];
  summary: string;
}

/**
 * spec-in 风险规则基线 (纯函数, 不依赖 LLM).
 *   riskScore = at_risk/lost 金额占比 × 权重 + 决策链缺口加成.
 */
export function buildSpecRiskBaseline(
  specs: SpecPosition[],
  coverage: SpecCoverage,
  chain: DecisionChainHealth,
): SpecInRiskAssessment {
  const positions: SpecPositionRisk[] = specs.map((s) => ({
    positionId: s.id,
    equipmentFamily: s.equipmentFamily,
    riskLevel: specRiskLevel(s),
    estimatedValue: s.estimatedValue ?? 0,
  }));

  const total = coverage.totalValue || 0;
  // 金额加权风险: at_risk 记 0.6, lost 记 1.0
  const exposure = total > 0 ? (coverage.atRiskValue * 0.6 + coverage.lostValue) / total : 0;
  // 决策链不完整加成 (completeness 越低, 风险越高) 最多 +30
  const chainPenalty = ((100 - chain.completeness) / 100) * 30;
  // 未指定/高危位数量加成
  const highCount = positions.filter((p) => p.riskLevel === 'high' || p.riskLevel === 'lost').length;
  const countPenalty = positions.length > 0 ? (highCount / positions.length) * 20 : 0;

  const riskScore = clampScore(exposure * 50 + chainPenalty + countPenalty, 0);

  const keyRisks: string[] = [];
  if (coverage.atRiskCount > 0) keyRisks.push(`${coverage.atRiskCount} 个设备族仅入围备选(alternate), 存在被替换风险`);
  if (coverage.lostValue > 0) keyRisks.push(`已丢失指定金额 ${Math.round(coverage.lostValue)}`);
  if (chain.missingCriticalRoles.length > 0) keyRisks.push(`决策链缺失关键角色: ${chain.missingCriticalRoles.join('/')}`);
  if (!chain.hasChampion) keyRisks.push('尚未建立内线(champion)');
  if (!chain.hasEconomicBuyer) keyRisks.push('尚未锁定经济决策人(economic buyer)');

  const recommendedActions: string[] = [];
  if (chain.missingCriticalRoles.length > 0) recommendedActions.push('补齐决策链关键角色触点');
  if (coverage.atRiskCount > 0) recommendedActions.push('对备选位推动升级为设计基准(basis_of_design)');
  if (!chain.hasChampion) recommendedActions.push('识别并发展设计工程师为内线');

  return {
    source: 'rule',
    riskScore,
    riskLevel: scoreToLevel(riskScore),
    positions,
    keyRisks: keyRisks.length ? keyRisks : ['暂无显著风险'],
    recommendedActions: recommendedActions.length ? recommendedActions : ['保持跟进, 巩固已指定设备族'],
    summary: `规则基线: 综合风险分 ${riskScore}/100 (spec 胜率 ${coverage.specWinRate}%, 决策链完整度 ${chain.completeness}%)`,
  };
}

export function scoreToLevel(score: number): RiskLevel {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

export interface DecisionChainInsight {
  source: InsightSource;
  completeness: number;
  gaps: string[];
  nextBestActions: string[];
  summary: string;
}

/** 决策链诊断规则基线 (纯函数) */
export function buildDecisionChainBaseline(
  stakeholders: ProjectStakeholder[],
  chain: DecisionChainHealth,
): DecisionChainInsight {
  const gaps: string[] = [];
  for (const role of CRITICAL_ROLES) {
    if (chain.missingCriticalRoles.includes(role)) gaps.push(`缺失关键角色: ${role}`);
  }
  if (!chain.hasChampion) gaps.push('无内线(champion)');
  if (!chain.hasEconomicBuyer) gaps.push('无经济决策人(economic buyer)');
  const lowInfluenceOnly = stakeholders.length > 0 && stakeholders.every((s) => s.influence === 'low');
  if (lowInfluenceOnly) gaps.push('现有干系人影响力均偏低, 缺高层触点');

  const nextBestActions: string[] = [];
  if (chain.missingCriticalRoles.includes('design_engineer')) nextBestActions.push('优先接触设计工程师(specifier) — 决定图纸品牌');
  if (chain.missingCriticalRoles.includes('installer')) nextBestActions.push('锁定安装商 — 真正的采购决策者');
  if (!chain.hasChampion) nextBestActions.push('从现有触点中培养内线');
  if (!chain.hasEconomicBuyer) nextBestActions.push('识别预算掌控方并建立触点');

  return {
    source: 'rule',
    completeness: chain.completeness,
    gaps: gaps.length ? gaps : ['决策链关键角色已覆盖'],
    nextBestActions: nextBestActions.length ? nextBestActions : ['维护现有关系, 定期回访'],
    summary: `规则基线: 决策链完整度 ${chain.completeness}% (${stakeholders.length} 个干系人)`,
  };
}

export interface TenderAnalysis {
  source: InsightSource;
  keyRequirements: string[];
  deadlines: { label: string; date?: string }[];
  qualificationRequirements: string[];
  scoringCriteria: string[];
  riskFlags: string[];
  summary: string;
}

// ---------------------------------------------------------------------------
// LLM 增强 (best-effort, fail-soft 到规则基线)
// ---------------------------------------------------------------------------

async function callJson<T>(system: string, user: string, maxTokens = 900): Promise<T | null> {
  try {
    const { getRouter } = await import('@/lib/boot');
    const router = getRouter();
    // eslint-disable-next-line no-restricted-syntax -- governed-chat-exempt: PMS 只读分析, 不改业务真值
    const reply = await router.chat({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      scenario: 'reasoning_complex',
      maxTokens,
    });
    const content =
      typeof reply.message.content === 'string' ? reply.message.content : JSON.stringify(reply.message.content);
    return extractJsonObject<T>(content);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[pms-ai] LLM call failed, falling back to rule baseline');
    return null;
  }
}

/**
 * spec-in 被替换风险预测 (LLM 增强, fail-soft 到规则基线).
 */
export async function predictSpecInRisk(input: {
  project: Project;
  specs: SpecPosition[];
  coverage: SpecCoverage;
  chain: DecisionChainHealth;
}): Promise<SpecInRiskAssessment> {
  const baseline = buildSpecRiskBaseline(input.specs, input.coverage, input.chain);

  const system =
    '你是暖通(HVAC)工程项目的 spec-in(品牌指定)风险分析专家。基于给定的项目规格矩阵、指定盘面与决策链数据, ' +
    '评估我方品牌被竞品替换的风险。必须基于给定数据作答, 不臆造数字。只输出 JSON: ' +
    '{"riskScore":0-100整数,"keyRisks":["..."],"recommendedActions":["..."],"summary":"≤120字"}。';
  const payload = {
    project: { name: input.project.projectName, stage: input.project.stage, estimatedValue: input.project.estimatedValue },
    specCoverage: input.coverage,
    decisionChain: input.chain,
    positions: baseline.positions,
  };
  const parsed = await callJson<{
    riskScore?: unknown;
    keyRisks?: unknown;
    recommendedActions?: unknown;
    summary?: unknown;
  }>(system, `项目数据(JSON):\n${JSON.stringify(payload, null, 2)}`);

  if (!parsed) return baseline;
  const riskScore = clampScore(parsed.riskScore, baseline.riskScore);
  return {
    source: 'ai',
    riskScore,
    riskLevel: scoreToLevel(riskScore),
    positions: baseline.positions,
    keyRisks: toStringArray(parsed.keyRisks, baseline.keyRisks),
    recommendedActions: toStringArray(parsed.recommendedActions, baseline.recommendedActions),
    summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim() : baseline.summary,
  };
}

/**
 * 决策链智能诊断 (LLM 增强, fail-soft 到规则基线).
 */
export async function analyzeDecisionChain(input: {
  project: Project;
  stakeholders: ProjectStakeholder[];
  chain: DecisionChainHealth;
}): Promise<DecisionChainInsight> {
  const baseline = buildDecisionChainBaseline(input.stakeholders, input.chain);

  const system =
    '你是 B2B 工程项目的决策链(MEDDICC)分析专家。基于给定干系人名单与决策链健康度, ' +
    '找出决策链缺口并给出下一步最佳行动。必须基于给定数据, 不臆造人物。只输出 JSON: ' +
    '{"gaps":["..."],"nextBestActions":["..."],"summary":"≤120字"}。';
  const payload = {
    project: { name: input.project.projectName, stage: input.project.stage },
    decisionChain: input.chain,
    stakeholders: input.stakeholders.map((s) => ({
      role: s.role,
      company: s.company,
      influence: s.influence,
      isChampion: s.isChampion,
      isEconomicBuyer: s.isEconomicBuyer,
    })),
  };
  const parsed = await callJson<{ gaps?: unknown; nextBestActions?: unknown; summary?: unknown }>(
    system,
    `决策链数据(JSON):\n${JSON.stringify(payload, null, 2)}`,
  );

  if (!parsed) return baseline;
  return {
    source: 'ai',
    completeness: input.chain.completeness,
    gaps: toStringArray(parsed.gaps, baseline.gaps),
    nextBestActions: toStringArray(parsed.nextBestActions, baseline.nextBestActions),
    summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim() : baseline.summary,
  };
}

/**
 * 招投标文档解析 (LLM 增强). 无 LLM 时返回空骨架 (source='rule').
 */
export async function analyzeTenderDocument(rawText: string): Promise<TenderAnalysis> {
  const emptyBaseline: TenderAnalysis = {
    source: 'rule',
    keyRequirements: [],
    deadlines: [],
    qualificationRequirements: [],
    scoringCriteria: [],
    riskFlags: [],
    summary: rawText.trim() ? 'LLM 不可用, 未能解析招标文档' : '招标文本为空',
  };
  if (!rawText || !rawText.trim()) return emptyBaseline;

  const system =
    '你是招投标文件分析专家。从给定招标/技术要求文本中抽取结构化要点。必须基于原文, 不臆造。只输出 JSON: ' +
    '{"keyRequirements":["技术/商务关键要求"],"deadlines":[{"label":"节点名","date":"YYYY-MM-DD或原文时间"}],' +
    '"qualificationRequirements":["资质/业绩要求"],"scoringCriteria":["评分办法要点"],' +
    '"riskFlags":["对我方不利/需注意的条款"],"summary":"≤150字"}。';
  const parsed = await callJson<{
    keyRequirements?: unknown;
    deadlines?: unknown;
    qualificationRequirements?: unknown;
    scoringCriteria?: unknown;
    riskFlags?: unknown;
    summary?: unknown;
  }>(system, `招标文本:\n${rawText.slice(0, 12000)}`, 1500);

  if (!parsed) return emptyBaseline;
  return {
    source: 'ai',
    keyRequirements: toStringArray(parsed.keyRequirements, []),
    deadlines: toDeadlineArray(parsed.deadlines),
    qualificationRequirements: toStringArray(parsed.qualificationRequirements, []),
    scoringCriteria: toStringArray(parsed.scoringCriteria, []),
    riskFlags: toStringArray(parsed.riskFlags, []),
    summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim() : '已解析招标文档',
  };
}

// ---------------------------------------------------------------------------
// 解析辅助 (纯函数)
// ---------------------------------------------------------------------------

export function toStringArray(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback;
  const out = v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim());
  return out.length ? out : fallback;
}

export function toDeadlineArray(v: unknown): { label: string; date?: string }[] {
  if (!Array.isArray(v)) return [];
  const out: { label: string; date?: string }[] = [];
  for (const item of v) {
    if (item && typeof item === 'object' && typeof (item as any).label === 'string') {
      const label = (item as any).label.trim();
      if (!label) continue;
      const date = typeof (item as any).date === 'string' ? (item as any).date.trim() : undefined;
      out.push({ label, date: date || undefined });
    }
  }
  return out;
}
