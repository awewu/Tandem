/**
 * 战略合理性感知 skill · 中央 AI 的"战略之眼" (跨仓感知桥, 姿势 B)
 *
 * 破除"中央 AI 看不到 StratOS 战略真值"的孤岛: 让中央 AI 按需拉取
 * StratOS (strat.rhautt.com) 的战略合理性传感器 —— 前提脆弱度 / 硬阻断 /
 * 诊断 crux / StratDiff / Bet-FPA 勾连 —— 融进它的五维感知, 用于季度
 * "战略合理性复盘"的裁决 (persevere / pivot / kill)。
 *
 * 纪律: 绿区 · 代行允许 · 纯只读 (跨系统 HTTP GET, 无副作用)。
 *   - 裁决是"建议", 写回 (kill/pivot) 走人工或 proposeAction 治理, 不在此 skill。
 *   - fail-soft: 未配置端点 / 拉取失败 → ok:false + 诚实告知, 绝不抛。
 *
 * 接线:
 *   1. builtin.ts registerBuiltinSkills() 注册 StrategyValidityDigestSkill
 *   2. company-brain-perception.ts PERCEPTION_TOOLSET 加 'strategy.validity_digest'
 *      + PERCEPTION_TOOL_MARKINGS 标 confidential + shouldPerceive 关键词扩战略
 *   3. env: STRATOS_PERCEPTION_URL + STRATOS_PERCEPTION_TOKEN (与 StratOS 侧一致)
 */

import type { Skill } from './registry';

function perceptionUrl(): string | null {
  return process.env.STRATOS_PERCEPTION_URL?.trim() || null;
}

function perceptionToken(): string | null {
  return process.env.STRATOS_PERCEPTION_TOKEN?.trim() || null;
}

export const StrategyValidityDigestSkill: Skill<Record<string, never>, unknown> = {
  id: 'strategy.validity_digest',
  description:
    '拉取 StratOS 战略合理性传感器: 战略诊断 crux + 硬阻断断言 + 脆弱/失效前提(fragility/failSignal) + Top StratDiff 变化 + 重大 Bet 的 gate/预算勾连 + FPA runway, 用于"战略前提还成不成立/该不该继续/哪条战略在动摇"的季度合理性复盘裁决',
  tags: ['战略', 'stratos', '前提', '假设', '复盘', '合理性', '坚守', '审视', 'crux', '诊断', 'bet', 'runway', 'diff', 'pivot', 'kill'],
  zone: 'green',
  proxyAllowed: true,
  estimatedTokens: 450,
  schema: {
    type: 'function',
    function: {
      name: 'strategy_validity_digest',
      description:
        '查 StratOS 当前战略的合理性真值 (诊断 crux + 硬阻断 + 脆弱/失效前提 + Top 战略差异 + 重大 Bet 勾连 + FPA runway), 用于判断战略前提是否失效/该不该继续坚守',
      parameters: { type: 'object', properties: {} },
    },
  },
  async execute(_args, _ctx) {
    const url = perceptionUrl();
    const token = perceptionToken();
    if (!url || !token) {
      return {
        ok: false,
        error: 'StratOS 战略感知桥未配置 (需 STRATOS_PERCEPTION_URL + STRATOS_PERCEPTION_TOKEN)',
      };
    }

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return {
          ok: false,
          error: `StratOS 感知端点返回 HTTP ${res.status}: ${body.slice(0, 200)}`,
        };
      }

      const digest = (await res.json()) as { ok?: boolean; error?: string } & Record<string, unknown>;
      if (!digest.ok) {
        return { ok: false, error: digest.error ?? 'StratOS 感知端点返回 ok=false' };
      }

      return {
        ok: true,
        data: digest,
        tokensUsed: 200,
        metadata: { source: 'stratos', dataSource: digest.dataSource },
      };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `StratOS 战略感知拉取失败: ${detail}` };
    }
  },
};
