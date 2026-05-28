/**
 * PersonaFeedback · 拿捏闭环 ④ 反馈评分
 *
 * 员工对每条 ProxyAction 的 👍/👎 评价.
 * 直接计入 bossCaptureScore 的多维公式.
 */

export interface PersonaFeedback {
  id: string;
  /** 关联的代行 */
  proxyActionId: string;
  /** 被代行员工 (也是反馈人) */
  userId: string;
  personaId: string;
  tenantId: string;

  kind: 'thumbs_up' | 'thumbs_down';
  /** 可选文字反馈 */
  reason?: string;

  createdAt: string;
}

/** 从最近 N 条反馈计算加权得分 */
export function computeFeedbackScore(
  feedbacks: Pick<PersonaFeedback, 'kind'>[],
  maxBonus = 5
): number {
  if (feedbacks.length === 0) return 0;
  let sum = 0;
  for (const f of feedbacks) {
    sum += f.kind === 'thumbs_up' ? 1 : -1;
  }
  // 归一化到 [-maxBonus, +maxBonus]
  const avg = sum / feedbacks.length; // [-1, 1]
  return Math.round(avg * maxBonus);
}
