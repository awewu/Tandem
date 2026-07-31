/**
 * 本体安全维度 Phase 3 · executeAction 按 objectType marking 门控写动作。
 *
 * 关键断言:
 *   ① 零行为变更: 内部主体 (缺省 clearance='restricted') 写 confidential 对象 → 放行。
 *   ② 外部主体写 confidential+ 对象 → 门控拦截 (stage=gate, marking reason)。
 *   ③ 决策防火墙: 写 personal_growth 对象 (governance 目的) → 恒拦 (即便内部)。
 *   ④ objectType 未注册 → marking undefined → 保守 internal → 内部主体放行。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { executeAction } from '@/lib/ontology/execute-action';
import { actionRegistry, type ActionType, type ActionContext } from '@/lib/ontology/action-types';
import { ontology } from '@/lib/ontology/registry';
import type { ObjectType } from '@/lib/ontology/types';

const SecretObjectType: ObjectType<{ id: string }> = {
  id: 'TestSecret',
  label: 'Test 机密对象',
  resolve: async (id) => ({ id }),
  search: async () => [],
  links: [],
  marking: { sensitivity: 'confidential' },
};

const GrowthObjectType: ObjectType<{ id: string }> = {
  id: 'TestGrowth',
  label: 'Test 个人成长对象',
  resolve: async (id) => ({ id }),
  search: async () => [],
  links: [],
  marking: { sensitivity: 'confidential', categories: ['personal_growth'] },
};

let executed = 0;
function makeAction(id: string, objectType: string): ActionType<{ id: string }, { ok: true }> {
  return {
    id,
    objectType,
    label: `写 ${objectType}`,
    declaredActionScope: 'commit',
    describeIntent: () => `更新 ${objectType}`,
    validate: () => ({ ok: true, errors: [] }),
    execute: async () => {
      executed += 1;
      return { ok: true };
    },
    sideEffects: [],
  };
}

const ctx = (over: Partial<ActionContext>): ActionContext => ({
  actorUserId: 'u1',
  isProxy: false,
  tenantId: 'default',
  ...over,
});

describe('executeAction · 本体安全维度写动作门控', () => {
  beforeEach(() => {
    executed = 0;
    ontology.register(SecretObjectType);
    ontology.register(GrowthObjectType);
    actionRegistry.register(makeAction('test.write_secret', 'TestSecret'));
    actionRegistry.register(makeAction('test.write_growth', 'TestGrowth'));
    actionRegistry.register(makeAction('test.write_unregistered', 'TestUnregisteredType'));
  });
  afterEach(() => {
    actionRegistry.unregister('test.write_secret');
    actionRegistry.unregister('test.write_growth');
    actionRegistry.unregister('test.write_unregistered');
    ontology.unregister('TestSecret');
    ontology.unregister('TestGrowth');
  });

  it('① 内部主体写 confidential 对象 → 放行 (零行为变更)', async () => {
    const r = await executeAction('test.write_secret', { id: 'x' }, ctx({}));
    expect(r.ok).toBe(true);
    expect(executed).toBe(1);
  });

  it('② 外部主体写 confidential+ 对象 → 门控拦截', async () => {
    const r = await executeAction('test.write_secret', { id: 'x' }, ctx({ isExternal: true }));
    expect(r.ok).toBe(false);
    expect(r.blocked?.stage).toBe('gate');
    expect(r.blocked?.reasons.join()).toMatch(/本体安全维度|外部/);
    expect(executed).toBe(0);
  });

  it('③ 决策防火墙: 写 personal_growth 对象 (governance) → 恒拦 (即便内部)', async () => {
    const r = await executeAction('test.write_growth', { id: 'x' }, ctx({}));
    expect(r.ok).toBe(false);
    expect(r.blocked?.stage).toBe('gate');
    expect(r.blocked?.reasons.join()).toMatch(/personal_growth|防火墙/);
    expect(executed).toBe(0);
  });

  it('④ objectType 未注册 → 保守 internal → 内部主体放行', async () => {
    const r = await executeAction('test.write_unregistered', { id: 'x' }, ctx({}));
    expect(r.ok).toBe(true);
    expect(executed).toBe(1);
  });

  it('⑤ 外部主体写未注册 (保守 internal) 对象 → 放行 (internal 非机密)', async () => {
    const r = await executeAction('test.write_unregistered', { id: 'x' }, ctx({ isExternal: true }));
    expect(r.ok).toBe(true);
  });
});
