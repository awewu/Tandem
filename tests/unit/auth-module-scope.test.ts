/**
 * Module Scope · 三板块边界守卫测试
 */

import { describe, it, expect } from 'vitest';
import { canAccessPath, pillarOf } from '@/lib/auth/module-scope';

describe('pillarOf', () => {
  it.each([
    ['/okr/cascade', 'shiban'],
    ['/retros/me', 'shiban'],
    ['/1on1', 'shiban'],
    ['/360', 'shiban'],
    ['/convergence/abc', 'shiban'],
    ['/api/objectives', 'shiban'],
    ['/api/key-results/x', 'shiban'],
    ['/persona/profile', 'naba'],
    ['/agents', 'naba'],
    ['/api/persona/x', 'naba'],
    ['/im/channel-1', 'dazi'],
    ['/docs/abc', 'dazi'],
    ['/calendar', 'dazi'],
    ['/learning/onboarding', 'dazi'],
    ['/intranet', 'dazi'],
    ['/api/im/messages', 'dazi'],
    ['/settings', 'system'],
    ['/admin/user-applications', 'system'],
    ['/api/admin/foo', 'system'],
    ['/login', 'system'],
  ])('%s → %s', (path, want) => {
    expect(pillarOf(path)).toBe(want);
  });
});

describe('canAccessPath', () => {
  it('内部员工 → 全板块通', () => {
    expect(canAccessPath(['employee'], '/okr/x')).toBe(true);
    expect(canAccessPath(['manager'], '/persona/y')).toBe(true);
    expect(canAccessPath(['owner'], '/im/z')).toBe(true);
  });

  it('外部 guest → 事半禁, 拿捏/搭子通, system 通', () => {
    expect(canAccessPath(['guest'], '/okr/x')).toBe(false);
    expect(canAccessPath(['guest'], '/api/objectives')).toBe(false);
    expect(canAccessPath(['guest'], '/persona/me')).toBe(true);
    expect(canAccessPath(['guest'], '/im/x')).toBe(true);
    expect(canAccessPath(['guest'], '/settings')).toBe(true);
  });

  it('外部 partner / contractor 同 guest', () => {
    expect(canAccessPath(['partner'], '/okr/x')).toBe(false);
    expect(canAccessPath(['contractor'], '/retros/me')).toBe(false);
    expect(canAccessPath(['partner'], '/docs/x')).toBe(true);
  });

  it('混合内外 → 视为内部 (向上聚合)', () => {
    expect(canAccessPath(['guest', 'employee'], '/okr/x')).toBe(true);
    expect(canAccessPath(['contractor', 'manager'], '/360')).toBe(true);
  });

  it('空 roles → 仅 system 路径放行', () => {
    expect(canAccessPath([], '/okr/x')).toBe(false);
    expect(canAccessPath([], '/persona/y')).toBe(false);
    expect(canAccessPath([], '/settings')).toBe(true);
  });
});
