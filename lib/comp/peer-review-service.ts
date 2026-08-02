/**
 * 他评 (peer review) 服务 (PRD §7.1-7.2) — 直连 typed 表
 *
 * 4 位评议人各 10% (Σ=40%), 半自选半指派, 去极值。
 * 评议人指派 + 评分提交 + 去极值聚合。
 */

import { and, eq } from 'drizzle-orm';
import { db } from '../infra/drizzle-client';
import { compGradeReview } from '../infra/drizzle-schema';

export interface PeerAssignment {
  tenantId: string;
  employeeId: string;
  cycle: string;
  /** 评议人 ID 列表 (4 位) */
  reviewerIds: string[];
  /** 半自选 (员工提名) */
  nominatedBy: string[];
  /** 半指派 (上级/系统指派) */
  assignedBy: string[];
}

export interface PeerScoreInput {
  tenantId: string;
  employeeId: string;
  cycle: string;
  reviewerId: string;
  score: number;
  comment?: string;
}

export interface PeerScoreResult {
  /** 去极值后的均值 */
  peerScore: number;
  /** 有效评议人数 */
  effectiveCount: number;
  /** 被去掉的最高分 */
  droppedHigh: number | null;
  /** 被去掉的最低分 */
  droppedLow: number | null;
  /** 原始评分列表 */
  rawScores: number[];
}

/** 提交他评分数 (存入 review 的 snapshot 字段) */
export async function submitPeerScore(input: PeerScoreInput): Promise<void> {
  const reviews = await db
    .select()
    .from(compGradeReview)
    .where(
      and(
        eq(compGradeReview.tenantId, input.tenantId),
        eq(compGradeReview.employeeId, input.employeeId),
        eq(compGradeReview.cycle, input.cycle),
      ),
    );

  const review = reviews[0];
  if (!review) throw new Error('review not found');

  const snapshot = (review.snapshot as Record<string, unknown> | null) ?? {};
  const peerScores = (snapshot.peerScores as Record<string, number> | null) ?? {};
  peerScores[input.reviewerId] = input.score;

  await db
    .update(compGradeReview)
    .set({
      snapshot: { ...snapshot, peerScores },
    })
    .where(eq(compGradeReview.id, review.id));
}

/** 去极值聚合 (4 人去掉最高最低, 取均值; <3 人全保留) */
export function aggregatePeerScores(scores: number[]): PeerScoreResult {
  const valid = scores.filter((s) => typeof s === 'number' && !isNaN(s) && s >= 0 && s <= 1);

  if (valid.length < 3) {
    return {
      peerScore: valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0,
      effectiveCount: valid.length,
      droppedHigh: null,
      droppedLow: null,
      rawScores: valid,
    };
  }

  const sorted = [...valid].sort((a, b) => a - b);
  const droppedLow = sorted[0];
  const droppedHigh = sorted[sorted.length - 1];
  const middle = sorted.slice(1, -1);
  const peerScore = middle.reduce((a, b) => a + b, 0) / middle.length;

  return {
    peerScore,
    effectiveCount: middle.length,
    droppedHigh,
    droppedLow,
    rawScores: valid,
  };
}

/** 从 review snapshot 读取他评分数并聚合 */
export async function getPeerScore(
  tenantId: string,
  employeeId: string,
  cycle: string,
): Promise<PeerScoreResult> {
  const reviews = await db
    .select()
    .from(compGradeReview)
    .where(
      and(
        eq(compGradeReview.tenantId, tenantId),
        eq(compGradeReview.employeeId, employeeId),
        eq(compGradeReview.cycle, cycle),
      ),
    );

  const review = reviews[0];
  if (!review) {
    return { peerScore: 0, effectiveCount: 0, droppedHigh: null, droppedLow: null, rawScores: [] };
  }

  const snapshot = (review.snapshot as Record<string, unknown> | null) ?? {};
  const peerScores = (snapshot.peerScores as Record<string, number> | null) ?? {};
  const scores = Object.values(peerScores);

  return aggregatePeerScores(scores);
}
