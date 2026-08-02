import { describe, it, expect } from 'vitest';
import {
  evaluateCondition,
  ruleMatches,
  computeQuantity,
  resolveProduct,
  validateInputs,
  evaluateSelector,
  type SelectorCatalogProduct,
} from '@/lib/pms/selector-engine';
import type { SelectorRuleSet, SelectorRule } from '@/lib/types/pms';

const catalog: SelectorCatalogProduct[] = [
  { id: 'p1', model: 'RH-60', series: '商用热水', unit: '台', listPrice: 30000, category: '商用', attributes: { power: '60kW' } },
  { id: 'p2', model: 'RH-30', series: '商用热水', unit: '台', listPrice: 18000, attributes: { power: '30kW' } },
  { id: 'p3', model: 'TANK-500', series: '水箱', unit: '个', listPrice: 5000 },
];

describe('evaluateCondition', () => {
  it('numeric comparators', () => {
    expect(evaluateCondition({ field: 'points', op: 'gte', value: 10 }, { points: 12 })).toBe(true);
    expect(evaluateCondition({ field: 'points', op: 'gt', value: 12 }, { points: 12 })).toBe(false);
    expect(evaluateCondition({ field: 'points', op: 'lt', value: 20 }, { points: 12 })).toBe(true);
    expect(evaluateCondition({ field: 'points', op: 'lte', value: 12 }, { points: 12 })).toBe(true);
  });
  it('eq/ne/in/contains/between', () => {
    expect(evaluateCondition({ field: 'type', op: 'eq', value: 'hotel' }, { type: 'hotel' })).toBe(true);
    expect(evaluateCondition({ field: 'type', op: 'ne', value: 'hotel' }, { type: 'factory' })).toBe(true);
    expect(evaluateCondition({ field: 'type', op: 'in', value: ['hotel', 'apartment'] }, { type: 'apartment' })).toBe(true);
    expect(evaluateCondition({ field: 'note', op: 'contains', value: 'GAS' }, { note: 'gas boiler' })).toBe(true);
    expect(evaluateCondition({ field: 'temp', op: 'between', value: [40, 60] }, { temp: 55 })).toBe(true);
    expect(evaluateCondition({ field: 'temp', op: 'between', value: [40, 60] }, { temp: 65 })).toBe(false);
  });
  it('missing field or type mismatch → false (fail-soft)', () => {
    expect(evaluateCondition({ field: 'x', op: 'gte', value: 1 }, {})).toBe(false);
    expect(evaluateCondition({ field: 'x', op: 'gte', value: 1 }, { x: 'abc' })).toBe(false);
  });
});

describe('ruleMatches', () => {
  const rule: SelectorRule = {
    id: 'r1',
    when: [
      { field: 'points', op: 'gte', value: 10 },
      { field: 'type', op: 'eq', value: 'hotel' },
    ],
    product: { matchBy: 'model', model: 'RH-60' },
    quantity: { mode: 'fixed', value: 1 },
  };
  it('all conditions must pass', () => {
    expect(ruleMatches(rule, { points: 12, type: 'hotel' })).toBe(true);
    expect(ruleMatches(rule, { points: 8, type: 'hotel' })).toBe(false);
  });
  it('empty conditions = always match', () => {
    expect(ruleMatches({ ...rule, when: [] }, {})).toBe(true);
  });
});

describe('computeQuantity', () => {
  it('fixed with clamp', () => {
    expect(computeQuantity({ mode: 'fixed', value: 3 }, {})).toBe(3);
    expect(computeQuantity({ mode: 'fixed', value: 0, min: 1 }, {})).toBe(1);
    expect(computeQuantity({ mode: 'fixed', value: 10, max: 5 }, {})).toBe(5);
  });
  it('perInput = ceil(input/divisor)', () => {
    expect(computeQuantity({ mode: 'perInput', inputField: 'points', divisor: 5 }, { points: 12 })).toBe(3);
    expect(computeQuantity({ mode: 'perInput', inputField: 'points', divisor: 5, max: 2 }, { points: 12 })).toBe(2);
  });
  it('invalid input → at least 1', () => {
    expect(computeQuantity({ mode: 'perInput', inputField: 'points', divisor: 5 }, {})).toBe(1);
    expect(computeQuantity({ mode: 'perInput', inputField: 'points', divisor: 0 }, { points: 12 })).toBe(1);
  });
});

describe('resolveProduct', () => {
  it('by catalogId / model (case-insensitive) / attributes', () => {
    expect(resolveProduct({ matchBy: 'catalogId', catalogId: 'p2' }, catalog)?.model).toBe('RH-30');
    expect(resolveProduct({ matchBy: 'model', model: 'rh-60' }, catalog)?.id).toBe('p1');
    expect(resolveProduct({ matchBy: 'attributes', attributes: { power: '30kW' } }, catalog)?.id).toBe('p2');
  });
  it('miss → null', () => {
    expect(resolveProduct({ matchBy: 'model', model: 'NOPE' }, catalog)).toBeNull();
  });
});

