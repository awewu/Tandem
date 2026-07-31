/**
 * 目标自动生成引擎 (建议, 非自动落地)
 *
 * 建立在真实历史事实层之上 (lib/kpi/bsc-fact-service.ts computeYoyFacts 同一批数据源):
 * 新周期目标建议 = 上一财年真实 actual × (1 + 增长率)。
 *
 * 铁律 (与 YoY/QoQ 事实层同一纪律):
 *   - 查不到上一财年真实数据的科目 → suggestedTarget = null, 前端提示"无历史基准, 需 HR 手工设定",
 *     绝不用 target*系数 这类虚构基准 (根治的假闭环同款教训)。
 *   - 增长率由 HR/高管在生成时输入 (按科目/默认两级), 本引擎不内置任何"合理增长率"假设,
 *     因为那是业务决策, 不是数据层该猜的。
 *   - 本函数只产出"建议", 不写任何 Kpi 记录 —— 由 HR 审核后走既有 POST /api/kpi 落地创建,
 *     或走目标修订签批流 (KpiTargetAmendment) 修正已存在的目标。
 *   - 级联一致性 (checkCascadeConsistency) 只做提示, 不拦截提交: 子级建议目标之和
 *     若明显偏离父级建议目标 (复用 computeBonusPayout 同款 isCascadeConsistent 判定),
 *     只是把差异标出来让 HR 自己判断是否要调整增长率, 系统不替业务拍板。
 */

import { isCascadeConsistent } from '@/lib/types/kpi';

export interface PriorYearActual {
  /** 上一财年周期里这条记录对应的真实 Kpi.id, 用于按 parentKpiId 做级联一致性匹配 */
  priorKpiId: string;
  /** 上一财年周期里这条 KPI 的 parentKpiId (无上级则 undefined) */
  priorParentKpiId?: string;
  subjectId: string;
  /** 供 UI 展示 + growthRateByCode 匹配 */
  subjectCode: string;
  assigneeId: string;
  level: string;
  /** 上一财年真实 currentValue */
  priorActual: number;
}

export interface TargetSuggestion {
  priorKpiId: string;
  priorParentKpiId?: string;
  subjectId: string;
  subjectCode: string;
  assigneeId: string;
  level: string;
  priorActual: number;
  /** 实际采用的增长率 (来自 growthRateByCode[code] 或 defaultGrowthRate) */
  growthRateUsed: number;
  /** priorActual * (1 + growthRateUsed), 四舍五入到 2 位小数 */
  suggestedTarget: number;
}

export interface CascadeWarning {
  /** 父级 (上一财年) KPI id */
  parentPriorKpiId: string;
  parentSubjectCode: string;
  parentSuggestedTarget: number;
  /** 子级建议目标之和 */
  childrenSuggestedSum: number;
  /** 偏离度 % = (childrenSum - parentTarget) / |parentTarget| * 100 */
  deltaPct: number;
}

/**
 * 用建议目标(而非原 targetValue)重新跑一遍 isCascadeConsistent, 挑出偏离的父子对。
 * 只在父子双方都有建议时才判断 (任一方缺历史基准就跳过, 不猜测)。
 */
export function checkCascadeConsistency(
  suggestions: TargetSuggestion[],
  toleranceRatio = 0.01,
): CascadeWarning[] {
  const byId = new Map(suggestions.map((s) => [s.priorKpiId, s]));
  const childrenByParent = new Map<string, TargetSuggestion[]>();
  for (const s of suggestions) {
    if (!s.priorParentKpiId) continue;
    if (!byId.has(s.priorParentKpiId)) continue; // 父级没有建议 (缺历史基准), 不判断
    const list = childrenByParent.get(s.priorParentKpiId) ?? [];
    list.push(s);
    childrenByParent.set(s.priorParentKpiId, list);
  }

  const warnings: CascadeWarning[] = [];
  for (const [parentId, children] of Array.from(childrenByParent.entries())) {
    const parent = byId.get(parentId)!;
    const childrenSum = children.reduce((acc: number, c: TargetSuggestion) => acc + c.suggestedTarget, 0);
    if (!isCascadeConsistent(parent.suggestedTarget, children.map((c) => c.suggestedTarget), toleranceRatio)) {
      const deltaPct =
        parent.suggestedTarget !== 0
          ? ((childrenSum - parent.suggestedTarget) / Math.abs(parent.suggestedTarget)) * 100
          : 0;
      warnings.push({
        parentPriorKpiId: parentId,
        parentSubjectCode: parent.subjectCode,
        parentSuggestedTarget: parent.suggestedTarget,
        childrenSuggestedSum: Math.round(childrenSum * 100) / 100,
        deltaPct: Math.round(deltaPct * 100) / 100,
      });
    }
  }
  return warnings;
}

export interface SuggestTargetsInput {
  priorYearActuals: PriorYearActual[];
  /** 按科目 code 指定增长率, e.g. { 'FIN.REV': 0.15, 'FIN.GP': 0.05 } */
  growthRateByCode?: Record<string, number>;
  /** 未在 growthRateByCode 指定的科目使用此增长率, 缺省 0 (持平) */
  defaultGrowthRate?: number;
}

/**
 * 纯函数: 给定上一财年真实 actuals + 增长率配置, 产出新周期目标建议。
 * 不做任何 IO, 不查库 —— 上一财年 actuals 由调用方 (API 层) 通过
 * computeYoyFacts 同款查询逻辑预先取好, 保证两条同比/建议链路使用同一份真实数据。
 */
export function suggestTargets(input: SuggestTargetsInput): TargetSuggestion[] {
  const { priorYearActuals, growthRateByCode = {}, defaultGrowthRate = 0 } = input;
  return priorYearActuals.map((p) => {
    const growthRateUsed = growthRateByCode[p.subjectCode] ?? defaultGrowthRate;
    const suggestedTarget = Math.round(p.priorActual * (1 + growthRateUsed) * 100) / 100;
    return {
      priorKpiId: p.priorKpiId,
      priorParentKpiId: p.priorParentKpiId,
      subjectId: p.subjectId,
      subjectCode: p.subjectCode,
      assigneeId: p.assigneeId,
      level: p.level,
      priorActual: p.priorActual,
      growthRateUsed,
      suggestedTarget,
    };
  });
}
