/**
 * 本体安全维度 · marking/purpose 门控单测 (Phase 1)。
 *
 * 覆盖: 敏感度等级门控 · 外部主体机密+拒入 · 目的禁止类别 (数据防火墙) ·
 *       未分类保守视 internal · redactByMarking 过滤 · 核心 ObjectType 已打密级。
 */

import { describe, it, expect } from 'vitest';
import {
  canAccess,
  redactByMarking,
  SENSITIVITY_RANK,
  type Marking,
  type AccessContext,
} from '@/lib/ontology/marking';
import { CORE_OBJECT_TYPES } from '@/lib/ontology/object-types';

const ctx = (over: Partial<AccessContext>): AccessContext => ({
  clearance: 'confidential',
  purpose: 'reporting',
  ...over,
});

describe('本体安全维度 · canAccess', () => {
  it('敏感度 ≤ 许可 放行; 超出拒绝', () => {
    expect(canAccess({ sensitivity: 'internal' }, ctx({ clearance: 'internal' })).allow).toBe(true);
    expect(canAccess({ sensitivity: 'confidential' }, ctx({ clearance: 'internal' })).allow).toBe(false);
    expect(canAccess({ sensitivity: 'restricted' }, ctx({ clearance: 'confidential' })).allow).toBe(false);
  });

  it('外部主体不得访问 confidential 及以上 (即便许可够)', () => {
    const r = canAccess({ sensitivity: 'confidential' }, ctx({ clearance: 'restricted', isExternal: true }));
    expect(r.allow).toBe(false);
    expect(r.reason).toMatch(/外部/);
    // 外部访问 internal 仍可
    expect(canAccess({ sensitivity: 'internal' }, ctx({ clearance: 'internal', isExternal: true })).allow).toBe(true);
  });

  it('决策防火墙: personal_growth 恒不得为 治理/OKR感知/报表 目的读取', () => {
    const growth: Marking = { sensitivity: 'confidential', categories: ['personal_growth'] };
    for (const purpose of ['governance', 'okr_perception', 'reporting'] as const) {
      const r = canAccess(growth, ctx({ clearance: 'restricted', purpose }));
      expect(r.allow).toBe(false);
      expect(r.reason).toMatch(/personal_growth|防火墙/);
    }
    // 个人助理目的可读个人成长
    expect(canAccess(growth, ctx({ clearance: 'confidential', purpose: 'personal_assistant' })).allow).toBe(true);
  });

  it('薪酬红线: compensation 不得进 okr_perception / reporting / ai_advice', () => {
    const comp: Marking = { sensitivity: 'confidential', categories: ['compensation'] };
    for (const purpose of ['okr_perception', 'reporting', 'ai_advice'] as const) {
      expect(canAccess(comp, ctx({ clearance: 'restricted', purpose })).allow).toBe(false);
    }
    // 治理目的允许 compensation (走人审流程)
    expect(canAccess(comp, ctx({ clearance: 'confidential', purpose: 'governance' })).allow).toBe(true);
  });

  it('个人助理目的禁 financial/compensation', () => {
    const fin: Marking = { sensitivity: 'confidential', categories: ['financial'] };
    expect(canAccess(fin, ctx({ clearance: 'restricted', purpose: 'personal_assistant' })).allow).toBe(false);
  });

  it('未分类 (无 marking) 保守视为 internal, 非 public', () => {
    // internal 许可可读; public 许可 (rank 0) 不可读未分类
    expect(canAccess(undefined, ctx({ clearance: 'internal' })).allow).toBe(true);
    expect(canAccess(undefined, ctx({ clearance: 'public' })).allow).toBe(false);
  });

  it('SENSITIVITY_RANK 单调递增', () => {
    expect(SENSITIVITY_RANK.public).toBeLessThan(SENSITIVITY_RANK.internal);
    expect(SENSITIVITY_RANK.internal).toBeLessThan(SENSITIVITY_RANK.confidential);
    expect(SENSITIVITY_RANK.confidential).toBeLessThan(SENSITIVITY_RANK.restricted);
  });
});

describe('本体安全维度 · redactByMarking', () => {
  it('过滤掉不可读条目, 返回可读集 + 脱敏计数', () => {
    const items = [
      { id: 'a', m: { sensitivity: 'internal' } as Marking },
      { id: 'b', m: { sensitivity: 'confidential' } as Marking },
      { id: 'c', m: { sensitivity: 'confidential', categories: ['personal_growth'] } as Marking },
    ];
    const { allowed, redactedCount } = redactByMarking(
      items,
      (i) => i.m,
      ctx({ clearance: 'confidential', purpose: 'reporting' }),
    );
    // a(internal) 放行; b(confidential/reporting) 放行; c(personal_growth) 被防火墙拦
    expect(allowed.map((i) => i.id)).toEqual(['a', 'b']);
    expect(redactedCount).toBe(1);
  });
});

describe('本体安全维度 · 核心 ObjectType 已打密级', () => {
  it('每个核心对象类型都带 marking', () => {
    for (const ot of CORE_OBJECT_TYPES) {
      expect(ot.marking, `${ot.id} 缺 marking`).toBeDefined();
    }
  });
  it('Persona=personal_growth · Kpi=financial · DecisionCard=confidential', () => {
    const byId = Object.fromEntries(CORE_OBJECT_TYPES.map((o) => [o.id, o]));
    expect(byId['Persona'].marking?.categories).toContain('personal_growth');
    expect(byId['Kpi'].marking?.categories).toContain('financial');
    expect(byId['DecisionCard'].marking?.sensitivity).toBe('confidential');
  });
});
