/**
 * PMS 选型配置校验 (纯函数) 单测
 */

import { describe, it, expect } from 'vitest';
import {
  validateInputFields,
  validateRules,
  validateRuleSetConfig,
} from '@/lib/pms/selector-validate';
import type { SelectorInputField, SelectorRule } from '@/lib/types/pms';

describe('validateInputFields', () => {
  it('合法字段通过', () => {
    const fields: SelectorInputField[] = [
      { key: 'a', label: '甲', type: 'number' },
      { key: 'b', label: '乙', type: 'enum', options: [{ value: 'x', label: 'X' }] },
    ];
    expect(validateInputFields(fields)).toEqual([]);
  });

  it('缺 key / 重复 key / 缺 label / 类型非法 / enum 缺 options 均报错', () => {
    const errs = validateInputFields([
      { key: '', label: '空键', type: 'number' },
      { key: 'a', label: '甲', type: 'number' },
      { key: 'a', label: '重复', type: 'number' },
      { key: 'c', label: '', type: 'text' },
      // @ts-expect-error 故意非法类型
      { key: 'd', label: '丁', type: 'weird' },
      { key: 'e', label: '戊', type: 'enum' },
    ]);
    expect(errs.length).toBeGreaterThanOrEqual(5);
    expect(errs.some((e) => e.includes('重复'))).toBe(true);
    expect(errs.some((e) => e.includes('options'))).toBe(true);
  });
});

describe('validateRules', () => {
  const keys = new Set(['demandPoints']);

  it('合法规则通过', () => {
    const rules: SelectorRule[] = [
      { id: 'r1', when: [{ field: 'demandPoints', op: 'gte', value: 20 }], product: { matchBy: 'model', model: 'M' }, quantity: { mode: 'perInput', inputField: 'demandPoints', divisor: 20 } },
    ];
    expect(validateRules(rules, keys)).toEqual([]);
  });

  it('重复 id / 条件引用未知字段 / 运算符非法 / in 值非数组 报错', () => {
    const errs = validateRules(
      [
        { id: 'r1', when: [], product: { matchBy: 'model', model: 'M' }, quantity: { mode: 'fixed', value: 1 } },
        { id: 'r1', when: [{ field: 'ghost', op: 'gte', value: 1 }], product: { matchBy: 'model', model: 'M' }, quantity: { mode: 'fixed', value: 1 } },
        // @ts-expect-error 非法运算符
        { id: 'r2', when: [{ field: 'demandPoints', op: 'weird', value: 1 }], product: { matchBy: 'model', model: 'M' }, quantity: { mode: 'fixed', value: 1 } },
        { id: 'r3', when: [{ field: 'demandPoints', op: 'in', value: 5 as unknown as number[] }], product: { matchBy: 'model', model: 'M' }, quantity: { mode: 'fixed', value: 1 } },
      ],
      keys,
    );
    expect(errs.some((e) => e.includes('id 重复'))).toBe(true);
    expect(errs.some((e) => e.includes('ghost'))).toBe(true);
    expect(errs.some((e) => e.includes('运算符'))).toBe(true);
    expect(errs.some((e) => e.includes('必须是数组'))).toBe(true);
  });

  it('product matchBy 与字段不匹配报错', () => {
    const errs = validateRules(
      [
        { id: 'r1', when: [], product: { matchBy: 'catalogId' }, quantity: { mode: 'fixed', value: 1 } },
        { id: 'r2', when: [], product: { matchBy: 'model' }, quantity: { mode: 'fixed', value: 1 } },
        { id: 'r3', when: [], product: { matchBy: 'attributes', attributes: {} }, quantity: { mode: 'fixed', value: 1 } },
      ],
      keys,
    );
    expect(errs.length).toBe(3);
  });

  it('quantity fixed 缺 value / perInput 引用未知字段报错', () => {
    const errs = validateRules(
      [
        { id: 'r1', when: [], product: { matchBy: 'model', model: 'M' }, quantity: { mode: 'fixed' } },
        { id: 'r2', when: [], product: { matchBy: 'model', model: 'M' }, quantity: { mode: 'perInput', inputField: 'nope' } },
      ],
      keys,
    );
    expect(errs.length).toBe(2);
  });
});

describe('validateRuleSetConfig', () => {
  it('汇总字段+规则错误; 规则引用的字段以传入 inputFields 为准', () => {
    const errs = validateRuleSetConfig(
      [{ key: 'demandPoints', label: '点数', type: 'number' }],
      [{ id: 'r1', when: [{ field: 'demandPoints', op: 'gte', value: 1 }], product: { matchBy: 'model', model: 'M' }, quantity: { mode: 'fixed', value: 1 } }],
    );
    expect(errs).toEqual([]);
  });

  it('空配置合法 (草稿可空)', () => {
    expect(validateRuleSetConfig([], [])).toEqual([]);
  });
});
