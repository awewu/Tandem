/**
 * PMS 写动作接治理链 (evolution #5) 单测。
 *
 * 核心回归: 断言各 PMS ActionType 的 describeIntent **永不被 deriveActionZone 判红** ——
 * 否则 executeAction 对红区永不放行, 连人工内部角色点击都会被拦死 (核心管理流程瘫痪)。
 * 这道断言把「措辞避开红线词 (仲裁/合同/诉讼…)」从注释变成强制不变量。
 */

import { describe, it, expect } from 'vitest';
import { deriveActionZone } from '@/lib/skill-gateway/derive-zone';
import {
  PmsAppealArbitrateAction,
  PmsOpportunityReviewAction,
  ensurePmsActions,
} from '@/lib/ontology/actions/pms-actions';
import { actionRegistry } from '@/lib/ontology/action-types';

function zoneOf(action: { describeIntent: (i: any) => string; declaredActionScope: any }, input: any) {
  return deriveActionZone({
    intent: action.describeIntent(input),
    declaredActionScope: action.declaredActionScope,
  }).zone;
}

describe('PMS ontology actions · 治理链接线', () => {
  it('ensurePmsActions 幂等注册 全部 PMS 动作', () => {
    ensurePmsActions();
    ensurePmsActions();
    expect(actionRegistry.has('pms.appeal.arbitrate')).toBe(true);
    expect(actionRegistry.has('pms.opportunity.review')).toBe(true);
  });

  describe('撞单申诉裁定 · describeIntent 永不判红 (措辞避开「仲裁」红线词)', () => {
    it('decision=approved → yellow, 非 red', () => {
      const z = zoneOf(PmsAppealArbitrateAction, { appealId: 'a1', decision: 'approved' });
      expect(z).not.toBe('red');
      expect(z).toBe('yellow');
    });
    it('decision=rejected → yellow, 非 red', () => {
      const z = zoneOf(PmsAppealArbitrateAction, { appealId: 'a1', decision: 'rejected' });
      expect(z).not.toBe('red');
      expect(z).toBe('yellow');
    });
    it('intent 文本不含红线词 仲裁/合同/诉讼/打款', () => {
      const text = PmsAppealArbitrateAction.describeIntent({ appealId: 'a1', decision: 'approved' } as any);
      expect(text).not.toMatch(/仲裁|合同|诉讼|起诉|打款|付款/);
    });
  });

  describe('商机报备审核 · describeIntent 永不判红', () => {
    it('decision=approved → yellow, 非 red', () => {
      const z = zoneOf(PmsOpportunityReviewAction, { opportunityId: 'o1', decision: 'approved' });
      expect(z).not.toBe('red');
      expect(z).toBe('yellow');
    });
    it('decision=rejected → yellow, 非 red', () => {
      const z = zoneOf(PmsOpportunityReviewAction, { opportunityId: 'o1', decision: 'rejected' });
      expect(z).not.toBe('red');
      expect(z).toBe('yellow');
    });
    it('intent 不含红线词, 且不含 YELLOW「审批通过/审批驳回」精确串', () => {
      const t = PmsOpportunityReviewAction.describeIntent({ opportunityId: 'o1', decision: 'rejected' } as any);
      expect(t).not.toMatch(/仲裁|合同|诉讼|打款/);
      expect(t).not.toMatch(/审批通过|审批驳回/);
    });
    it('validate: 缺 opportunityId / 非法 decision → invalid', async () => {
      const ctx = { actorUserId: 'u1', tenantId: 'default', isProxy: false } as any;
      expect((await PmsOpportunityReviewAction.validate({ decision: 'approved' } as any, ctx)).ok).toBe(false);
      expect((await PmsOpportunityReviewAction.validate({ opportunityId: 'o1', decision: 'x' } as any, ctx)).ok).toBe(false);
    });
  });

  describe('validate · DB 无关的早退分支', () => {
    const ctx = { actorUserId: 'u1', tenantId: 'default', isProxy: false } as any;
    it('缺 appealId → invalid', async () => {
      const r = await PmsAppealArbitrateAction.validate({ decision: 'approved' } as any, ctx);
      expect(r.ok).toBe(false);
      expect(r.code).toBe('invalid');
    });
    it('非法 decision → invalid (早于 DB 查询)', async () => {
      const r = await PmsAppealArbitrateAction.validate(
        { appealId: 'a1', decision: 'maybe' } as any,
        ctx,
      );
      expect(r.ok).toBe(false);
      expect(r.code).toBe('invalid');
    });
  });
});
