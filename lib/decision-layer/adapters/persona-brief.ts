/**
 * Persona Brief Adapter · 主分身 brief 推荐 3+1 (P1 接入)
 *
 * 主分身 brief 不是给 4 个执行方案, 而是给 4 个"先做哪一项"建议:
 *   A: SOP (按 OKR 优先级排序, 紧急 KR 先)
 *   B: LLM 推演 (考虑日程 + IM backlog + 卡点)
 *   C: 历史案例 (你过去类似日子怎么做)
 *   D: 员工自己拍 (humanOnly=true)
 */

import { ThreePlusOneEngine, type DecisionContext, type MemoryRetriever, type OptionGenerationResult } from '../three-plus-one-engine';
import type { TandemRouter } from '../../taf/router';

export interface PersonaBriefContext {
  briefId: string;
  /** 待推进项: KR/TTI/议事 backlog/学习必修 */
  pendingItems: { kind: string; title: string; urgency: 'low' | 'medium' | 'high' }[];
  actorUserId: string;
}

export async function generatePersonaBriefOptions(
  router: TandemRouter,
  retriever: MemoryRetriever,
  ctx: PersonaBriefContext
): Promise<OptionGenerationResult> {
  const engine = new ThreePlusOneEngine(router, retriever);
  const itemsText = ctx.pendingItems
    .map((it) => `- [${it.urgency}] ${it.kind}: ${it.title}`)
    .join('\n');

  const decisionCtx: DecisionContext = {
    cardId: ctx.briefId,
    title: '主分身今日 brief · 先做哪一项',
    description: `我的待推进:\n${itemsText}\n\n请给出"今天先做哪一项"的 4 种推荐 (A/B/C/D).`,
    actorUserId: ctx.actorUserId,
    scenario: 'persona_brief',
  };
  return engine.generateOptions(decisionCtx);
}
