/**
 * TTI Adapter · 任务拆解 3+1 (P1 接入)
 *
 * 员工添加 TTI 时, AI 给 4 种拆法:
 *   A: SOP 标准拆法 (来自项目管理 SOP)
 *   B: LLM 推演 (基于当前 KR + 历史 TTI)
 *   C: 历史案例 (类似 KR 之前怎么拆的)
 *   D: 员工自创 (humanOnly=true)
 */

import { ThreePlusOneEngine, type DecisionContext, type MemoryRetriever, type OptionGenerationResult } from '../three-plus-one-engine';
import type { TandemRouter } from '../../taf/router';

export interface TtiBreakdownContext {
  ttiId: string;
  ttiTitle: string;
  parentKrId: string;
  parentKrTitle: string;
  actorUserId: string;
}

export async function generateTtiBreakdownOptions(
  router: TandemRouter,
  retriever: MemoryRetriever,
  ctx: TtiBreakdownContext
): Promise<OptionGenerationResult> {
  const engine = new ThreePlusOneEngine(router, retriever);
  const decisionCtx: DecisionContext = {
    cardId: ctx.ttiId,
    title: `TTI 拆解: ${ctx.ttiTitle}`,
    description: `把 TTI"${ctx.ttiTitle}"拆成可执行子任务. 关联 KR: ${ctx.parentKrTitle}`,
    relatedKrTitles: [ctx.parentKrTitle],
    actorUserId: ctx.actorUserId,
    scenario: 'tti_breakdown',
  };
  return engine.generateOptions(decisionCtx);
}
