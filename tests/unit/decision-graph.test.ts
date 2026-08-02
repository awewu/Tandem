/**
 * 决策图谱 (Context Graph · Phase 1) 测试
 *
 * 覆盖:
 *   - toDecisionNode: who/why/constraints/provenance/outcome 提取
 *   - buildDecisionGraph: 时间主干 + same_kr 主干; VETOED 排除; committedOnly / tenantId 过滤
 *   - buildKrDecisionTrail: 只取触及某 KR 的决策链 (旗舰先例查询)
 *   - 确定性: 稳定排序
 */

import { describe, it, expect } from 'vitest';
import {
  toDecisionNode,
  buildDecisionGraph,
  buildKrDecisionTrail,
  decisionKrs,
} from '@/lib/memory/decision-graph';
import type { DecisionCard, ConvergenceState } from '@/lib/types/decision-card';

function mkCard(p: Partial<DecisionCard> & { id: string; createdAt: string }): DecisionCard {
  return {
    schemaVersion: 'tandem.v1',
    title: p.title ?? `决议 ${p.id}`,
    decisionClass: p.decisionClass ?? 'simple',
    convergenceState: p.convergenceState ?? 'COMMIT',
    elapsedSeconds: p.elapsedSeconds ?? 60,
    options: p.options ?? [
      {
        id: 'B',
        type: 'AGENT_REASONING',
        description: 'AI 方案',
        reasoning: `理由-${p.id}`,
        confidence: 0.8,
        risk: 'low',
        okrAlignment: '服务',
      },
    ],
    selected: p.selected ?? 'B',
    selectedBy: p.selectedBy,
    actionItems: p.actionItems ?? [],
    createdBy: p.createdBy ?? 'u-creator',
    watermark: p.watermark ?? { isProxy: false },
    ...p,
  } as DecisionCard;
}

describe('decision-graph · toDecisionNode', () => {
  it('提取 who/why/constraints/provenance/outcome', () => {
    const card = mkCard({
      id: 'd1',
      createdAt: '2026-07-01T00:00:00.000Z',
      selectedBy: 'u-boss',
      primaryKrId: 'kr-1',
      relatedKr: ['kr-2'],
      expectedKrImpact: [{ kr: 'kr-1', deltaPp: 5 }],
      options: [
        {
          id: 'B',
          type: 'AGENT_REASONING',
          description: '扩市',
          reasoning: '基于历史增速',
          confidence: 0.9,
          risk: 'medium',
          okrAlignment: '服务',
          servesOkr: '华东扩张',
          citedMemory: ['mem-9'],
        },
      ],
      selected: 'B',
      retrospective: { reviewAt: '2026-08-01T00:00:00.000Z', actualOutcome: '达成', learning: '早投放' },
    });
    const n = toDecisionNode(card);
    expect(n.decidedBy).toBe('u-boss');
    expect(n.rationale).toBe('基于历史增速');
    expect(n.okrAlignment).toBe('服务');
    expect(n.primaryKrId).toBe('kr-1');
    expect(decisionKrs(n).sort()).toEqual(['kr-1', 'kr-2']);
    expect(n.expectedKrImpact).toEqual([{ kr: 'kr-1', deltaPp: 5 }]);
    expect(n.citedMemory).toEqual(['mem-9']);
    expect(n.outcome).toBe('达成');
    expect(n.learning).toBe('早投放');
  });

  it('novelInsight (D 原创) 优先作为 rationale', () => {
    const card = mkCard({
      id: 'd2',
      createdAt: '2026-07-02T00:00:00.000Z',
      options: [
        { id: 'D', type: 'ORIGINAL', description: '原创', confidence: 1, risk: 'low', novelInsight: '换渠道', humanOnly: true },
      ],
      selected: 'D',
    });
    expect(toDecisionNode(card).rationale).toBe('换渠道');
  });
});

describe('decision-graph · buildDecisionGraph', () => {
  const cards = [
    mkCard({ id: 'd1', createdAt: '2026-07-01T00:00:00.000Z', primaryKrId: 'kr-1' }),
    mkCard({ id: 'd2', createdAt: '2026-07-02T00:00:00.000Z', primaryKrId: 'kr-2' }),
    mkCard({ id: 'd3', createdAt: '2026-07-03T00:00:00.000Z', primaryKrId: 'kr-1' }),
  ];

  it('时间主干: 相邻节点 temporal_next (d1→d2→d3)', () => {
    const g = buildDecisionGraph(cards);
    expect(g.nodes.map((n) => n.id)).toEqual(['d1', 'd2', 'd3']);
    const temporal = g.edges.filter((e) => e.kind === 'temporal_next').map((e) => `${e.fromId}->${e.toId}`);
    expect(temporal).toEqual(['d1->d2', 'd2->d3']);
  });

  it('same_kr 主干: 同 KR 相邻决策 (kr-1: d1→d3)', () => {
    const g = buildDecisionGraph(cards);
    const sameKr = g.edges.filter((e) => e.kind === 'same_kr');
    expect(sameKr).toContainEqual(
      expect.objectContaining({ fromId: 'd1', toId: 'd3', kind: 'same_kr', label: 'kr-1' }),
    );
  });

  it('VETOED 排除; committedOnly 只留 COMMIT', () => {
    const mixed = [
      mkCard({ id: 'a', createdAt: '2026-07-01T00:00:00.000Z', convergenceState: 'COMMIT' }),
      mkCard({ id: 'b', createdAt: '2026-07-02T00:00:00.000Z', convergenceState: 'VETOED' }),
      mkCard({ id: 'c', createdAt: '2026-07-03T00:00:00.000Z', convergenceState: 'CONVERGE' as ConvergenceState }),
    ];
    expect(buildDecisionGraph(mixed).nodes.map((n) => n.id)).toEqual(['a', 'c']);
    expect(buildDecisionGraph(mixed, { committedOnly: true }).nodes.map((n) => n.id)).toEqual(['a']);
  });

  it('tenantId 过滤 (缺省字段视作 default)', () => {
    const t = [
      mkCard({ id: 'x', createdAt: '2026-07-01T00:00:00.000Z', tenantId: 'acme' }),
      mkCard({ id: 'y', createdAt: '2026-07-02T00:00:00.000Z' }), // default
    ];
    expect(buildDecisionGraph(t, { tenantId: 'acme' }).nodes.map((n) => n.id)).toEqual(['x']);
    expect(buildDecisionGraph(t, { tenantId: 'default' }).nodes.map((n) => n.id)).toEqual(['y']);
  });
});

describe('decision-graph · buildKrDecisionTrail', () => {
  it('只取触及该 KR 的决策链, same_kr 边限定该 KR', () => {
    const cards = [
      mkCard({ id: 'd1', createdAt: '2026-07-01T00:00:00.000Z', primaryKrId: 'kr-1' }),
      mkCard({ id: 'd2', createdAt: '2026-07-02T00:00:00.000Z', primaryKrId: 'kr-2' }),
      mkCard({ id: 'd3', createdAt: '2026-07-03T00:00:00.000Z', relatedKr: ['kr-1'] }),
    ];
    const trail = buildKrDecisionTrail('kr-1', cards);
    expect(trail.nodes.map((n) => n.id)).toEqual(['d1', 'd3']);
    expect(trail.edges).toContainEqual(
      expect.objectContaining({ fromId: 'd1', toId: 'd3', kind: 'same_kr', label: 'kr-1' }),
    );
    expect(buildKrDecisionTrail('', cards).nodes).toEqual([]);
  });
});
