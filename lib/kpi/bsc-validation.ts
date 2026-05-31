/**
 * BSC 四维配比校验 (B-020)
 *
 * Kaplan/Norton 原版 BSC 建议: 战略不能退回单一财务考核, 学习成长不能被压到 0.
 * 这里只算 + 评估, 不做强制阻断 — 严重失衡时由 setup 页二次确认 + audit.
 *
 * CHARTER-KPI-TTI §2 已落 `Kpi.bscPerspective` + `KpiSubject.bscPerspective` 字段;
 * 本文件按 `weight` 求和归一, 给 UI 雷达 + 周期激活前置守卫使用.
 *
 * 工具函数纯函数, 无副作用, 无网络/DB 访问.
 */

import type { Kpi, KpiSubject } from '@/lib/types/kpi';
import { BSC_PERSPECTIVE, type BscPerspective } from '@/lib/design-tokens';

// ---------------------------------------------------------------------------
// 健康区间常量 (CHARTER §2 + Kaplan/Norton 通用建议)
// ---------------------------------------------------------------------------

/** 软警告阈值: financial 权重上限 (建议 ≤ 50%). 超过 = 退回单一财务考核. */
export const BSC_FINANCIAL_SOFT_MAX = 0.5;

/** 严重失衡阈值: financial 权重上限 (> 70% = 周期激活前置守卫触发). */
export const BSC_FINANCIAL_HARD_MAX = 0.7;

/** 软警告阈值: 非财务维度每维下限 (建议 ≥ 10%). */
export const BSC_NON_FINANCIAL_SOFT_MIN = 0.1;

/** 维度顺序 (UI 渲染 + 因果链方向, growth → process → customer → financial). */
export const BSC_PERSPECTIVES: readonly BscPerspective[] = [
  'growth',
  'process',
  'customer',
  'financial',
] as const;

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

export interface BscDistribution {
  /** 每维加权占比 (0-1, 4 维和 = 1, 若所有 weight=0 则全 0). */
  byPerspective: Record<BscPerspective, number>;
  /** 每维 KPI 数量. */
  countByPerspective: Record<BscPerspective, number>;
  /** 每维加权 (raw, 未归一). */
  weightByPerspective: Record<BscPerspective, number>;
  /** 总权重 (sum of weight). 用于判断是否全 0. */
  totalWeight: number;
  /** 未分类 KPI 数 (perspective 缺失). */
  unclassifiedCount: number;
  /** 未分类 KPI 的总权重. */
  unclassifiedWeight: number;
}

export type BscBalanceLevel = 'healthy' | 'warning' | 'imbalanced';

export interface BscBalanceIssue {
  /** 'financial-too-high' | 'perspective-too-low' | 'perspective-zero' | 'unclassified' */
  code:
    | 'financial-too-high'
    | 'financial-severe'
    | 'perspective-too-low'
    | 'perspective-zero'
    | 'unclassified-present'
    | 'no-weights';
  severity: 'warning' | 'severe';
  perspective?: BscPerspective;
  /** 用户可读说明 (中文). */
  message: string;
}

export interface BscBalanceReport {
  distribution: BscDistribution;
  level: BscBalanceLevel;
  issues: BscBalanceIssue[];
  /**
   * `true` 表示周期可直接激活;
   * `false` 表示存在 `severe` issue, setup 页应弹二次确认.
   */
  canActivateWithoutConfirm: boolean;
}

// ---------------------------------------------------------------------------
// 推断 perspective (fallback)
// ---------------------------------------------------------------------------

/**
 * 解析 KPI 的 BSC 维度:
 *   1. 直接读 `kpi.bscPerspective`
 *   2. 回退到 subject.bscPerspective
 *   3. 都没有 = 未分类 (返回 undefined, 进入 unclassifiedCount)
 *
 * 不再用关键词兜底 — setup 页要求 HR 显式选定维度, 维度缺失就是真缺失,
 * 不应被字符串猜测掩盖.
 */
export function resolvePerspective(
  kpi: Pick<Kpi, 'bscPerspective' | 'subjectId'>,
  subjects: Pick<KpiSubject, 'id' | 'bscPerspective'>[],
): BscPerspective | undefined {
  if (kpi.bscPerspective) return kpi.bscPerspective;
  const subj = subjects.find((s) => s.id === kpi.subjectId);
  return subj?.bscPerspective;
}

// ---------------------------------------------------------------------------
// 主计算
// ---------------------------------------------------------------------------

const ZERO_BY_PERSPECTIVE = (): Record<BscPerspective, number> => ({
  financial: 0,
  customer: 0,
  process: 0,
  growth: 0,
});

/**
 * 计算 BSC 4 维分布. 按 `weight` 加权 (CHARTER §2 KPI 奖金权重).
 *
 * 注: 仅 `scope=bonus` KPI 计入分布 (`scope=monitor` 是全维度健康监控,
 * 不参与奖金权重配比). 调用方若想看全量, 自行传入未过滤数据.
 */
