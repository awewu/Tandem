/**
 * PMS · 经销商价值层聚合 (§3.21 "每个管控配一个经销商价值")
 *
 * 面向外部经销商的自服务价值门户, 一处聚合三件价值可视:
 *   1. 撞单申诉进度可视 (本人申诉 + 仲裁进度)
 *   2. 健康分自查 (考核=自查同源, 最新分 + 环比趋势 + 维度短板)
 *   3. 返利可视 (本 org 计提 + 待结算/已结算汇总)
 *
 * 纯聚合, 复用既有服务; 严格 orgId/appealerId 隔离 (由调用方 requirePmsAuth 传入)。
 */

import { listAppeals } from './duplicate-appeal-service';
import { listHealthScores, healthRank, DEFAULT_HEALTH_WEIGHTS, type HealthDimensions } from './dealer-health-service';
import { listRebateAccruals, listRebatePolicies } from './rebate-service';

// ---------------------------------------------------------------------------
// 纯函数 (可测)
// ---------------------------------------------------------------------------

export interface AppealProgress {
  step: number;
  total: number;
  label: string;
  done: boolean;
  outcome?: 'approved' | 'rejected';
}

/** 申诉状态 → 进度可视 (pending→under_review→approved|rejected) */
export function appealProgress(status: string): AppealProgress {
  switch (status) {
    case 'pending':
      return { step: 1, total: 3, label: '已提交, 待受理', done: false };
    case 'under_review':
      return { step: 2, total: 3, label: '销售管理部仲裁中', done: false };
    case 'approved':
      return { step: 3, total: 3, label: '申诉成立 (撤销撞单)', done: true, outcome: 'approved' };
    case 'rejected':
      return { step: 3, total: 3, label: '维持撞单判定', done: true, outcome: 'rejected' };
    default:
      return { step: 0, total: 3, label: status, done: false };
  }
}

/** 找加权得分最低的维度 (自查短板提示) */
export function weakestDimension(
  dims: HealthDimensions,
  weights = DEFAULT_HEALTH_WEIGHTS,
): { key: keyof HealthDimensions; score: number } | null {
  const entries = (Object.keys(dims) as (keyof HealthDimensions)[]).map((k) => ({
    key: k,
    weighted: dims[k] * (weights[k] ?? 0),
    score: dims[k],
  }));
  if (entries.length === 0) return null;
  entries.sort((a, b) => a.weighted - b.weighted);
  return { key: entries[0].key, score: entries[0].score };
}

// ---------------------------------------------------------------------------
// 聚合装配
// ---------------------------------------------------------------------------

export interface DealerValueData {
  generatedAt: string;
  orgId: string | null;
  appeals: {
    total: number;
    active: number;
    items: Array<{
      id: string;
      duplicateCheckId: string;
      reason: string;
      status: string;
      progress: AppealProgress;
      arbitrationReason?: string;
      createdAt: string;
      arbitratedAt?: string;
    }>;
  };
  health: {
    latest: {
      period: string;
      totalScore: number;
      rank: string;
      dimensions: Record<string, number>;
    } | null;
    deltaFromPrev: number | null;
    weakest: { key: string; score: number } | null;
    history: Array<{ period: string; totalScore: number; rank: string }>;
  };
  rebates: {
    pendingAmount: number;
    settledAmount: number;
    accrualCount: number;
    activePolicies: number;
    items: Array<{
      id: string;
      policyId: string;
      period: string;
      salesAmount: number;
      rebateAmount: number;
      status: string;
      settledAt?: string;
    }>;
  };
}

export async function assembleDealerValue(input: {
  tenantId: string;
  orgId: string | null;
  appealerId: string;
  now?: Date;
}): Promise<DealerValueData> {
  const { tenantId, orgId, appealerId } = input;
  const now = input.now ?? new Date();

  // 1) 撞单申诉进度 (本人)
  const appealRows = await listAppeals({ tenantId, appealerId, limit: 50 });
  const appealItems = appealRows.map((a) => ({
    id: a.id,
    duplicateCheckId: a.duplicateCheckId,
    reason: a.reason,
    status: a.status,
    progress: appealProgress(a.status),
    arbitrationReason: a.arbitrationReason,
    createdAt: a.createdAt,
    arbitratedAt: a.arbitratedAt,
  }));
  const activeAppeals = appealItems.filter((a) => !a.progress.done).length;

  // 2) 健康分自查 (本 org, 最新 + 环比)
  const scoreRows = orgId
    ? await listHealthScores({ tenantId, dealerOrgId: orgId, limit: 12 })
    : [];
  // listHealthScores 按 createdAt desc; 取最新 + 上一期
  const latestRow = scoreRows[0] ?? null;
  const prevRow = scoreRows[1] ?? null;
  const latest = latestRow
    ? {
        period: latestRow.period,
        totalScore: latestRow.totalScore,
        rank: latestRow.rank ?? healthRank(latestRow.totalScore),
        dimensions: (latestRow.dimensions as Record<string, number>) ?? {},
      }
    : null;
  const deltaFromPrev =
    latestRow && prevRow ? Math.round((latestRow.totalScore - prevRow.totalScore) * 10) / 10 : null;
  const weakest =
    latest && latest.dimensions
      ? weakestDimension(latest.dimensions as unknown as HealthDimensions)
      : null;

  // 3) 返利可视 (本 org)
  const accruals = orgId ? await listRebateAccruals(tenantId, { dealerOrgId: orgId }) : [];
  const pendingAmount = accruals
    .filter((a) => a.status !== 'settled')
    .reduce((s, a) => s + a.rebateAmount, 0);
  const settledAmount = accruals
    .filter((a) => a.status === 'settled')
    .reduce((s, a) => s + a.rebateAmount, 0);
  const policies = await listRebatePolicies(tenantId, 'active');

  return {
    generatedAt: now.toISOString(),
    orgId,
    appeals: {
      total: appealItems.length,
      active: activeAppeals,
      items: appealItems,
    },
    health: {
      latest,
      deltaFromPrev,
      weakest: weakest ? { key: weakest.key, score: weakest.score } : null,
      history: scoreRows.map((r) => ({
        period: r.period,
        totalScore: r.totalScore,
        rank: r.rank ?? healthRank(r.totalScore),
      })),
    },
    rebates: {
      pendingAmount: Math.round(pendingAmount * 100) / 100,
      settledAmount: Math.round(settledAmount * 100) / 100,
      accrualCount: accruals.length,
      activePolicies: policies.length,
      items: accruals.map((a) => ({
        id: a.id,
        policyId: a.policyId,
        period: a.period,
        salesAmount: a.salesAmount,
        rebateAmount: a.rebateAmount,
        status: a.status,
        settledAt: a.settledAt,
      })),
    },
  };
}
