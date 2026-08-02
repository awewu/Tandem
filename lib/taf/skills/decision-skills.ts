/**
 * 决策图谱只读感知 skill · 中央 AI 的"决策记忆之眼" (Context Graph Phase 1)
 *
 * 让中央 AI / 外部 agent 按需查"围绕某 KR 我们历史上一路是怎么决策的、结果如何"
 * (Foundation Capital "决策先例可搜索" 命题的落地入口)。走 lib/memory/decision-graph.ts
 * 的纯函数装配, 无 LLM、无新 DDL。
 *
 * 纪律: 绿区 · 代行允许 · 纯只读 (不写任何业务真值)。
 * 接线: builtin.ts registerBuiltinSkills() 注册 DecisionTrailSkill; 自动经 MCP Server 暴露。
 */

import type { Skill } from './registry';

export const DecisionTrailSkill: Skill<{ krId: string; limit?: number }, unknown> = {
  id: 'decision.trail',
  description:
    '围绕某 KR 的历史决策先例链: 按时间列出相关决议 (谁拍板/理由/OKR对齐/预期影响/复盘结果) + 决策间的时间与同目标关联, 用于"以前围绕这个目标我们怎么决策的/上次这类事结果如何"',
  tags: ['决策', '决议', '先例', '复盘', 'okr', 'kr', '历史', '因果', 'context-graph'],
  zone: 'green',
  proxyAllowed: true,
  estimatedTokens: 400,
  schema: {
    type: 'function',
    function: {
      name: 'decision_trail',
      description: '查某 KR 的历史决策先例链 (决议 who/why/outcome + 时间/同目标关联)',
      parameters: {
        type: 'object',
        properties: {
          krId: { type: 'string', description: '目标 KR 的 id (决策围绕该 KR 检索)' },
          limit: { type: 'number', description: '最多返回决议节点数 (默认 20)' },
        },
        required: ['krId'],
      },
    },
  },
  async execute({ krId, limit = 20 }, ctx) {
    if (!krId || !krId.trim()) {
      return { ok: false, error: '缺少 krId' };
    }
    const { getStore } = await import('../../storage/repository');
    const { buildKrDecisionTrail } = await import('../../memory/decision-graph');
    const cards = await getStore().decisionCards.list();
    const graph = buildKrDecisionTrail(krId.trim(), cards, { tenantId: ctx.tenantId });

    const nodes = graph.nodes.slice(-Math.max(1, limit)).map((n) => ({
      id: n.id,
      title: n.title,
      at: n.at,
      state: n.state,
      decidedBy: n.decidedBy,
      isProxy: n.isProxy,
      rationale: n.rationale,
      okrAlignment: n.okrAlignment,
      expectedKrImpact: n.expectedKrImpact,
      outcome: n.outcome,
      learning: n.learning,
    }));
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = graph.edges
      .filter((e) => nodeIds.has(e.fromId) && nodeIds.has(e.toId))
      .map((e) => ({ from: e.fromId, to: e.toId, kind: e.kind }));

    return {
      ok: true,
      data: {
        krId: krId.trim(),
        count: nodes.length,
        decisions: nodes,
        links: edges,
      },
      tokensUsed: 120 + nodes.length * 40,
    };
  },
};