export function computeBscDistribution(
  kpis: Pick<Kpi, 'bscPerspective' | 'subjectId' | 'weight' | 'scope'>[],
  subjects: Pick<KpiSubject, 'id' | 'bscPerspective'>[],
  options: { onlyBonus?: boolean } = { onlyBonus: true },
): BscDistribution {
  const weightByPerspective = ZERO_BY_PERSPECTIVE();
  const countByPerspective = ZERO_BY_PERSPECTIVE();
  let totalWeight = 0;
  let unclassifiedCount = 0;
  let unclassifiedWeight = 0;

  const filtered = options.onlyBonus
    ? kpis.filter((k) => k.scope === 'bonus')
    : kpis;

  for (const k of filtered) {
    const w = Number.isFinite(k.weight) ? Math.max(0, k.weight) : 0;
    const p = resolvePerspective(k, subjects);
    if (!p) {
      unclassifiedCount += 1;
      unclassifiedWeight += w;
      continue;
    }
    weightByPerspective[p] += w;
    countByPerspective[p] += 1;
    totalWeight += w;
  }

  const byPerspective = ZERO_BY_PERSPECTIVE();
  if (totalWeight > 0) {
    for (const p of BSC_PERSPECTIVES) {
      byPerspective[p] = weightByPerspective[p] / totalWeight;
    }
  }

  return {
    byPerspective,
    countByPerspective,
    weightByPerspective,
    totalWeight,
    unclassifiedCount,
    unclassifiedWeight,
  };
}

// ---------------------------------------------------------------------------
// 健康评估
// ---------------------------------------------------------------------------

/**
 * 评估 BSC 配比健康度.
 *
 * 级别:
 *   - healthy: financial ≤ 50%, 其余 3 维各 ≥ 10%, 无未分类
 *   - warning: 软警告 (financial > 50% 或某维 < 10% 或有未分类), 不阻断
 *   - imbalanced: severe (financial > 70% 或某维 = 0%), setup 页二次确认
 */
export function assessBscBalance(distribution: BscDistribution): BscBalanceReport {
  const issues: BscBalanceIssue[] = [];

  // 边界: 总权重 = 0
  if (distribution.totalWeight === 0) {
    issues.push({
      code: 'no-weights',
      severity: 'warning',
      message: '尚未为 bonus KPI 设置权重, 无法计算 BSC 配比 (CHARTER §2 权重决定奖金分配)',
    });
    return {
      distribution,
      level: 'warning',
      issues,
      canActivateWithoutConfirm: true,
    };
  }

  const { byPerspective, countByPerspective } = distribution;
  const fin = byPerspective.financial;

  // financial 过高
  if (fin > BSC_FINANCIAL_HARD_MAX) {
    issues.push({
      code: 'financial-severe',
      severity: 'severe',
      perspective: 'financial',
      message: `财务维度占 ${pct(fin)}, 超过严重失衡阈值 ${pct(BSC_FINANCIAL_HARD_MAX)} — 退回单一财务考核, 违背 BSC 平衡精神`,
    });
  } else if (fin > BSC_FINANCIAL_SOFT_MAX) {
    issues.push({
      code: 'financial-too-high',
      severity: 'warning',
      perspective: 'financial',
      message: `财务维度占 ${pct(fin)}, 高于建议上限 ${pct(BSC_FINANCIAL_SOFT_MAX)} — 建议补充其他三维 KPI`,
    });
  }

  // 非财务维度过低
  for (const p of BSC_PERSPECTIVES) {
    if (p === 'financial') continue;
    const share = byPerspective[p];
    const count = countByPerspective[p];
    if (count === 0 || share === 0) {
      issues.push({
        code: 'perspective-zero',
        severity: 'severe',
        perspective: p,
        message: `${BSC_PERSPECTIVE[p].label}维度为 0 — BSC 要求四维齐全, 缺位 = 战略盲区`,
      });
    } else if (share < BSC_NON_FINANCIAL_SOFT_MIN) {
      issues.push({
        code: 'perspective-too-low',
        severity: 'warning',
        perspective: p,
        message: `${BSC_PERSPECTIVE[p].label}维度仅占 ${pct(share)}, 低于建议下限 ${pct(BSC_NON_FINANCIAL_SOFT_MIN)}`,
      });
    }
  }

  // 未分类
  if (distribution.unclassifiedCount > 0) {
    issues.push({
      code: 'unclassified-present',
      severity: 'warning',
      message: `${distribution.unclassifiedCount} 个 KPI 未指定 BSC 维度, 建议在科目或 KPI 上补齐 bscPerspective`,
    });
  }

  const hasSevere = issues.some((i) => i.severity === 'severe');
  const level: BscBalanceLevel = hasSevere ? 'imbalanced' : issues.length > 0 ? 'warning' : 'healthy';

  return {
    distribution,
    level,
    issues,
    canActivateWithoutConfirm: !hasSevere,
  };
}

// ---------------------------------------------------------------------------
// 因果链方向 (B-019 前置 helper)
// ---------------------------------------------------------------------------

/**
 * 判断因果链方向是否符合 BSC 原版 (growth → process → customer → financial).
 *
 * `from` 必须严格上游 `to`. 反向 (e.g. financial → growth) 返回 false,
 * 由调用方决定是否走议事室特批.
 */
export function isCausalDirectionValid(from: BscPerspective, to: BscPerspective): boolean {
  if (from === to) return false; // 同维度不算因果, 同维度关联用其他机制
  return (BSC_PERSPECTIVE[from].causalDownstream as readonly BscPerspective[]).includes(to);
}

// ---------------------------------------------------------------------------
// 内部
// ---------------------------------------------------------------------------

function pct(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}
