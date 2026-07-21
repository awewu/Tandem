/**
 * Off-Topic Nudge · 闲聊软引导 (中央 AI 回复后置 · 可开关, 默认关)
 *
 * 员工与中央 AI 聊与工作无关的话题 (中午吃啥/周末去哪) 时, 系统按现有设计"友好放行"
 * (感知/行动/出口裁判全绕行, 秒回省算力)。本模块提供一个**可选**的轻量引导:
 * 在这类回复末尾附一句软提示 (如"聊得开心~ 需要看看你这周 KR 进度吗?"), 把话题轻轻带回工作。
 *
 * 设计:
 *   - 默认关 (aiSettings.offTopicNudgeEnabled !== true → 不注入), 避免打扰。
 *   - 话术可在 Admin AI 配置页自定义 (offTopicNudgeText), 留空用默认。
 *   - 纯函数 buildOffTopicNudge 便于单测; maybeOffTopicNudge 读 DB 配置 (fail-soft)。
 *   - "off-topic" 判定由调用方给出: 快道 (非复杂/决策类) 或出口裁判 alignment==='无关'。
 */

export const DEFAULT_OFF_TOPIC_NUDGE = '聊得开心～ 顺便，需要我帮你看看这周的 KR 进度吗？';

/**
 * 纯函数: 按开关 + 是否 off-topic 决定要不要附引导脚注。
 * 返回可直接拼到回复末尾的脚注串 (含前导空行), 不需要则返回空串。
 */
export function buildOffTopicNudge(opts: {
  enabled: boolean;
  offTopic: boolean;
  customText?: string;
}): string {
  if (!opts.enabled || !opts.offTopic) return '';
  const text = (opts.customText ?? '').trim() || DEFAULT_OFF_TOPIC_NUDGE;
  return `\n\n_💬 ${text}_`;
}

/**
 * 读 aiSettings 得到闲聊引导配置 (DB 覆盖 env, fail-soft 关闭).
 */
export async function getOffTopicNudgeConfig(
  tenantId?: string,
): Promise<{ enabled: boolean; text: string }> {
  try {
    const { getAiSettings } = await import('@/lib/settings/ai-settings');
    const s = await getAiSettings(tenantId);
    return {
      enabled: s.offTopicNudgeEnabled === true,
      text: (s.offTopicNudgeText ?? '').trim() || DEFAULT_OFF_TOPIC_NUDGE,
    };
  } catch {
    return { enabled: false, text: DEFAULT_OFF_TOPIC_NUDGE };
  }
}

/**
 * 出口便捷函数: 给定"这条回复是否 off-topic", 读配置并返回要附加的引导脚注 (或空串)。
 * 供 BossAI stream / IM 中央AI 出口复用, fail-soft 永不抛。
 */
export async function maybeOffTopicNudge(offTopic: boolean, tenantId?: string): Promise<string> {
  if (!offTopic) return '';
  try {
    const cfg = await getOffTopicNudgeConfig(tenantId);
    return buildOffTopicNudge({ enabled: cfg.enabled, offTopic, customText: cfg.text });
  } catch {
    return '';
  }
}