describe('validateInputs', () => {
  it('flags missing required fields', () => {
    const w = validateInputs(
      [
        { key: 'points', label: '用水点数', type: 'number', required: true },
        { key: 'note', label: '备注', type: 'text' },
      ],
      { note: 'x' },
    );
    expect(w).toHaveLength(1);
    expect(w[0]).toContain('用水点数');
  });
});

function makeRuleSet(rules: SelectorRule[]): SelectorRuleSet {
  return {
    id: 'rs1',
    tenantId: 'default',
    name: '商用热水选型',
    category: '商用',
    scenario: '酒店',
    systemName: '生活热水系统',
    version: 1,
    status: 'published',
    inputFields: [
      { key: 'demandPoints', label: '用水点数', type: 'number', unit: '点', required: true },
      { key: 'buildingType', label: '建筑类型', type: 'enum' },
    ],
    rules,
    createdBy: 'u1',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

describe('evaluateSelector', () => {
  it('produces a system with resolved items + working conditions', () => {
    const rs = makeRuleSet([
      {
        id: 'r1',
        label: '大点数主机',
        when: [{ field: 'demandPoints', op: 'gte', value: 20 }],
        product: { matchBy: 'model', model: 'RH-60' },
        quantity: { mode: 'perInput', inputField: 'demandPoints', divisor: 20 },
      },
      {
        id: 'r2',
        label: '配套水箱',
        when: [],
        product: { matchBy: 'model', model: 'TANK-500' },
        quantity: { mode: 'fixed', value: 2 },
      },
    ]);
    const res = evaluateSelector(rs, { demandPoints: 40, buildingType: 'hotel' }, catalog);
    expect(res.system.name).toBe('生活热水系统');
    expect(res.system.items).toHaveLength(2);
    const main = res.system.items.find((i) => i.model === 'RH-60')!;
    expect(main.quantity).toBe(2); // ceil(40/20)
    expect(main.listPrice).toBe(30000);
    expect(res.system.workingConditions?.demandPoints).toBe(40);
    expect(res.system.workingConditions?.buildingType).toBe('hotel');
    expect(res.warnings).toHaveLength(0);
  });

  it('merges duplicate products (same catalog id) by summing quantity', () => {
    const rs = makeRuleSet([
      { id: 'r1', when: [], product: { matchBy: 'catalogId', catalogId: 'p3' }, quantity: { mode: 'fixed', value: 1 } },
      { id: 'r2', when: [], product: { matchBy: 'catalogId', catalogId: 'p3' }, quantity: { mode: 'fixed', value: 3 } },
    ]);
    const res = evaluateSelector(rs, { points: 5 }, catalog);
    expect(res.system.items).toHaveLength(1);
    expect(res.system.items[0].quantity).toBe(4);
  });

  it('unresolved product → placeholder line + warning', () => {
    const rs = makeRuleSet([
      { id: 'r1', label: '未入库件', when: [], product: { matchBy: 'model', model: 'GHOST', fallbackModel: '定制机组' }, quantity: { mode: 'fixed', value: 1 } },
    ]);
    const res = evaluateSelector(rs, { points: 5 }, catalog);
    expect(res.system.items[0].model).toBe('定制机组');
    expect(res.system.items[0].productCatalogId).toBeUndefined();
    expect(res.lines[0].resolved).toBe(false);
    expect(res.warnings.some((w) => w.includes('未入库件'))).toBe(true);
  });

  it('no rule matches → empty system + warning', () => {
    const rs = makeRuleSet([
      { id: 'r1', when: [{ field: 'points', op: 'gte', value: 999 }], product: { matchBy: 'model', model: 'RH-60' }, quantity: { mode: 'fixed', value: 1 } },
    ]);
    const res = evaluateSelector(rs, { points: 5 }, catalog);
    expect(res.system.items).toHaveLength(0);
    expect(res.warnings.some((w) => w.includes('无规则命中'))).toBe(true);
  });

  it('missing required input surfaces warning but still evaluates', () => {
    const rs = makeRuleSet([
      { id: 'r1', when: [], product: { matchBy: 'catalogId', catalogId: 'p1' }, quantity: { mode: 'fixed', value: 1 } },
    ]);
    const res = evaluateSelector(rs, {}, catalog);
    expect(res.warnings.some((w) => w.includes('用水点数'))).toBe(true);
    expect(res.system.items).toHaveLength(1);
  });

  it('stopOnMatch halts further rules', () => {
    const rs = makeRuleSet([
      { id: 'r1', when: [], product: { matchBy: 'catalogId', catalogId: 'p1' }, quantity: { mode: 'fixed', value: 1 }, stopOnMatch: true },
      { id: 'r2', when: [], product: { matchBy: 'catalogId', catalogId: 'p2' }, quantity: { mode: 'fixed', value: 1 } },
    ]);
    const res = evaluateSelector(rs, { points: 5 }, catalog);
    expect(res.system.items).toHaveLength(1);
    expect(res.system.items[0].productCatalogId).toBe('p1');
  });
});
