/**
 * tests/unit/manifesto.test.ts · 产品定位 SSOT 锁
 *
 * 这是用测试钉住产品灵魂层结构, 防止后续不经 Owner 立宪就被悄悄改.
 */

import { describe, expect, it } from 'vitest';

import {
  IS_SELF_USE_PHASE,
  SELF_USE_FORBIDDEN_TOPICS,
  SELF_USE_SUCCESS_CRITERIA,
  SKILL_GATEWAY_GATES,
  STRATEGIC_RED_LINES,
  TANDEM_INVARIANTS,
  TANDEM_PHASE,
  TANDEM_SOULS,
  TANDEM_TRINITY,
  buildSoulContext,
  tandemPositioningOneLiner,
} from '@/lib/product/manifesto';

describe('product manifesto · SSOT 锁', () => {
  it('当前阶段 = self-use (Owner 2026-05-27 立宪)', () => {
    expect(TANDEM_PHASE).toBe('self-use');
    expect(IS_SELF_USE_PHASE).toBe(true);
  });

  it('灵魂层必须是 6 条 (不可增减不经 Owner 立宪)', () => {
    expect(TANDEM_SOULS).toHaveLength(6);
    expect(TANDEM_SOULS.map((s) => s.id)).toEqual([
      'soul-1', 'soul-2', 'soul-3', 'soul-4', 'soul-5', 'soul-6',
    ]);
  });

  it('4 件不变量都必须挂到一条灵魂', () => {
    const soulIds = TANDEM_SOULS.map((s) => s.id) as string[];
    expect(TANDEM_INVARIANTS).toHaveLength(4);
    for (const inv of TANDEM_INVARIANTS) {
      expect(soulIds).toContain(inv.serves);
      expect(inv.enforceAt).toMatch(/^lib\//);
    }
  });

  it('三元结构 = 事半 / 拿捏 / 搭子', () => {
    expect(Object.keys(TANDEM_TRINITY).sort()).toEqual(['dazi', 'naina', 'shiban']);
    expect(TANDEM_TRINITY.shiban.coupling).toBe('OKR-coupled');
    expect(TANDEM_TRINITY.naina.coupling).toBe('OKR-decoupled');
    expect(TANDEM_TRINITY.dazi.coupling).toBe('gateway');
  });

  it('Skill Gateway 必须是 4 道闸', () => {
    expect(SKILL_GATEWAY_GATES).toHaveLength(4);
    expect(SKILL_GATEWAY_GATES.map((g) => g.id)).toEqual([
      'baseline-guard', 'okr-drift', 'data-scope', 'action-scope',
    ]);
  });

  it('自用阶段成功标准 = 70%/3月 + 80% OKR/议事/1on1 + 50% Persona + ≥3 时间故事', () => {
    expect(SELF_USE_SUCCESS_CRITERIA.weeklyActiveRate).toBeGreaterThanOrEqual(0.7);
    expect(SELF_USE_SUCCESS_CRITERIA.weeklyActiveMonths).toBeGreaterThanOrEqual(3);
    expect(SELF_USE_SUCCESS_CRITERIA.okrConvergence1on1InTandemRate).toBeGreaterThanOrEqual(0.8);
    expect(SELF_USE_SUCCESS_CRITERIA.personaTrainingRate).toBeGreaterThanOrEqual(0.5);
    expect(SELF_USE_SUCCESS_CRITERIA.minTimeSavingStories).toBeGreaterThanOrEqual(3);
  });

  it('自用阶段禁止主动提议的话题至少包含定价/客户获取/多租户', () => {
    expect(SELF_USE_FORBIDDEN_TOPICS).toContain('pricing');
    expect(SELF_USE_FORBIDDEN_TOPICS).toContain('customer-acquisition');
    expect(SELF_USE_FORBIDDEN_TOPICS).toContain('multi-tenant');
  });

  it('战略红线必含: 不集成飞书钉钉企微 / 不做 OA / 不替员工劳动', () => {
    const joined = STRATEGIC_RED_LINES.join('\n');
    expect(joined).toMatch(/飞书|钉钉|企微/);
    expect(joined).toMatch(/OA|审批|考勤/);
    expect(joined).toMatch(/AI 替员工劳动|humanOnly/);
  });

  it('positioning 一句话不许出现 SaaS / pilot / 客户 (自用阶段红线)', () => {
    const line = tandemPositioningOneLiner();
    expect(line).not.toMatch(/SaaS|pilot|客户/i);
    expect(line).toMatch(/事半/);
    expect(line).toMatch(/拿捏/);
    expect(line).toMatch(/搭子/);
  });

  it('buildSoulContext 输出 6 条灵魂全文', () => {
    const ctx = buildSoulContext();
    for (const soul of TANDEM_SOULS) {
      expect(ctx).toContain(soul.title);
    }
  });
});
