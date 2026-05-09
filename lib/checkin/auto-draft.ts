/**
 * Auto Check-in Draft · 周 Check-in 自动草稿
 *
 * 每周一早上自动:
 *   1. 拉取上周 KR / TTI 进展
 *   2. 拉取本周关闭的 DecisionCards
 *   3. 调 LLM (高频低成本场景 → 豆包 Pro) 生成草稿
 *   4. 写入 CheckIn (aiDraftGenerated: true, approvedByOwner: false)
 *   5. 推送通知给员工 review
 *
 * 关键: 草稿默认未通过, 必须员工手动确认.
 */

import { getStore } from '../storage/repository';
import { getRouter } from '../boot';
import type { CheckIn } from '../types/okr-tti';

export interface DraftInput {
  ownerId: string;
  cycleId: string;
  /** 本周开始日期 (周一) */
  weekStart: string;
}

export async function generateCheckInDraft(input: DraftInput): Promise<CheckIn> {
  const store = getStore();
  const router = getRouter();

  // 拉取数据
  const ownKrs = (await store.keyResults.list()).filter((kr) => kr.ownerId === input.ownerId);
  const ownTtis = (await store.ttis.list()).filter((t) => t.ownerId === input.ownerId);
  const cards = (await store.decisionCards.list())
    .filter((c) => c.createdBy === input.ownerId)
    .filter((c) => {
      const t = new Date(c.createdAt).getTime();
      const weekTs = new Date(input.weekStart).getTime();
      return t >= weekTs && t < weekTs + 7 * 86400_000;
    });

  // LLM 生成草稿
  let aiText = '';
  try {
    const res = await router.chat({
      scenario: 'high_frequency',
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content: `你是 Tandem 周 Check-in 助手. 任务: 基于本周 KR / TTI / 决议数据, 生成 3 段:
1. whatWentWell: 这周做得好的事 (具体)
2. whatWentWrong: 这周遇到的卡点 (诚实)
3. nextWeekPlan: 下周计划 (聚焦 1-3 件事)

请输出 JSON: {whatWentWell, whatWentWrong, nextWeekPlan}.
注意: 这只是草稿, 员工本人会 review 修改.`,
        },
        {
          role: 'user',
          content: `本周数据:
- KR: ${ownKrs.map((k) => `${k.title} (${k.currentValue}/${k.targetValue})`).join('; ') || '(无)'}
- TTI: ${ownTtis.map((t) => `${t.title} (${(t.completionRate * 100).toFixed(0)}%)`).join('; ') || '(无)'}
- 本周决议: ${cards.map((c) => c.title).join('; ') || '(无)'}`,
        },
      ],
      responseFormat: 'json',
    });
    aiText = typeof res.message.content === 'string' ? res.message.content : '{}';
  } catch (err) {
    aiText = '{}';
  }

  let parsed: { whatWentWell?: string; whatWentWrong?: string; nextWeekPlan?: string } = {};
  try {
    parsed = JSON.parse(aiText);
  } catch {
    /* fallback empty */
  }

  // 创建 CheckIn
  return store.checkIns.create({
    ownerId: input.ownerId,
    cycleId: input.cycleId,
    weekStart: input.weekStart,
    krUpdates: ownKrs.map((k) => ({
      keyResultId: k.id,
      previousValue: k.currentValue,
      newValue: k.currentValue,
    })),
    ttiUpdates: ownTtis.map((t) => ({
      ttiId: t.id,
      previousRate: t.completionRate,
      newRate: t.completionRate,
    })),
    whatWentWell: parsed.whatWentWell,
    whatWentWrong: parsed.whatWentWrong,
    nextWeekPlan: parsed.nextWeekPlan,
    aiDraftGenerated: true,
    approvedByOwner: false,
    createdAt: new Date().toISOString(),
  });
}

/**
 * 员工确认 (autonomy 守门)
 */
export async function approveCheckIn(checkInId: string): Promise<CheckIn> {
  const store = getStore();
  return store.checkIns.update(checkInId, { approvedByOwner: true });
}
