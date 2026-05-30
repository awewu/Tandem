/**
 * Auto Check-in Draft · scope-based 自动草稿
 *
 * A2.1a 重构 (2026-05-10):
 *   - CheckIn 模型从 weekly + krUpdates JSON 改为 scope-based (1 KR 或 1 Objective 一条)
 *   - 本 lib 旧的 LLM 调用代码已删除 (响应模型不再适配); 简化为对每个未达标 KR 生成 1 条 stub 草稿
 *   - 真正的 AI 摘要后续在 /api/okr/checkins/draft 端点重做 (A3 范围)
 *
 * 当前状态: 不是 production wire, 仅作为 type-safe 兼容存根, 等 A3 重写
 */

import { getStore } from '../storage/repository';
import type { CheckIn, KeyResult, Confidence } from '../types/okr-tti';

export interface DraftInput {
  /** 发起人 (User.id) */
  authorId: string;
  /** 限定 cycle (用于过滤 KR) */
  cycleId?: string;
}

function confidenceFromRisk(risk: KeyResult['riskStatus']): Confidence {
  if (risk === 'off_track') return 'off-track';
  if (risk === 'at_risk') return 'at-risk';
  return 'on-track';
}

function progressOfKR(kr: KeyResult): number {
  const span = kr.targetValue - kr.startValue;
  if (span === 0) return kr.currentValue >= kr.targetValue ? 100 : 0;
  const pct = ((kr.currentValue - kr.startValue) / span) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/**
 * 给作者名下未达 70% 的 KR 各生成一条 scope=kr 的 check-in 草稿.
 *
 * @returns 创建出来的 check-in 数组
 */
export async function generateCheckInDraft(input: DraftInput): Promise<CheckIn[]> {
  const store = getStore();

  let ownKrs = (await store.keyResults.list()).filter((kr) => kr.ownerId === input.authorId);
  if (input.cycleId) {
    const objs = await store.objectives.list();
    const cycleObjIds = new Set(
      objs.filter((o) => o.cycleId === input.cycleId).map((o) => o.id)
    );
    ownKrs = ownKrs.filter((kr) => cycleObjIds.has(kr.objectiveId));
  }

  const now = new Date().toISOString();
  const created: CheckIn[] = [];
  for (const kr of ownKrs) {
    const progress = progressOfKR(kr);
    if (progress >= 70) continue; // 健康的不打扰
    const conf = confidenceFromRisk(kr.riskStatus);
    const ci = await store.checkIns.create({
      scope: 'kr',
      scopeId: kr.id,
      authorId: input.authorId,
      progressBefore: progress,
      progressAfter: progress,
      confidenceBefore: conf,
      confidenceAfter: conf,
      achievements: null,
      blockers: '(草稿) 本周进展低于预期, 请补充阻碍说明.',
      nextSteps: null,
      mood: null,
      createdAt: now,
    });
    created.push(ci);
  }
  return created;
}

