/**
 * 述职/九宫格评审服务 (PRD §7) — 直连 typed 表
 *
 * 九宫格: 潜力轴(row 1-3) × 绩效轴(col 1-3)
 *   row 1 = 低潜力, row 2 = 中潜力, row 3 = 高潜力
 *   col 1 = 低绩效, col 2 = 中绩效, col 3 = 高绩效
 *
 * 评审结果 outcome 映射:
 *   (3,3) star · (3,2) rising_talent · (3,1) risk_burnout
 *   (2,3) high_performer · (2,2) core · (2,1) plateau
 *   (1,3) mismatch · (1,2) low_engagement · (1,1) must_intervene
 */

import { and, eq } from 'drizzle-orm';
import { db } from '../infra/drizzle-client';
import { compGradeReview } from '../infra/drizzle-schema';

export type ReviewType = 'quarterly_checkin' | 'half_year' | 'annual';
export type ReviewOutcome = 'promote' | 'hold' | 'watch' | 'pip' | 'demote';

export interface GradeReviewInput {
  tenantId: string;
  employeeId: string;
  cycle: string;
  reviewType: ReviewType;
  okrPotentialScore?: number;
  kpiPerformanceScore?: number;
  nineBoxRow?: number;
  nineBoxCol?: number;
  selfScore?: number;
  peerScore?: number;
  managerScore?: number;
  sourceWeights?: { self: number; peer: number; manager: number };
  review360CycleId?: string;
  outcome?: ReviewOutcome;
  snapshot?: unknown;
}

export interface GradeReviewRow {
  id: string;
  tenantId: string;
  employeeId: string;
  cycle: string;
  reviewType: string;
  okrPotentialScore: string | null;
  kpiPerformanceScore: string | null;
  nineBoxRow: number | null;
  nineBoxCol: number | null;
  selfScore: string | null;
  peerScore: string | null;
  managerScore: string | null;
  sourceWeights: unknown;
  review360CycleId: string | null;
  outcome: string | null;
  snapshot: unknown;
  createdAt: Date;
}

/** 九宫格 (row, col) → outcome 映射 */
export function nineBoxOutcome(row: number, col: number): ReviewOutcome {
  const map: Record<string, ReviewOutcome> = {
    '3,3': 'promote',
    '3,2': 'promote',
    '3,1': 'watch',
    '2,3': 'hold',
    '2,2': 'hold',
    '2,1': 'pip',
    '1,3': 'watch',
    '1,2': 'pip',
    '1,1': 'demote',
  };
  return map[`${row},${col}`] ?? 'hold';
}

/** 提交述职评审 (幂等: 同 employee+cycle+reviewType 唯一) */
export async function submitReview(input: GradeReviewInput): Promise<{ id: string; created: boolean }> {
  const id = `review_${input.tenantId}_${input.employeeId}_${input.cycle}_${input.reviewType}`;

  // 检查是否已存在
  const existing = await db
    .select({ id: compGradeReview.id })
    .from(compGradeReview)
    .where(
      and(
        eq(compGradeReview.tenantId, input.tenantId),
        eq(compGradeReview.employeeId, input.employeeId),
        eq(compGradeReview.cycle, input.cycle),
        eq(compGradeReview.reviewType, input.reviewType),
      ),
    )
    .limit(1);

  if (existing[0]) {
    // 更新已有记录
    await db
      .update(compGradeReview)
      .set({
        okrPotentialScore: input.okrPotentialScore?.toString() ?? null,
        kpiPerformanceScore: input.kpiPerformanceScore?.toString() ?? null,
        nineBoxRow: input.nineBoxRow ?? null,
        nineBoxCol: input.nineBoxCol ?? null,
        selfScore: input.selfScore?.toString() ?? null,
        peerScore: input.peerScore?.toString() ?? null,
        managerScore: input.managerScore?.toString() ?? null,
        sourceWeights: input.sourceWeights ?? { self: 0.3, peer: 0.3, manager: 0.4 },
        review360CycleId: input.review360CycleId ?? null,
        outcome: input.outcome ?? (input.nineBoxRow && input.nineBoxCol
          ? nineBoxOutcome(input.nineBoxRow, input.nineBoxCol)
          : null),
        snapshot: input.snapshot ?? {},
      })
      .where(eq(compGradeReview.id, existing[0].id));
    return { id: existing[0].id, created: false };
  }

  await db.insert(compGradeReview).values({
    id,
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    cycle: input.cycle,
    reviewType: input.reviewType,
    okrPotentialScore: input.okrPotentialScore?.toString() ?? null,
    kpiPerformanceScore: input.kpiPerformanceScore?.toString() ?? null,
    nineBoxRow: input.nineBoxRow ?? null,
    nineBoxCol: input.nineBoxCol ?? null,
    selfScore: input.selfScore?.toString() ?? null,
    peerScore: input.peerScore?.toString() ?? null,
    managerScore: input.managerScore?.toString() ?? null,
    sourceWeights: input.sourceWeights ?? { self: 0.3, peer: 0.3, manager: 0.4 },
    review360CycleId: input.review360CycleId ?? null,
    outcome: input.outcome ?? (input.nineBoxRow && input.nineBoxCol
      ? nineBoxOutcome(input.nineBoxRow, input.nineBoxCol)
      : null),
    snapshot: input.snapshot ?? {},
  });

  return { id, created: true };
}

/** 查询员工述职记录 */
export async function listReviews(
  tenantId: string,
  employeeId?: string,
  cycle?: string,
): Promise<GradeReviewRow[]> {
  const rows = await db
    .select()
    .from(compGradeReview)
    .where(eq(compGradeReview.tenantId, tenantId));

  return rows.filter(
    (r) =>
      (!employeeId || r.employeeId === employeeId) &&
      (!cycle || r.cycle === cycle),
  );
}
