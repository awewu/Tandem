import { describe, it, expect } from 'vitest';
import {
  extractJsonObject,
  clampScore,
  scoreToLevel,
  toStringArray,
  toDeadlineArray,
  buildSpecRiskBaseline,
  buildDecisionChainBaseline,
  ruleActionForException,
} from '@/lib/pms/ai-service';
import type {
  SpecPosition,
  SpecCoverage,
  DecisionChainHealth,
  ProjectStakeholder,
} from '@/lib/types/pms';

describe('pms-ai · extractJsonObject', () => {
  it('parses plain JSON', () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });
  it('strips ```json fences', () => {
    expect(extractJsonObject('```json\n{"a":2}\n```')).toEqual({ a: 2 });
  });
  it('extracts JSON embedded in explanation text', () => {
    expect(extractJsonObject('分析如下:\n{"riskScore":80}\n完毕')).toEqual({ riskScore: 80 });
  });
  it('returns null on invalid input', () => {
    expect(extractJsonObject('no json here')).toBeNull();
    expect(extractJsonObject('')).toBeNull();
    expect(extractJsonObject('{broken')).toBeNull();
  });
});

describe('pms-ai · ruleActionForException (驾驶舱建议规则基线/LLM兜底)', () => {
  it('已知异常类型返回专属动作 (动词开头)', () => {
    expect(ruleActionForException('spec_at_risk')).toContain('设计');
    expect(ruleActionForException('tender_deadline')).toContain('标书');
    expect(ruleActionForException('contract_backlog')).toContain('审批');
  });
  it('未知类型回退到通用动作', () => {
    expect(ruleActionForException('unknown_type')).toBe('查看详情并处理');
  });
});

describe('pms-ai · clampScore / scoreToLevel', () => {
  it('clamps to 0-100 integer', () => {
    expect(clampScore(150)).toBe(100);
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(42.6)).toBe(43);
    expect(clampScore('x', 30)).toBe(30);
  });
  it('maps score to level', () => {
    expect(scoreToLevel(10)).toBe('low');
    expect(scoreToLevel(30)).toBe('medium');
    expect(scoreToLevel(60)).toBe('high');
    expect(scoreToLevel(80)).toBe('critical');
  });
});

describe('pms-ai · toStringArray / toDeadlineArray', () => {
  it('filters non-strings and falls back', () => {
    expect(toStringArray(['a', '', 'b', 3], ['fb'])).toEqual(['a', 'b']);
    expect(toStringArray('nope', ['fb'])).toEqual(['fb']);
    expect(toStringArray([], ['fb'])).toEqual(['fb']);
  });
  it('parses deadline objects', () => {
    expect(toDeadlineArray([{ label: '投标截止', date: '2026-08-01' }, { label: '' }, { nope: 1 }])).toEqual([
      { label: '投标截止', date: '2026-08-01' },
    ]);
    expect(toDeadlineArray('bad')).toEqual([]);
  });
});

function spec(partial: Partial<SpecPosition>): SpecPosition {
  return {
    id: partial.id ?? 's1',
    tenantId: 'default',
    projectId: 'p1',
    equipmentFamily: partial.equipmentFamily ?? '冷水机组',
    ourBrandStatus: partial.ourBrandStatus ?? 'not_specified',
    specStage: partial.specStage ?? 'design',
    estimatedValue: partial.estimatedValue,
    competitorBrand: partial.competitorBrand,
    createdBy: 'u1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('pms-ai · buildSpecRiskBaseline', () => {
  it('high exposure + incomplete chain yields high risk', () => {
    const specs = [
      spec({ id: 's1', ourBrandStatus: 'alternate', estimatedValue: 500000 }),
      spec({ id: 's2', ourBrandStatus: 'lost', estimatedValue: 500000 }),
    ];
    const coverage: SpecCoverage = {
      totalPositions: 2,
      wonValue: 0,
      atRiskValue: 500000,
      lostValue: 500000,
      totalValue: 1000000,
      specWinRate: 0,
      atRiskCount: 1,
    };
    const chain: DecisionChainHealth = {
      totalStakeholders: 0,
      presentRoles: [],
      missingCriticalRoles: ['owner', 'design_engineer', 'installer'],
      hasChampion: false,
      hasEconomicBuyer: false,
      completeness: 0,
    };
    const r = buildSpecRiskBaseline(specs, coverage, chain);
    expect(r.source).toBe('rule');
    expect(r.riskScore).toBeGreaterThan(50);
    expect(['high', 'critical']).toContain(r.riskLevel);
    expect(r.positions).toHaveLength(2);
  });

  it('fully specified + complete chain yields low risk', () => {
    const specs = [spec({ id: 's1', ourBrandStatus: 'basis_of_design', estimatedValue: 1000000 })];
    const coverage: SpecCoverage = {
      totalPositions: 1,
      wonValue: 1000000,
      atRiskValue: 0,
      lostValue: 0,
      totalValue: 1000000,
      specWinRate: 100,
      atRiskCount: 0,
    };
    const chain: DecisionChainHealth = {
      totalStakeholders: 3,
      presentRoles: ['owner', 'design_engineer', 'installer'],
      missingCriticalRoles: [],
      hasChampion: true,
      hasEconomicBuyer: true,
      completeness: 100,
    };
    const r = buildSpecRiskBaseline(specs, coverage, chain);
    expect(r.riskScore).toBeLessThan(25);
    expect(r.riskLevel).toBe('low');
  });
});

function sh(partial: Partial<ProjectStakeholder>): ProjectStakeholder {
  return {
    id: partial.id ?? 'sh1',
    tenantId: 'default',
    projectId: 'p1',
    role: partial.role ?? 'owner',
    name: partial.name ?? '张三',
    influence: partial.influence ?? 'medium',
    isChampion: partial.isChampion ?? false,
    isEconomicBuyer: partial.isEconomicBuyer ?? false,
    createdBy: 'u1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('pms-ai · buildDecisionChainBaseline', () => {
  it('flags missing critical roles and champion', () => {
    const chain: DecisionChainHealth = {
      totalStakeholders: 1,
      presentRoles: ['owner'],
      missingCriticalRoles: ['design_engineer', 'installer'],
      hasChampion: false,
      hasEconomicBuyer: false,
      completeness: 20,
    };
    const r = buildDecisionChainBaseline([sh({ role: 'owner' })], chain);
    expect(r.source).toBe('rule');
    expect(r.gaps.some((g) => g.includes('design_engineer'))).toBe(true);
    expect(r.nextBestActions.length).toBeGreaterThan(0);
  });

  it('reports covered chain', () => {
    const chain: DecisionChainHealth = {
      totalStakeholders: 3,
      presentRoles: ['owner', 'design_engineer', 'installer'],
      missingCriticalRoles: [],
      hasChampion: true,
      hasEconomicBuyer: true,
      completeness: 100,
    };
    const r = buildDecisionChainBaseline(
      [sh({ role: 'owner' }), sh({ id: 'sh2', role: 'design_engineer', isChampion: true }), sh({ id: 'sh3', role: 'installer', isEconomicBuyer: true })],
      chain,
    );
    expect(r.gaps).toEqual(['决策链关键角色已覆盖']);
  });
});
