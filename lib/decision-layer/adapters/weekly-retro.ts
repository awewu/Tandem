/**
 * Weekly Retro Adapter · 周回顾 3+1 (P1 接入)
 *
 * 周五员工写本周回顾时, AI 给 4 种"下周押注方向":
 *   A: SOP (沿用上周成功路径)
 *   B: LLM 推演 (基于本周日报 + KR 进度)
 *   C: 历史案例 (类似情境员工/同事过去做过什么)
 *   D: 员工自创 (humanOnly=true)
 */

import { ThreePlusOneEngine, type DecisionContext, type MemoryRetriever, type OptionGenerationResult } from '../three-plus-one-engine';
import type { TandemRouter } from '../../taf/router';

export interface WeeklyRetroContext {
  retroId: string;
  weekIso: string;        // e.g. "2026-W22"
  /** 本周 7 篇日报摘要 */
  weeklyDigest: string;
  /** 本周关注的 KR 状态 */
  krStatuses: { krId: string; krTitle: string; progressDelta: number }[];
  actorUserId: string;
}

export async function generateWeeklyRetroOptions(
  router: TandemRouter,
  retriever: MemoryRetriever,
  ctx: WeeklyRetroContext
): Promise<OptionGenerationResult> {
  const engine = new ThreePlusOneEngine(router, retriever);
  const decisionCtx: DecisionContext = {
    cardId: ctx.retroId,
    title: `${ctx.weekIso} 周回顾 + 下周押注`,
    description: `本周日报摘要:\n${ctx.weeklyDigest}\n\nKR 状态:\n${ctx.krStatuses
      .map((k) => `- ${k.krTitle}: ${k.progressDelta >= 0 ? '+' : ''}${k.progressDelta}%`)
      .join('\n')}\n\n请给出下周聚焦建议.`,
    relatedKrTitles: ctx.krStatuses.map((k) => k.krTitle),
    actorUserId: ctx.actorUserId,
    scenario: 'weekly_retro',
  };
  return engine.generateOptions(decisionCtx);
}
