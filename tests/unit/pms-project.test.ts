import { describe, it, expect } from 'vitest';
import {
  canTransitionProject,
  deriveStatusFromStage,
  formatProjectCode,
} from '@/lib/pms/project-service';
import {
  decisionChainHealth,
  CRITICAL_ROLES,
} from '@/lib/pms/project-stakeholder-service';
import {
  specCoverage,
  specRiskLevel,
} from '@/lib/pms/spec-position-service';
import type { StakeholderRole, SpecBrandStatus, SpecStage } from '@/lib/types/pms';

describe('PMS project · FSM canTransitionProject', () => {
  it('合法流转', () => {
    expect(canTransitionProject('lead', 'design')).toBe(true);
    expect(canTransitionProject('lead', 'tender')).toBe(true);
    expect(canTransitionProject('design', 'tender')).toBe(true);
    expect(canTransitionProject('tender', 'awarded')).toBe(true);
    expect(canTransitionProject('awarded', 'delivery')).toBe(true);
    expect(canTransitionProject('delivery', 'warranty')).toBe(true);
    expect(canTransitionProject('warranty', 'closed')).toBe(true);
  });
  it('任一非终态可 lost (delivery 之后不可丢标)', () => {
    expect(canTransitionProject('lead', 'lost')).toBe(true);
    expect(canTransitionProject('tender', 'lost')).toBe(true);
    expect(canTransitionProject('awarded', 'lost')).toBe(true);
    expect(canTransitionProject('delivery', 'lost')).toBe(false);
  });
  it('非法流转 + 终态不可再转', () => {
    expect(canTransitionProject('lead', 'awarded')).toBe(false); // 跳阶段
    expect(canTransitionProject('tender', 'delivery')).toBe(false);
    expect(canTransitionProject('closed', 'delivery')).toBe(false);
    expect(canTransitionProject('lost', 'lead')).toBe(false);
    expect(canTransitionProject('unknown', 'lead')).toBe(false);
  });
});

describe('PMS project · deriveStatusFromStage', () => {
  it('awarded 及之后 → won; lost → lost; 其余 active', () => {
    expect(deriveStatusFromStage('lead')).toBe('active');
    expect(deriveStatusFromStage('design')).toBe('active');
    expect(deriveStatusFromStage('tender')).toBe('active');
    expect(deriveStatusFromStage('awarded')).toBe('won');
    expect(deriveStatusFromStage('delivery')).toBe('won');
    expect(deriveStatusFromStage('warranty')).toBe('won');
    expect(deriveStatusFromStage('closed')).toBe('won');
    expect(deriveStatusFromStage('lost')).toBe('lost');
  });
});

describe('PMS project · formatProjectCode', () => {
  it('PJ-YYYYMMDD-<suffix>', () => {
    expect(formatProjectCode(new Date(Date.UTC(2026, 2, 5)), 'abc123')).toBe('PJ-20260305-abc123');
  });
});

describe('PMS · decisionChainHealth (决策链诊断)', () => {
  const sh = (role: StakeholderRole, extra: Partial<{ isChampion: boolean; isEconomicBuyer: boolean }> = {}) => ({
    role, isChampion: !!extra.isChampion, isEconomicBuyer: !!extra.isEconomicBuyer,
  });

  it('空 → 完整度 0, 关键角色全缺', () => {
    const h = decisionChainHealth([]);
    expect(h.totalStakeholders).toBe(0);
    expect(h.completeness).toBe(0);
    expect(h.missingCriticalRoles).toEqual(CRITICAL_ROLES);
    expect(h.hasChampion).toBe(false);
  });

  it('关键角色齐 + 有内线 + 有经济决策人 → 100', () => {
    const h = decisionChainHealth([
      sh('owner', { isEconomicBuyer: true }),
      sh('design_engineer', { isChampion: true }),
      sh('installer'),
    ]);
    expect(h.missingCriticalRoles).toEqual([]);
    expect(h.hasChampion).toBe(true);
    expect(h.hasEconomicBuyer).toBe(true);
    expect(h.completeness).toBe(100);
  });

  it('只有关键角色 (无内线/无EB) → 60', () => {
    const h = decisionChainHealth([sh('owner'), sh('design_engineer'), sh('installer')]);
    expect(h.completeness).toBe(60);
  });

  it('缺一个关键角色 → 角色覆盖 2/3*60=40', () => {
    const h = decisionChainHealth([sh('owner'), sh('design_engineer')]);
    expect(h.missingCriticalRoles).toEqual(['installer']);
    expect(h.completeness).toBe(40);
  });

  it('去重 presentRoles', () => {
    const h = decisionChainHealth([sh('owner'), sh('owner'), sh('installer')]);
    expect(h.presentRoles.sort()).toEqual(['installer', 'owner']);
    expect(h.totalStakeholders).toBe(3);
  });
});

describe('PMS · specCoverage (规格战况)', () => {
  const p = (ourBrandStatus: SpecBrandStatus, estimatedValue: number) => ({ ourBrandStatus, estimatedValue });

  it('聚合 won/atRisk/lost 预算 + specWinRate', () => {
    const c = specCoverage([
      p('basis_of_design', 500000),
      p('specified', 300000),
      p('alternate', 200000),
      p('substituted', 100000),
      p('not_specified', 0),
    ]);
    expect(c.totalPositions).toBe(5);
    expect(c.wonValue).toBe(800000); // 500000+300000
    expect(c.atRiskValue).toBe(200000);
    expect(c.lostValue).toBe(100000);
    expect(c.totalValue).toBe(1100000);
    expect(c.atRiskCount).toBe(1);
    expect(c.specWinRate).toBe(72.7); // 800000/1100000
  });

  it('空 → 全 0, winRate 0', () => {
    const c = specCoverage([]);
    expect(c.totalValue).toBe(0);
    expect(c.specWinRate).toBe(0);
  });

  it('缺 estimatedValue 视为 0', () => {
    const c = specCoverage([{ ourBrandStatus: 'specified' }]);
    expect(c.wonValue).toBe(0);
    expect(c.specWinRate).toBe(0);
  });
});

describe('PMS · specRiskLevel', () => {
  const p = (ourBrandStatus: SpecBrandStatus, specStage: SpecStage, competitorBrand?: string) => ({
    ourBrandStatus, specStage, competitorBrand,
  });
  it('设计基准无竞品 → low; 有竞品 → medium', () => {
    expect(specRiskLevel(p('basis_of_design', 'design'))).toBe('low');
    expect(specRiskLevel(p('basis_of_design', 'design', '大金'))).toBe('medium');
  });
  it('已指定 design → low; tender → medium', () => {
    expect(specRiskLevel(p('specified', 'design'))).toBe('low');
    expect(specRiskLevel(p('specified', 'tender'))).toBe('medium');
  });
  it('备选/未指定 → high; 被替换/丢失 → lost', () => {
    expect(specRiskLevel(p('alternate', 'tender'))).toBe('high');
    expect(specRiskLevel(p('not_specified', 'design'))).toBe('high');
    expect(specRiskLevel(p('substituted', 'tender'))).toBe('lost');
    expect(specRiskLevel(p('lost', 'awarded'))).toBe('lost');
  });
});
