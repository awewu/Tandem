/**
 * Report Adapter · 5min 智能日报 KR 推流前 3+1 (P1 接入)
 *
 * 现状: 5min 日报 → AI 提炼 ActionPlan → 直接推流 KR (单选项, 违反 §2)
 * P1 接入后: AI 提炼 → 4 选项 (SOP / 推演 / 历史相似日报 / 员工自创) → 员工选 → 推流 KR
 *
 * 当前为 stub, P1 阶段实现真接入.
 */

import { ThreePlusOneEngine, type DecisionContext, type MemoryRetriever, type OptionGenerationResult } from '../three-plus-one-engine';
import type { TandemRouter } from '../../taf/router';

export interface ReportExtractContext {
  reportId: string;
  /** 员工原始 3 行进展 */
  rawProgress: string;
  /** 关联 KR id (必填, 事半 §3+1 强制 OKR 锚点) */
  krId: string;
  krTitle: string;
  actorUserId: string;
}

export async function generateReportActionOptions(
  router: TandemRouter,
  retriever: MemoryRetriever,
  ctx: ReportExtractContext
): Promise<OptionGenerationResult> {
  const engine = new ThreePlusOneEngine(router, retriever);
  const decisionCtx: DecisionContext = {
    cardId: ctx.reportId,
    title: `日报推流 KR: ${ctx.krTitle}`,
    description: `员工进展: ${ctx.rawProgress}\n\n请提炼 ActionPlan 并建议 KR 进度推流幅度.`,
    relatedKrTitles: [ctx.krTitle],
    actorUserId: ctx.actorUserId,
    scenario: 'report_extract',
  };
  return engine.generateOptions(decisionCtx);
}
